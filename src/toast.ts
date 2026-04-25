import { type ToastOptions, toastStore } from "./stores/toast.js";

export function showToast(message: string, options: ToastOptions = {}) {
  return toastStore.show(message, options);
}

export function showSuccess(message: string, duration = 4000): number {
  return toastStore.show(message, { type: "success", duration });
}

export function showError(message: string, duration = 5000): number {
  return toastStore.show(message, { type: "error", duration });
}

export function showWarning(message: string, duration = 4500): number {
  return toastStore.show(message, { type: "warning", duration });
}

export function showInfo(message: string, duration = 4000): number {
  return toastStore.show(message, { type: "info", duration });
}

export function dismissToast(id: number): void {
  toastStore.dismiss(id);
}

export function clearAllToasts(): void {
  toastStore.clear();
}
