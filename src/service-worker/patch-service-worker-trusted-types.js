/**
 * Rewrites the generated Workbox service worker so its bootstrap importScripts
 * calls pass through Trusted Types when the browser enforces report-only TT.
 */

const SERVICE_WORKER_BOOTSTRAP_MARKER = "shadowClawImportScripts";

function buildTrustedTypesPrelude() {
  return [
    'const shadowClawServiceWorkerTrustedTypesFactory = Reflect.get(self, "trustedTypes");',
    "let shadowClawServiceWorkerTrustedTypesPolicy = null;",
    'if (shadowClawServiceWorkerTrustedTypesFactory && typeof shadowClawServiceWorkerTrustedTypesFactory.createPolicy === "function") {',
    "  try {",
    '    if (typeof shadowClawServiceWorkerTrustedTypesFactory.getPolicy === "function") {',
    "      shadowClawServiceWorkerTrustedTypesPolicy =",
    '        shadowClawServiceWorkerTrustedTypesFactory.getPolicy("default") ||',
    '        shadowClawServiceWorkerTrustedTypesFactory.getPolicy("shadowclaw-sandbox") ||',
    "        null;",
    "    }",
    "",
    "    if (!shadowClawServiceWorkerTrustedTypesPolicy) {",
    "      shadowClawServiceWorkerTrustedTypesPolicy =",
    '        shadowClawServiceWorkerTrustedTypesFactory.createPolicy("default", {',
    "          createHTML: (input) => input,",
    "          createScriptURL: (input) => input,",
    "        });",
    "    }",
    "  } catch {",
    "    // Ignore policy creation failures and fall back to raw importScripts.",
    "  }",
    "}",
    "",
    'const shadowClawNativeImportScripts = typeof importScripts === "function" ? importScripts.bind(self) : null;',
    "",
    "const shadowClawImportScripts = (...urls) => {",
    "  if (!shadowClawNativeImportScripts) {",
    "    return;",
    "  }",
    "",
    '  if (!shadowClawServiceWorkerTrustedTypesPolicy || typeof shadowClawServiceWorkerTrustedTypesPolicy.createScriptURL !== "function") {',
    "    shadowClawNativeImportScripts(...urls);",
    "",
    "    return;",
    "  }",
    "",
    "  shadowClawNativeImportScripts(...urls.map((url) => shadowClawServiceWorkerTrustedTypesPolicy.createScriptURL(url)));",
    "};",
  ].join("\n");
}

export function patchServiceWorkerTrustedTypes(source) {
  if (source.includes(SERVICE_WORKER_BOOTSTRAP_MARKER)) {
    return source;
  }

  if (
    !source.includes("if(!self.define){") ||
    !source.includes("importScripts(")
  ) {
    return source;
  }

  return `${buildTrustedTypesPrelude()}\n${source.replace(
    /importScripts\(/g,
    "shadowClawImportScripts(",
  )}`;
}
