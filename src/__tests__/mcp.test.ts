import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mcpHarness = vi.hoisted(() => ({
  servers: [] as MockMcpServer[],
  transports: [] as MockTransport[],
  MockTransport: class MockTransport {},
  MockMcpServer: class MockMcpServer {
    tools = new Map<
      string,
      (input: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>;
        isError?: boolean;
      }>
    >();
    connect = vi.fn(async (_transport: object) => {});

    constructor(_meta: { name: string; version: string }) {
      mcpHarness.servers.push(this as MockMcpServer);
    }

    registerTool(
      name: string,
      _definition: Record<string, unknown>,
      handler: (input: Record<string, unknown>) => Promise<{
        content: Array<{ type: "text"; text: string }>;
        isError?: boolean;
      }>,
    ): void {
      this.tools.set(name, handler);
    }
  },
}));

type MockTransport = InstanceType<typeof mcpHarness.MockTransport>;
type MockMcpServer = InstanceType<typeof mcpHarness.MockMcpServer>;

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: mcpHarness.MockMcpServer,
}));

vi.mock("@modelcontextprotocol/sdk/server/stdio.js", () => ({
  StdioServerTransport: class extends mcpHarness.MockTransport {
    constructor() {
      super();
      mcpHarness.transports.push(this as MockTransport);
    }
  },
}));

import { initKlyDir } from "../config";
import { startMcpServer } from "../mcp";
import { openDatabase } from "../store";
import { cleanupTempDir, createFileIndex, createTempDir } from "./helpers/fixtures";

function getLatestServer(): MockMcpServer {
  const server = mcpHarness.servers.at(-1);
  if (!server) {
    throw new Error("Expected MCP server to be created");
  }
  return server;
}

function getTextPayload(result: { content: Array<{ type: "text"; text: string }> }): string {
  return result.content[0]?.text ?? "";
}

describe("startMcpServer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTempDir();
    mcpHarness.servers.length = 0;
    mcpHarness.transports.length = 0;

    initKlyDir(tmpDir);
    const db = openDatabase(tmpDir, "default");
    db.setMetadata("generated_at", "2026-03-19T00:00:00.000Z");
    db.upsertFile(
      createFileIndex({
        path: "src/auth.ts",
        name: "Auth Module",
        description: "Handles authentication flows",
        summary: "Indexes login and session helpers.",
      }),
    );
    db.close();
  });

  afterEach(() => {
    cleanupTempDir(tmpDir);
  });

  it("connects over stdio and registers the public tools", async () => {
    await startMcpServer(tmpDir);

    const server = getLatestServer();
    expect(mcpHarness.transports).toHaveLength(1);
    expect(server.connect).toHaveBeenCalledWith(mcpHarness.transports[0]);
    expect([...server.tools.keys()]).toEqual(["search_files", "get_file_index", "get_overview"]);
  });

  it("returns structured search results for `search_files`", async () => {
    await startMcpServer(tmpDir);

    const server = getLatestServer();
    const result = await server.tools.get("search_files")!({
      query: "authentication",
      limit: 10,
      rerank: false,
    });

    const payload = JSON.parse(getTextPayload(result)) as Array<Record<string, unknown>>;
    expect(payload).toHaveLength(1);
    expect(payload[0]).toMatchObject({
      path: "src/auth.ts",
      name: "Auth Module",
      description: "Handles authentication flows",
      language: "typescript",
    });
  });

  it("returns file details and overview payloads", async () => {
    await startMcpServer(tmpDir);

    const server = getLatestServer();

    const fileResult = await server.tools.get("get_file_index")!({
      path: "src/auth.ts",
    });
    expect(JSON.parse(getTextPayload(fileResult))).toMatchObject({
      path: "src/auth.ts",
      name: "Auth Module",
    });

    const missingResult = await server.tools.get("get_file_index")!({
      path: "src/missing.ts",
    });
    expect(missingResult.isError).toBe(true);
    expect(getTextPayload(missingResult)).toBe("File not found in index: src/missing.ts");

    const overviewResult = await server.tools.get("get_overview")!({});
    expect(JSON.parse(getTextPayload(overviewResult))).toMatchObject({
      totalFiles: 1,
      generatedAt: "2026-03-19T00:00:00.000Z",
      languages: {
        typescript: 1,
      },
      files: [
        {
          path: "src/auth.ts",
          name: "Auth Module",
          description: "Handles authentication flows",
        },
      ],
    });
  });
});
