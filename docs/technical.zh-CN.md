# kly 技术文档

[English](technical.md) | **中文**

> 本文档面向 AI Agent 和开发者，详细说明 kly 的架构、数据流和实现细节。

## 概述

kly 是一个代码仓库文件级索引工具。它为仓库中的每个源文件生成结构化元数据 — 包括名称、描述、imports、exports、symbols 和摘要 — 使 AI Agent 能以最少的 token 消耗定位到正确的文件。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                     CLI / MCP                        │
│  (commander)            (stdio transport)            │
├─────────────────────────────────────────────────────┤
│                     Indexer                           │
│                   (编排引擎)                          │
├──────────┬──────────┬──────────┬────────────────────┤
│ Scanner  │ Hasher   │ Parser   │ LLM Service        │
│ (globby) │ (SHA256) │(tree-sitter)│ (pi-ai)         │
├──────────┴──────────┴──────────┴────────────────────┤
│                     Store                            │
│              (.kly/index.yaml)                        │
└─────────────────────────────────────────────────────┘
```

### 入口

| 入口 | 文件           | 用途                              |
| ---- | -------------- | --------------------------------- |
| 库   | `src/index.ts` | 编程式调用的公开 API              |
| CLI  | `src/cli.ts`   | `kly` 命令行工具                  |
| MCP  | `src/mcp.ts`   | MCP Server (stdio)，供 Agent 集成 |

## 数据流

```
scanner.ts  →  hasher.ts (增量比对)  →  parser/ (tree-sitter AST)  →  llm/ (生成描述)  →  store.ts
```

1. **扫描** — 通过 glob 模式发现文件，遵守 `.gitignore` 和配置中的排除规则
2. **哈希** — 计算每个文件的 SHA-256；增量模式下跳过未变更的文件
3. **解析** — 使用 tree-sitter AST 提取 imports、exports 和 symbols
4. **LLM** — 将文件内容 + 检测到的 symbols 通过 pi-ai 发送给 LLM（支持 OpenRouter/Anthropic/OpenAI/Google 等），获取结构化元数据（名称、描述、摘要、符号描述）
5. **存储** — 将 `FileIndex` 条目 upsert 到 `.kly/index.yaml`

## 核心类型

```typescript
type Language = "typescript" | "javascript" | "swift";

type SymbolKind =
  | "class"
  | "function"
  | "method"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "protocol"
  | "struct";

interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  description: string; // LLM 生成
}

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

interface IndexStore {
  version: number;
  generatedAt: number;
  files: FileIndex[];
}

interface KlyConfig {
  llm: {
    provider: string; // "openrouter", "anthropic", "openai" 等
    model: string; // "anthropic/claude-haiku-4-5-20251001"
    apiKey: string; // 存储在配置中，通过 `kly init` 设置
  };
  include: string[]; // glob 模式
  exclude: string[]; // glob 模式
}

interface ParseResult {
  imports: string[];
  exports: string[];
  symbols: SymbolInfo[];
}
```

## 设计决策

### 选择 YAML 而非 JSON

所有 `.kly/` 目录下的存储文件（配置和索引）均使用 YAML 而非 JSON：

- **更少 token** — YAML 省去了大括号、方括号和键名引号，LLM 消费时显著减少 token 数
- **Agent 可读性更好** — 更简洁的结构，便于 AI Agent 解析和推理
- **人类友好** — 手动编辑更容易，不易出现语法错误

### 多 Provider LLM（pi-ai）

使用 [pi-ai](https://github.com/badlogic/pi-mono) 统一 LLM API 而非特定 provider 的 SDK。用户可在 `kly init` 时选择任意支持的 provider（OpenRouter、Anthropic、OpenAI、Google、Mistral、Groq、xAI 等）。API key 存储在 `.kly/config.yaml` 中，不使用环境变量。

### 交互式 CLI（@clack/prompts）

所有 CLI 用户交互使用 [@clack/prompts](https://github.com/bombshell-dev/clack)，提供现代一致的终端体验 — 选择菜单、密码输入、进度指示器和结构化日志输出。

## 代码规范

- **禁止 `as any` 和 `as unknown`** — 使用正确的类型收窄、泛型或具有明确签名的包装函数，而非绕过类型系统的类型断言
- **代码和注释使用英文** — 所有代码、变量名和注释必须使用英文
- **存储使用 YAML** — kly 持久化的任何配置或数据必须使用 YAML 格式
- **100% 测试覆盖率** — 所有可自动化测试的代码必须达到 100% 覆盖率（语句、分支、函数、行）。通过 `npm run test:coverage` 强制执行
- **TDD（测试驱动开发）** — 新功能必须先写测试再写实现。详见 [测试文档](testing.zh-CN.md)

## 模块详解

### Scanner (`src/scanner.ts`)

使用 `globby` 按 `include` 模式发现文件，同时排除 `exclude` 模式匹配的文件。默认遵守 `.gitignore`。返回按字母排序的相对路径。

### Hasher (`src/hasher.ts`)

计算文件内容的 SHA-256 哈希用于变更检测。增量模式下跳过自上次索引以来未变更的文件。

### Parser (`src/parser/`)

基于 tree-sitter 的静态分析，无需执行代码即可提取结构信息。

| 解析器     | 文件扩展名                   | 提取的符号类型                                           |
| ---------- | ---------------------------- | -------------------------------------------------------- |
| TypeScript | `.ts`、`.tsx`、`.js`、`.jsx` | class, function, method, interface, type, enum, variable |
| Swift      | `.swift`                     | class, struct, protocol, function, enum                  |

**解析器架构：**

- `base.ts` — 抽象基类 `BaseParser`，提供 `parse()` 和 `supports()` 方法
- `typescript.ts` — 通过 `tree-sitter-typescript` 处理 TS/TSX/JS/JSX（JS 是 TS 的子集，单个解析器即可处理）
- `swift.ts` — 通过 `tree-sitter-swift` 处理 Swift
- `index.ts` — `ParserManager` 按文件扩展名路由到对应解析器

**提取的 AST 节点类型：**

TypeScript/JavaScript:

- Imports: `import_statement`
- Exports: `export_statement`, `export_default_declaration`, `export_clause`
- Symbols: `class_declaration`, `function_declaration`, `method_definition`, `interface_declaration`, `type_alias_declaration`, `enum_declaration`, `lexical_declaration` (带 export)

Swift:

- Imports: `import_declaration`
- Exports: 所有顶层声明
- Symbols: `class_declaration`, `struct_declaration`, `protocol_declaration`, `function_declaration`, `enum_declaration`

### LLM 服务 (`src/llm/`)

通过 [pi-ai](https://github.com/badlogic/pi-mono) 统一 LLM API 为每个文件生成人类可读的元数据。支持多个 provider：OpenRouter、Anthropic、OpenAI、Google、Mistral、Groq、xAI 等。

**组件：**

- `prompts.ts` — 系统提示词和用户提示词模板
- `batcher.ts` — 基于 `p-limit` 的并发限制批处理（默认 5 个并发请求）
- `index.ts` — `LLMService` 类，编排 API 调用并解析 JSON 响应

**提示词策略：**

- 系统提示词指示 LLM 返回包含 `name`、`description`、`summary` 和 `symbols` 的 JSON 对象
- 用户提示词包含：文件路径、检测到的 symbols（来自 tree-sitter）和完整源代码
- 响应解析为 JSON（处理 markdown 代码块包裹的情况）

**配置：**

- 默认 provider：`openrouter`
- 默认模型：`anthropic/claude-haiku-4-5-20251001`
- API Key：存储在 `.kly/config.yaml` 中（通过 `kly init` 设置）

### Indexer (`src/indexer.ts`)

主编排引擎，协调完整的处理流水线：

1. 加载配置并初始化各组件
2. 扫描文件 → 过滤变更（增量）→ 解析（tree-sitter）→ LLM（批量）→ 存储
3. 通过回调报告进度：`{ total, completed, currentFile }`

### Store (`src/store.ts`)

基于 YAML 的持久化存储，位于 `.kly/index.yaml`。提供 CRUD 操作：

- `loadStore()` / `saveStore()` — 读写完整 store
- `upsertFileIndex()` — 按路径插入或更新
- `removeFileIndex()` — 按路径删除
- `getFileIndex()` — 按路径查询

### Query (`src/query.ts`)

基于文本的搜索，带相关性评分：

- 将查询拆分为词项
- 在 name、description、summary、path、symbols、exports 中匹配评分
- 对 name/path/symbol name 的匹配施加加权
- 按分数降序返回结果

另提供工具函数：`filterByLanguage()`、`filterByPath()`

## CLI 命令

| 命令               | 描述                                              | 关键选项                           |
| ------------------ | ------------------------------------------------- | ---------------------------------- |
| `kly init`         | 交互式设置：选择 provider、输入 API key、选择模型 | —                                  |
| `kly build`        | 构建完整索引                                      | `-i, --incremental` 跳过未变更文件 |
| `kly query <text>` | 按自然语言描述搜索文件                            | —                                  |
| `kly show <path>`  | 显示指定文件的详细索引                            | —                                  |
| `kly serve`        | 启动 MCP stdio Server                             | —                                  |

## MCP Server

通过 stdio 传输协议暴露 3 个工具供 Agent 使用：

### `search_files`

自然语言文件搜索。

- **输入：** `{ query: string, limit?: number }`
- **输出：** JSON 数组 `{ path, name, description, score }`

### `get_file_index`

获取指定文件的完整索引。

- **输入：** `{ path: string }`
- **输出：** 完整的 `FileIndex` JSON 对象

### `get_overview`

仓库概览。

- **输入：** 无
- **输出：** `{ totalFiles, languages: { [lang]: count }, files: [{ path, name, description }] }`

## 配置

默认 `.kly/config.yaml`：

```yaml
llm:
  provider: openrouter
  model: anthropic/claude-haiku-4-5-20251001
  apiKey: sk-or-...
include:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.swift"
exclude:
  - "**/node_modules/**"
  - "**/dist/**"
  - "**/build/**"
  - "**/.git/**"
  - "**/.kly/**"
  - "**/vendor/**"
  - "**/*.d.ts"
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
```

## 目录结构

```
kly/
├── src/
│   ├── index.ts              # 库公开 API
│   ├── cli.ts                # CLI 入口 (commander)
│   ├── mcp.ts                # MCP Server (stdio)
│   ├── types.ts              # 核心类型
│   ├── config.ts             # .kly/ 目录管理
│   ├── scanner.ts            # 文件发现 (globby)
│   ├── hasher.ts             # SHA-256 哈希
│   ├── store.ts              # 索引 YAML 持久化
│   ├── indexer.ts            # 流水线编排
│   ├── query.ts              # 搜索与过滤
│   ├── tree-sitter.d.ts      # Grammar 类型声明
│   ├── commands/
│   │   ├── init.ts
│   │   ├── build.ts
│   │   ├── query.ts
│   │   ├── show.ts
│   │   └── serve.ts
│   ├── llm/
│   │   ├── index.ts          # LLMService (Anthropic)
│   │   ├── prompts.ts        # 提示词模板
│   │   └── batcher.ts        # 并发控制
│   ├── parser/
│   │   ├── base.ts           # 抽象基类 BaseParser
│   │   ├── index.ts          # ParserManager
│   │   ├── typescript.ts     # TS/TSX/JS/JSX 解析器
│   │   └── swift.ts          # Swift 解析器
│   └── __tests__/            # 测试文件 (Vitest)
│       ├── helpers/fixtures.ts
│       ├── config.test.ts
│       ├── scanner.test.ts
│       ├── hasher.test.ts
│       ├── store.test.ts
│       ├── query.test.ts
│       ├── indexer.test.ts
│       ├── parser/
│       │   ├── typescript.test.ts
│       │   ├── swift.test.ts
│       │   └── manager.test.ts
│       └── llm/
│           ├── prompts.test.ts
│           ├── batcher.test.ts
│           └── service.test.ts
├── .kly/                     # 生成的索引目录
│   ├── config.yaml
│   └── index.yaml
├── package.json
└── vite.config.ts            # VP (vite-plus) 构建配置
```

## 技术栈

| 组件     | 技术                           | 用途                                                                |
| -------- | ------------------------------ | ------------------------------------------------------------------- |
| 构建     | VP (vite-plus) / tsdown        | 打包 3 个入口为 ESM                                                 |
| LLM      | `@mariozechner/pi-ai`          | 统一多 provider LLM API（OpenRouter、Anthropic、OpenAI、Google 等） |
| 静态分析 | `tree-sitter`                  | AST 解析 (TS/JS/Swift)                                              |
| MCP      | `@modelcontextprotocol/sdk`    | Agent 侧工具协议                                                    |
| 文件发现 | `globby`                       | Glob 模式 + gitignore                                               |
| CLI      | `commander` + `@clack/prompts` | 命令行框架 + 交互式提示                                             |
| 并发控制 | `p-limit`                      | 限制 LLM 调用速率                                                   |
| 序列化   | `yaml`                         | YAML 配置和索引存储                                                 |
| 校验     | `zod`                          | Schema 验证                                                         |

## 路线图

### P0（已完成）

- 项目骨架，3 个入口
- 核心模块：scanner、hasher、store、config
- Tree-sitter 解析器：TypeScript、JavaScript、Swift
- LLM 集成 Anthropic Claude
- CLI：init、build（增量）、query、show、serve
- MCP Server（stdio 传输）

### P1

- `kly overview` — 仓库级摘要命令
- `kly graph` — 依赖图可视化（Mermaid）
- LLM rerank 查询结果
- 文件监听自动增量索引
- npm publish
- MCP SSE 传输

### P2

- 架构可视化（模块依赖图）

### P3

- 云端批量索引 GitHub 仓库

### P4

- 基于 Embedding 的语义搜索（付费 API）
