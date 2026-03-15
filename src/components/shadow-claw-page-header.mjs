/**
 * Reusable page header component with mobile-first responsive design.
 * Supports title, actions, and optional breadcrumbs.
 */
export class ShadowClawPageHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /** @type {() => void} */
    this.actionsLayoutCleanup = () => {};
  }

  static get observedAttributes() {
    return ["title", "icon"];
  }

  static getTemplate() {
    return `
      <style>
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: block;
        }

        .header {
          background-color: var(--shadow-claw-bg-primary, #ffffff);
          border-bottom: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
        }

        .header__main {
          align-items: flex-start;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0.75rem;
        }

        .header__top {
          align-items: flex-start;
          display: grid;
          gap: 0.75rem;
          grid-template-columns: minmax(0, 1fr);
          width: 100%;
        }

        .header__title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }

        .header__actions {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          padding-top: 0.5rem;
          width: 100%;
        }

        .header__actions[hidden] {
          display: none !important;
        }

        .header__actions-disclosure {
          width: 100%;
        }

        .header__actions-disclosure[hidden] {
          display: none !important;
        }

        .header__actions-toggle {
          align-items: center;
          background-color: var(--shadow-claw-bg-secondary, #f8fafc);
          border: 0.0625rem solid var(--shadow-claw-border-color, #e5e7eb);
          border-radius: var(--shadow-claw-radius-m, 0.75rem);
          color: var(--shadow-claw-text-secondary, #475569);
          cursor: pointer;
          display: flex;
          font-size: 0.75rem;
          font-weight: 600;
          gap: 0.5rem;
          justify-content: space-between;
          list-style: none;
          min-height: 2rem;
          padding: 0.375rem 0.625rem;
          user-select: none;
          width: calc(100% - 1.5rem);
        }

        .header__actions-toggle::-webkit-details-marker {
          display: none;
        }

        .header__actions-toggle::after {
          border-color: currentColor transparent transparent;
          border-style: solid;
          border-width: 0.375rem 0.3125rem 0;
          content: "";
          display: inline-block;
          flex: none;
          transform: rotate(0deg);
          transition: transform 0.2s ease;
        }

        .header__actions-disclosure[open] .header__actions-toggle::after {
          transform: rotate(180deg);
        }

        .header__actions-toggle:hover,
        .header__actions-toggle:focus-visible {
          background-color: var(--shadow-claw-bg-tertiary, #f1f5f9);
          border-color: var(--shadow-claw-accent-primary, #334155);
          color: var(--shadow-claw-text-primary, #0f172a);
          outline: none;
        }

        /* Mobile: make all slotted buttons full-width and stacked */
        ::slotted(button) {
          width: 100% !important;
          flex: 1 1 100% !important;
          min-width: 0 !important;
        }

        /* Tablet and up: horizontal layout */
        @media (min-width: 650px) {
          .header__main {
            padding: 1rem;
          }

          .header__title {
            font-size: 1.125rem;
          }

          .header__top {
            align-items: start;
            grid-template-columns: 1fr auto;
          }

          .header__actions {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: flex-end;
            padding-top: 0;
            width: auto;
          }

          .header__actions-toggle {
            display: none;
          }

          .header__actions-disclosure {
            width: auto;
          }

          ::slotted(button) {
            width: auto !important;
            flex: 0 1 auto !important;
            min-width: fit-content !important;
          }
        }

        /* Breadcrumbs section */
        .header__breadcrumbs {
          width: 100%;
        }

        .header__breadcrumbs:empty {
          display: none;
        }

        /* Status row (for chat) */
        .header__status {
          align-items: flex-start;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .header__status:empty {
          display: none;
        }

        @media (min-width: 650px) {
          .header__status {
            align-items: center;
            flex-direction: row;
            justify-content: space-between;
          }
        }
      </style>

      <header class="header">
        <div class="header__main">
          <div class="header__top">
            <h2 class="header__title"></h2>
            <details class="header__actions-disclosure">
              <summary class="header__actions-toggle" aria-label="Toggle page actions">
                Actions
              </summary>
              <div class="header__actions" id="header-actions-panel">
                <slot name="actions"></slot>
              </div>
            </details>
          </div>
          <div class="header__status">
            <slot name="status"></slot>
          </div>
          <div class="header__breadcrumbs">
            <slot name="breadcrumbs"></slot>
          </div>
        </div>
      </header>
    `;
  }

  connectedCallback() {
    this.render();
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    const root = this.shadowRoot;
    if (!root) return;

    const template = document.createElement("template");
    template.innerHTML = ShadowClawPageHeader.getTemplate();
    root.innerHTML = "";
    root.appendChild(template.content.cloneNode(true));

    // Set title
    const titleEl = root.querySelector(".header__title");
    if (titleEl) {
      const icon = this.getAttribute("icon") || "";
      const title = this.getAttribute("title") || "";
      titleEl.textContent = icon ? `${icon} ${title}` : title;
    }

    this.setupActionsContainer(root);
    this.setupResponsiveActionsDisclosure(root);
  }

  /**
   * Hide the actions container when no action buttons are slotted.
   *
   * @param {ShadowRoot} root
   */
  setupActionsContainer(root) {
    const actionSlot = root.querySelector('slot[name="actions"]');
    const actions = root.querySelector(".header__actions");
    const disclosure = root.querySelector(".header__actions-disclosure");

    if (
      !(actionSlot instanceof HTMLSlotElement) ||
      !(actions instanceof HTMLElement) ||
      !(disclosure instanceof HTMLElement)
    ) {
      return;
    }

    const updateVisibility = () => {
      const hasActions = actionSlot.assignedElements().length > 0;
      actions.hidden = !hasActions;
      disclosure.hidden = !hasActions;
    };

    actionSlot.addEventListener("slotchange", updateVisibility);
    updateVisibility();
  }

  /**
   * Keep actions collapsed by default on stacked/mobile layout and expanded on wider screens.
   *
   * @param {ShadowRoot} root
   */
  setupResponsiveActionsDisclosure(root) {
    this.actionsLayoutCleanup();

    const disclosure = root.querySelector(".header__actions-disclosure");
    if (!(disclosure instanceof HTMLDetailsElement)) {
      return;
    }

    if (typeof globalThis.matchMedia !== "function") {
      disclosure.open = false;
      this.actionsLayoutCleanup = () => {};
      return;
    }

    const mediaQuery = globalThis.matchMedia("(min-width: 650px)");

    const applyLayoutMode = () => {
      if (mediaQuery.matches) {
        disclosure.open = true;
      } else {
        disclosure.open = false;
      }
    };

    applyLayoutMode();

    const onChange = () => {
      applyLayoutMode();
    };

    mediaQuery.addEventListener("change", onChange);

    this.actionsLayoutCleanup = () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }

  disconnectedCallback() {
    this.actionsLayoutCleanup();
  }
}

customElements.define("shadow-claw-page-header", ShadowClawPageHeader);
