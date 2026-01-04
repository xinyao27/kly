import { z } from "zod";
import { defineApp, tool } from "../src";

/**
 * Example app for testing natural language parameter extraction
 *
 * Usage:
 *   # Normal mode
 *   bun run examples/travel-advisor.ts --city Beijing --days 3
 *
 *   # Natural language mode (requires OPENAI_API_KEY or ANTHROPIC_API_KEY)
 *   export OPENAI_API_KEY=sk-...
 *   kly run examples/travel-advisor.ts "What should I pack for a week in Tokyo?"
 *   kly run examples/travel-advisor.ts "Is Paris cold in December?"
 *   kly run examples/travel-advisor.ts --budget=1000 "cheap trip to Bali"
 */

const adviseTool = tool({
  name: "advise",
  description: "Get travel advice for a city",
  inputSchema: z.object({
    city: z.string().describe("Destination city"),
    days: z.number().min(1).max(30).default(7).describe("Number of days to stay"),
    budget: z.number().optional().describe("Budget in USD (optional)"),
    season: z
      .enum(["spring", "summer", "fall", "winter"])
      .optional()
      .describe("Travel season (optional, inferred from current date if not provided)"),
  }),
  execute: async ({ city, days, budget, season }) => {
    // Mock weather data based on season
    const currentSeason = season || getCurrentSeason();
    const weather = getWeatherForSeason(currentSeason);

    // Generate packing list
    const packingList = generatePackingList(weather, days);

    // Budget advice
    const budgetAdvice = budget
      ? `With a budget of $${budget} for ${days} days, you have about $${Math.floor(budget / days)}/day.`
      : `Consider budgeting $50-150/day for ${city}.`;

    return {
      destination: city,
      duration: `${days} days`,
      season: currentSeason,
      weather,
      packingList,
      budgetAdvice,
      tips: [
        `Best time to visit ${city} is during ${getBestSeason(city)}`,
        `Don't forget travel insurance!`,
        `Book accommodations at least 2 weeks in advance`,
      ],
    };
  },
});

const app = defineApp({
  name: "travel-advisor",
  version: "0.1.0",
  description: "AI-powered travel advisor with natural language support",
  permissions: {
    // Needs API keys for natural language processing
    apiKeys: true,
  },
  tools: [adviseTool],
  instructions:
    "Help users plan their trips by extracting destination, duration, and preferences from natural language",
});

export default app;

// Helper functions
function getCurrentSeason(): "spring" | "summer" | "fall" | "winter" {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getWeatherForSeason(season: string): {
  temp: string;
  conditions: string;
} {
  const weatherMap = {
    spring: { temp: "15-20°C", conditions: "Mild, occasional rain" },
    summer: { temp: "25-30°C", conditions: "Hot and sunny" },
    fall: { temp: "10-15°C", conditions: "Cool and crisp" },
    winter: { temp: "0-5°C", conditions: "Cold, possible snow" },
  };
  return weatherMap[season as keyof typeof weatherMap] || weatherMap.spring;
}

function generatePackingList(
  weather: { temp: string; conditions: string },
  days: number,
): string[] {
  const base = ["Passport and travel documents", "Phone charger", `${days} days of clothing`];

  if (weather.temp.includes("25-30")) {
    base.push("Sunscreen", "Sunglasses", "Light clothing", "Swimwear");
  } else if (weather.temp.includes("0-5")) {
    base.push("Winter coat", "Warm layers", "Gloves", "Scarf");
  } else {
    base.push("Light jacket", "Comfortable shoes", "Umbrella");
  }

  return base;
}

function getBestSeason(_city: string): string {
  // Simplified - in real app would have city-specific data
  return "spring or fall";
}
