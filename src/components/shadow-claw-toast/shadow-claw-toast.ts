import { effect } from "../../effect.js";
import { toastStore, type Toast, type ToastType } from "../../stores/toast.js";

import ShadowClawElement from "../shadow-claw-element.js";

const EXIT_ANIMATION_MS = 150;

const elementName = "shadow-claw-toast";
export class ShadowClawToast extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawToast.componentPath}/${elementName}.css`;
  static template = `${ShadowClawToast.componentPath}/${elementName}.html`;

  cleanup: () => void = () => {};
  exitingToasts: Set<number> = new Set();

  constructor() {
    super();

    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    await this.render();

    this.cleanup = effect(() => {
      toastStore.toasts;
      this.render();
    });
  }

  disconnectedCallback() {
    this.cleanup();

    this.shadowRoot?.removeEventListener("keydown", this.handleKeyDown);
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root.addEventListener("keydown", this.handleKeyDown);

    const container = root.querySelector(".toast-container");
    if (!(container instanceof HTMLElement)) {
      return;
    }

    const toasts: Toast[] = toastStore.toasts;
    container.replaceChildren();

    toasts.forEach((toast) => {
      const toastEl = document.createElement("article");
      toastEl.className = `toast ${toast.type}`;
      toastEl.dataset.toastId = String(toast.id);
      toastEl.setAttribute("role", toast.type === "error" ? "alert" : "status");
      toastEl.setAttribute(
        "aria-live",
        toast.type === "error" ? "assertive" : "polite",
      );

      const iconEl = document.createElement("div");
      iconEl.className = "toast-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = this.iconForType(toast.type);

      const messageEl = document.createElement("div");
      messageEl.className = "toast-message";
      messageEl.textContent = toast.message;

      const closeBtn = document.createElement("button");
      closeBtn.className = "toast-close";
      closeBtn.setAttribute("aria-label", "Dismiss notification");
      closeBtn.type = "button";
      closeBtn.textContent = "×";

      toastEl.append(iconEl, messageEl, closeBtn);

      if (toast.action) {
        const actions = document.createElement("div");
        actions.className = "toast-actions";
        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.className = "toast-action";
        actionButton.textContent = toast.action.label;
        actions.appendChild(actionButton);
        toastEl.appendChild(actions);

        actionButton.addEventListener("click", async () => {
          try {
            await toastStore.runAction(toast.id);
          } finally {
            this.dismissWithAnimation(toast.id);
          }
        });
      }

      closeBtn.addEventListener("click", () =>
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

  async handleKeyDown(event: Event) {
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
    await this.dismissWithAnimation(toastId);
  }

  async dismissWithAnimation(toastId: number) {
    if (this.exitingToasts.has(toastId)) {
      return;
    }

    this.exitingToasts.add(toastId);
    await this.render();

    globalThis.setTimeout(() => {
      this.exitingToasts.delete(toastId);
      toastStore.dismiss(toastId);
    }, EXIT_ANIMATION_MS);
  }

  iconForType(type: ToastType): string {
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
}

customElements.define(elementName, ShadowClawToast);
