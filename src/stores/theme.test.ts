import { jest } from "@jest/globals";

describe("themeStore", () => {
  beforeEach(() => {
    jest.resetModules();
    (window as any).matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
    localStorage.clear();
    document.documentElement.className = "";

    // Mock dispatchEvent
    (window as any).dispatchEvent = jest.fn();
  });

  it("applies and persists explicit theme", async () => {
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("dark");

    expect(themeStore.theme).toBe("dark");

    expect(themeStore.resolved).toBe("dark");

    expect(localStorage.getItem("shadow-claw-theme")).toBe("dark");
  });

  it("sets light theme", async () => {
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("light");

    expect(themeStore.theme).toBe("light");

    expect(themeStore.resolved).toBe("light");

    expect(document.documentElement.classList.contains("light-mode")).toBe(
      true,
    );

    expect(document.documentElement.classList.contains("dark-mode")).toBe(
      false,
    );
  });

  it("resolves system theme to light when system prefers light", async () => {
    (window as any).matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
    }));
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("system");

    expect(themeStore.resolved).toBe("light");
  });

  it("resolves system theme to dark when system prefers dark", async () => {
    (window as any).matchMedia = jest.fn(() => ({
      matches: true,
      addEventListener: jest.fn(),
    }));
    jest.resetModules();
    localStorage.clear();
    document.documentElement.className = "";
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("system");

    expect(themeStore.resolved).toBe("dark");
  });

  it("getTheme returns both theme choice and resolved theme", async () => {
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("dark");
    const info = themeStore.getTheme();

    expect(info).toEqual({ theme: "dark", resolved: "dark" });
  });

  it("applies classes to shadow-claw element", async () => {
    const shadowAgentElement = document.createElement("shadow-claw");
    document.body.appendChild(shadowAgentElement);

    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("dark");

    expect(shadowAgentElement.classList.contains("dark-mode")).toBe(true);

    expect(shadowAgentElement.classList.contains("light-mode")).toBe(false);
  });

  it("dispatches theme-change event", async () => {
    const { themeStore } = await import("./theme.js");

    themeStore.setTheme("dark");

    expect((window as any).dispatchEvent).toHaveBeenCalled();
    const call = (window as any).dispatchEvent.mock.calls[0][0];
    expect(call.type).toBe("shadow-claw-theme-change");
  });

  it("overrides explicit theme on system theme change", async () => {
    const mockAddEventListener = jest.fn();
    (window as any).matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: mockAddEventListener,
    }));
    jest.resetModules();
    localStorage.clear();
    document.documentElement.className = "";
    const { themeStore } = await import("./theme.js");

    // User explicitly sets dark theme
    themeStore.setTheme("dark");
    expect(themeStore.theme).toBe("dark");
    expect(themeStore.resolved).toBe("dark");

    // Get the change callback that was registered
    const changeCallback = (mockAddEventListener as any).mock.calls[0][1];

    // Simulate system change to light — should override the explicit "dark" choice
    (window as any).matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: jest.fn(),
    }));

    changeCallback();

    expect(themeStore.theme).toBe("system");
    expect(themeStore.resolved).toBe("light");
    expect(localStorage.getItem("shadow-claw-theme")).toBe("system");
  });
});
