import { toastStore } from "./stores/toast.mjs";

/**
 * @param {string} message
 * @param {{ type?: 'success'|'warning'|'error'|'info', duration?: number, action?: { label: string, onClick: () => (void|Promise<void>) } }} [options]
 * @returns {number}
 */
export function showToast(message, options = {}) {
  return toastStore.show(message, options);
}

/**
 * @param {string} message
 * @param {number} [duration]
 * @returns {number}
 */
export function showSuccess(message, duration = 4000) {
  return toastStore.show(message, { type: "success", duration });
}

/**
 * @param {string} message
 * @param {number} [duration]
 * @returns {number}
 */
export function showError(message, duration = 5000) {
  return toastStore.show(message, { type: "error", duration });
}

/**
 * @param {string} message
 * @param {number} [duration]
 * @returns {number}
 */
export function showWarning(message, duration = 4500) {
  return toastStore.show(message, { type: "warning", duration });
}

/**
 * @param {string} message
 * @param {number} [duration]
 * @returns {number}
 */
export function showInfo(message, duration = 4000) {
  return toastStore.show(message, { type: "info", duration });
}

/**
 * @param {number} id
 */
export function dismissToast(id) {
  toastStore.dismiss(id);
}

export function clearAllToasts() {
  toastStore.clear();
}
