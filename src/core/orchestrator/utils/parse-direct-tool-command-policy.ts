import {
  DEFAULT_DIRECT_TOOL_COMMAND_POLICY,
  type DirectToolCommandPolicy,
} from "./types.js";

/**
 * Parses a raw JSON string into a validated DirectToolCommandPolicy.
 * Falls back to the default policy on parse failure or missing input.
 */
export function parseDirectToolCommandPolicy(
  raw: string | null | undefined,
): DirectToolCommandPolicy {
  if (!raw) {
    return {
      allowedTools: [...DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools],
      enabledChannelTypes: [
        ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY.enabledChannelTypes,
      ],
      requireMention: DEFAULT_DIRECT_TOOL_COMMAND_POLICY.requireMention,
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DirectToolCommandPolicy>;

    const enabledChannelTypes = Array.isArray(parsed.enabledChannelTypes)
      ? parsed.enabledChannelTypes.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
      : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.enabledChannelTypes;

    const allowedTools = Array.isArray(parsed.allowedTools)
      ? parsed.allowedTools.filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        )
      : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools;

    return {
      allowedTools,
      enabledChannelTypes,
      requireMention:
        typeof parsed.requireMention === "boolean"
          ? parsed.requireMention
          : DEFAULT_DIRECT_TOOL_COMMAND_POLICY.requireMention,
    };
  } catch {
    return {
      allowedTools: [...DEFAULT_DIRECT_TOOL_COMMAND_POLICY.allowedTools],
      enabledChannelTypes: [
        ...DEFAULT_DIRECT_TOOL_COMMAND_POLICY.enabledChannelTypes,
      ],
      requireMention: DEFAULT_DIRECT_TOOL_COMMAND_POLICY.requireMention,
    };
  }
}
