/* agent-frontmatter:start
AGENT: Type definitions for Clai
PURPOSE: Define core types for tool, defineApp, context, and app instances
USAGE: Import types in tool.ts, define-app.ts and other modules
EXPORTS: StandardSchemaV1, InferOutput, Tool, ToolDefinition, AppDefinition, ExecuteContext, ClaiApp, RuntimeMode
FEATURES:
  - Standard Schema V1 interface (inlined for zero deps)
  - Type inference from schema to args
  - Dual API support (tool + defineApp)
  - Runtime mode detection types
SEARCHABLE: types, schema, tool, defineApp, context, standard schema
agent-frontmatter:end */

/**
 * Standard Schema V1 interface (inlined to avoid external dependency)
 * @see https://github.com/standard-schema/standard-schema
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output>;
  }

  type Result<Output> = SuccessResult<Output> | FailureResult;

  interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>;
  }

  interface PathSegment {
    readonly key: PropertyKey;
  }

  interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
}

/**
 * Extract output type from a Standard Schema
 */
export type InferOutput<TSchema> =
  TSchema extends StandardSchemaV1<unknown, infer Output> ? Output : never;

/**
 * Runtime execution mode
 */
export type RuntimeMode = "cli" | "mcp" | "programmatic";

/**
 * Context passed to the execute function
 */
export interface ExecuteContext {
  /** Current runtime mode */
  mode: RuntimeMode;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Tool definition (Vercel AI SDK style)
 * Core building block that can be used standalone or within defineApp
 */
export interface ToolDefinition<
  TInput extends StandardSchemaV1,
  TResult = unknown,
> {
  /** Description of what the tool does (used by LLM for tool selection) */
  description?: string;
  /** Input schema (Standard Schema compliant: Zod, Valibot, ArkType, etc.) */
  inputSchema: TInput;
  /** Execute function that performs the tool's action */
  execute: (
    args: InferOutput<TInput>,
    context: ExecuteContext,
  ) => Promise<TResult>;
}

/**
 * Tool instance returned by tool()
 * Each tool has a name for CLI subcommand and MCP registration
 */
export interface Tool<TInput extends StandardSchemaV1, TResult = unknown>
  extends ToolDefinition<TInput, TResult> {
  /** Tool name (used as subcommand in CLI, tool name in MCP) */
  name: string;
  /** Type brand for tool identification */
  readonly _brand: "Tool";
}

/**
 * Any tool type for collections
 */
export type AnyTool = Tool<StandardSchemaV1, unknown>;

/**
 * Base app metadata
 */
export interface AppMetadata {
  /** App name */
  name: string;
  /** Semantic version */
  version: string;
  /** App description */
  description: string;
}

/**
 * App definition with tools array
 */
export interface AppDefinition<TTools extends AnyTool[] = AnyTool[]>
  extends AppMetadata {
  /** Array of tools */
  tools: TTools;
}

/**
 * Clai app instance returned by defineApp
 */
export interface ClaiApp<TTools extends AnyTool[] = AnyTool[]> {
  /** Original app configuration */
  readonly definition: AppDefinition<TTools>;
  /** Execute a specific tool by name */
  execute(toolName: string, args?: Record<string, unknown>): Promise<unknown>;
  /** Get all available tools */
  readonly tools: Map<string, AnyTool>;
}

/**
 * Validation error with structured issues
 */
export class ValidationError extends Error {
  constructor(public readonly issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    const message = issues
      .map((issue) => {
        const path = issue.path
          ?.map((p) => (typeof p === "object" ? p.key : p))
          .join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join("\n");
    super(message);
    this.name = "ValidationError";
  }
}
