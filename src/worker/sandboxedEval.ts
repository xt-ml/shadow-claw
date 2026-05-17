/**
 * Sandboxed JavaScript execution for the `javascript` tool.
 */

/** Default execution timeout in milliseconds */
export const JS_EXEC_TIMEOUT_MS = 30_000;

const SANDBOX_TRUSTED_TYPES_POLICY_NAME = "shadowclaw-sandbox";

type SandboxTrustedPolicyLike = {
  createScriptURL?: (input: string) => unknown;
};

let cachedSandboxTrustedPolicy: SandboxTrustedPolicyLike | null | undefined;

function getSandboxTrustedTypesPolicy(): SandboxTrustedPolicyLike | null {
  if (cachedSandboxTrustedPolicy !== undefined) {
    return cachedSandboxTrustedPolicy;
  }

  const trustedTypesFactory = Reflect.get(globalThis, "trustedTypes") as
    | {
        createPolicy?: (
          name: string,
          rules: {
            createScriptURL?: (input: string) => string;
          },
        ) => SandboxTrustedPolicyLike;
      }
    | undefined;

  if (
    !trustedTypesFactory ||
    typeof trustedTypesFactory.createPolicy !== "function"
  ) {
    cachedSandboxTrustedPolicy = null;

    return cachedSandboxTrustedPolicy;
  }

  try {
    cachedSandboxTrustedPolicy = trustedTypesFactory.createPolicy(
      SANDBOX_TRUSTED_TYPES_POLICY_NAME,
      {
        createScriptURL: (input: string) => input,
      },
    );
  } catch {
    cachedSandboxTrustedPolicy = null;
  }

  return cachedSandboxTrustedPolicy;
}

/**
 * Names that will be shadowed (set to `undefined`) inside the sandbox so
 * user-supplied code cannot reach worker / global internals.
 */
const BASE_BLOCKED_GLOBALS: string[] = [
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

function getBlockedGlobals(allowFullInternetAccess: boolean): string[] {
  if (allowFullInternetAccess) {
    return BASE_BLOCKED_GLOBALS;
  }

  return [...BASE_BLOCKED_GLOBALS, "fetch"];
}

/**
 * Execute user-supplied JavaScript in a sandboxed, timeout-enforced context.
 */
export async function sandboxedEval(
  code: string,
  timeoutMs: number = JS_EXEC_TIMEOUT_MS,
  allowFullInternetAccess: boolean = false,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  // Build the worker source inline via a Blob URL
  const workerSource = buildWorkerSource(code, allowFullInternetAccess);
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

      const trustedTypesPolicy = getSandboxTrustedTypesPolicy();
      const workerUrl =
        trustedTypesPolicy &&
        typeof trustedTypesPolicy.createScriptURL === "function"
          ? trustedTypesPolicy.createScriptURL(blobUrl)
          : blobUrl;
      const w = new Worker(workerUrl as string);
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
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
    if (workerRef) {
      (workerRef as any).terminate();
    }
  }
}

export function buildWorkerSource(
  code: string = "",
  allowFullInternetAccess: boolean = false,
): string {
  // We JSON-encode the blocked globals list so it's safely embedded.
  const blockedJSON = JSON.stringify(
    getBlockedGlobals(allowFullInternetAccess),
  );

  return `
"use strict";
const blocked = ${blockedJSON};
const __hostPostMessage =
  typeof globalThis.postMessage === "function"
    ? globalThis.postMessage.bind(globalThis)
    : function () {};

function serializeAndSend(value) {
  if (value === undefined) {
    __hostPostMessage({ ok: true, value: "__UNDEFINED__" });

    return;
  }

  if (value === null) {
    __hostPostMessage({ ok: true, value: null });

    return;
  }

  if (typeof value === "object" || typeof value === "function") {
    try {
      __hostPostMessage({ ok: true, value: value });

      return;
    } catch (_cloneErr) {
      try {
        __hostPostMessage({ ok: true, value: JSON.parse(JSON.stringify(value)) });

        return;
      } catch (_jsonErr) {
        __hostPostMessage({ ok: true, value: String(value) });

        return;
      }
    }
  }

  __hostPostMessage({ ok: true, value: value });
}

function applyGlobalShadows() {
  const restores = [];
  for (const name of blocked) {
    if (name === "self" || name === "postMessage") {
      continue;
    }

    const hasOwn = Object.prototype.hasOwnProperty.call(globalThis, name);
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);

    restores.push({ name, hasOwn, descriptor });

    try {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value: undefined,
      });
    } catch (_shadowErr) {
      // Some host properties cannot be shadowed; lexical guards below still apply.
    }
  }

  return () => {
    for (let i = restores.length - 1; i >= 0; i--) {
      const entry = restores[i];
      try {
        if (entry.hasOwn) {
          if (entry.descriptor) {
            Object.defineProperty(globalThis, entry.name, entry.descriptor);
          }
        } else {
          delete globalThis[entry.name];
        }
      } catch (_restoreErr) {
        // Best-effort restore only.
      }
    }
  };
}

const restoreGlobals = applyGlobalShadows();
(async function () {
  try {
    const result = await (async () => {
      "use strict";
      const self = undefined;
      const postMessage = undefined;
      const importScripts = undefined;
      const close = undefined;
      const onmessage = undefined;
      const onmessageerror = undefined;
      const onerror = undefined;
      const setInterval = undefined;
      const XMLHttpRequest = undefined;
      const WebSocket = undefined;
      const indexedDB = undefined;
      const caches = undefined;
      const navigator = undefined;
      const location = undefined;
      const Function = undefined;
      ${allowFullInternetAccess ? "" : "const fetch = undefined;"}

    ${code}
    })();

    serializeAndSend(result);
  } catch (err) {
    __hostPostMessage({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    restoreGlobals();
  }
})();
`;
}
