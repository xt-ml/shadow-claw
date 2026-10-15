import { ShadowClawEmptyState } from "./shadow-claw-empty-state.js";

describe("shadow-claw-empty-state", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-empty-state")).toBe(
      ShadowClawEmptyState,
    );
  });

  it("renders message and hint from attributes", async () => {
    const el = new ShadowClawEmptyState();
    el.setAttribute("message", "No records found");
    el.setAttribute("hint", "Try creating one.");

    document.body.appendChild(el);
    await el.render();

    const message = el.shadowRoot?.querySelector(".empty-state__message");
    const hint = el.shadowRoot?.querySelector(".empty-state__hint");

    expect(message?.textContent).toBe("No records found");
    expect(hint?.textContent).toBe("Try creating one.");
    expect(hint?.hasAttribute("hidden")).toBe(false);

    el.remove();
  });

  it("renders default message and hidden hint when attributes are missing", async () => {
    const el = new ShadowClawEmptyState();
    document.body.appendChild(el);
    await el.connectedCallback();

    const message = el.shadowRoot?.querySelector(".empty-state__message");
    const hint = el.shadowRoot?.querySelector(".empty-state__hint");

    expect(message?.textContent).toBe("Nothing here yet.");
    expect(hint?.textContent).toBe("");
    expect(hint?.hasAttribute("hidden")).toBe(true);

    // attributeChangedCallback
    el.setAttribute("message", "Custom Message");
    el.attributeChangedCallback();
    expect(message?.textContent).toBe("Custom Message");

    el.remove();
  });

  it("handles early returns when shadowRoot or elements are missing", async () => {
    const el = new ShadowClawEmptyState();
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.render()).resolves.toBeUndefined();

    const el2 = new ShadowClawEmptyState();
    el2.shadowRoot?.querySelector(".empty-state__message")?.remove();
    await expect(el2.render()).resolves.toBeUndefined();

    const el3 = new ShadowClawEmptyState();
    el3.shadowRoot?.querySelector(".empty-state__hint")?.remove();
    await expect(el3.render()).resolves.toBeUndefined();
  });
});
