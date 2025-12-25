import { describe, expect, it, mock } from "bun:test";
import { createProgress } from "../components/progress";

// Mock isTTY to avoid output in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("progress (non-TTY mode)", () => {
  it("creates progress handle with default config", () => {
    const progress = createProgress();

    expect(progress).toHaveProperty("update");
    expect(progress).toHaveProperty("complete");
    expect(progress).toHaveProperty("fail");
  });

  it("creates progress with custom config", () => {
    const progress = createProgress({
      total: 50,
      message: "Loading...",
      width: 20,
    });

    expect(progress).toHaveProperty("update");
  });

  it("update method can be called without error", () => {
    const progress = createProgress({ total: 100 });

    expect(() => progress.update(50)).not.toThrow();
    expect(() => progress.update(100, "Done")).not.toThrow();
  });

  it("complete method can be called without error", () => {
    const progress = createProgress();

    expect(() => progress.complete()).not.toThrow();
    expect(() => progress.complete("Finished!")).not.toThrow();
  });

  it("fail method can be called without error", () => {
    const progress = createProgress();

    expect(() => progress.fail()).not.toThrow();
    expect(() => progress.fail("Error occurred")).not.toThrow();
  });
});
