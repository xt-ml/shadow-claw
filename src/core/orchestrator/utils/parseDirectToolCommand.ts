import type { InboundMessage } from "../../../subsystems/channels/types.js";

import type {
  DirectToolCommandPolicy,
  ParsedDirectToolCommand,
} from "./types.js";

export function parseDirectToolCommand(
  policy: DirectToolCommandPolicy,
  assistantName: string,
  msg: InboundMessage,
): ParsedDirectToolCommand | null {
  if (!policy.enabledChannelTypes.includes(msg.channel)) {
    return null;
  }

  const content = msg.content.trim();
  const escapedAssistant = assistantName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let commandPart = content;
  if (policy.requireMention) {
    const mentionPrefix = new RegExp(
      `^@${escapedAssistant}\\b\\s*(?:-|:)?\\s*`,
      "i",
    );

    if (!mentionPrefix.test(commandPart)) {
      return null;
    }

    commandPart = commandPart.replace(mentionPrefix, "").trim();
  }

  const toolMatch = commandPart.match(/^\/([a-zA-Z0-9_]+)(?:\s+([\s\S]+))?$/);
  if (!toolMatch) {
    return null;
  }

  const toolName = toolMatch[1];
  if (!policy.allowedTools.includes(toolName)) {
    return null;
  }

  const rawArgs = (toolMatch[2] || "").trim();
  if (!rawArgs) {
    return { toolName, input: {} };
  }

  const unwrappedArgs =
    (rawArgs.startsWith("'") && rawArgs.endsWith("'")) ||
    (rawArgs.startsWith('"') && rawArgs.endsWith('"'))
      ? rawArgs.slice(1, -1).trim()
      : rawArgs;

  try {
    const parsedInput = JSON.parse(unwrappedArgs);
    if (parsedInput && typeof parsedInput === "object") {
      return {
        toolName,
        input: parsedInput as Record<string, any>,
      };
    }

    return null;
  } catch {
    return null;
  }
}
