/**
 * Sandboxed JavaScript execution for the `javascript` tool.
 */

/** Default execution timeout in milliseconds */
export const JS_EXEC_TIMEOUT_MS = 30_000;

/**
 * Names that will be shadowed (set to `undefined`) inside the sandbox so
 * user-supplied code cannot reach worker / global internals.
 */
const BLOCKED_GLOBALS: string[] = [
  // Worker-specific
  "self",
  "postMessage",
  "importScripts",
  "close",
  "onmessage",
  "onmessageerror",
  "onerror",
  // Timers that could be abused
  "setInterval",
  // Network / storage
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "indexedDB",
  "caches",
  "navigator",
  "location",
  // Dynamic code execution
  "eval",
  "Function",
];

/**
 * Execute user-supplied JavaScript in a sandboxed, timeout-enforced context.
 */
export async function sandboxedEval(
  code: string,
  timeoutMs: number = JS_EXEC_TIMEOUT_MS,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  // Build the worker source inline via a Blob URL
  const workerSource = buildWorkerSource();
  const blob = new Blob([workerSource], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  let workerRef: Worker | null = null;

  try {
    return await new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (workerRef) {
          workerRef.terminate();
          workerRef = null;
        }

        resolve({
          ok: false,
          error: `Execution timed out after ${timeoutMs / 1000}s`,
        });
      }, timeoutMs);

      const w = new Worker(blobUrl);
      workerRef = w;

      w.onmessage = (e: MessageEvent) => {
        clearTimeout(timer);
        w.terminate();
        workerRef = null;
        resolve(e.data);
      };

      w.onerror = (e: ErrorEvent) => {
        clearTimeout(timer);
        w.terminate();
        workerRef = null;
        resolve({
          ok: false,
          error: e.message || "Unknown worker error",
        });
      };

      // Send the code to the sandbox worker for execution
      w.postMessage({ code });
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
    if (workerRef) {
      (workerRef as any).terminate();
    }
  }
}

/**
 * Build the source code string for the disposable sandbox worker.
 */
export function buildWorkerSource(): string {
  // We JSON-encode the blocked globals list so it's safely embedded.
  const blockedJSON = JSON.stringify(BLOCKED_GLOBALS);

  return `
"use strict";
self.onmessage = function (e) {
  var code = e.data.code;
  try {
    var blocked = ${blockedJSON};
    // Build parameter list that shadows dangerous globals with undefined
    var paramNames = blocked.join(",");
    // Wrap in an IIFE that returns the last expression value.
    var wrappedCode = 'return (function(){\\n"use strict";\\n' + code + '\\n})()';
    var fn = new Function(paramNames, wrappedCode);
    // Call with all blocked params as undefined
    var args = new Array(blocked.length);
    var result = fn.apply(undefined, args);
    // Serialise the result -- handle non-cloneable values gracefully
    if (result === undefined) {
      self.postMessage({ ok: true, value: "__UNDEFINED__" });
    } else if (result === null) {
      self.postMessage({ ok: true, value: null });
    } else if (typeof result === "object" || typeof result === "function") {
      try {
        // Try structured clone (postMessage handles this natively)
        self.postMessage({ ok: true, value: result });
      } catch (_cloneErr) {
        // Fall back to JSON, then to toString
        try {
          self.postMessage({ ok: true, value: JSON.parse(JSON.stringify(result)) });
        } catch (_jsonErr) {
          self.postMessage({ ok: true, value: String(result) });
        }
      }
    } else {
      self.postMessage({ ok: true, value: result });
    }
  } catch (err) {
    self.postMessage({ ok: false, error: (err && err.message) ? err.message : String(err) });
  }
};
`;
}
