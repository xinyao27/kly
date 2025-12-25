# Testing MCP Adapter with Claude Desktop

This guide shows how to configure and test the clai MCP adapter with Claude Desktop or Claude Code.

## Quick Start

### 1. Build clai

```bash
bun run build
```

### 2. Configure Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json` (macOS/Linux) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "clai-hello": {
      "command": "node",
      "args": [
        "-e",
        "require('child_process').spawn('/absolute/path/to/clai/dist/bin/clai.mjs', ['mcp', '/absolute/path/to/clai/examples/hello.ts'], { stdio: 'inherit', shell: true })"
      ]
    }
  }
}
```

Or if clai is globally installed:

```json
{
  "mcpServers": {
    "clai-hello": {
      "command": "clai",
      "args": ["mcp", "./examples/hello.ts"],
      "env": {
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      }
    },
    "clai-weather": {
      "command": "clai",
      "args": ["mcp", "./examples/weather.ts"]
    }
  }
}
```

### 3. Restart Claude Desktop

Completely quit Claude Desktop (Cmd+Q on macOS) and restart it.

### 4. Test the Integration

In Claude Desktop, try asking:

- "Can you greet Alice with excitement?"
- "What tools do you have available?"
- "Get the current weather for San Francisco"

Claude should be able to see and use the tools from your clai apps!

## Testing with Remote Repos

You can also expose GitHub repos as MCP servers:

```json
{
  "mcpServers": {
    "remote-weather": {
      "command": "clai",
      "args": ["mcp", "xinyao27/weather-app"]
    }
  }
}
```

## Debugging

If the server doesn't appear in Claude:

1. Check Claude Desktop logs (Help → Show Logs in Claude Desktop)
2. Ensure the paths are absolute
3. Verify the app runs with `clai run examples/hello.ts`
4. Test the MCP server manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | bun run dist/bin/clai.mjs mcp examples/hello.ts
```

## How It Works

1. `clai mcp <app>` starts the app in MCP mode
2. `defineApp()` detects MCP mode via `process.env.CLAI_MCP_MODE`
3. The MCP server automatically converts clai tools to MCP format:
   - Tool names → MCP tool names
   - Zod schemas → JSON Schema
   - Execute functions → MCP tool calls
4. Claude Desktop/Code can discover and call these tools
