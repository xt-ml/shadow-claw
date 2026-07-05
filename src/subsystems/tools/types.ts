export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    properties?: Object;
    required?: string[];
    type?: string;
  };
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
