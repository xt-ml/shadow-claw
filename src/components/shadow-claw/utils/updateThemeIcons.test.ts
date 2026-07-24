import { updateThemeIcons } from "./updateThemeIcons.js";

describe("updateThemeIcons", () => {
  let shadowRoot: ShadowRoot;
  let sunIcon: HTMLElement;
  let moonIcon: HTMLElement;

  beforeEach(() => {
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    sunIcon = document.createElement("div");
    sunIcon.className = "sun-icon";
    moonIcon = document.createElement("div");
    moonIcon.className = "moon-icon";
    shadowRoot.append(sunIcon, moonIcon);
  });

  it("should return early if shadowRoot is null", () => {
    updateThemeIcons(null, "dark");
  });

  it("should return early if icons are not found", () => {
    shadowRoot.innerHTML = "";
    updateThemeIcons(shadowRoot, "dark");
  });

  it("should update icons for dark theme", () => {
    updateThemeIcons(shadowRoot, "dark");

    expect(sunIcon.style.display).toBe("block");
    expect(sunIcon.hasAttribute("hidden")).toBe(false);
    expect(sunIcon.classList.contains("hidden")).toBe(false);

    expect(moonIcon.style.display).toBe("none");
    expect(moonIcon.getAttribute("hidden")).toBe("hidden");
    expect(moonIcon.classList.contains("hidden")).toBe(true);
  });

  it("should update icons for light theme", () => {
    updateThemeIcons(shadowRoot, "light");

    expect(sunIcon.style.display).toBe("none");
    expect(sunIcon.getAttribute("hidden")).toBe("hidden");
    expect(sunIcon.classList.contains("hidden")).toBe(true);

    expect(moonIcon.style.display).toBe("block");
    expect(moonIcon.hasAttribute("hidden")).toBe(false);
    expect(moonIcon.classList.contains("hidden")).toBe(false);
  });

  it("should update icons for unknown theme (treated as light)", () => {
    updateThemeIcons(shadowRoot, "unknown");

    expect(sunIcon.style.display).toBe("none");
    expect(sunIcon.getAttribute("hidden")).toBe("hidden");
    expect(sunIcon.classList.contains("hidden")).toBe(true);

    expect(moonIcon.style.display).toBe("block");
    expect(moonIcon.hasAttribute("hidden")).toBe(false);
    expect(moonIcon.classList.contains("hidden")).toBe(false);
  });
});
