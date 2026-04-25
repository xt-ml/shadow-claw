import { handleMessage } from "./agent.js";
import { CONFIG_KEYS, DEFAULT_VM_BOOT_HOST } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { openDatabase } from "../db/openDatabase.js";

import {
  bootVM,
  setVMBootHostPreference,
  setVMBootModePreference,
  setVMNetworkRelayURLPreference,
  subscribeVMStatus,
} from "../vm.js";

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
 */
function showToast(
  message: string,
  type: "success" | "error" | "warning" | "info" = "info",
  duration: number,
) {
  self.postMessage({
    type: "show-toast",
    payload: { message, type, duration },
  });
}

/**
 * Show a success toast
 */
function showSuccess(message: string, duration: number) {
  showToast(message, "success", duration);
}

/**
 * Show an error toast
 */
function showError(message: string, duration: number) {
  showToast(message, "error", duration);
}

/**
 * Show a warning toast
 */
function showWarning(message: string, duration: number) {
  showToast(message, "warning", duration);
}

/**
 * Show an info toast
 */
function showInfo(message: string, duration: number) {
  showToast(message, "info", duration);
}

// Attach to globalThis for JavaScript tasks executed via eval()
(globalThis as any).showToast = showToast;
(globalThis as any).showSuccess = showSuccess;
(globalThis as any).showError = showError;
(globalThis as any).showWarning = showWarning;
(globalThis as any).showInfo = showInfo;

self.onmessage = handleMessage;
