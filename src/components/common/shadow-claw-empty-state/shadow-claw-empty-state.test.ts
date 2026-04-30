const { ShadowClawEmptyState } = await import("./shadow-claw-empty-state.js");

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
    await el.onTemplateReady;
    await el.render();

    const message = el.shadowRoot?.querySelector(".empty-state__message");
    const hint = el.shadowRoot?.querySelector(".empty-state__hint");

    expect(message?.textContent).toBe("No records found");
    expect(hint?.textContent).toBe("Try creating one.");
    expect(hint?.hasAttribute("hidden")).toBe(false);

    el.remove();
  });
});
