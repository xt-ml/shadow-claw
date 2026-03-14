import { handleMessage } from "./src/worker/agent.mjs";
import { CONFIG_KEYS, DEFAULT_VM_BOOT_HOST } from "./src/config.mjs";
import { getConfig } from "./src/db/getConfig.mjs";
import { openDatabase } from "./src/db/openDatabase.mjs";
import {
  bootVM,
  setVMBootHostPreference,
  setVMBootModePreference,
  setVMNetworkRelayURLPreference,
  subscribeVMStatus,
} from "./src/vm.mjs";

/**
 * ShadowClaw Agent Worker
 *
 * Runs in a dedicated Web Worker. Owns the tool-use loop.
 *
 * Communicates with the main thread via postMessage.
 */

subscribeVMStatus((status) => {
  self.postMessage({
    type: "vm-status",
    payload: status,
  });
});

// Eagerly boot only when mode is explicitly selected.
// In auto mode, defer probing/boot until the user opens terminal or runs bash,
// which avoids immediate startup 404 noise for optional VM assets.
(async () => {
  try {
    const db = await openDatabase();
    const stored = await getConfig(db, CONFIG_KEYS.VM_BOOT_MODE);
    const mode =
      stored === "disabled" ||
      stored === "9p" ||
      stored === "ext2" ||
      stored === "auto"
        ? stored
        : "disabled";
    const bootHostRaw = await getConfig(db, CONFIG_KEYS.VM_BOOT_HOST);
    const bootHost =
      typeof bootHostRaw === "string" ? bootHostRaw : DEFAULT_VM_BOOT_HOST;
    const networkRelayUrl = await getConfig(
      db,
      CONFIG_KEYS.VM_NETWORK_RELAY_URL,
    );

    setVMBootModePreference(mode);
    setVMBootHostPreference(bootHost);
    setVMNetworkRelayURLPreference(networkRelayUrl);

    if (mode === "ext2" || mode === "9p") {
      await bootVM();
    }
  } catch (err) {
    console.warn("[WebVM] Eager boot failed:", err);
  }
})();

// ── Expose toast helpers on worker globalThis for JavaScript tasks ──

/**
 * Show a toast notification (from worker context)
 *
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} [type="info"]
 * @param {number} [duration]
 */
function showToast(message, type = "info", duration) {
  self.postMessage({
    type: "show-toast",
    payload: { message, type, duration },
  });
}

/**
 * Show a success toast
 *
 * @param {string} message
 * @param {number} [duration]
 */
function showSuccess(message, duration) {
  showToast(message, "success", duration);
}

/**
 * Show an error toast
 *
 * @param {string} message
 * @param {number} [duration]
 */
function showError(message, duration) {
  showToast(message, "error", duration);
}

/**
 * Show a warning toast
 *
 * @param {string} message
 * @param {number} [duration]
 */
function showWarning(message, duration) {
  showToast(message, "warning", duration);
}

/**
 * Show an info toast
 *
 * @param {string} message
 * @param {number} [duration]
 */
function showInfo(message, duration) {
  showToast(message, "info", duration);
}

// Attach to globalThis for JavaScript tasks executed via eval()
/** @type {any} */ (globalThis).showToast = showToast;
/** @type {any} */ (globalThis).showSuccess = showSuccess;
/** @type {any} */ (globalThis).showError = showError;
/** @type {any} */ (globalThis).showWarning = showWarning;
/** @type {any} */ (globalThis).showInfo = showInfo;

self.onmessage = handleMessage;
