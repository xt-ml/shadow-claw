/**
 * Computes display values for the token usage metric bar from an API token
 * usage object.
 *
 * The key invariant: when `usage.totalTokens` is non-zero it is used as-is;
 * when it is zero (some providers omit it) we fall back to the arithmetic sum
 * of prompt + output tokens.  This MUST use a **logical** `||` — not a
 * **bitwise** `|` — so that large integer values are never corrupted by
 * bitwise truncation to 32-bit integers.
 */
export interface TokenUsageLike {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  totalTokens?: number | null;
}

export interface TokenDisplayValues {
  cacheTokens: number;
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export function computeTokenDisplayValues(
  usage: TokenUsageLike,
): TokenDisplayValues {
  const cacheTokens =
    (usage.cacheReadTokens || 0) + (usage.cacheCreationTokens || 0);
  const promptTokens = (usage.inputTokens || 0) + cacheTokens;
  const outputTokens = usage.outputTokens || 0;
  // Use logical OR (||) so that zero-valued totalTokens falls through to the
  // computed sum.  A bitwise OR (|) would corrupt large integer values through
  // 32-bit signed integer coercion (e.g. 26326 | 51422 = 59390, not 26326).
  const totalTokens = usage.totalTokens || promptTokens + outputTokens;

  return { cacheTokens, promptTokens, outputTokens, totalTokens };
}
