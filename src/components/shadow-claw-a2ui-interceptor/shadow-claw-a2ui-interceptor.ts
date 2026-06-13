import type { A2UIAction } from "../../a2ui.js";

export class ShadowClawA2UIInterceptor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const slot = document.createElement("slot");
    this.shadowRoot!.appendChild(slot);
  }

  connectedCallback() {
    this.addEventListener("shadow-claw-a2ui-action", this.#handleAction);
  }

  disconnectedCallback() {
    this.removeEventListener("shadow-claw-a2ui-action", this.#handleAction);
  }

  #handleAction = (e: Event) => {
    const customEvent = e as CustomEvent<{
      groupId: string;
      action: A2UIAction;
    }>;
    const actionId = customEvent.detail?.action?.actionId;
    if (!actionId) {
      return;
    }

    if (actionId === "playTrack" || actionId === "play") {
      const a2ui = this.querySelector("shadow-claw-a2ui");
      let handled = false;
      if (a2ui && a2ui.shadowRoot) {
        const mediaElements = a2ui.shadowRoot.querySelectorAll(
          "audio, video",
        ) as NodeListOf<HTMLMediaElement>;
        if (mediaElements.length > 0) {
          mediaElements.forEach((m) => m.play().catch(console.error));
          handled = true;
        }
      }

      if (handled) {
        e.stopPropagation();

        return;
      }
    }

    if (actionId === "pauseTrack" || actionId === "pause") {
      const a2ui = this.querySelector("shadow-claw-a2ui");
      let handled = false;
      if (a2ui && a2ui.shadowRoot) {
        const mediaElements = a2ui.shadowRoot.querySelectorAll(
          "audio, video",
        ) as NodeListOf<HTMLMediaElement>;
        if (mediaElements.length > 0) {
          mediaElements.forEach((m) => m.pause());
          handled = true;
        }
      }

      if (handled) {
        e.stopPropagation();

        return;
      }
    }

    if (actionId === "closeModal" || actionId === "close") {
      const a2ui = this.querySelector("shadow-claw-a2ui");
      let handled = false;
      if (a2ui && a2ui.shadowRoot) {
        const overlays = a2ui.shadowRoot.querySelectorAll(
          ".a2ui__modal-overlay",
        ) as NodeListOf<HTMLElement>;
        overlays.forEach((overlay) => {
          if (overlay.style.display !== "none") {
            const btn = overlay.querySelector(
              ".a2ui__modal-close",
            ) as HTMLButtonElement;
            if (btn) {
              btn.click();
            }

            handled = true;
          }
        });
      }

      if (handled) {
        e.stopPropagation();

        return;
      }
    }
  };
}

if (!customElements.get("shadow-claw-a2ui-interceptor")) {
  customElements.define(
    "shadow-claw-a2ui-interceptor",
    ShadowClawA2UIInterceptor,
  );
}
