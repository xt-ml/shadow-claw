const { ShadowClawPageHeader } = await import("./shadow-claw-page-header.mjs");

describe("shadow-claw-page-header", () => {
  it("registers custom element and renders title/icon", () => {
    expect(customElements.get("shadow-claw-page-header")).toBe(
      ShadowClawPageHeader,
    );

    const el = document.createElement("shadow-claw-page-header");
    el.setAttribute("title", "Files");
    el.setAttribute("icon", "[icon]");

    document.body.appendChild(el);

    const title = el.shadowRoot.querySelector(".header__title").textContent;
    expect(title).toBe("[icon] Files");

    el.remove();
  });

  it("renders actions disclosure with summary toggle", () => {
    const el = document.createElement("shadow-claw-page-header");
    el.setAttribute("title", "Files");

    const action = document.createElement("button");
    action.slot = "actions";
    action.textContent = "Upload";
    el.appendChild(action);

    document.body.appendChild(el);

    const disclosure = el.shadowRoot.querySelector(
      ".header__actions-disclosure",
    );
    const summary = el.shadowRoot.querySelector(".header__actions-toggle");

    expect(disclosure).toBeTruthy();
    expect(summary?.textContent).toContain("Actions");

    el.remove();
  });
});
