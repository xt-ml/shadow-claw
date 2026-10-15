import { jest } from "@jest/globals";
import { ShadowClawPageHeader } from "./shadow-claw-page-header.js";

describe("shadow-claw-page-header", () => {
  it("registers custom element and renders title/icon", async () => {
    expect(customElements.get("shadow-claw-page-header")).toBe(
      ShadowClawPageHeader,
    );

    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Files");
    el.setAttribute("icon", "[icon]");

    document.body.appendChild(el);

    const title = el.shadowRoot?.querySelector(".header__title")?.textContent;
    expect(title).toBe("[icon] Files");

    el.remove();
  });

  it("renders actions disclosure with summary toggle", async () => {
    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Files");

    const action = document.createElement("button");
    action.slot = "actions";
    action.textContent = "Upload";
    el.appendChild(action);

    document.body.appendChild(el);

    const disclosure = el.shadowRoot?.querySelector(
      ".header__actions-disclosure",
    );

    const summary = el.shadowRoot?.querySelector(".header__actions-toggle");

    expect(disclosure).toBeTruthy();
    expect(summary?.textContent).toContain("Actions");

    el.remove();
  });

  it("is not collapsed by default on small/mobile viewports", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() =>
        ({
          matches: false,
          media: "(min-width: 56rem)",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as unknown as MediaQueryList);

    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Chat");
    document.body.appendChild(el);

    expect(el.isMainCollapsed()).toBe(false);

    el.remove();
    globalThis.matchMedia = originalMatchMedia;
  });

  it("shows automatically on larger viewports", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() =>
        ({
          matches: true,
          media: "(min-width: 56rem) and (min-height: 401px)",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as unknown as MediaQueryList);

    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Chat");
    document.body.appendChild(el);

    expect(el.isMainCollapsed()).toBe(false);

    el.remove();
    globalThis.matchMedia = originalMatchMedia;
  });

  it("supports manual override toggle regardless of viewport", async () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia =
      originalMatchMedia ||
      (() =>
        ({
          matches: true,
          media: "(min-width: 56rem) and (min-height: 401px)",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => true,
        }) as unknown as MediaQueryList);

    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Chat");
    document.body.appendChild(el);

    expect(el.isMainCollapsed()).toBe(false);

    el.toggleMainCollapsedOverride();
    expect(el.isMainCollapsed()).toBe(true);

    el.toggleMainCollapsedOverride();
    expect(el.isMainCollapsed()).toBe(false);

    el.remove();
    globalThis.matchMedia = originalMatchMedia;
  });

  it("handles page-title attribute and missing icon", async () => {
    const el = new ShadowClawPageHeader();
    el.setAttribute("page-title", "Page Title Only");
    document.body.appendChild(el);

    const title = el.shadowRoot?.querySelector(".header__title")?.textContent;
    expect(title).toBe("Page Title Only");

    // Attribute changed with same value vs different value
    el.attributeChangedCallback(
      "page-title",
      "Page Title Only",
      "Page Title Only",
    );
    el.setAttribute("page-title", "Updated Title");
    expect(el.shadowRoot?.querySelector(".header__title")?.textContent).toBe(
      "Updated Title",
    );

    el.remove();
  });

  it("handles slotchange and hides actions when no elements are slotted", async () => {
    const el = new ShadowClawPageHeader();
    document.body.appendChild(el);

    const actions = el.shadowRoot?.querySelector(
      ".header__actions",
    ) as HTMLElement;
    const disclosure = el.shadowRoot?.querySelector(
      ".header__actions-disclosure",
    ) as HTMLElement;
    const actionSlot = el.shadowRoot?.querySelector(
      'slot[name="actions"]',
    ) as HTMLSlotElement;

    expect(actions?.hidden).toBe(true);
    expect(disclosure?.hidden).toBe(true);

    // Mock assignedElements returning an element
    const btn = document.createElement("button");
    jest.spyOn(actionSlot, "assignedElements").mockReturnValue([btn]);
    actionSlot.dispatchEvent(new Event("slotchange"));

    expect(actions?.hidden).toBe(false);
    expect(disclosure?.hidden).toBe(false);

    el.remove();
  });

  it("handles matchMedia listener callbacks and missing matchMedia", async () => {
    let changeHandler: any;
    let matches = false;
    const mockMql = {
      get matches() {
        return matches;
      },
      media: "(min-width: 40.625rem)",
      addEventListener: jest.fn((event: string, handler: any) => {
        if (event === "change") changeHandler = handler;
      }),
      removeEventListener: jest.fn(),
    } as any;

    const origMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = jest.fn(() => mockMql) as any;

    const el = new ShadowClawPageHeader();
    document.body.appendChild(el);

    const disclosure = el.shadowRoot?.querySelector(
      ".header__actions-disclosure",
    ) as HTMLDetailsElement;
    expect(disclosure.open).toBe(false);

    // Trigger change event with matches = true
    matches = true;
    changeHandler();
    expect(disclosure.open).toBe(true);

    // Disconnect removes listener
    el.remove();
    expect(mockMql.removeEventListener).toHaveBeenCalled();

    // Now test when matchMedia is not a function
    (globalThis as any).matchMedia = undefined;
    const el2 = new ShadowClawPageHeader();
    document.body.appendChild(el2);
    const disclosure2 = el2.shadowRoot?.querySelector(
      ".header__actions-disclosure",
    ) as HTMLDetailsElement;
    expect(disclosure2.open).toBe(false);
    el2.remove();

    globalThis.matchMedia = origMatchMedia;
  });

  it("handles early returns in guards when elements or shadowRoot are missing", async () => {
    const el = new ShadowClawPageHeader();
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );
    await expect(el.render()).resolves.toBeUndefined();
    expect(() => el.applyMainVisibility()).not.toThrow();

    const el2 = new ShadowClawPageHeader();
    el2.shadowRoot?.querySelector(".header__main")?.remove();
    expect(() => el2.applyMainVisibility()).not.toThrow();

    const el3 = new ShadowClawPageHeader();
    el3.shadowRoot?.querySelector(".header__actions-disclosure")?.remove();
    expect(() =>
      el3.setupActionsContainer(el3.shadowRoot as ShadowRoot),
    ).not.toThrow();
    expect(() =>
      el3.setupResponsiveActionsDisclosure(el3.shadowRoot as ShadowRoot),
    ).not.toThrow();

    // Non-boolean override
    el3.setMainCollapsedOverride(null);
    expect(el3.getEffectiveMainCollapsed()).toBe(false);
  });
});
