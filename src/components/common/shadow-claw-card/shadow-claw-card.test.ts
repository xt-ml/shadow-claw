import { ShadowClawCard } from "./shadow-claw-card.js";

describe("shadow-claw-card", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-card")).toBe(ShadowClawCard);
  });

  it("renders label, meta, and badge from attributes", async () => {
    const el = new ShadowClawCard();
    el.setAttribute("label", "Main Account");
    el.setAttribute("meta", "github.com · Token (PAT)");
    el.setAttribute("badge", "Default");

    document.body.appendChild(el);
    await el.render();

    const label = el.shadowRoot?.querySelector(".card__label");
    const meta = el.shadowRoot?.querySelector(".card__meta");
    const badge = el.shadowRoot?.querySelector(".card__badge");

    expect(label?.textContent).toBe("Main Account");
    expect(meta?.textContent).toBe("github.com · Token (PAT)");
    expect(badge?.textContent).toBe("Default");
    expect(badge?.hasAttribute("hidden")).toBe(false);

    el.remove();
  });

  it("handles missing attributes and triggers attributeChangedCallback", async () => {
    const el = new ShadowClawCard();
    document.body.appendChild(el);
    await el.connectedCallback();

    const label = el.shadowRoot?.querySelector(".card__label");
    const meta = el.shadowRoot?.querySelector(".card__meta");
    const badge = el.shadowRoot?.querySelector(".card__badge");

    expect(label?.textContent).toBe("");
    expect(meta?.textContent).toBe("");
    expect(badge?.textContent).toBe("");
    expect(badge?.hasAttribute("hidden")).toBe(true);

    // Call attributeChangedCallback
    el.setAttribute("label", "Updated Label");
    el.attributeChangedCallback();
    expect(label?.textContent).toBe("Updated Label");

    el.remove();
  });

  it("handles early returns when shadowRoot or elements are missing", async () => {
    const el = new ShadowClawCard();
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.render()).resolves.toBeUndefined();

    const el2 = new ShadowClawCard();
    el2.shadowRoot?.querySelector(".card__label")?.remove();
    await expect(el2.render()).resolves.toBeUndefined();

    const el3 = new ShadowClawCard();
    el3.shadowRoot?.querySelector(".card__meta")?.remove();
    await expect(el3.render()).resolves.toBeUndefined();

    const el4 = new ShadowClawCard();
    el4.shadowRoot?.querySelector(".card__badge")?.remove();
    await expect(el4.render()).resolves.toBeUndefined();
  });
});
