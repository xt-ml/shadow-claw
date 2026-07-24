import { updateTerminalToggle } from "./updateTerminalToggle.js";

describe("updateTerminalToggle", () => {
  let shadowRoot: ShadowRoot;
  let button: HTMLButtonElement;

  beforeEach(() => {
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    button = document.createElement("button");
    button.className = "webvm-toggle";
    shadowRoot.appendChild(button);
  });

  it("should return early if shadowRoot is null", () => {
    updateTerminalToggle(null, "chat", true, {
      ready: true,
      booting: false,
      bootAttempted: false,
    });
  });

  it("should return early if button is not found", () => {
    shadowRoot.innerHTML = "";
    updateTerminalToggle(shadowRoot, "chat", true, {
      ready: true,
      booting: false,
      bootAttempted: false,
    });
  });

  it("should set error state and hide if page is not chat or files", () => {
    updateTerminalToggle(shadowRoot, "settings", true, {
      ready: true,
      booting: false,
      bootAttempted: false,
    });

    expect(button.hidden).toBe(true);
    expect(button.classList.contains("hidden")).toBe(true);
    expect(button.classList.contains("webvm-toggle--error")).toBe(true);
  });

  it("should set visible and ready classes", () => {
    updateTerminalToggle(shadowRoot, "chat", true, {
      ready: true,
      booting: false,
      bootAttempted: false,
    });

    expect(button.hidden).toBe(false);
    expect(button.classList.contains("hidden")).toBe(false);
    expect(button.classList.contains("webvm-toggle--visible")).toBe(true);
    expect(button.classList.contains("webvm-toggle--ready")).toBe(true);
    expect(button.classList.contains("webvm-toggle--error")).toBe(false);

    expect(button.getAttribute("aria-label")).toBe("Hide WebVM terminal");
    expect(button.getAttribute("title")).toBe("Hide WebVM terminal");
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("should set hidden and booting classes", () => {
    updateTerminalToggle(shadowRoot, "files", false, {
      ready: false,
      booting: true,
      bootAttempted: false,
    });

    expect(button.classList.contains("webvm-toggle--hidden")).toBe(true);
    expect(button.classList.contains("webvm-toggle--booting")).toBe(true);

    expect(button.getAttribute("aria-label")).toBe("Show WebVM terminal");
    expect(button.getAttribute("title")).toBe("Show WebVM terminal");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("should clear old classes", () => {
    button.classList.add("webvm-toggle--error", "webvm-toggle--ready");
    updateTerminalToggle(shadowRoot, "chat", true, {
      ready: false,
      booting: true,
      bootAttempted: false,
    });

    expect(button.classList.contains("webvm-toggle--error")).toBe(false);
    expect(button.classList.contains("webvm-toggle--ready")).toBe(false);
    expect(button.classList.contains("webvm-toggle--booting")).toBe(true);
  });
});
