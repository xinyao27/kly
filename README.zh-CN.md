# kly

[English](README.md) | **中文**

面向 AI Agent 的代码仓库文件级索引工具。

kly 扫描你的代码仓库，通过 tree-sitter AST 提取结构化信息，并利用 LLM 为每个文件生成人类可读的元数据。最终产出一份结构化索引，让 Agent 用最少的 token 找到最正确的文件。

## 特性

- **Tree-sitter AST 解析** — 从 TypeScript、JavaScript、Swift 中提取 imports、exports 和 symbols
- **多 Provider LLM** — 通过 OpenRouter、Anthropic、OpenAI、Google、Mistral、Groq 等生成元数据（基于 [pi-ai](https://github.com/badlogic/pi-mono)）
- **增量构建** — SHA-256 哈希跳过未变更的文件
- **MCP Server** — 以 stdio 传输协议向 Agent 暴露索引工具
- **YAML 存储** — 配置和索引使用 YAML 格式，更省 token，Agent 可读性更好
- **简洁 CLI** — `init`、`build`、`query`、`show`、`serve`

## 安装

```bash
npm install -g kly
```

## 快速开始

```bash
# 交互式设置：选择 provider、输入 API key、选择模型
kly init

# 构建索引
kly build

# 按描述搜索文件
kly query "authentication middleware"

# 查看某个文件的详细索引
kly show src/auth.ts

# 启动 MCP Server 供 Agent 集成
kly serve
```

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

- `search_files` — 自然语言文件搜索
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
