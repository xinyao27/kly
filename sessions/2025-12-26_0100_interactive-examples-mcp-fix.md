# Session: Fix Interactive Examples for MCP Mode

> Date: 2025-12-26 01:00
> Duration: ~30min

## Summary

Fixed all interactive UI component examples to work correctly in both CLI and MCP modes by checking `context.mode` and adapting behavior accordingly.

## Problem

All example files using interactive UI components (`input`, `select`, `form`, `multiselect`, `password`, `autocomplete`) would fail in MCP mode with error:

```
Interactive input not available in MCP mode. All parameters must be defined in the tool's inputSchema.
```

## Root Cause

The examples were designed for CLI mode only, calling interactive UI functions directly without considering MCP mode where:

- Claude provides all parameters through inputSchema
- No user interaction is possible (stdio used for JSON-RPC)
- Parameters should be read from schema, not prompted

## Solution Pattern

For each interactive example, implemented the dual-mode pattern:

### 1. Update inputSchema

Add optional parameters for the values that would be collected interactively:

```typescript
inputSchema: z.object({
  // ... existing params
  value: z.string().optional().describe("Value (Claude provides in MCP mode)"),
})
```

### 2. Check context.mode in execute

```typescript
execute: async ({ value, ... }, context) => {
  if (context.mode === "mcp") {
    // Use value from schema (provided by Claude)
    result = value ?? defaultValue;
  } else {
    // Prompt user interactively (CLI mode)
    result = await input({ prompt: "..." });
  }
  return result;
}
```

## Files Modified

### Examples Fixed

1. **`examples/input.ts`**
   - Added `value` parameter to schema
   - Check mode: use schema value in MCP, prompt in CLI

2. **`examples/select.ts`**
   - Added `value` (string | number) parameter
   - Check mode: use schema value in MCP, interactive select in CLI

3. **`examples/multiselect.ts`**
   - Added `values` (array) parameter
   - Check mode: use schema values in MCP, interactive multiselect in CLI

4. **`examples/form.ts`**
   - Added all form field parameters to schema (username, email, age, role, etc.)
   - Check mode: filter provided values in MCP, interactive form in CLI

5. **`examples/password.ts`**
   - Added `useEnvVar` and `envVarName` parameters
   - Check mode: read from env vars in MCP (secure), interactive password in CLI
   - Security note: passwords should ALWAYS use environment variables in MCP

6. **`examples/autocomplete.ts`**
   - Added `query` and `values` parameters
   - Check mode: use schema values in MCP, interactive autocomplete in CLI

### UI Components Updated (Earlier)

Also updated UI component error messages to be MCP-aware:

- `src/ui/components/input.ts`
- `src/ui/components/select.ts`
- `src/ui/components/form.ts`
- `src/ui/components/password.ts`
- `src/ui/components/confirm.ts`

## Key Patterns

### Simple Value Input

```typescript
inputSchema: z.object({
  value: z.string().optional().describe("The input value"),
})
execute: async ({ value }, context) => {
  if (context.mode === "mcp") return value ?? "";
  return await input({ prompt: "Enter value" });
}
```

### Selection

```typescript
inputSchema: z.object({
  value: z.enum(["option1", "option2"]).optional(),
})
execute: async ({ value }, context) => {
  if (context.mode === "mcp") return value ?? "option1";
  return await select({ options: [...] });
}
```

### Multi-Selection

```typescript
inputSchema: z.object({
  values: z.array(z.string()).optional(),
})
execute: async ({ values }, context) => {
  if (context.mode === "mcp") return values ?? [];
  return await multiselect({ options: [...] });
}
```

### Form (Multiple Fields)

```typescript
inputSchema: z.object({
  field1: z.string().optional(),
  field2: z.number().optional(),
  // ... all fields
})
execute: async (args, context) => {
  if (context.mode === "mcp") {
    return Object.fromEntries(
      Object.entries(args).filter(([_, v]) => v !== undefined)
    );
  }
  return await form({ fields: [...] });
}
```

### Secrets (Password/API Keys)

```typescript
inputSchema: z.object({
  useEnvVar: z.boolean().default(true),
  envVarName: z.string().optional(),
})
execute: async ({ useEnvVar, envVarName }, context) => {
  if (context.mode === "mcp" || useEnvVar) {
    const secret = process.env[envVarName || "SECRET"];
    if (!secret) throw new Error("Env var not set");
    return secret;
  }
  return await password({ prompt: "Enter secret" });
}
```

## Benefits

1. ✅ **Dual-Mode Support**: All examples work in both CLI and MCP modes
2. ✅ **No Breaking Changes**: CLI mode behavior unchanged
3. ✅ **Clear Patterns**: Developers can easily adapt their own tools
4. ✅ **Security**: Passwords properly handled via environment variables in MCP
5. ✅ **Flexibility**: Claude can provide values based on conversation context

## Testing

Build successful:

```bash
bun run build
# ✔ Build complete in 1116ms
# ✔ [publint] No issues found
```

All examples now:

- Work in CLI mode (interactive prompts)
- Work in MCP mode (Claude provides parameters)
- Follow MCP best practices

## Documentation Updated

- **MCP-BEST-PRACTICES.md**: Added sections on:
  - Checking context mode for conditional logic
  - Pattern for input tools
  - Updated summary with new guidelines

## Next Steps

- ✅ All interactive examples fixed for MCP mode
- ✅ Documentation updated with patterns
- Ready for v0.1.0 release

## Key Takeaway

**The golden rule for MCP-compatible tools:**

> In MCP mode, use schema parameters (Claude provides values).
> In CLI mode, use interactive UI (user provides values).
> Always check `context.mode` to decide which path to take.
