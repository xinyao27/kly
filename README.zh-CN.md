# kly

[English](README.md) | **中文**

面向 AI Agent 的代码仓库文件级索引工具。

kly 扫描你的代码仓库，通过 tree-sitter AST 提取结构化信息，并利用 LLM 为每个文件生成人类可读的元数据。最终产出一份结构化索引，让 Agent 用最少的 token 找到最正确的文件。

## 特性

- **Tree-sitter AST 解析** — 从 TypeScript、JavaScript、Swift 中提取 imports、exports 和 symbols
- **多 Provider LLM** — 通过 OpenRouter、Anthropic、OpenAI、Google、Mistral、Groq 等生成元数据（基于 [pi-ai](https://github.com/badlogic/pi-mono)）
- **Git 感知增量构建** — 跟踪每个分支的 git 历史，仅重新索引自上次提交以来变更的文件
- **SQLite 存储** — 每个分支独立的 SQLite 数据库，支持 FTS5 全文搜索，替代单一 YAML 文件
- **MCP Server** — 以 stdio 传输协议向 Agent 暴露索引工具
- **Post-commit Hook** — 每次提交后自动索引
- **简洁 CLI** — `init`、`build`、`query`、`show`、`serve`、`hook`、`gc`

## 安装

```bash
npm install -g kly
```

## 快速开始

```bash
# 交互式设置：选择 provider、输入 API key、选择模型
kly init

# 构建索引（git 仓库中默认使用 git 增量模式）
kly build

# 按描述搜索文件（基于 FTS5 全文搜索）
kly query "authentication middleware"

# 查看某个文件的详细索引
kly show src/auth.ts

# 启动 MCP Server 供 Agent 集成
kly serve

# 安装 post-commit hook 实现自动索引
kly hook install

# 清理已删除分支的数据库
kly gc
```

## 工作原理

在 git 仓库中，kly 在 `.kly/db/` 下维护**每个分支独立的 SQLite 数据库**：

```
.kly/
  config.yaml           # LLM 和 glob 设置
  state.yaml            # 追踪每个分支的最后索引提交
  db/
    main.db             # main 分支索引
    feature--auth.db    # feature/auth 分支（/ → --）
```

首次全量构建后，后续构建使用 `git diff` 仅重新索引变更文件 — 使增量构建几乎瞬时完成。

## MCP 集成

添加到你的 MCP 客户端配置：

```json
{
  "mcpServers": {
    "kly": {
      "command": "kly",
      "args": ["serve"],
      "cwd": "/path/to/your/repo"
    }
  }
}
```

可用工具：

- `search_files` — 自然语言文件搜索（FTS5 全文搜索）
- `get_file_index` — 获取指定文件的详细元数据
- `get_overview` — 仓库概览（含语言分布）

## 配置

编辑 `.kly/config.yaml` 进行自定义：

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

## 文档

- [技术文档](docs/technical.zh-CN.md) — 架构设计、数据流、核心类型和模块详解
- [测试文档](docs/testing.zh-CN.md) — 测试策略、覆盖率、手动测试清单

## License

MIT
