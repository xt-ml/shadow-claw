/**
 * Wraps externally-sourced tool content in structural delimiters that signal
 * to the LLM that the enclosed text is untrusted external content, not a
 * system or user instruction.
 *
 * This is one layer of the prompt-injection defense stack. It complements the
 * system prompt hardening in `buildSystemPrompt` by providing a visual /
 * semantic boundary that modern frontier models respect when deciding whether
 * to follow text as an instruction vs. treat it as data.
 *
 * @param content  The externally-sourced body to wrap.
 * @param toolName The name of the tool that produced this content (used in the
 *                 marker so the LLM has clear provenance context).
 * @param prefix   Optional string to prepend *before* the BEGIN marker, e.g.
 *                 an HTTP status line like `"[HTTP 200 OK]\n"`.
 */
export function wrapUntrustedContent(
  content: string,
  toolName: string,
  prefix = "",
): string {
  const begin = `--- BEGIN EXTERNAL CONTENT (UNTRUSTED: ${toolName}) ---`;
  const end = `--- END EXTERNAL CONTENT ---`;
  return `${prefix}${begin}\n${content}\n${end}`;
}
