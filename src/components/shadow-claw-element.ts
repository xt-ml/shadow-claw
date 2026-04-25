export default class ShadowClawElement extends HTMLElement {
  static readonly component: string;
  static readonly styles: URL | string;
  static readonly template: URL | string;

  onStylesReady: Promise<void>;
  onTemplateReady: Promise<void>;

  static getTemplate(
    template: URL | string = (this as any).template,
  ): Promise<Element[]> {
    return fetch(template)
      .then((r) => r.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const templateEl = doc.querySelector("template");

        if (templateEl) {
          // return <template> content's children

          return Array.from(templateEl.content.children);
        }

        // return the parsed document (head + body)
        const templateChildren = Array.from(doc.head.children).concat(
          Array.from(doc.body.children),
        );

        return templateChildren;
      })
      .catch((err) => {
        console.error("Failed to load template", err);

        return Promise.reject(err);
      });
  }

  static getTemplateSource(
    template: URL | string = (this as any).template,
  ): Promise<string> {
    return fetch(template).then((r) => r.text());
  }

  static setTemplate(shadowRoot: ShadowRoot, templateChildren: Element[]) {
    shadowRoot.append(...templateChildren);
  }

  static getStyles(
    styles: URL | string = (this as any).styles,
  ): Promise<CSSStyleSheet> {
    return fetch(styles)
      .then((r) => r.text())
      .then((css) => {
        const sheet = new CSSStyleSheet();

        sheet.replaceSync(css);

        return sheet;
      })
      .catch((err) => {
        console.error("Failed to load styles", err);

        return Promise.reject(err);
      });
  }

  static getStylesSource(
    styles: URL | string = (this as any).styles,
  ): Promise<string> {
    return fetch(styles).then((r) => r.text());
  }

  static setStyles(shadowRoot: ShadowRoot, styles: CSSStyleSheet) {
    shadowRoot.adoptedStyleSheets = [styles];
  }

  constructor() {
    super();

    const { template, styles } = this.constructor as typeof ShadowClawElement;

    this.attachShadow({ mode: "open" });

    this.onTemplateReady = ShadowClawElement.getTemplate(template).then(
      (el: Element[]) => {
        if (this.shadowRoot) {
          ShadowClawElement.setTemplate(this.shadowRoot, el);

          return Promise.resolve();
        }

        return Promise.reject("Failed to load Shadow DOM");
      },
    );

    this.onStylesReady = ShadowClawElement.getStyles(styles).then(
      (sheet: CSSStyleSheet) => {
        if (this.shadowRoot) {
          ShadowClawElement.setStyles(this.shadowRoot, sheet);

          return Promise.resolve();
        }

        return Promise.reject("Failed to load Shadow DOM");
      },
    );
  }

  connectedCallback() {
    Promise.all([this.onStylesReady, this.onTemplateReady])
      .then(() => this.render())
      .catch(console.error);
  }

  async render() {}
}
