/* agent-frontmatter:start
AGENT: Weather CLI with multiple tools
PURPOSE: Demonstrate multi-tools mode with subcommands
USAGE: bun run examples/weather.ts current --city=Beijing
EXPORTS: currentTool, forecastTool
FEATURES:
  - Multiple tools in one app
  - Subcommand support (current, forecast)
  - Shared types between tools
SEARCHABLE: example, weather, multi-tools, subcommand
agent-frontmatter:end */

import { z } from "zod";
import { defineApp, tool } from "../src";

// Tool 1: Current weather
const currentTool = tool({
  name: "current",
  description: "Get current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .default("celsius")
      .describe("Temperature unit"),
  }),
  execute: async ({ city, unit }) => {
    const temp = Math.floor(Math.random() * 30) + 5;
    const displayTemp =
      unit === "fahrenheit" ? Math.floor(temp * 1.8 + 32) : temp;
    const symbol = unit === "fahrenheit" ? "°F" : "°C";

    return {
      city,
      temperature: `${displayTemp}${symbol}`,
      condition: ["Sunny", "Cloudy", "Rainy"][Math.floor(Math.random() * 3)],
    };
  },
});

// Tool 2: Weather forecast
const forecastTool = tool({
  name: "forecast",
  description: "Get weather forecast for upcoming days",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    days: z.number().min(1).max(7).default(3).describe("Number of days"),
  }),
  execute: async ({ city, days }) => {
    const forecast = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      forecast.push({
        date: date.toISOString().split("T")[0],
        high: Math.floor(Math.random() * 15) + 20,
        low: Math.floor(Math.random() * 10) + 10,
        condition: ["Sunny", "Cloudy", "Rainy"][Math.floor(Math.random() * 3)],
      });
    }
    return { city, forecast };
  },
});

// Multi-tools app
defineApp({
  name: "weather",
  version: "0.1.0",
  description: "Weather CLI with current conditions and forecast",
  tools: [currentTool, forecastTool],
});
