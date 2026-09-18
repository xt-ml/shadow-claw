import { runInNewContext } from "node:vm";
import type { HeadlessEvalExecutor } from "./sandboxedEval.js";
import { setHeadlessEvalExecutor } from "./sandboxedEval.js";

/**
 * Native Node.js node:vm executor for headless CLI / server mode.
 */
export const nativeEvalExecutor: HeadlessEvalExecutor = async (
  code,
  timeoutMs,
  allowFullInternetAccess = false,
  data,
) => {
  try {
    const sandbox: any = {
      console,
      URL,
      TextEncoder,
      TextDecoder,
      JSON,
      Math,
      Date,
      parseInt,
      parseFloat,
      encodeURIComponent,
      decodeURIComponent,
      setTimeout,
      clearTimeout,
      data: data ?? "",
      $PIPE_DATA: data ?? "",
      fetch: allowFullInternetAccess ? globalThis.fetch : undefined,
    };
    const wrappedCode = `(async () => {
      "use strict";
      ${code}
    })()`;
    const result = await Promise.race([
      runInNewContext(wrappedCode, sandbox, { timeout: timeoutMs }),
      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Execution timed out after ${timeoutMs / 1000}s`)),
          timeoutMs,
        ),
      ),
    ]);
    return { ok: true, value: result };
  } catch (err: any) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
    };
  }
};

// Register with sandboxedEval when loaded
setHeadlessEvalExecutor(nativeEvalExecutor);
(globalThis as any).__headlessEvalExecutor = nativeEvalExecutor;
