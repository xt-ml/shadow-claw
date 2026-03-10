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
});
