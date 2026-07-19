/**
 * Create a token-usage message object
 */
export function createTokenUsageMessage(
  groupId: string,
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  },
  contextLimit: number,
): any {
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

  return {
    type: "token-usage",
    payload: {
      groupId,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalTokens:
        inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
      contextLimit,
    },
  };
}
