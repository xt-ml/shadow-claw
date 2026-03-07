/**
 * Build the message list for compaction
 *
 * @param {any[]} messages Current messages
 *
 * @returns {any[]}
 */
export function getCompactionMessages(messages) {
  return [
    ...messages,
    {
      role: "user",
      content:
        "Please provide a concise summary of our entire conversation so far. Include all key facts, decisions, code discussed, and important context. This summary will replace the full history.",
    },
  ];
}
