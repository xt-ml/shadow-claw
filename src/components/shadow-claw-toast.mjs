import { effect } from "../effect.mjs";
import { toastStore } from "../stores/toast.mjs";

/**
 * @typedef {import("../stores/toast.mjs").Toast} Toast
 */

const EXIT_ANIMATION_MS = 150;

export class ShadowClawToast extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {() => void} */
    this.cleanup = () => {};
    /** @type {Set<number>} */
    this.exitingToasts = new Set();

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  connectedCallback() {
    this.render();

    this.cleanup = effect(() => {
      toastStore.toasts;
      this.renderToasts();
    });

    this.shadowRoot?.addEventListener(
      "keydown",
      /** @type {EventListener} */ (this.handleKeyDown),
    );
  }

  disconnectedCallback() {
    this.cleanup();
    this.shadowRoot?.removeEventListener(
      "keydown",
      /** @type {EventListener} */ (this.handleKeyDown),
    );
  }

  render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root.innerHTML = `
      <style>
        :host {
          --toast-gap: 0.625rem;
          --toast-padding: 0.75rem;
          display: block;
          pointer-events: none;
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          z-index: 9999;
        }

        .toast-container {
          display: flex;
          flex-direction: column;
          gap: var(--toast-gap);
          max-width: min(20rem, calc(100vw - 2rem));
          width: min(20rem, calc(100vw - 2rem));
        }

        .toast {
          align-items: flex-start;
          background: var(--shadow-claw-bg-secondary);
          border-left: 0.25rem solid var(--toast-accent);
          border-radius: var(--shadow-claw-radius-m, 0.75rem);
          box-shadow: var(--shadow-claw-shadow-md);
          color: var(--shadow-claw-text-primary);
          display: grid;
          gap: 0.5rem;
          grid-template-columns: auto 1fr auto;
          padding: var(--toast-padding);
          pointer-events: auto;
          transform: translateX(0);
          opacity: 1;
          animation: toast-enter 100ms ease-out;
        }

        .toast.exiting {
          animation: toast-exit 150ms ease-in forwards;
        }

        .toast.success {
          --toast-accent: var(--shadow-claw-success-color);
        }

        .toast.warning {
          --toast-accent: var(--shadow-claw-warning-color);
        }

        .toast.error {
          --toast-accent: var(--shadow-claw-error-color);
        }

        .toast.info {
          --toast-accent: var(--shadow-claw-accent-primary);
        }

        .toast-icon {
          color: var(--toast-accent);
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.4;
          margin-top: 0.0625rem;
        }

        .toast-message {
          font-size: 0.875rem;
          line-height: 1.4;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
        }

        .toast-actions {
          align-items: center;
          display: flex;
          gap: 0.375rem;
          grid-column: 2 / 4;
          justify-content: flex-end;
        }

        .toast-action,
        .toast-close {
          align-items: center;
          background: transparent;
          border-radius: var(--shadow-claw-radius-s, 0.5rem);
          border: 0.0625rem solid var(--shadow-claw-border-color);
          color: var(--shadow-claw-text-primary);
          cursor: pointer;
          display: inline-flex;
          font-size: 0.75rem;
          font-weight: 600;
          justify-content: center;
          min-height: 1.75rem;
          padding: 0.25rem 0.5rem;
        }

        .toast-action:hover,
        .toast-close:hover {
          background: var(--shadow-claw-bg-tertiary);
        }

        .toast-action:focus-visible,
        .toast-close:focus-visible {
          box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
          outline: 0.0625rem solid var(--shadow-claw-accent-primary);
          outline-offset: 0.0625rem;
        }

        .toast-close {
          border: none;
          font-size: 1.125rem;
          font-weight: 400;
          line-height: 1;
          margin-left: 0.375rem;
          min-height: auto;
          min-width: 1.75rem;
          padding: 0.125rem;
        }

        @keyframes toast-enter {
          from {
            opacity: 0;
            transform: translateX(1.5rem);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toast-exit {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(150%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .toast,
          .toast.exiting {
            animation: none;
          }
        }

        @media (max-width: 47.9375rem) {
          :host {
            bottom: 0.75rem;
            left: 0.75rem;
            right: 0.75rem;
          }

          .toast-container {
            max-width: 100%;
            width: 100%;
          }
        }
      </style>
      <div class="toast-container" aria-live="polite" aria-atomic="false"></div>
    `;

    this.renderToasts();
  }

  renderToasts() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const container = root.querySelector(".toast-container");
    if (!(container instanceof HTMLElement)) {
      return;
    }

    /** @type {Toast[]} */
    const toasts = toastStore.toasts;
    container.innerHTML = "";

    toasts.forEach((/** @type {Toast} */ toast) => {
      const toastEl = document.createElement("article");
      toastEl.className = `toast ${toast.type}`;
      toastEl.dataset.toastId = String(toast.id);
      toastEl.setAttribute("role", toast.type === "error" ? "alert" : "status");
      toastEl.setAttribute(
        "aria-live",
        toast.type === "error" ? "assertive" : "polite",
      );

      const icon = this.iconForType(toast.type);
      toastEl.innerHTML = `
        <div class="toast-icon" aria-hidden="true">${icon}</div>
        <div class="toast-message">${this.escapeHtml(toast.message)}</div>
        <button class="toast-close" aria-label="Dismiss notification" type="button">&times;</button>
      `;

      if (toast.action) {
        const actions = document.createElement("div");
        actions.className = "toast-actions";
        actions.innerHTML = `<button type="button" class="toast-action">${this.escapeHtml(toast.action.label)}</button>`;
        toastEl.appendChild(actions);

        const actionButton = actions.querySelector(".toast-action");
        actionButton?.addEventListener("click", async () => {
          try {
            await toastStore.runAction(toast.id);
          } finally {
            this.dismissWithAnimation(toast.id);
          }
        });
      }

      const closeBtn = toastEl.querySelector(".toast-close");
      closeBtn?.addEventListener("click", () =>
        this.dismissWithAnimation(toast.id),
      );

      toastEl.addEventListener("mouseenter", () => toastStore.pause(toast.id));
      toastEl.addEventListener("mouseleave", () => toastStore.resume(toast.id));

      if (this.exitingToasts.has(toast.id)) {
        toastEl.classList.add("exiting");
      }

      container.appendChild(toastEl);
    });
  }

  /**
   * @param {Event} event
   */
  handleKeyDown(event) {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    if (event.key !== "Escape") {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const toastNode = target.closest(".toast");
    if (!(toastNode instanceof HTMLElement)) {
      return;
    }

    const toastId = Number(toastNode.dataset.toastId);
    if (!Number.isFinite(toastId)) {
      return;
    }

    event.preventDefault();
    this.dismissWithAnimation(toastId);
  }

  /**
   * @param {number} toastId
   */
  dismissWithAnimation(toastId) {
    if (this.exitingToasts.has(toastId)) {
      return;
    }

    this.exitingToasts.add(toastId);
    this.renderToasts();

    globalThis.setTimeout(() => {
      this.exitingToasts.delete(toastId);
      toastStore.dismiss(toastId);
    }, EXIT_ANIMATION_MS);
  }

  /**
   * @param {'success'|'warning'|'error'|'info'} type
   * @returns {string}
   */
  iconForType(type) {
    if (type === "success") {
      return "✓";
    }

    if (type === "error") {
      return "!";
    }

    if (type === "warning") {
      return "⚠";
    }

    return "i";
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define("shadow-claw-toast", ShadowClawToast);
