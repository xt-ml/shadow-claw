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

  it("sets pending attributes if element already has data-prerender-no-seed='true'", () => {
    shadowClawEl.setAttribute("data-prerender-no-seed", "true");

    initializeThemeAndBootState();

    expect(shadowClawEl.getAttribute("data-prerender-no-seed")).toBe("true");
    expect(shadowClawEl.getAttribute("data-js-boot-pending")).toBe("true");
    expect(shadowClawEl.getAttribute("data-hydration-pending")).toBe("true");
  });
});
