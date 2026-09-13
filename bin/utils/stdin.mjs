/**
 * bin/utils/stdin.mjs
 *
 * Utilities for reading piped stdin data in headless CLI commands.
 */

import process from "node:process";

/**
 * Read all data from a readable stream (defaults to process.stdin).
 *
 * Resolves to a trimmed UTF-8 string when data is piped in, or `null` when:
 * - The stream is a TTY (interactive terminal) and `force` is not set.
 * - No data arrives before the stream ends.
 *
 * @param {{ force?: boolean, stdin?: NodeJS.ReadableStream, timeoutMs?: number }} [opts]
 *   - `force`: read even when stdin is a TTY (useful for testing or explicit `-` flag).
 *   - `stdin`: override the stream to read from (defaults to `process.stdin`).
 *   - `timeoutMs`: give up after this many ms if the stream stalls (default: none).
 * @returns {Promise<string | null>}
 */
export function readStdin(opts = {}) {
  const { force = false, stdin = process.stdin, timeoutMs } = opts;

  // Skip if we're in an interactive terminal and not forced
  if (!force && stdin.isTTY) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let timedOut = false;
    let timer;

    if (timeoutMs != null && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        if (typeof stdin.destroy === "function") stdin.destroy();
        resolve(null);
      }, timeoutMs);
    }

    if (typeof stdin.setEncoding === "function") {
      stdin.setEncoding("utf8");
    }

    stdin.on("data", (chunk) => {
      if (!timedOut) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      }
    });

    stdin.on("end", () => {
      if (timer) clearTimeout(timer);
      if (timedOut) return;
      const raw = chunks.join("").trim();
      resolve(raw.length > 0 ? raw : null);
    });

    stdin.on("error", (err) => {
      if (timer) clearTimeout(timer);
      if (timedOut) return;
      reject(err);
    });
  });
}

/**
 * Map a plain-text string to a tool input object based on the tool's JSON Schema.
 *
 * Priority order for the target field:
 *  1. `text`
 *  2. `prompt`
 *  3. `content`
 *  4. `input` (fallback)
 *
 * @param {string} text            Plain-text stdin content.
 * @param {object | undefined} inputSchema  The tool's `input_schema` (JSON Schema object).
 * @returns {Record<string, string>}
 */
export function mapTextToToolInput(text, inputSchema) {
  const props =
    inputSchema && typeof inputSchema === "object"
      ? Object.keys(inputSchema.properties || {})
      : [];

  const PRIORITY = ["text", "prompt", "content", "input"];
  for (const field of PRIORITY) {
    if (props.includes(field)) {
      return { [field]: text };
    }
  }

  // Generic fallback — always usable
  return { input: text };
}
