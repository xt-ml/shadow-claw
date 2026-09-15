import process from "node:process";

export interface ReadStdinOptions {
  force?: boolean;
  stdin?: any;
  timeoutMs?: number;
}

/**
 * Read all data from a readable stream (defaults to process.stdin).
 *
 * Resolves to a trimmed UTF-8 string when data is piped in, or `null` when:
 * - The stream is a TTY (interactive terminal) and `force` is not set.
 * - No data arrives before the stream ends.
 */
export function readStdin(opts: ReadStdinOptions = {}): Promise<string | null> {
  const { force = false, stdin = process.stdin, timeoutMs } = opts;
  const stream: any = stdin;

  // Skip if we're in an interactive terminal and not forced
  if (!force && stream?.isTTY) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    if (timeoutMs != null && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        if (typeof stream?.destroy === "function") {
          stream.destroy();
        }
        resolve(null);
      }, timeoutMs);
    }

    if (typeof stream?.setEncoding === "function") {
      stream.setEncoding("utf8");
    }

    stream.on("data", (chunk: string | Buffer) => {
      if (!timedOut) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      }
    });

    stream.on("end", () => {
      if (timer) clearTimeout(timer);
      if (timedOut) return;
      const raw = chunks.join("").trim();
      resolve(raw.length > 0 ? raw : null);
    });

    stream.on("error", (err: Error) => {
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
 */
export function mapTextToToolInput(
  text: string,
  inputSchema?:
    | { properties?: Record<string, unknown> }
    | Record<string, unknown>,
): Record<string, string> {
  const props =
    inputSchema && typeof inputSchema === "object"
      ? Object.keys((inputSchema as any).properties || {})
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
