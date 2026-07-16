import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawPageHeaderStyles from "./shadow-claw-page-header.css" with { type: "css" };
import shadowClawPageHeaderTemplate from "./shadow-claw-page-header.html" with { type: "html" };

const elementName = "shadow-claw-page-header";

/**
 * Reusable page header component with mobile-first responsive design.
 * Supports title, actions, and optional breadcrumbs.
 */
export class ShadowClawPageHeader extends ShadowClawElement {
  static styles = shadowClawPageHeaderStyles;
  static template = shadowClawPageHeaderTemplate;

  static get observedAttributes() {
    return ["title", "icon"];
  }

  mainCollapsed: boolean = false;
  mainVisibilityMediaQuery: MediaQueryList | null = null;
  manualMainCollapsedOverride: boolean | null = null;

  constructor() {
    super();
  }

  attributeChangedCallback(_name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  async connectedCallback() {

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    await this.render();
  }

  disconnectedCallback() {
    this.actionsLayoutCleanup();
    this.mainVisibilityCleanup();
  }

  actionsLayoutCleanup: () => void = () => {};

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

  getAutoMainCollapsed() {
    return false;
  }

  getEffectiveMainCollapsed() {
    if (typeof this.manualMainCollapsedOverride === "boolean") {
      return this.manualMainCollapsedOverride;
    }

    return this.getAutoMainCollapsed();
  }

  isMainCollapsed() {
    return this.mainCollapsed;
  }

  mainVisibilityCleanup: () => void = () => {};

  setMainCollapsedOverride(collapsed: boolean | null) {
    this.manualMainCollapsedOverride =
      typeof collapsed === "boolean" ? collapsed : null;
    this.applyMainVisibility();
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

  setupMainVisibility(root: ShadowRoot) {
    this.mainVisibilityCleanup();
    this.mainVisibilityMediaQuery = null;
    this.mainVisibilityCleanup = () => {};
    this.applyMainVisibility(root);
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

  toggleMainCollapsedOverride() {
    this.setMainCollapsedOverride(!this.isMainCollapsed());

    return this.isMainCollapsed();
  }

  async render() {
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
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawPageHeader);
}
