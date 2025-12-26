# Natural Language Mode

Clai supports parsing natural language input and automatically extracting structured parameters using LLMs.

## Quick Start

### 1. Set up an API key

```bash
# Option 1: OpenAI
export OPENAI_API_KEY=sk-...

# Option 2: Anthropic Claude
export ANTHROPIC_API_KEY=sk-ant-...

# Optional: Customize model or endpoint
export OPENAI_MODEL=gpt-4o-mini
export ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

### 2. Use natural language

```bash
# Instead of this:
clai run travel-advisor.ts --city Beijing --days 7 --budget 2000

# You can write this:
clai run travel-advisor.ts "Plan a week-long trip to Beijing with $2000 budget"
```

## How It Works

### Detection

Clai automatically detects natural language input when:
- Input contains **spaces** (e.g., "weather in Tokyo")
- Input contains **question marks** (e.g., "Is it cold?")
- Input contains **common words** (e.g., "what", "how", "the", "is", etc.)

### Parameter Extraction

When natural language is detected, Clai:
1. Sends the input to the configured LLM
2. Provides the tool's schema as context
3. Extracts structured parameters from the response
4. Executes the tool with those parameters

### Hybrid Mode

You can mix CLI flags with natural language:

```bash
# Specify budget explicitly, let AI extract other params
clai run travel-advisor.ts --budget 1000 "cheap trip to Bali"

# CLI flags always take precedence over AI-extracted values
clai run travel-advisor.ts --days 3 "week-long trip to Tokyo"
# Result: days=3 (from flag), city="Tokyo" (from AI)
```

## Examples

### Travel Advisor

```bash
# Natural language queries
clai run examples/travel-advisor.ts "What should I pack for Tokyo in winter?"
clai run examples/travel-advisor.ts "Is Paris expensive in December?"
clai run examples/travel-advisor.ts "Plan a cheap 3-day trip to Bali"

# Hybrid mode
clai run examples/travel-advisor.ts --budget 500 "backpacking in Thailand"
```

### Weather App (Multi-tool)

For apps with multiple tools, specify `--tool`:

```bash
clai run examples/weather.ts --tool current "What's the weather in Beijing?"
clai run examples/weather.ts --tool forecast "Will it rain in Tokyo this week?"
```

## Configuration

### Provider Priority

Clai checks environment variables in this order:
1. `OPENAI_API_KEY` → Uses OpenAI
2. `ANTHROPIC_API_KEY` → Uses Anthropic Claude

### Custom Endpoints

```bash
# Use OpenAI-compatible endpoint
export OPENAI_BASE_URL=https://api.your-proxy.com/v1
export OPENAI_API_KEY=your-key

# Use custom Anthropic endpoint
export ANTHROPIC_BASE_URL=https://api.your-proxy.com/v1
export ANTHROPIC_API_KEY=your-key
```

### Models

By default, Clai uses:
- OpenAI: `gpt-4o-mini` (fast and cheap)
- Anthropic: `claude-3-5-haiku-20241022` (fast and cheap)

To customize:

```bash
export OPENAI_MODEL=gpt-4o
export ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## Best Practices

### 1. Design good schema descriptions

```typescript
const tool = tool({
  inputSchema: z.object({
    city: z.string().describe("Destination city name"), // Good
    // city: z.string() // Bad - no context for LLM

    days: z.number()
      .min(1)
      .max(30)
      .describe("Number of days to stay"), // Good - clear constraints
  }),
});
```

### 2. Provide defaults for optional params

```typescript
inputSchema: z.object({
  unit: z.enum(["celsius", "fahrenheit"])
    .default("celsius") // LLM won't need to guess
    .describe("Temperature unit"),
});
```

### 3. Use meaningful property names

```typescript
// Good - clear intent
{ city: z.string(), departureDate: z.string() }

// Bad - ambiguous
{ c: z.string(), d: z.string() }
```

### 4. Handle extraction failures gracefully

The LLM might not always extract perfect parameters. Consider:
- Providing sensible defaults
- Validating extracted values
- Prompting users for missing required fields

## Programmatic Usage

You can also use the AI inference directly in your code:

```typescript
import { parseNaturalLanguage } from "clai";
import { z } from "zod";

const schema = z.object({
  city: z.string(),
  days: z.number(),
});

const params = await parseNaturalLanguage(
  "week-long trip to Tokyo",
  schema,
  { budget: 1000 } // already provided
);

console.log(params);
// { city: "Tokyo", days: 7, budget: 1000 }
```

## Troubleshooting

### Error: "Natural language mode requires an LLM API key"

Set either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable.

### Incorrect parameter extraction

Try:
1. Improve schema descriptions
2. Use a more capable model (e.g., `gpt-4o` instead of `gpt-4o-mini`)
3. Be more explicit in your natural language input
4. Use CLI flags for critical parameters

### App doesn't export default

Make sure your app exports the result of `defineApp()`:

```typescript
// ✓ Correct
const app = defineApp({...});
export default app;

// ✗ Wrong
defineApp({...}); // No export
```

## Cost Considerations

Natural language mode makes API calls to LLMs:

- **OpenAI gpt-4o-mini**: ~$0.0001-0.0005 per request
- **Anthropic claude-3-5-haiku**: ~$0.0008 per request

For heavy usage, consider:
- Using cheaper models
- Caching common queries
- Using CLI flags for known parameters
- Running locally with Ollama (future)

## Limitations

1. **Multi-tool apps**: Requires explicit `--tool` flag
2. **Complex nested objects**: Flat schemas work best
3. **Ambiguous input**: LLM may make assumptions
4. **Latency**: Adds ~500ms-2s for API call

## Future Enhancements

- [ ] Local LLM support (Ollama)
- [ ] Response streaming for faster UX
- [ ] Smart tool selection for multi-tool apps
- [ ] Parameter history and caching
- [ ] Interactive clarification prompts
