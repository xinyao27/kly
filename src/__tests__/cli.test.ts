import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cliMocks = vi.hoisted(() => ({
  runInit: vi.fn(),
  runBuild: vi.fn(),
  runQuery: vi.fn(),
  runShow: vi.fn(),
  runGraph: vi.fn(),
  runOverview: vi.fn(),
  runHook: vi.fn(),
  runGc: vi.fn(),
  runDependents: vi.fn(),
  runHistory: vi.fn(),
  runEnrich: vi.fn(),
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

vi.mock("../commands/hook", () => ({
  runHook: cliMocks.runHook,
}));

vi.mock("../commands/gc", () => ({
  runGc: cliMocks.runGc,
}));

vi.mock("../commands/dependents", () => ({
  runDependents: cliMocks.runDependents,
}));

vi.mock("../commands/history", () => ({
  runHistory: cliMocks.runHistory,
}));

vi.mock("../commands/enrich", () => ({
  runEnrich: cliMocks.runEnrich,
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

  it("routes `query --rerank` to runQuery with parsed options", async () => {
    await importCliWithArgs(["query", "auth middleware", "--rerank"]);
    expect(cliMocks.runQuery).toHaveBeenCalledWith(process.cwd(), "auth middleware", {
      rerank: true,
      limit: 10,
      pretty: undefined,
    });
  });

  it("routes `query --limit 5 --pretty` to runQuery", async () => {
    await importCliWithArgs(["query", "auth", "--limit", "5", "--pretty"]);
    expect(cliMocks.runQuery).toHaveBeenCalledWith(process.cwd(), "auth", {
      rerank: undefined,
      limit: 5,
      pretty: true,
    });
  });

  it("routes `show --pretty` to runShow", async () => {
    await importCliWithArgs(["show", "src/auth.ts", "--pretty"]);
    expect(cliMocks.runShow).toHaveBeenCalledWith(process.cwd(), "src/auth.ts", {
      pretty: true,
    });
  });

  it("routes `graph` to runGraph with parsed depth", async () => {
    await importCliWithArgs(["graph", "--focus", "src/auth.ts", "--depth", "3", "--pretty"]);
    expect(cliMocks.runGraph).toHaveBeenCalledWith(process.cwd(), {
      focus: "src/auth.ts",
      depth: 3,
      pretty: true,
    });
  });

  it("routes `dependents` to runDependents", async () => {
    await importCliWithArgs(["dependents", "src/types.ts", "--pretty"]);
    expect(cliMocks.runDependents).toHaveBeenCalledWith(process.cwd(), "src/types.ts", {
      pretty: true,
    });
  });

  it("routes `history --limit` to runHistory", async () => {
    await importCliWithArgs(["history", "src/auth.ts", "--limit", "10"]);
    expect(cliMocks.runHistory).toHaveBeenCalledWith(process.cwd(), "src/auth.ts", {
      limit: 10,
      pretty: undefined,
    });
  });

  it("routes `enrich --frames` to runEnrich", async () => {
    await importCliWithArgs(["enrich", "--frames", '[{"file":"src/a.ts","line":1}]']);
    expect(cliMocks.runEnrich).toHaveBeenCalledWith(process.cwd(), {
      frames: '[{"file":"src/a.ts","line":1}]',
    });
  });

  it("routes `hook install` to runHook", async () => {
    await importCliWithArgs(["hook", "install"]);
    expect(cliMocks.runHook).toHaveBeenCalledWith(process.cwd(), "install");
  });

  it("routes `init --provider --api-key` to runInit", async () => {
    await importCliWithArgs(["init", "--provider", "openrouter", "--api-key", "sk-test"]);
    expect(cliMocks.runInit).toHaveBeenCalledWith(
      process.cwd(),
      expect.objectContaining({
        provider: "openrouter",
        apiKey: "sk-test",
      }),
    );
  });
});
