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
  return {
    type: "token-usage",
    payload: {
      groupId,
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      contextLimit,
    },
  };
}
