export const DEFAULT_DIRECT_TOOL_COMMAND_POLICY: DirectToolCommandPolicy = {
  allowedTools: ["clear_chat", "show_toast"],
  enabledChannelTypes: ["telegram"],
  requireMention: true,
};

export type ParsedDirectToolCommand = {
  input: Record<string, any>;
  toolName: string;
};

export interface DirectToolCommandPolicy {
  allowedTools: string[];
  enabledChannelTypes: string[];
  requireMention: boolean;
}
