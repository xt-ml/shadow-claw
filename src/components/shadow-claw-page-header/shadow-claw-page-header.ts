import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-page-header";

/**
 * Reusable page header component with mobile-first responsive design.
 * Supports title, actions, and optional breadcrumbs.
 */
export class ShadowClawPageHeader extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawPageHeader.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPageHeader.componentPath}/${elementName}.html`;

  actionsLayoutCleanup: () => void = () => {};

  constructor() {
    super();
  }

  static get observedAttributes() {
    return ["title", "icon"];
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    await this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  async render() {
    await this.onTemplateReady;
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

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
   */
  setupActionsContainer(root: ShadowRoot) {
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
   */
  setupResponsiveActionsDisclosure(root: ShadowRoot) {
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

    const mediaQuery = globalThis.matchMedia("(min-width: 40.625rem)");

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

customElements.define(elementName, ShadowClawPageHeader);
