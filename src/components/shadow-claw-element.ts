export default class ShadowClawElement extends HTMLElement {
  static readonly component: string;

  // These now accept the compiled modules directly
  static readonly styles: CSSStyleSheet;
  static readonly template: HTMLElement[];

  private _cleanups: Array<() => void> = [];

  constructor() {
    super();

    const { template, styles } = this.constructor as typeof ShadowClawElement;
    const existingShadowRoot = this.shadowRoot;

    if (!existingShadowRoot) {
      const shadowRoot = this.attachShadow({ mode: "open" });

      // Synchronously apply template elements compiled by Rolldown
      if (template && Array.isArray(template)) {
        // We clone nodes to ensure multi-instance reuse works correctly
        const clonedElements = template.map(
          (el) => el.cloneNode(true) as HTMLElement,
        );
        shadowRoot.append(...clonedElements);
      }
    }

    // Synchronously apply stylesheet compiled by Rolldown
    if (this.shadowRoot && styles instanceof CSSStyleSheet) {
      this.shadowRoot.adoptedStyleSheets = [styles];

      const dsdStyles = this.shadowRoot.querySelectorAll(
        'style[data-dsd-style], link[rel="stylesheet"]',
      );
      dsdStyles.forEach((el) => el.remove());
    }

    this.ensureShadowDialogs();
  }

  connectedCallback() {
    this.ensureShadowDialogs();
    this.render();
  }

  protected ensureShadowDialogs(): void {
    if (!this.shadowRoot) {
      return;
    }
    const dialogs = this.shadowRoot.querySelectorAll("shadow-claw-dialog");
    for (const dialog of dialogs) {
      if (dialog instanceof HTMLElement) {
        customElements.upgrade(dialog);
      }
      if (typeof (dialog as any).ensureDialog === "function") {
        (dialog as any).ensureDialog();
      }
    }
  }

  disconnectedCallback() {
    this.disposeCleanups();
  }

  protected addCleanup(cleanup: () => void): void {
    this._cleanups.push(cleanup);
  }

  protected disposeCleanups(): void {
    this._cleanups.forEach((cleanup) => cleanup());
    this._cleanups = [];
  }

  render() {}
}
