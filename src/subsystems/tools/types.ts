export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    properties?: Object;
    required?: string[];
    type?: string;
  };
}

export interface DeclarativeToolExecution {
  type: "bash" | "javascript" | "tool";
  command?: string;
  code?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * WebMCP tool annotations that a declarative tool may declare.
 *
 * Known hints (`readOnlyHint`, `consequentialHint`, `untrustedContentHint`,
 * `debugging`) are typed; any other boolean-valued hint is preserved so that
 * hints added to the WebMCP spec later keep working without a code change.
 */
export interface DeclarativeToolAnnotations {
  readOnlyHint?: boolean;
  consequentialHint?: boolean;
  untrustedContentHint?: boolean;
  debugging?: boolean;
  [hint: string]: boolean | undefined;
}

export interface DeclarativeToolDefinition extends ToolDefinition {
  execution: DeclarativeToolExecution;
  /** WebMCP annotations forwarded to `registerTool` (e.g. `readOnlyHint`). */
  annotations?: DeclarativeToolAnnotations;
  path?: string;
}

export interface ToolProfile {
  // Unique profile identifier
  id: string;
  // Display name
  name: string;
  // Associated provider ID (optional; matches any if omitted)
  providerId?: string;
  // Associated model (optional; matches any if omitted)
  model?: string;
  // Tool names enabled in this profile
  enabledToolNames: string[];
  // Custom/cloned tool definitions
  customTools: ToolDefinition[];
  // Optional system prompt override
  systemPromptOverride?: string;
}

export const ToolDefinition = undefined;
export const DeclarativeToolExecution = undefined;
export const DeclarativeToolDefinition = undefined;
export const ToolProfile = undefined;
