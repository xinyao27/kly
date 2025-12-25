import { z } from "zod";
import { defineApp, tool } from "../src";
import { autocomplete, autocompleteMultiselect, log } from "../src/ui";

const autocompleteTool = tool({
  name: "search-select",
  description: "Autocomplete search and select demonstrations",
  inputSchema: z.object({
    demo: z
      .enum(["countries", "packages", "multi"])
      .default("countries")
      .describe("Type of autocomplete demo to run"),
  }),
  execute: async ({ demo }) => {
    switch (demo) {
      case "countries": {
        const country = await autocomplete({
          prompt: "Search for a country",
          placeholder: "Type to search...",
          options: [
            {
              name: "United States",
              value: "us",
              description: "North America",
            },
            { name: "United Kingdom", value: "uk", description: "Europe" },
            { name: "Germany", value: "de", description: "Europe" },
            { name: "France", value: "fr", description: "Europe" },
            { name: "Japan", value: "jp", description: "Asia" },
            { name: "China", value: "cn", description: "Asia" },
            { name: "Australia", value: "au", description: "Oceania" },
            { name: "Brazil", value: "br", description: "South America" },
            { name: "Canada", value: "ca", description: "North America" },
            { name: "India", value: "in", description: "Asia" },
          ],
          maxItems: 5,
        });

        log.success(`Selected: ${country}`);
        return { demo, selected: country };
      }

      case "packages": {
        const pkg = await autocomplete({
          prompt: "Search npm packages",
          placeholder: "e.g., react, vue, express...",
          options: [
            { name: "react", value: "react", description: "UI library" },
            { name: "vue", value: "vue", description: "Progressive framework" },
            { name: "express", value: "express", description: "Web framework" },
            {
              name: "typescript",
              value: "typescript",
              description: "Typed JS",
            },
            { name: "vite", value: "vite", description: "Build tool" },
            { name: "eslint", value: "eslint", description: "Linter" },
            { name: "prettier", value: "prettier", description: "Formatter" },
            { name: "zod", value: "zod", description: "Schema validation" },
          ],
        });

        log.success(`Installing ${pkg}...`);
        return { demo, package: pkg };
      }

      case "multi": {
        const frameworks = await autocompleteMultiselect({
          prompt: "Search and select frameworks",
          placeholder: "Type to filter...",
          options: [
            { name: "React", value: "react", description: "Meta" },
            { name: "Vue", value: "vue", description: "Evan You" },
            { name: "Angular", value: "angular", description: "Google" },
            { name: "Svelte", value: "svelte", description: "Rich Harris" },
            { name: "Solid", value: "solid", description: "Ryan Carniato" },
            { name: "Qwik", value: "qwik", description: "Builder.io" },
            {
              name: "Preact",
              value: "preact",
              description: "Lightweight React",
            },
          ],
          maxItems: 5,
        });

        log.success(`Selected ${frameworks.length} frameworks`);
        return { demo, selected: frameworks, count: frameworks.length };
      }
    }
  },
});

defineApp({
  name: "autocomplete-example",
  version: "0.1.0",
  description: "Autocomplete search examples",
  tools: [autocompleteTool],
});
