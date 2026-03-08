import { handleMessage } from "./src/worker/agent.mjs";

/**
 * ShadowClaw Agent Worker
 *
 * Runs in a dedicated Web Worker. Owns the tool-use loop.
 *
 * Communicates with the main thread via postMessage.
 */

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
