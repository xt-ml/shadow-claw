import { jest } from "@jest/globals";

import { updateActivityLogToggle } from "./updateActivityLogToggle.js";

describe("updateActivityLogToggle", () => {
  let shadowRoot: ShadowRoot;
  let button: HTMLButtonElement;
  let originalMatchMedia: any;

  beforeEach(() => {
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    button = document.createElement("button");
    button.className = "activity-log-toggle";
    shadowRoot.appendChild(button);

    originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
  });

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
  });

  it("should return early if shadowRoot is null", () => {
    // Should not throw
    updateActivityLogToggle(null);
  });

  it("should return early if button is not found", () => {
    shadowRoot.innerHTML = "";
    // Should not throw
    updateActivityLogToggle(shadowRoot);
  });

  it("should return early if element is not a button", () => {
    shadowRoot.innerHTML = "";
    const div = document.createElement("div");
    div.className = "activity-log-toggle";
    shadowRoot.appendChild(div);
    // Should not throw
    updateActivityLogToggle(shadowRoot);
  });

  it("should update attributes based on override", () => {
    updateActivityLogToggle(shadowRoot, true);

    expect(button.getAttribute("aria-label")).toBe("Show activity log");
    expect(button.getAttribute("title")).toBe("Show activity log");
    expect(button.getAttribute("aria-pressed")).toBe("true");

    updateActivityLogToggle(shadowRoot, false);

    expect(button.getAttribute("aria-label")).toBe("Hide activity log");
    expect(button.getAttribute("title")).toBe("Hide activity log");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("should update attributes based on autoCollapsed if override is undefined", () => {
    // matches is true -> autoCollapsed is false
    updateActivityLogToggle(shadowRoot);

    expect(button.getAttribute("aria-label")).toBe("Hide activity log");
    expect(button.getAttribute("title")).toBe("Hide activity log");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    // matches is false -> autoCollapsed is true
    globalThis.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false }) as any;
    updateActivityLogToggle(shadowRoot);

    expect(button.getAttribute("aria-label")).toBe("Show activity log");
    expect(button.getAttribute("title")).toBe("Show activity log");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("should handle missing matchMedia", () => {
    delete (globalThis as any).matchMedia;

    // autoCollapsed defaults to false
    updateActivityLogToggle(shadowRoot);

    expect(button.getAttribute("aria-label")).toBe("Hide activity log");
    expect(button.getAttribute("title")).toBe("Hide activity log");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
});
