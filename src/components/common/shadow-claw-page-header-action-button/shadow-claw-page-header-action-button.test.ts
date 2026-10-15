import { ShadowClawPageHeaderActionButton } from "./shadow-claw-page-header-action-button.js";

describe("shadow-claw-page-header-action-button", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-page-header-action-button")).toBe(
      ShadowClawPageHeaderActionButton,
    );
  });

  it("renders with default variant by default", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    document.body.appendChild(el);
    await el.render();

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--default")).toBe(true);

    el.remove();
  });

  it("renders with primary variant", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("variant", "primary");
    document.body.appendChild(el);
    await el.render();

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--primary")).toBe(true);

    el.remove();
  });

  it("renders with danger variant", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("variant", "danger");
    document.body.appendChild(el);
    await el.render();

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--danger")).toBe(true);

    el.remove();
  });

  it("reflects disabled attribute to inner button", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("disabled", "");
    document.body.appendChild(el);
    await el.render();

    const button =
      el.shadowRoot?.querySelector<HTMLButtonElement>(".action-btn");
    expect(button?.disabled).toBe(true);

    el.remove();
  });

  it("re-renders when variant attribute changes", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    document.body.appendChild(el);
    await el.render();

    el.setAttribute("variant", "danger");
    await el.render();

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--danger")).toBe(true);

    el.remove();
  });

  it("auto-reflects disabled via attributeChangedCallback without manual render call", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("disabled", "");
    document.body.appendChild(el);

    el.removeAttribute("disabled");

    const button =
      el.shadowRoot?.querySelector<HTMLButtonElement>(".action-btn");
    expect(button?.disabled).toBe(false);

    el.remove();
  });

  it("auto-reflects variant via attributeChangedCallback without manual render call", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    document.body.appendChild(el);

    el.setAttribute("variant", "primary");

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--primary")).toBe(true);

    el.remove();
  });

  it("removes disabled from inner button when attribute is removed", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("disabled", "");
    document.body.appendChild(el);
    await el.render();

    el.removeAttribute("disabled");
    await el.render();

    const button =
      el.shadowRoot?.querySelector<HTMLButtonElement>(".action-btn");
    expect(button?.disabled).toBe(false);

    el.remove();
  });

  it("handles early returns when shadowRoot or button is missing", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.render()).resolves.toBeUndefined();

    const el2 = new ShadowClawPageHeaderActionButton();
    el2.shadowRoot?.querySelector(".action-btn")?.remove();
    await expect(el2.render()).resolves.toBeUndefined();
  });

  it("handles empty variant attribute and falls back to default", async () => {
    const el = new ShadowClawPageHeaderActionButton();
    el.setAttribute("variant", "");
    await el.connectedCallback();

    const button = el.shadowRoot?.querySelector(".action-btn");
    expect(button?.classList.contains("action-btn--default")).toBe(true);
  });
});
