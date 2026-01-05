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
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
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
 * Model configuration information (basic info without secrets)
 */
export interface ModelInfo {
  /** Model configuration name */
  name: string;
  /** Provider (openai, anthropic, etc.) */
  provider: string;
  /** Model name (e.g., gpt-4, claude-3-opus) */
  model?: string;
  /** Whether this is the current active model */
  isCurrent: boolean;
}

/**
 * Full model configuration including API keys
 */
export interface ModelConfig {
  /** Provider (openai, anthropic, etc.) */
  provider: string;
  /** Model name (e.g., gpt-4, claude-3-opus) */
  model?: string;
  /** API key */
  apiKey?: string;
  /** Base URL */
  baseURL?: string;
}

/**
 * Models management interface
 * Provides access to configured LLM models and their credentials
 */
export interface ModelsContext {
  /**
   * List all configured models (without API keys)
   */
  list(): ModelInfo[];

  /**
   * Get the current active model info
   */
  getCurrent(): ModelInfo | null;

  /**
   * Get a specific model info by name
   */
  get(name: string): ModelInfo | null;

  /**
   * Get full configuration for a model (including API key)
   *
   * ⚠️  SECURITY: This method requires user permission
   * The first time this is called, the user will be prompted to grant permission.
   * Permission can be granted for:
   * - One time only
   * - Always for this app
   * - Denied
   *
   * @param name - Model name (if not specified, returns current model)
   * @returns Full config or null if not found/configured
   * @throws Error if permission is denied
   *
   * @example
   * ```typescript
   * const config = await context.models.getConfigAsync();
   * if (config) {
   *   // Use config.provider, config.apiKey, config.model etc.
   * }
   * ```
   */
  getConfigAsync(name?: string): Promise<ModelConfig | null>;
}

/**
 * Context passed to the execute function
 */
export interface ExecuteContext {
  /** Current runtime mode */
  mode: RuntimeMode;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /**
   * Models management
   * Access configured LLM models and their credentials
   * @example
   * ```typescript
   * const config = context.models.getConfig();
   * if (config) {
   *   // Use config.provider, config.apiKey, config.model etc.
   *   // to create your own AI SDK provider instance
   * }
   * ```
   */
  models: ModelsContext;
  /**
   * Working directory where `kly run` was invoked
   * This is the directory from which the user ran the command,
   * not the directory where the script is located
   * @example
   * ```typescript
   * // User runs: cd /home/user/project && kly run /home/user/tools/my-tool.ts
   * // context.invokeDir === "/home/user/project"
   * // process.cwd() === "/home/user/tools" (script directory)
   * ```
   */
  invokeDir?: string;
}

/**
 * Tool definition (Vercel AI SDK style)
 * Core building block that can be used standalone or within defineApp
 */
export interface ToolDefinition<TInput extends StandardSchemaV1, TResult = unknown> {
  /** Description of what the tool does (used by LLM for tool selection) */
  description?: string;
  /** Input schema (Standard Schema compliant: Zod, Valibot, ArkType, etc.) */
  inputSchema: TInput;
  /** Execute function that performs the tool's action */
  execute: (args: InferOutput<TInput>, context: ExecuteContext) => Promise<TResult>;
}

/**
 * Tool instance returned by tool()
 * Each tool has a name for CLI subcommand and MCP registration
 */
export interface Tool<TInput extends StandardSchemaV1, TResult = unknown> extends ToolDefinition<
  TInput,
  TResult
> {
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
 * All fields are optional - defaults will be used if not provided
 */
export interface AppMetadata {
  /** App name (defaults to "unknown" if not provided) */
  name?: string;
  /** Semantic version (defaults to "0.0.0" if not provided) */
  version?: string;
  /** App description (defaults to "" if not provided) */
  description?: string;
}

/**
 * App definition with tools array
 *
 * @example
 * ```typescript
 * defineApp({
 *   name: "my-app",
 *   version: "0.1.0",
 *   description: "My CLI app",
 *   tools: [greetTool, farewellTool],
 *   instructions: "When user expresses greeting intent, prefer the greet tool",
 * })
 * ```
 */
export interface AppDefinition<TTools extends AnyTool[] = AnyTool[]> extends AppMetadata {
  /** Array of tools */
  tools: TTools;
  /**
   * AI instructions for Skill mode
   * Hints for AI routing when this app is composed with others
   */
  instructions?: string;
}

/**
 * Kly app instance returned by defineApp
 */
export interface KlyApp<TTools extends AnyTool[] = AnyTool[]> {
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
        const path = issue.path?.map((p) => (typeof p === "object" ? p.key : p)).join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join("\n");
    super(message);
    this.name = "ValidationError";
  }
}
