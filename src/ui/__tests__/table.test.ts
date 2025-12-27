import { describe, expect, test } from "bun:test";
import { table } from "../components/table";

describe("table", () => {
  test("should render table with data", () => {
    // This is a smoke test - just verify it doesn't throw
    const data = [
      { name: "Alice", age: 25, status: "active" },
      { name: "Bob", age: 30, status: "inactive" },
    ];

    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age", align: "right" },
          { key: "status", header: "Status" },
        ],
        rows: data,
      });
    }).not.toThrow();
  });

  test("should render table with title", () => {
    const data = [{ name: "Alice", age: 25 }];

    expect(() => {
      table({
        title: "Users Table",
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age" },
        ],
        rows: data,
      });
    }).not.toThrow();
  });

  test("should render empty table", () => {
    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age" },
        ],
        rows: [],
      });
    }).not.toThrow();
  });

  test("should render table without header", () => {
    const data = [{ name: "Alice", age: 25 }];

    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age" },
        ],
        rows: data,
        showHeader: false,
      });
    }).not.toThrow();
  });

  test("should render table without borders", () => {
    const data = [{ name: "Alice", age: 25 }];

    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age" },
        ],
        rows: data,
        showBorders: false,
      });
    }).not.toThrow();
  });

  test("should handle custom formatter", () => {
    const data = [{ name: "Alice", score: 95 }];

    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          {
            key: "score",
            header: "Score",
            formatter: (val) => `${val}%`,
          },
        ],
        rows: data,
      });
    }).not.toThrow();
  });

  test("should handle null and undefined values", () => {
    const data = [
      { name: "Alice", age: 25, city: null },
      { name: "Bob", age: undefined, city: "NYC" },
    ];

    expect(() => {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age" },
          { key: "city", header: "City" },
        ],
        rows: data,
      });
    }).not.toThrow();
  });

  test("should handle different alignments", () => {
    const data = [{ left: "L", center: "C", right: "R" }];

    expect(() => {
      table({
        columns: [
          { key: "left", header: "Left", align: "left" },
          { key: "center", header: "Center", align: "center" },
          { key: "right", header: "Right", align: "right" },
        ],
        rows: data,
      });
    }).not.toThrow();
  });

  test("should handle fixed column widths", () => {
    const data = [{ short: "A", long: "Very Long Text Here" }];

    expect(() => {
      table({
        columns: [
          { key: "short", header: "Short", width: 20 },
          { key: "long", header: "Long", width: 10 },
        ],
        rows: data,
      });
    }).not.toThrow();
  });
});
