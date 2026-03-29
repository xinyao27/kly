# kly

[English](README.md) | **中文**

## 一句话介绍

kly 帮你的代码仓库建一份「目录」，让 AI Agent 和你自己都能快速找到想要的文件。

## 它解决什么问题？

一个项目有几百上千个文件，你想问 AI：「帮我改一下登录逻辑」——AI 怎么知道该看哪个文件？

传统做法是把所有代码塞给 AI 看，但这样 token 消耗巨大，而且 AI 还是会漏掉东西。

kly 的做法是：**先扫一遍你的代码，给每个文件生成一段简短的描述**。AI 拿到的不是几万行代码，而是一份简明的索引——像一本书的目录，直接翻到想看的章节。

## 它具体做了什么？

### 1. 解析代码结构

kly 用 [tree-sitter](https://tree-sitter.github.io/) 解析你的源码，提取出每个文件里有什么：

- **导入了什么**（import 哪些模块）
- **导出了什么**（export 哪些函数/类/变量）
- **有哪些符号**（函数名、类名、接口名、类型名）

支持 TypeScript、JavaScript、Swift 三种语言。

### 2. 用 AI 生成文件描述

光有代码结构还不够——`src/utils/helpers.ts` 里面到底干嘛的？kly 把代码交给 LLM，让它生成：

- **文件名称**（一个简短的人类可读名字，比如「认证中间件」）
- **文件描述**（一句话说清楚这个文件干什么）
- **文件摘要**（更详细的功能总结）
- **符号描述**（每个函数/类是做什么的）

支持 OpenRouter、Anthropic、OpenAI、Google、Mistral、Groq 等多家 LLM 服务商。

### 3. 存进数据库，支持搜索

所有索引信息存在 SQLite 数据库里，带 FTS5 全文搜索。你可以用自然语言搜索：

```bash
kly query "处理用户登录的文件"
kly query "数据库连接配置"
kly query "错误处理中间件"
```

搜索结果按相关性排序。还可以用 LLM 做二次排序（`--rerank`），结果更精准。

### 4. 跟踪文件依赖关系

kly 记录了文件之间的 import 关系：

- **正向依赖**：这个文件 import 了谁？
- **反向依赖**：谁 import 了这个文件？

```bash
# 谁依赖了 types.ts？
kly dependents src/types.ts

# 整个依赖图
kly graph --focus src/auth.ts --depth 3
```

这对分析「改了这个文件会影响哪些模块」非常有用。

### 5. 查看文件修改历史

kly 可以查询每个文件最近被谁改过：

```bash
kly history src/auth.ts
```

输出类似：

```
abc1234 @alice 2026-03-25 fix: handle expired token
def5678 @bob   2026-03-20 feat: add refresh token
```

### 6. 错误栈增强（Error Stack Enrichment）

这是 kly 最强大的能力之一。当你的应用报错时，错误栈通常只有文件名和行号：

```
TypeError: Cannot read property 'content' of undefined
    at renderMessage (src/components/MessageList.tsx:142)
```

kly 可以把这个错误栈「增强」——补上完整的代码上下文：

```bash
echo '[{"file":"src/components/MessageList.tsx","line":142}]' | kly enrich
```

输出会告诉你：

- 📄 这个文件是做什么的（「聊天消息列表渲染组件」）
- 🔗 有哪些文件依赖它（影响范围）
- 📝 它 import 了哪些模块
- 👤 最近被谁改过（可能是谁引入的 bug）

### 7. Git 感知增量构建

首次构建需要扫描所有文件（调 LLM），但之后每次只处理变更的文件：

```bash
kly build           # 增量构建，只处理 git diff 里变了的文件
kly build --full    # 强制全量重建
```

每个 git 分支有自己独立的数据库，分支之间互不影响。切换分支时，新分支会从 main 分支 fork 一份索引，再增量更新。

## 怎么用？

### 安装

```bash
npm install -g kly
```

### 初始化

```bash
# 方式一：命令行参数（适合 CI 和 Agent）
kly init --provider openrouter --api-key sk-or-xxx

# 方式二：交互式引导（适合人类）
kly init
```

### 构建索引

```bash
kly build
```

### 搜索和查询

```bash
# 搜索文件
kly query "用户认证"

# 查看文件详情
kly show src/auth.ts

# 仓库概览
kly overview

# 人类可读的输出（默认是 JSON，给 Agent 读的）
kly query "用户认证" --pretty
```

### 自动化

```bash
# 安装 git hook，每次 commit 后自动更新索引
kly hook install
```

## 作为 TypeScript 库使用

kly 不只是命令行工具，也是一个导出干净的 TypeScript 库，可以直接 import：

```typescript
import { openDatabase, searchFiles, enrichErrorStack, buildIndex } from "kly";

const db = openDatabase("/path/to/repo");

// 搜索
const results = searchFiles(db, "authentication", 10);

// 错误栈增强
const enriched = enrichErrorStack(db, "/path/to/repo", [
  { file: "src/auth.ts", line: 42, function: "validate" },
]);

db.close();
```

## 所有命令一览

| 命令                          | 说明                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `kly init`                    | 初始化（支持 `--provider`、`--api-key`、`--model` 参数）      |
| `kly build`                   | 构建或更新索引（`--full` 全量重建，`--quiet` 静默模式）       |
| `kly query <文本>`            | 自然语言搜索文件（`--rerank` LLM 重排序，`--limit` 限制数量） |
| `kly show <路径>`             | 查看文件的索引详情                                            |
| `kly overview`                | 仓库总览（文件数、语言分布）                                  |
| `kly graph`                   | 文件依赖图（`--focus` 聚焦，`--depth` 深度）                  |
| `kly dependents <路径>`       | 查看谁 import 了这个文件                                      |
| `kly history <路径>`          | 查看文件的 git 修改历史（`--limit` 限制条数）                 |
| `kly enrich`                  | 错误栈增强（通过 stdin 或 `--frames` 传入）                   |
| `kly hook install\|uninstall` | 管理 post-commit hook                                         |
| `kly gc`                      | 清理已删除分支的数据库                                        |

所有查询命令默认输出 JSON（给 Agent 读），加 `--pretty` 输出人类可读格式。

## 配置

编辑 `.kly/config.yaml`：

```yaml
llm:
  provider: openrouter
  model: anthropic/claude-haiku-4.5
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
```

## License

MIT
