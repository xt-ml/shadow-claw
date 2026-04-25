import { Signal } from "signal-polyfill";

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  action: ToastAction | undefined;
  createdAt: number;
}

export interface ToastTimer {
  timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  remaining: number;
  startedAt: number;
}

const MAX_VISIBLE_TOASTS = 5;

export class ToastStore {
  #toasts: Signal.State<Toast[]> = new Signal.State([]);
  #nextId: Signal.State<number> = new Signal.State(0);
  #timers: Map<number, ToastTimer> = new Map();

  get toasts() {
    return this.#toasts.get();
  }

  show(message: string, options: ToastOptions = {}) {
    const nextId = this.#nextId.get() + 1;
    this.#nextId.set(nextId);

    const toast = {
      id: nextId,
      message,
      type: this.resolveType(options.type),
      duration: this.resolveDuration(options.duration),
      action: this.resolveAction(options.action),
      createdAt: Date.now(),
    };

    const current = this.#toasts.get();
    const updated = [...current, toast];
    if (updated.length > MAX_VISIBLE_TOASTS) {
      const oldest = updated[0];
      this.clearTimer(oldest.id);

      this.#toasts.set(updated.slice(1));
    } else {
      this.#toasts.set(updated);
    }

    if (toast.duration > 0) {
      this.scheduleDismiss(toast.id, toast.duration);
    }

    return toast.id;
  }

  dismiss(toastId: number) {
    this.clearTimer(toastId);

    this.#toasts.set(
      this.#toasts.get().filter((toast) => toast.id !== toastId),
    );
  }

  clear() {
    this.#timers.forEach((_, toastId) => this.clearTimer(toastId));
    this.#timers.clear();
    this.#toasts.set([]);
  }

  pause(toastId: number) {
    const timer = this.#timers.get(toastId);
    if (!timer || !timer.timeoutId) {
      return;
    }

    clearTimeout(timer.timeoutId);

    timer.timeoutId = undefined;
    timer.remaining = Math.max(
      0,
      timer.remaining - (Date.now() - timer.startedAt),
    );

    this.#timers.set(toastId, timer);
  }

  resume(toastId: number) {
    const timer = this.#timers.get(toastId);
    if (!timer || timer.timeoutId || timer.remaining <= 0) {
      return;
    }

    this.scheduleDismiss(toastId, timer.remaining);
  }

  async runAction(toastId: number): Promise<void> {
    const toast = this.#toasts.get().find((item) => item.id === toastId);

    if (!toast?.action) {
      return;
    }

    await toast.action.onClick();
  }

  scheduleDismiss(toastId: number, delay: number): void {
    this.clearTimer(toastId);

    const timeoutId = globalThis.setTimeout(() => {
      this.dismiss(toastId);
    }, delay);

    this.#timers.set(toastId, {
      timeoutId,
      remaining: delay,
      startedAt: Date.now(),
    });
  }

  clearTimer(toastId: number): void {
    const timer = this.#timers.get(toastId);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
    }

    this.#timers.delete(toastId);
  }

  resolveType(type: ToastType | undefined): ToastType {
    return type && ["success", "warning", "error", "info"].includes(type)
      ? type
      : "info";
  }

  resolveDuration(duration: number | undefined): number {
    if (
      typeof duration !== "number" ||
      Number.isNaN(duration) ||
      duration < 0
    ) {
      return 4000;
    }

    return duration;
  }

  resolveAction(action: ToastAction | undefined): ToastAction | undefined {
    if (
      !action ||
      typeof action.label !== "string" ||
      typeof action.onClick !== "function"
    ) {
      return undefined;
    }

    return action;
  }
}

export const toastStore = new ToastStore();
