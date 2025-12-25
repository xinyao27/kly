import { describe, expect, it } from "bun:test";
import { log } from "../components/log";

describe("log", () => {
  it("has all log methods", () => {
    expect(typeof log.info).toBe("function");
    expect(typeof log.success).toBe("function");
    expect(typeof log.step).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.message).toBe("function");
  });

  it("log.info can be called without error", () => {
    expect(() => log.info("Info message")).not.toThrow();
  });

  it("log.success can be called without error", () => {
    expect(() => log.success("Success message")).not.toThrow();
  });

  it("log.step can be called without error", () => {
    expect(() => log.step("Step message")).not.toThrow();
  });

  it("log.warn can be called without error", () => {
    expect(() => log.warn("Warning message")).not.toThrow();
  });

  it("log.error can be called without error", () => {
    expect(() => log.error("Error message")).not.toThrow();
  });

  it("log.message can be called without error", () => {
    expect(() => log.message("General message")).not.toThrow();
  });
});
