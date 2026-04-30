const { ShadowClawCard } = await import("./shadow-claw-card.js");

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
    await el.onTemplateReady;
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
});
