// @ts-ignore
import { Signal } from "signal-polyfill";

/**
 * @typedef {'success'|'warning'|'error'|'info'} ToastType
 */

/**
 * @typedef {Object} ToastAction
 *
 * @property {string} label
 * @property {() => (void|Promise<void>)} onClick
 */

/**
 * @typedef {Object} Toast
 *
 * @property {number} id
 * @property {string} message
 * @property {ToastType} type
 * @property {number} duration
 * @property {ToastAction | undefined} action
 * @property {number} createdAt
 */

/**
 * @typedef {Object} ToastTimer
 *
 * @property {ReturnType<typeof globalThis.setTimeout> | undefined} timeoutId
 * @property {number} remaining
 * @property {number} startedAt
 */

const MAX_VISIBLE_TOASTS = 5;

export class ToastStore {
  constructor() {
    /** @type {Signal.State<Toast[]>} */
    this._toasts = new Signal.State([]);
    /** @type {Signal.State<number>} */
    this._nextId = new Signal.State(0);
    /** @type {Map<number, ToastTimer>} */
    this._timers = new Map();
  }

  get toasts() {
    return this._toasts.get();
  }

  /**
   * @param {string} message
   * @param {{ type?: ToastType, duration?: number, action?: ToastAction }} [options]
   * @returns {number}
   */
  show(message, options = {}) {
    const nextId = this._nextId.get() + 1;
    this._nextId.set(nextId);

    const toast = {
      id: nextId,
      message,
      type: this.resolveType(options.type),
      duration: this.resolveDuration(options.duration),
      action: this.resolveAction(options.action),
      createdAt: Date.now(),
    };

    const current = this._toasts.get();
    const updated = [...current, toast];
    if (updated.length > MAX_VISIBLE_TOASTS) {
      const oldest = updated[0];
      this.clearTimer(oldest.id);

      this._toasts.set(updated.slice(1));
    } else {
      this._toasts.set(updated);
    }

    if (toast.duration > 0) {
      this.scheduleDismiss(toast.id, toast.duration);
    }

    return toast.id;
  }

  /**
   * @param {number} toastId
   */
  dismiss(toastId) {
    this.clearTimer(toastId);

    this._toasts.set(
      this._toasts
        .get()
        .filter((/** @type {Toast} */ toast) => toast.id !== toastId),
    );
  }

  clear() {
    this._timers.forEach((_, toastId) => this.clearTimer(toastId));
    this._timers.clear();
    this._toasts.set([]);
  }

  /**
   * @param {number} toastId
   */
  pause(toastId) {
    const timer = this._timers.get(toastId);
    if (!timer || !timer.timeoutId) {
      return;
    }

    clearTimeout(timer.timeoutId);

    timer.timeoutId = undefined;
    timer.remaining = Math.max(
      0,
      timer.remaining - (Date.now() - timer.startedAt),
    );

    this._timers.set(toastId, timer);
  }

  /**
   * @param {number} toastId
   */
  resume(toastId) {
    const timer = this._timers.get(toastId);
    if (!timer || timer.timeoutId || timer.remaining <= 0) {
      return;
    }

    this.scheduleDismiss(toastId, timer.remaining);
  }

  /**
   * @param {number} toastId
   *
   * @returns {Promise<void>}
   */
  async runAction(toastId) {
    const toast = this._toasts
      .get()
      .find((/** @type {Toast} */ item) => item.id === toastId);

    if (!toast?.action) {
      return;
    }

    await toast.action.onClick();
  }

  /**
   * @param {number} toastId
   * @param {number} delay
   */
  scheduleDismiss(toastId, delay) {
    this.clearTimer(toastId);

    const timeoutId = globalThis.setTimeout(() => {
      this.dismiss(toastId);
    }, delay);

    this._timers.set(toastId, {
      timeoutId,
      remaining: delay,
      startedAt: Date.now(),
    });
  }

  /**
   * @param {number} toastId
   */
  clearTimer(toastId) {
    const timer = this._timers.get(toastId);
    if (timer?.timeoutId) {
      clearTimeout(timer.timeoutId);
    }

    this._timers.delete(toastId);
  }

  /**
   * @param {ToastType | undefined} type
   *
   * @returns {ToastType}
   */
  resolveType(type) {
    return type && ["success", "warning", "error", "info"].includes(type)
      ? type
      : "info";
  }

  /**
   * @param {number | undefined} duration
   *
   * @returns {number}
   */
  resolveDuration(duration) {
    if (
      typeof duration !== "number" ||
      Number.isNaN(duration) ||
      duration < 0
    ) {
      return 4000;
    }

    return duration;
  }

  /**
   * @param {ToastAction | undefined} action
   *
   * @returns {ToastAction | undefined}
   */
  resolveAction(action) {
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
