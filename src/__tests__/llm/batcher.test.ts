import { describe, expect, it } from "vitest";

import { Batcher } from "../../llm/batcher.js";

describe("llm/batcher", () => {
  it("should execute all tasks and return results", async () => {
    const batcher = new Batcher<number>(3);
    const tasks = [1, 2, 3, 4, 5].map((n) => ({
      execute: async () => n * 2,
    }));
    const results = await batcher.run(tasks);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("should return results in the same order as input", async () => {
    const batcher = new Batcher<string>(2);
    const tasks = ["a", "b", "c"].map((s) => ({
      execute: async () => {
        // Simulate variable async delay
        await new Promise((r) => setTimeout(r, Math.random() * 10));
        return s;
      },
    }));
    const results = await batcher.run(tasks);
    expect(results).toEqual(["a", "b", "c"]);
  });

  it("should respect concurrency limit", async () => {
    const batcher = new Batcher<number>(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, (_, i) => ({
      execute: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return i;
      },
    }));

    await batcher.run(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("should return empty array for empty task list", async () => {
    const batcher = new Batcher<number>(5);
    const results = await batcher.run([]);
    expect(results).toEqual([]);
  });

  it("should propagate task errors", async () => {
    const batcher = new Batcher<number>(3);
    const tasks = [
      { execute: async () => 1 },
      {
        execute: async () => {
          throw new Error("task failed");
        },
      },
      { execute: async () => 3 },
    ];
    await expect(batcher.run(tasks)).rejects.toThrow("task failed");
  });
});
