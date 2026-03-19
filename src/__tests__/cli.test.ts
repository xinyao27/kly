import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cliMocks = vi.hoisted(() => ({
  runInit: vi.fn(),
  runBuild: vi.fn(),
  runQuery: vi.fn(),
  runShow: vi.fn(),
  runGraph: vi.fn(),
  runOverview: vi.fn(),
  runServe: vi.fn(),
  runHook: vi.fn(),
  runGc: vi.fn(),
}));

vi.mock("../commands/init", () => ({
  runInit: cliMocks.runInit,
}));

vi.mock("../commands/build", () => ({
  runBuild: cliMocks.runBuild,
}));

vi.mock("../commands/query", () => ({
  runQuery: cliMocks.runQuery,
}));

vi.mock("../commands/show", () => ({
  runShow: cliMocks.runShow,
}));

vi.mock("../commands/graph", () => ({
  runGraph: cliMocks.runGraph,
}));

vi.mock("../commands/overview", () => ({
  runOverview: cliMocks.runOverview,
}));

vi.mock("../commands/serve", () => ({
  runServe: cliMocks.runServe,
}));

vi.mock("../commands/hook", () => ({
  runHook: cliMocks.runHook,
}));

vi.mock("../commands/gc", () => ({
  runGc: cliMocks.runGc,
}));

const originalArgv = [...process.argv];

async function importCliWithArgs(args: string[]): Promise<void> {
  vi.resetModules();
  process.argv = ["node", "kly", ...args];
  await import("../cli");
}

describe("cli wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
  });

  it("routes `mcp` to runServe", async () => {
    await importCliWithArgs(["mcp"]);
    expect(cliMocks.runServe).toHaveBeenCalledWith(process.cwd());
  });

  it("routes `query --rerank` to runQuery with parsed options", async () => {
    await importCliWithArgs(["query", "auth middleware", "--rerank"]);
    expect(cliMocks.runQuery).toHaveBeenCalledWith(process.cwd(), "auth middleware", {
      rerank: true,
    });
  });

  it("routes `graph` to runGraph with parsed depth and format", async () => {
    await importCliWithArgs(["graph", "--focus", "src/auth.ts", "--depth", "3", "--format", "svg"]);
    expect(cliMocks.runGraph).toHaveBeenCalledWith(process.cwd(), {
      focus: "src/auth.ts",
      depth: 3,
      format: "svg",
    });
  });

  it("routes `hook install` to runHook", async () => {
    await importCliWithArgs(["hook", "install"]);
    expect(cliMocks.runHook).toHaveBeenCalledWith(process.cwd(), "install");
  });
});
