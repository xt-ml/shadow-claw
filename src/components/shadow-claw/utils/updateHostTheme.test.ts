import { updateHostTheme } from "./updateHostTheme.js";

describe("updateHostTheme", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("div");
  });

  it("should set dark-mode and remove light-mode when theme is dark", () => {
    element.classList.add("light-mode");
    updateHostTheme("dark", element.classList);

    expect(element.classList.contains("dark-mode")).toBe(true);
    expect(element.classList.contains("light-mode")).toBe(false);
  });

  it("should set light-mode and remove dark-mode when theme is light", () => {
    element.classList.add("dark-mode");
    updateHostTheme("light", element.classList);

    expect(element.classList.contains("light-mode")).toBe(true);
    expect(element.classList.contains("dark-mode")).toBe(false);
  });

  it("should default to light mode for unknown themes", () => {
    element.classList.add("dark-mode");
    updateHostTheme("unknown", element.classList);

    expect(element.classList.contains("light-mode")).toBe(true);
    expect(element.classList.contains("dark-mode")).toBe(false);
  });
});
