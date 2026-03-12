/**
 * Reusable page header component with mobile-first responsive design.
 * Supports title, actions, and optional breadcrumbs.
 */
export class ShadowClawPageHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
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
          align-items: stretch;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }

        .header__title {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
        }

        /* Mobile-first: actions container */
        .header__actions {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
          width: 100%;
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
            align-items: center;
            flex-direction: row;
            justify-content: space-between;
          }

          .header__actions {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: flex-end;
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
            <div class="header__actions">
              <slot name="actions"></slot>
            </div>
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
  }
}

customElements.define("shadow-claw-page-header", ShadowClawPageHeader);
