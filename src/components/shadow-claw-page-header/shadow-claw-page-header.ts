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
  mainVisibilityCleanup: () => void = () => {};
  mainVisibilityMediaQuery: MediaQueryList | null = null;
  manualMainCollapsedOverride: boolean | null = null;
  mainCollapsed: boolean = false;

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

  attributeChangedCallback(_name, oldValue, newValue) {
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
    this.setupMainVisibility(root);
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

  setupMainVisibility(root: ShadowRoot) {
    this.mainVisibilityCleanup();
    this.mainVisibilityMediaQuery = null;
    this.mainVisibilityCleanup = () => {};
    this.applyMainVisibility(root);
  }

  getAutoMainCollapsed() {
    return false;
  }

  getEffectiveMainCollapsed() {
    if (typeof this.manualMainCollapsedOverride === "boolean") {
      return this.manualMainCollapsedOverride;
    }

    return this.getAutoMainCollapsed();
  }

  applyMainVisibility(root?: ShadowRoot) {
    const targetRoot = root || this.shadowRoot;
    if (!targetRoot) {
      return;
    }

    const headerMain = targetRoot.querySelector(".header__main");
    if (!(headerMain instanceof HTMLElement)) {
      return;
    }

    const collapsed = this.getEffectiveMainCollapsed();
    this.mainCollapsed = collapsed;
    headerMain.hidden = collapsed;
  }

  setMainCollapsedOverride(collapsed: boolean | null) {
    this.manualMainCollapsedOverride =
      typeof collapsed === "boolean" ? collapsed : null;
    this.applyMainVisibility();
  }

  toggleMainCollapsedOverride() {
    this.setMainCollapsedOverride(!this.isMainCollapsed());

    return this.isMainCollapsed();
  }

  isMainCollapsed() {
    return this.mainCollapsed;
  }

  disconnectedCallback() {
    this.actionsLayoutCleanup();
    this.mainVisibilityCleanup();
  }
}

customElements.define(elementName, ShadowClawPageHeader);
