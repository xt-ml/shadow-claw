/**
 * Create a token-usage message object
 *
 * @param {string} groupId
 * @param {any} usage
 * @param {number} contextLimit
 *
 * @returns {any}
 */
export function createTokenUsageMessage(groupId, usage, contextLimit) {
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
