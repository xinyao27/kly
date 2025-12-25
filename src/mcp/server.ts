import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ClaiApp } from "../types";
import { convertToJsonSchema } from "./schema-converter";

/**
 * Start an MCP server for a Clai app
 *
 * This makes all tools from the app available to Claude Desktop/Code via the MCP protocol.
 *
 * @param app - The Clai app instance returned by defineApp()
 *
 * @example
 * ```typescript
 * import { defineApp, tool, startMcpServer } from "clai"
 * import { z } from "zod"
 *
 * const app = defineApp({
 *   name: "my-app",
 *   version: "1.0.0",
 *   description: "My app",
 *   tools: [myTool],
 * })
 *
 * // In MCP mode, start the server
 * if (process.env.CLAI_MCP_MODE === "true") {
 *   await startMcpServer(app)
 * }
 * ```
 */
export async function startMcpServer(app: ClaiApp): Promise<void> {
  const { definition } = app;

  // Create MCP server instance
  const server = new Server(
    {
      name: definition.name,
      version: definition.version,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Handle tools/list - enumerate all tools from the app
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = definition.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? `Execute ${tool.name}`,
      inputSchema: convertToJsonSchema(tool.inputSchema),
    }));

    return { tools };
  });

  // Handle tools/call - execute a specific tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Execute the tool through the app's execute method
      const result = await app.execute(name, args as Record<string, unknown>);

      // Convert result to MCP content format
      const content = formatToolResult(result);

      return {
        content,
        isError: false,
      };
    } catch (error) {
      // Return error in MCP format
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Error executing tool '${name}': ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Error handling
  server.onerror = (error) => {
    console.error("[MCP Error]", error);
  };

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Note: In MCP mode, we should not log to stdout as it interferes with JSON-RPC
  // The SDK handles logging internally via stderr
}

/**
 * Format tool result for MCP response
 */
function formatToolResult(
  result: unknown,
): Array<{ type: string; text: string }> {
  if (result === undefined || result === null) {
    return [
      {
        type: "text",
        text: "Success",
      },
    ];
  }

  // If result is already a string, use it directly
  if (typeof result === "string") {
    return [
      {
        type: "text",
        text: result,
      },
    ];
  }

  // Otherwise, stringify the result as JSON
  return [
    {
      type: "text",
      text: JSON.stringify(result, null, 2),
    },
  ];
}
