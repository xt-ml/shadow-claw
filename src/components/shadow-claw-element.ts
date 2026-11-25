import type { ShadowClawDialog } from "./shadow-claw-dialog/shadow-claw-dialog.js";
import { installPageSwipeGuard } from "../utils/page-swipe-guard.js";

export const BaseElement: typeof HTMLElement =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export function defineElement(
  tagName: string,
  ctor: CustomElementConstructor,
): void {
  if (typeof customElements !== "undefined" && !customElements.get(tagName)) {
    customElements.define(tagName, ctor);
  }
}

export type ShadowClawStyleInput = CSSStyleSheet | string | null | undefined;
export type ShadowClawStylesConfig =
  ShadowClawStyleInput | ReadonlyArray<ShadowClawStyleInput>;
export type ShadowClawTemplateConfig =
  HTMLElement[] | HTMLTemplateElement | string | null | undefined;

const stringSheetCache = new Map<string, CSSStyleSheet>();
const stringTemplateCache = new Map<string, HTMLTemplateElement>();

function canUseConstructableStylesheet(): boolean {
  return (
    typeof CSSStyleSheet !== "undefined" &&
    typeof CSSStyleSheet.prototype?.replaceSync === "function"
  );
}

function getOrCreateCachedSheet(cssText: string): CSSStyleSheet {
  let sheet = stringSheetCache.get(cssText);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    stringSheetCache.set(cssText, sheet);
  }

  return sheet;
}

function appendTemplateNodes(
  shadowRoot: ShadowRoot,
  template: ShadowClawTemplateConfig,
): void {
  if (!template) {
    return;
  }

  if (Array.isArray(template)) {
    const clonedElements = template.map(
      (el) => el.cloneNode(true) as HTMLElement,
    );
    shadowRoot.append(...clonedElements);

    return;
  }

  if (
    typeof HTMLTemplateElement !== "undefined" &&
    template instanceof HTMLTemplateElement
  ) {
    shadowRoot.append(template.content.cloneNode(true));

    return;
  }

  if (typeof template === "string" && typeof document !== "undefined") {
    let cachedTemplate = stringTemplateCache.get(template);
    if (!cachedTemplate) {
      cachedTemplate = document.createElement("template");
      cachedTemplate.innerHTML = template;
      stringTemplateCache.set(template, cachedTemplate);
    }

    shadowRoot.append(cachedTemplate.content.cloneNode(true));
  }
}

function applyComponentStyles(
  shadowRoot: ShadowRoot,
  styles: ShadowClawStylesConfig,
): void {
  if (!styles) {
    return;
  }

  const rawEntries = Array.isArray(styles) ? styles : [styles];
  const sheets: CSSStyleSheet[] = [];
  const fallbackCssStrings: string[] = [];

  for (const entry of rawEntries) {
    if (!entry) {
      continue;
    }

    if (
      typeof CSSStyleSheet !== "undefined" &&
      entry instanceof CSSStyleSheet
    ) {
      sheets.push(entry);
    } else if (typeof entry === "string") {
      if (canUseConstructableStylesheet()) {
        sheets.push(getOrCreateCachedSheet(entry));
      } else {
        fallbackCssStrings.push(entry);
      }
    }
  }

  if (sheets.length > 0 && "adoptedStyleSheets" in shadowRoot) {
    shadowRoot.adoptedStyleSheets = sheets;
  }

  if (fallbackCssStrings.length > 0 && typeof document !== "undefined") {
    const styleEl = document.createElement("style");
    styleEl.textContent = fallbackCssStrings.join("\n");
    shadowRoot.prepend(styleEl);
  }

  if (sheets.length > 0) {
    const dsdStyles = shadowRoot.querySelectorAll(
      'style[data-dsd-style], link[rel="stylesheet"]:not([data-theme-stylesheet])',
    );
    dsdStyles.forEach((el) => el.remove());
  }
}

export class ShadowClawElement extends BaseElement {
  static readonly component: string;
  static readonly styles?: ShadowClawStylesConfig;
  static readonly template?: ShadowClawTemplateConfig;
  static readonly shadowRootOptions?: Partial<ShadowRootInit>;
  static readonly disablePageSwipe?: boolean;

  private _cleanups: Array<() => void> = [];

  constructor() {
    super();

    const ctor = this.constructor as typeof ShadowClawElement;
    const existingShadowRoot = this.shadowRoot;

    if (!existingShadowRoot && typeof this.attachShadow === "function") {
      const shadowRoot = this.attachShadow({
        ...(ctor.shadowRootOptions || {}),
        mode: "open",
      });

      appendTemplateNodes(shadowRoot, ctor.template);
    }

    if (this.shadowRoot) {
      applyComponentStyles(this.shadowRoot, ctor.styles);
    }

    this.ensureShadowDialogs();
  }

  connectedCallback() {
    if ((this.constructor as typeof ShadowClawElement).disablePageSwipe) {
      this.addCleanup(installPageSwipeGuard(this));
    }
    this.ensureShadowDialogs();
    this.render();
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

  protected ensureShadowDialogs(): void {
    if (
      !this.shadowRoot ||
      typeof HTMLElement === "undefined" ||
      typeof customElements === "undefined"
    ) {
      return;
    }

    const dialogs = this.shadowRoot.querySelectorAll("shadow-claw-dialog");
    for (const dialog of dialogs as unknown as ShadowClawDialog[]) {
      if (dialog instanceof HTMLElement) {
        customElements.upgrade(dialog);
      }

      if (typeof (dialog as any).ensureDialog === "function") {
        (dialog as any).ensureDialog();
      }
    }
  }

  render() {}
}

export default ShadowClawElement;
