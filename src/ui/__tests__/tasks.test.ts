import { describe, expect, it, mock } from "bun:test";
import { tasks } from "../components/tasks";

// Mock isTTY to avoid spinner output in tests
mock.module("../utils/tty", () => ({
  isTTY: () => false,
}));

describe("tasks (non-TTY mode)", () => {
  it("executes single task successfully", async () => {
    const results = await tasks([
      {
        title: "Test task",
        task: async () => "done",
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(results[0]?.result).toBe("done");
  });

  it("executes multiple tasks in sequence", async () => {
    const order: number[] = [];

    const results = await tasks([
      {
        title: "Task 1",
        task: async () => {
          order.push(1);
          return "first";
        },
      },
      {
        title: "Task 2",
        task: async () => {
          order.push(2);
          return "second";
        },
      },
    ]);

    expect(results).toHaveLength(2);
    expect(order).toEqual([1, 2]);
    expect(results[0]?.result).toBe("first");
    expect(results[1]?.result).toBe("second");
  });

  it("captures task failure", async () => {
    const results = await tasks([
      {
        title: "Failing task",
        task: async () => {
          throw new Error("Task failed");
        },
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(false);
    expect(results[0]?.error?.message).toBe("Task failed");
  });

  it("skips disabled tasks", async () => {
    const results = await tasks([
      {
        title: "Enabled task",
        task: async () => "enabled",
      },
      {
        title: "Disabled task",
        task: async () => "disabled",
        enabled: false,
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Enabled task");
  });

  it("provides message callback to tasks", async () => {
    let messageReceived = false;

    await tasks([
      {
        title: "Task with message",
        task: async (message) => {
          message("Updating status...");
          messageReceived = true;
        },
      },
    ]);

    expect(messageReceived).toBe(true);
  });
});
