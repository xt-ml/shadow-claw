import { estimateTokens, estimateMessageTokens } from "./estimateTokens.js";
import { truncateToolOutput } from "./truncateToolOutput.js";
import type { ConversationMessage } from "../types.js";

interface DynamicContextResult {
  messages: ConversationMessage[];
  estimatedTokens: number;
  truncatedCount: number;
  contextLimit: number;
  usagePercent: number;
}

interface DynamicContextOptions {
  contextLimit: number;
  systemPromptTokens: number;
  maxOutputTokens: number;
  skimTop?: boolean;
}

/**
 * Default fallback characters allowed for a single tool output before truncation.
 * ~25K chars ≈ ~6K tokens — keeps any single tool result from dominating.
 */
const DEFAULT_TOOL_OUTPUT_MAX_CHARS = 25_000;

/**
 * Build a dynamic context window that fits within the model's token budget.
 *
 * Strategy:
 * 1. Calculate available budget: contextLimit - systemPrompt - maxOutput
 * 2. Truncate large tool outputs in all messages
 * 3. Walk messages from newest to oldest, accumulating until budget is exceeded
 * 4. If skimTop is true, always try to keep the first message (index 0) if it is a user message.
 * 5. Always keep at least the most recent message.
 */
export function buildDynamicContext(
  messages: ConversationMessage[],
  options: DynamicContextOptions,
): DynamicContextResult {
  const {
    contextLimit,
    systemPromptTokens,
    maxOutputTokens,
    skimTop = false,
  } = options;

  if (messages.length === 0) {
    return {
      messages: [],
      estimatedTokens: 0,
      truncatedCount: 0,
      contextLimit,
      usagePercent: 0,
    };
  }

  const availableBudget = Math.max(
    0,
    contextLimit - systemPromptTokens - maxOutputTokens,
  );

  // Determine a safe maximum character limit for tool outputs based on the budget.
  // We assume roughly 4 chars per token. We want any given tool to take up AT MOST
  // 60% of the available budget (leaving room for user request, etc.), up to the default max.
  const dynamicToolMaxChars = Math.min(
    DEFAULT_TOOL_OUTPUT_MAX_CHARS,
    Math.max(1000, Math.floor(availableBudget * 0.6 * 4)),
  );

  // First pass: truncate large tool outputs
  const processed = messages.map((msg) =>
    truncateMessage(msg, dynamicToolMaxChars),
  );

  // Second pass: walk from newest to oldest, fitting within budget
  let usedTokens = 0;
  let startIndex = processed.length;

  // If skimTop is enabled, we reserve budget for the first message (if it fits)
  let topMessage: ConversationMessage | null = null;
  let topMessageTokens = 0;
  if (skimTop && processed.length > 0) {
    const first = processed[0];
    if (first.role === "user" || first.role === "system") {
      topMessageTokens = estimateMessageTokens(first);
      if (topMessageTokens <= availableBudget) {
        topMessage = first;
      }
    }
  }

  // Adjusted budget for the recent messages
  const recentBudget = availableBudget - topMessageTokens;

  for (let i = processed.length - 1; i >= (topMessage ? 1 : 0); i--) {
    let msgTokens = estimateMessageTokens(processed[i]);
    const currentMsg = processed[i];
    let isToolGroup = false;

    // Determine if this is a tool result that must be grouped with its preceeding tool call
    if (
      currentMsg.role === "user" &&
      Array.isArray(currentMsg.content) &&
      currentMsg.content.some((b) => b.type === "tool_result")
    ) {
      const prevMsg = processed[i - 1];
      if (
        prevMsg &&
        prevMsg.role === "assistant" &&
        Array.isArray(prevMsg.content) &&
        prevMsg.content.some((b) => b.type === "tool_use")
      ) {
        isToolGroup = true;
        msgTokens += estimateMessageTokens(prevMsg);
      }
    }

    if (usedTokens + msgTokens > recentBudget && i < processed.length - 1) {
      // This message (or tool group) would exceed budget and it's not the last one

      break;
    }

    usedTokens += msgTokens;
    if (isToolGroup) {
      startIndex = i - 1;
      i--; // Skip the preceeding message since we bundled it
    } else {
      startIndex = i;
    }
  }

  let kept = processed.slice(startIndex);
  let truncatedCount = startIndex;

  // Prepend the top message if it was skimmed out from the Slice
  if (topMessage && startIndex > 0) {
    kept = [topMessage, ...kept];
    // We don't decrement truncatedCount because index 0 is kept, but messages
    // between index 0 and startIndex are still truncated.
    // However, the caller usually expects truncatedCount to be messages LOST.
    // Index 0 was saved, so we lost (startIndex - 1) messages.
    truncatedCount = Math.max(0, startIndex - 1);
  }

  const finalUsedTokens = usedTokens + topMessageTokens;

  // Calculate usage as percentage of total context (including system + output)
  const totalUsed = finalUsedTokens + systemPromptTokens;
  const usagePercent =
    contextLimit > 0
      ? Math.round((totalUsed / contextLimit) * 100 * 10) / 10
      : 0;

  return {
    messages: kept,
    estimatedTokens: finalUsedTokens,
    truncatedCount,
    contextLimit,
    usagePercent,
  };
}

/**
 * Deep-copy a message, truncating any large tool outputs.
 */
function truncateMessage(
  msg: ConversationMessage,
  maxChars: number,
): ConversationMessage {
  if (!Array.isArray(msg.content)) {
    return msg;
  }

  const newContent = msg.content.map((block) => {
    if (block.type === "tool_result" && typeof block.content === "string") {
      return {
        ...block,
        content: truncateToolOutput(block.content, maxChars),
      };
    }

    return block;
  });

  return { ...msg, content: newContent };
}
