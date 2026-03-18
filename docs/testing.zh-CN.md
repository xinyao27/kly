# kly 测试文档

[English](testing.md) | **中文**

## 测试策略

kly 遵循 **TDD（测试驱动开发）** — 新功能必须先写测试再实现。所有可自动化测试的代码必须达到 **100% 测试覆盖率**。

## 测试基础设施

| 组件     | 技术                                   |
| -------- | -------------------------------------- |
| 框架     | Vitest 4.1（通过 `vp test`）           |
| 覆盖率   | v8 coverage provider                   |
| 原生模块 | tree-sitter（预编译二进制）            |
| 文件系统 | 真实临时目录（`os.tmpdir()`）          |
| Mock     | `vi.mock()` 用于 `@mariozechner/pi-ai` |

## 运行测试

```bash
# 运行全部测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行指定测试文件
npx vp test --run src/__tests__/hasher.test.ts

# 以监听模式运行测试
npx vp test
```

## 测试结构

```
src/__tests__/
├── helpers/
│   └── fixtures.ts              # 共享工厂函数
├── config.test.ts               # Config 模块
├── scanner.test.ts              # Scanner 模块
├── hasher.test.ts               # Hasher 模块
├── store.test.ts                # Store 模块
├── query.test.ts                # Query 模块
├── indexer.test.ts              # Indexer 集成测试（mock LLM）
├── parser/
│   ├── typescript.test.ts       # TS/TSX/JS/JSX 解析器（合并后）
│   ├── swift.test.ts            # Swift 解析器
│   └── manager.test.ts          # ParserManager 路由
└── llm/
    ├── prompts.test.ts          # Prompt 模板
    ├── batcher.test.ts          # 并发控制
    └── service.test.ts          # LLMService（mock pi-ai）
```

## 覆盖率配置

覆盖率在 `vite.config.ts` 中配置，阈值为 100%：

```typescript
test: {
  coverage: {
    provider: "v8",
    thresholds: {
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
    },
  },
}
```

**覆盖的模块：** config、scanner、hasher、store、query、indexer、parser/_、llm/_

**排除覆盖：** CLI 命令（`src/commands/`）、MCP Server（`src/mcp.ts`）、入口文件（`src/cli.ts`、`src/index.ts`）

## Mock 策略

| 模块                  | 何时 mock                     | 方式                                        |
| --------------------- | ----------------------------- | ------------------------------------------- |
| `@mariozechner/pi-ai` | LLMService 测试、Indexer 测试 | `vi.mock()` — mock `complete` 和 `getModel` |
| 文件系统              | 不 mock                       | 使用真实临时目录（`os.tmpdir()`）           |
| tree-sitter           | 不 mock                       | 使用真实原生模块                            |
| globby                | 不 mock                       | 使用真实实现                                |

## 手动测试清单

以下测试需要手动验证：

### CLI 命令

- [ ] `kly init`：交互式选择 provider → 输入 API key → 输入 model → 验证 `.kly/config.yaml`
- [ ] `kly init` 取消操作（Ctrl+C）正确退出
- [ ] `kly build`：spinner 显示进度；未初始化时报错
- [ ] `kly build -i`：增量模式跳过未更改文件
- [ ] `kly query "search term"`：输出格式正确；无结果时警告
- [ ] `kly show src/file.ts`：完整信息展示；不存在的文件报错
- [ ] `kly serve`：不报错启动；未初始化时报错

### MCP Server

- [ ] 配置 MCP client 连接 `kly serve`
- [ ] `search_files` 返回结果
- [ ] `get_file_index` 正常/不存在路径
- [ ] `get_overview` 返回 language breakdown

### LLM 集成（需要真实 API key）

- [ ] 用真实 API key 对小项目 `kly build`，验证 index.yaml 内容有意义
- [ ] 切换 provider（openrouter/anthropic 等）都能工作
- [ ] 网络错误时的行为
