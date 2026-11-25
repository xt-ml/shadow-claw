import {
  installPageSwipeGuard,
  SWIPE_GUARD_ATTRS,
} from "./page-swipe-guard.js";

describe("page-swipe-guard", () => {
  it("sets guard attributes on host and enclosing .pages__rendered / .pages__viewer / extraSelectors ancestors", () => {
    const viewer = document.createElement("div");
    viewer.className = "pages__viewer";
    const rendered = document.createElement("div");
    rendered.className = "pages__rendered";
    const customPage = document.createElement("div");
    customPage.className = "custom-workbench-page";
    const host = document.createElement("div");

    viewer.appendChild(rendered);
    rendered.appendChild(customPage);
    customPage.appendChild(host);
    document.body.appendChild(viewer);

    const dispose = installPageSwipeGuard(host, {
      extraSelectors: [".custom-workbench-page"],
    });

    for (const el of [host, viewer, rendered, customPage]) {
      for (const attr of SWIPE_GUARD_ATTRS) {
        expect(el.getAttribute(attr)).toBe("true");
      }
    }

    dispose();

    for (const el of [viewer, rendered, customPage]) {
      for (const attr of SWIPE_GUARD_ATTRS) {
        expect(el.hasAttribute(attr)).toBe(false);
      }
    }

    viewer.remove();
  });

  it("ref-counts shared ancestors via WeakMap and restores prior attribute values idempotently", () => {
    const viewer = document.createElement("div");
    viewer.className = "pages__viewer";
    viewer.setAttribute("data-no-swipe", "false");

    const hostA = document.createElement("div");
    const hostB = document.createElement("div");
    viewer.append(hostA, hostB);
    document.body.appendChild(viewer);

    const disposeA = installPageSwipeGuard(hostA);
    const disposeB = installPageSwipeGuard(hostB);

    expect(viewer.getAttribute("data-no-swipe")).toBe("true");
    expect(viewer.getAttribute("data-no-nav")).toBe("true");

    // Disposing A keeps guards intact while B is still mounted
    disposeA();
    // Double-disposing A must not decrement B's ref count
    disposeA();

    expect(viewer.getAttribute("data-no-swipe")).toBe("true");
    expect(viewer.getAttribute("data-no-nav")).toBe("true");

    // Disposing B restores original values and removes newly added attrs
    disposeB();
    expect(viewer.getAttribute("data-no-swipe")).toBe("false");
    expect(viewer.hasAttribute("data-no-nav")).toBe(false);

    viewer.remove();
  });

  it("safely no-ops when host is null or lacks DOM methods", () => {
    const disposeNull = installPageSwipeGuard(null);
    expect(() => disposeNull()).not.toThrow();

    const disposeObj = installPageSwipeGuard({} as unknown as HTMLElement);
    expect(() => disposeObj()).not.toThrow();
  });
});
