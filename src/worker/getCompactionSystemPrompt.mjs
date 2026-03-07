/**
 * Build the compaction system prompt
 *
 * @param {string} systemPrompt Origin system prompt
 *
 * @returns {string}
 */
export function getCompactionSystemPrompt(systemPrompt) {
  return [
    systemPrompt,
    "",
    "## COMPACTION TASK",
    "",
    "The conversation context is getting large. Produce a concise summary of the conversation so far.",
    "Include key facts, decisions, user preferences, and any important context.",
    "The summary will replace the full conversation history to stay within token limits.",
    "Be thorough but concise — aim for the essential information only.",
  ].join("\n");
}
