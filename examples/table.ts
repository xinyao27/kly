import { z } from "zod";
import { color, defineApp, table, tool } from "../src";

const showUsersTool = tool({
  name: "users",
  description: "Display a table of users",
  inputSchema: z.object({
    format: z
      .enum(["basic", "detailed", "minimal"])
      .default("basic")
      .describe("Display format"),
  }),
  execute: async ({ format }) => {
    const users = [
      { name: "Alice Johnson", age: 28, role: "Engineer", status: "active" },
      { name: "Bob Smith", age: 34, role: "Designer", status: "active" },
      { name: "Carol White", age: 29, role: "Manager", status: "inactive" },
      { name: "David Brown", age: 42, role: "Engineer", status: "active" },
      { name: "Eve Davis", age: 31, role: "Designer", status: "active" },
    ];

    if (format === "minimal") {
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "role", header: "Role" },
        ],
        rows: users,
        showBorders: false,
      });
    } else if (format === "detailed") {
      table({
        title: "User Directory",
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age", align: "right" },
          { key: "role", header: "Role", align: "center" },
          {
            key: "status",
            header: "Status",
            formatter: (val: unknown) =>
              val === "active"
                ? color.green("● Active")
                : color.red("○ Inactive"),
          },
        ],
        rows: users,
      });
    } else {
      // basic format
      table({
        columns: [
          { key: "name", header: "Name" },
          { key: "age", header: "Age", align: "right" },
          { key: "role", header: "Role" },
          { key: "status", header: "Status" },
        ],
        rows: users,
      });
    }

    return "Table displayed";
  },
});

const showStatsTool = tool({
  name: "stats",
  description: "Display statistics table",
  inputSchema: z.object({}),
  execute: async () => {
    const stats = [
      { metric: "Total Users", value: 1250, change: "+12.5%" },
      { metric: "Active Sessions", value: 342, change: "+8.2%" },
      { metric: "API Calls", value: 45780, change: "-3.1%" },
      { metric: "Error Rate", value: 0.02, change: "-0.5%" },
    ];

    table({
      title: "System Statistics",
      columns: [
        { key: "metric", header: "Metric" },
        {
          key: "value",
          header: "Value",
          align: "right",
          formatter: (val: unknown) =>
            typeof val === "number" ? val.toLocaleString() : String(val),
        },
        {
          key: "change",
          header: "Change",
          align: "center",
          formatter: (val: unknown) => {
            const str = String(val);
            return str.startsWith("+")
              ? color.green(str)
              : str.startsWith("-")
                ? color.red(str)
                : str;
          },
        },
      ],
      rows: stats,
    });

    return "Statistics displayed";
  },
});

defineApp({
  name: "table-demo",
  version: "0.1.0",
  description: "Demonstrate table component capabilities",
  tools: [showUsersTool, showStatsTool],
});
