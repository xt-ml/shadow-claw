import { initializeThemeAndBootState } from "./theme-init.js";

describe("theme-init initializeThemeAndBootState", () => {
  let shadowClawEl: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.body.innerHTML = "";

    shadowClawEl = document.createElement("shadow-claw");
    document.body.appendChild(shadowClawEl);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("sets data-prerender-no-seed and pending attributes when override-prerender-skeleton is enabled in localStorage", () => {
    localStorage.setItem("shadow-claw-override-prerender-skeleton", "true");

    initializeThemeAndBootState();

    expect(shadowClawEl.getAttribute("data-prerender-no-seed")).toBe("true");
    expect(shadowClawEl.getAttribute("data-js-boot-pending")).toBe("true");
    expect(shadowClawEl.getAttribute("data-hydration-pending")).toBe("true");
  });

  it("does not set data-prerender-no-seed if override is false and element lacks no-seed attribute", () => {
    localStorage.setItem("shadow-claw-override-prerender-skeleton", "false");

    initializeThemeAndBootState();

    expect(shadowClawEl.hasAttribute("data-prerender-no-seed")).toBe(false);
    expect(shadowClawEl.hasAttribute("data-js-boot-pending")).toBe(false);
    expect(shadowClawEl.hasAttribute("data-hydration-pending")).toBe(false);
  });

  it("does NOT set pending attributes if element has data-prerender-no-seed='true' but override is disabled", () => {
    // The prerender script always bakes data-prerender-no-seed="true" into the
    // HTML, but if the user has the override setting disabled the skeleton
    // should not appear. Pending attributes must not be set in this case.
    shadowClawEl.setAttribute("data-prerender-no-seed", "true");
    // __PRERENDER_MAIN_MEMORY__ is false in jest-setup; no localStorage override
    initializeThemeAndBootState();

    // data-prerender-no-seed was already on the element — should stay
    expect(shadowClawEl.getAttribute("data-prerender-no-seed")).toBe("true");
    // but the skeleton-driving pending attrs must NOT be set
    expect(shadowClawEl.hasAttribute("data-js-boot-pending")).toBe(false);
    expect(shadowClawEl.hasAttribute("data-hydration-pending")).toBe(false);
  });

  it("sets pending attributes if element has data-prerender-no-seed='true' AND override is enabled", () => {
    shadowClawEl.setAttribute("data-prerender-no-seed", "true");
    localStorage.setItem("shadow-claw-override-prerender-skeleton", "true");

    initializeThemeAndBootState();

    expect(shadowClawEl.getAttribute("data-prerender-no-seed")).toBe("true");
    expect(shadowClawEl.getAttribute("data-js-boot-pending")).toBe("true");
    expect(shadowClawEl.getAttribute("data-hydration-pending")).toBe("true");
  });

  it("adds sc-prerender-override class to <html> when override setting is enabled", () => {
    localStorage.setItem("shadow-claw-override-prerender-skeleton", "true");

    initializeThemeAndBootState();

    expect(
      document.documentElement.classList.contains("sc-prerender-override"),
    ).toBe(true);
  });

  it("does not add sc-prerender-override class to <html> when override setting is disabled", () => {
    localStorage.setItem("shadow-claw-override-prerender-skeleton", "false");

    initializeThemeAndBootState();

    expect(
      document.documentElement.classList.contains("sc-prerender-override"),
    ).toBe(false);
  });
});
