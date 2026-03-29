# kly 技术文档

[English](technical.md) | **中文**

> 本文档面向 AI Agent 和开发者，详细说明 kly 的架构、数据流和实现细节。

## 概述

kly 是一个代码仓库文件级索引工具。它为仓库中的每个源文件生成结构化元数据 — 包括名称、描述、imports、exports、symbols 和摘要 — 使 AI Agent 能以最少的 token 消耗定位到正确的文件。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                        CLI                            │
│                    (commander)                        │
├─────────────────────────────────────────────────────┤
│                     Indexer                           │
│                   (编排引擎)                          │
├──────────┬──────────┬──────────┬────────────────────┤
│ Scanner  │ Git      │ Parser   │ LLM Service        │
│ (globby) │(git CLI) │(tree-sitter)│ (pi-ai)         │
├──────────┴──────────┴──────────┴────────────────────┤
│              Database (SQLite)                        │
│         .kly/db/<branch>.db (每分支独立)              │
└─────────────────────────────────────────────────────┘
```

### 入口

| 入口 | 文件           | 用途                 |
| ---- | -------------- | -------------------- |
| 库   | `src/index.ts` | 编程式调用的公开 API |
| CLI  | `src/cli.ts`   | `kly` 命令行工具     |

## 数据流

### Git 感知模式（git 仓库中默认启用）

```
git.ts (检测分支/提交)
  → state.yaml (上次索引的提交?)
    → git diff (仅变更文件)
      → diff-filter.ts (匹配 include/exclude)
        → parser/ (tree-sitter AST)
          → llm/ (生成描述)
            → database.ts (SQLite upsert)
              → state.yaml (更新最后提交)
```

### 经典模式（非 git 或 --full）

```
scanner.ts → hasher.ts (SHA-256 比对) → parser/ (tree-sitter AST) → llm/ (生成描述) → database.ts (SQLite upsert)
```

### 构建流水线步骤

1. **检测** — 检查是否在 git 仓库中；确定分支和当前提交
2. **Diff** — 使用 `git diff --name-status` 在上次索引提交和 HEAD 之间查找变更文件
3. **过滤** — 将 diff 结果匹配 `include`/`exclude` glob 模式
4. **解析** — 使用 tree-sitter AST 提取 imports、exports 和 symbols
5. **LLM** — 将文件内容 + 检测到的 symbols 发送给 LLM 生成元数据
6. **存储** — 将 `FileIndex` 条目 upsert 到每分支的 SQLite 数据库
7. **状态** — 用当前提交哈希更新 `state.yaml`

## 存储层

### SQLite + FTS5

每个分支在 `.kly/db/` 下有独立的 SQLite 数据库：

```
.kly/
  config.yaml                     # LLM 和 glob 设置
  state.yaml                      # 追踪每个分支的最后索引提交
  db/
    main.db                       # main 分支
    feature--auth.db              # feature/auth（/ → --）
    _detached--a1b2c3d4.db        # detached HEAD
    default.db                    # 非 git 仓库
```

**Schema：**

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL,
  imports TEXT NOT NULL DEFAULT '[]',     -- JSON 数组
  exports TEXT NOT NULL DEFAULT '[]',     -- JSON 数组
  symbols TEXT NOT NULL DEFAULT '[]',     -- JSON 数组 {name, kind, description}
  summary TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  indexed_at INTEGER NOT NULL
);

CREATE VIRTUAL TABLE files_fts USING fts5(
  path, name, description, summary, symbols_text,
  content=files, content_rowid=rowid
);

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**为什么选 SQLite 而非 YAML：**

| 维度                | YAML (旧)            | SQLite (当前)             |
| ------------------- | -------------------- | ------------------------- |
| 读取 1 个文件的索引 | 解析整个文件 O(n)    | 主键查询 O(1)             |
| 搜索                | 全量扫描 + JS 打分   | FTS5 全文搜索             |
| 写入单个条目        | 重写整个文件         | UPDATE 单行               |
| 10k 文件仓库        | ~5-10MB YAML，解析慢 | ~2-3MB SQLite，毫秒级查询 |
| 并发安全            | 无                   | WAL 模式，多读单写        |

### 状态文件（`state.yaml`）

```yaml
version: 2
configHash: "sha256..." # include/exclude 配置的哈希
branches:
  main:
    lastCommit: "a1b2c3d4..."
    lastBuilt: 1710700000000
  feature--auth:
    lastCommit: "f6e5d4c3..."
    lastBuilt: 1710700100000
    forkedFrom: main
```

## 核心类型

```typescript
type Language = "typescript" | "javascript" | "swift";

interface FileIndex {
  path: string; // 相对于仓库根目录
  name: string; // LLM 生成的可读名称
  description: string; // 一句话描述
  language: Language;
  imports: string[]; // tree-sitter 提取
  exports: string[]; // tree-sitter 提取
  symbols: SymbolInfo[];
  summary: string; // 2-3 句摘要
  hash: string; // SHA-256，用于增量构建
  indexedAt: number; // 时间戳
}

interface GitDiff {
  added: string[];
  modified: string[];
  deleted: string[];
  renamed: Array<{ from: string; to: string }>;
}

interface GitState {
  version: number;
  configHash: string;
  branches: Record<string, BranchState>;
}

interface BranchState {
  lastCommit: string;
  lastBuilt: number;
  forkedFrom?: string;
}
```

## 设计决策

### SQLite 替代 YAML

索引存储从单一 `.kly/index.yaml` 迁移为每分支独立的 SQLite 数据库。实现 O(1) 文件查询、FTS5 全文搜索、事务写入以及高效的分支隔离。

### Git 感知增量构建

不再对每个文件计算哈希来检测变更（O(全部文件)），而是使用 `git diff` 比较上次索引提交和 HEAD。增量构建变为 O(变更文件) — 对于一般提交几乎瞬时完成。

### 每分支独立数据库

每个 git 分支有自己的 `.db` 文件。切换分支零开销 — 直接打开对应的数据库。新分支可以从父分支的数据库 fork，避免全量重建。

### 多 Provider LLM（pi-ai）

使用 [pi-ai](https://github.com/badlogic/pi-mono) 统一 LLM API。用户可在 `kly init` 时选择任意支持的 provider。

### 交互式 CLI（@clack/prompts）

所有 CLI 用户交互使用 [@clack/prompts](https://github.com/bombshell-dev/clack)，提供现代一致的终端体验。

## 代码规范

- **禁止 `as any` 和 `as unknown`** — 使用正确的类型收窄
- **代码和注释使用英文** — 所有代码、变量名和注释必须使用英文
- **YAML 用于配置** — 配置使用 YAML；索引数据使用 SQLite
- **核心模块 100% 覆盖率阈值** — `vite.config.ts` 对 `coverage.include` 中列出的模块执行 100% 阈值；CLI 入口通过定向 smoke 测试和手工集成验证保障质量

## 模块详解

### Database (`src/database.ts`)

基于 `better-sqlite3` 的 SQLite 存储。提供：

- **CRUD**：`getFile()`、`upsertFile()`、`upsertFiles()`、`removeFile()`、`removeFiles()`
- **FTS5 搜索**：`searchFiles()` — 在 path、name、description、summary、symbols 中全文搜索
- **统计**：`getFileCount()`、`getLanguageStats()`
- **元数据**：`getMetadata()`、`setMetadata()`
- **批量写入**：事务包裹，保证原子性和性能

### Git (`src/git.ts`)

通过 `child_process.execSync` 封装的 Git CLI wrapper：

- `isGitRepo()` — 检测 git 仓库
- `getCurrentBranch()` — 当前分支名（detached HEAD 返回 null）
- `getCurrentCommit()` — 当前 HEAD 提交哈希
- `getChangedFiles()` — 两个提交之间的 `git diff --name-status`
- `isAncestor()` — 验证提交祖先关系（检测 rebase/force-push）
- `getMergeBase()` — 查找分支间的公共祖先
- `branchToDbName()` — 将分支名转换为安全的 db 文件名

### Diff Filter (`src/diff-filter.ts`)

使用 `picomatch` 将 `git diff` 结果按 `include`/`exclude` glob 模式过滤。返回分类列表：`toIndex`、`toDelete`、`renamed`。

### Store (`src/store.ts`)

分支感知的数据库管理：

- `openDatabase()` — 为当前分支打开/创建 SQLite 数据库
- `resolveDbName()` — 根据 git 状态确定 db 文件名
- `copyDatabase()` — 为新分支 fork 父分支的 db
- `loadState()` / `saveState()` — 管理 `state.yaml`
- `listBranchDbs()` / `removeBranchDb()` — 清理操作

### Scanner (`src/scanner.ts`)

使用 `globby` 按 `include` 模式发现文件，同时排除 `exclude` 模式。默认遵守 `.gitignore`。

### Hasher (`src/hasher.ts`)

计算文件内容的 SHA-256 哈希用于变更检测。作为 git diff 不可用时的后备方案。

### Parser (`src/parser/`)

基于 tree-sitter 的静态分析，无需执行代码即可提取结构信息。

| 解析器     | 文件扩展名                   | 提取的符号类型                                           |
| ---------- | ---------------------------- | -------------------------------------------------------- |
| TypeScript | `.ts`、`.tsx`、`.js`、`.jsx` | class, function, method, interface, type, enum, variable |
| Swift      | `.swift`                     | class, struct, protocol, function, enum                  |

### LLM 服务 (`src/llm/`)

通过 [pi-ai](https://github.com/badlogic/pi-mono) 统一 LLM API 为每个文件生成人类可读的元数据。

### Indexer (`src/indexer.ts`)

主编排引擎，有两条构建路径：

1. **Git 感知**（git 仓库中默认）：使用 `git diff` 实现 O(变更文件) 增量构建
2. **经典**（非 git 或 `--full`）：扫描全部文件，使用 SHA-256 哈希比较

处理边界情况：rebase/force-push（回退到 hash-based）、配置变更（强制全量重建）、新分支（从父分支 db fork）。

### Query (`src/query.ts`)

委托 SQLite 中的 FTS5 全文搜索。另提供工具函数：`filterByLanguage()`、`filterByPath()`。可选通过 `searchFilesWithRerank()` 支持 LLM 语义重排序。

### Graph (`src/graph.ts`)

从已索引文件的 imports 构建依赖图。解析相对导入到已索引文件（支持扩展名补全和 index.ts 补全）。支持聚焦子图和可配置深度。生成 Mermaid `graph LR` 语法，并通过 [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) 渲染为 ASCII 或 SVG 输出。

支持四种输出格式（`--format`）：

| 格式      | 描述                                   |
| --------- | -------------------------------------- |
| `mermaid` | 默认，Mermaid 语法（对 agent 最友好）  |
| `json`    | 结构化 JSON（节点 + 边）               |
| `ascii`   | 通过 beautiful-mermaid 渲染的 ASCII 图 |
| `svg`     | 通过 beautiful-mermaid 渲染的 SVG 图   |

### Reranker (`src/llm/reranker.ts`)

接收 FTS5 搜索候选结果，通过 LLM 语义理解重新排序。将文件元数据（path、name、description、summary）发送给 LLM，解析重排后的路径列表。

## CLI 命令

| 命令                | 描述                                    | 关键选项                                           |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| `kly init`          | 交互式设置 + 可选 post-commit hook 安装 | —                                                  |
| `kly build`         | 构建或更新仓库索引                      | `--full` 强制全量，`--quiet` 静默（hook 用）       |
| `kly query <text>`  | 用自然语言搜索已索引文件                | `--rerank` LLM 重排序                              |
| `kly show <path>`   | 查看指定文件的索引元数据                | —                                                  |
| `kly overview`      | 显示已索引仓库的概要信息                | —                                                  |
| `kly graph`         | 渲染已索引文件依赖图                    | `--focus <path>`、`--depth <n>`、`--format <type>` |
| `kly hook <action>` | 安装/卸载 post-commit hook              | `install` 或 `uninstall`                           |
| `kly gc`            | 清理已删除分支的数据库                  | —                                                  |

## 目录结构

```
kly/
├── src/
│   ├── index.ts              # 库公开 API
│   ├── cli.ts                # CLI 入口 (commander)
│   ├── types.ts              # 核心类型
│   ├── config.ts             # .kly/ 目录管理
│   ├── database.ts           # SQLite IndexDatabase 类
│   ├── git.ts                # Git CLI wrapper
│   ├── diff-filter.ts        # Git diff glob 过滤
│   ├── scanner.ts            # 文件发现 (globby)
│   ├── hasher.ts             # SHA-256 哈希
│   ├── store.ts              # 分支感知 db 管理
│   ├── indexer.ts            # 流水线编排
│   ├── query.ts              # FTS5 搜索与过滤 + rerank
│   ├── graph.ts              # 依赖图构建 + Mermaid 生成
│   ├── commands/
│   │   ├── init.ts
│   │   ├── build.ts
│   │   ├── query.ts
│   │   ├── show.ts
│   │   ├── overview.ts       # 仓库概览
│   │   ├── graph.ts          # 依赖图 CLI
│   │   ├── hook.ts           # Git hook 安装/卸载
│   │   └── gc.ts             # 分支 db 清理
│   ├── llm/
│   │   ├── index.ts          # LLMService
│   │   ├── prompts.ts        # 提示词模板
│   │   ├── reranker.ts       # LLM 搜索结果重排序
│   │   └── batcher.ts        # 并发控制
│   ├── parser/
│   │   ├── base.ts           # 抽象基类 BaseParser
│   │   ├── index.ts          # ParserManager
│   │   ├── typescript.ts     # TS/TSX/JS/JSX 解析器
│   │   └── swift.ts          # Swift 解析器
│   └── __tests__/
│       ├── helpers/fixtures.ts
│       ├── config.test.ts
│       ├── database.test.ts
│       ├── git.test.ts
│       ├── diff-filter.test.ts
│       ├── integration.test.ts
│       ├── store.test.ts
│       ├── query.test.ts
│       ├── graph.test.ts
│       ├── indexer.test.ts
│       ├── scanner.test.ts
│       ├── hasher.test.ts
│       ├── parser/
│       └── llm/
├── .kly/
│   ├── config.yaml
│   ├── state.yaml
│   └── db/
│       ├── main.db
│       └── <branch>.db
├── package.json
└── vite.config.ts
```

## 技术栈

| 组件     | 技术                           | 用途                          |
| -------- | ------------------------------ | ----------------------------- |
| 构建     | VP (vite-plus) / tsdown        | 打包 3 个入口为 ESM           |
| LLM      | `@mariozechner/pi-ai`          | 统一多 provider LLM API       |
| 静态分析 | `tree-sitter`                  | AST 解析 (TS/JS/Swift)        |
| 存储     | `better-sqlite3`               | 每分支 SQLite + FTS5 全文搜索 |
| 文件发现 | `globby`                       | Glob 模式 + gitignore         |
| CLI      | `commander` + `@clack/prompts` | 命令行框架 + 交互式提示       |
| 并发控制 | `p-limit`                      | 限制 LLM 调用速率             |
| 序列化   | `yaml`                         | YAML 配置和状态               |
| 校验     | `zod`                          | Schema 验证                   |
| 图渲染   | `beautiful-mermaid`            | Mermaid 图渲染（ASCII + SVG） |

## 边界情况

| 场景              | 处理方式                                      |
| ----------------- | --------------------------------------------- |
| Detached HEAD     | 使用 `_detached--<commit8>` 作为 db 文件名    |
| Rebase/Force push | `isAncestor` 检测失败，回退到 hash-based 增量 |
| 分支删除          | `kly gc` 清理对应 .db 文件                    |
| Merge commit      | `git diff` 正确覆盖合并带来的所有变更         |
| 非 git 仓库       | 使用 `default.db`，hash-based 增量            |
| Renamed files     | 复制已有索引，内容变更时重新 LLM 索引         |
| Config 变更       | 检测 configHash 变化，强制全量重建            |

## 路线图

### P0（已完成）

- 项目骨架，3 个入口
- 核心模块：scanner、hasher、store、config
- Tree-sitter 解析器：TypeScript、JavaScript、Swift
- LLM 集成多 provider 支持
- CLI：init、build、query、show、hook、gc
- Git 感知增量索引 + 每分支 SQLite 存储
- FTS5 全文搜索
- Post-commit hook 系统

### P1（已完成）

- `kly overview` — 仓库级摘要命令
- `kly graph` — 依赖图可视化（Mermaid，基于 beautiful-mermaid）
- LLM rerank 查询结果（`--rerank` 选项）

### P2

- npm publish
- 架构可视化（模块依赖图）

### P3

- 云端批量索引 GitHub 仓库

### P4

- 基于 Embedding 的语义搜索（付费 API）
