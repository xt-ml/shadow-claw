const { ShadowClawPageHeader } = await import("./shadow-claw-page-header.js");

describe("shadow-claw-page-header", () => {
  it("registers custom element and renders title/icon", async () => {
    expect(customElements.get("shadow-claw-page-header")).toBe(
      ShadowClawPageHeader,
    );

    const el = new ShadowClawPageHeader();
    el.setAttribute("title", "Files");
    el.setAttribute("icon", "[icon]");

    document.body.appendChild(el);
    await el.onTemplateReady;

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
    await el.onTemplateReady;

    const disclosure = el.shadowRoot?.querySelector(
      ".header__actions-disclosure",
    );
    const summary = el.shadowRoot?.querySelector(".header__actions-toggle");

    expect(disclosure).toBeTruthy();
    expect(summary?.textContent).toContain("Actions");

    el.remove();
  });
});
