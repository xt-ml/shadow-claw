/**
 * Parse a Server-Sent Events (SSE) stream from a ReadableStream.
 *
 * Yields parsed JSON data objects from `data:` lines, skipping `[DONE]`
 * sentinel and comment lines.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<any> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split("\n\n");

      // Keep the last incomplete part in the buffer
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");

        for (const line of lines) {
          // Skip empty lines and comments
          if (!line || line.startsWith(":")) {
            continue;
          }

          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();

            // Skip the [DONE] sentinel
            if (data === "[DONE]") {
              continue;
            }

            try {
              yield JSON.parse(data);
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
