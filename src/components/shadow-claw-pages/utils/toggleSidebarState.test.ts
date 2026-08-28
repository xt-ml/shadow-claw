import { describe, it, expect } from "@jest/globals";
import { toggleSidebarState } from "./toggleSidebarState.js";

describe("toggleSidebarState", () => {
  it("toggles sidebar open state and sets CSS classes and details open attribute", () => {
    const root = document.createElement("div");
    const sidebar = document.createElement("div");
    sidebar.className = "pages__sidebar";
    const content = document.createElement("div");
    content.className = "pages__content";
    const dropdown = document.createElement("details");
    dropdown.setAttribute("data-pages-dropdown", "");

    root.appendChild(sidebar);
    root.appendChild(content);
    root.appendChild(dropdown);

    const nextOpen = toggleSidebarState({
      root,
      currentOpen: false,
    });

    expect(nextOpen).toBe(true);
    expect(sidebar.classList.contains("collapsed")).toBe(false);
    expect(
      content.classList.contains("pages__content--sidebar-collapsed"),
    ).toBe(false);
    expect(dropdown.hasAttribute("open")).toBe(true);
  });

  it("respects force boolean when provided", () => {
    const root = document.createElement("div");
    const sidebar = document.createElement("div");
    sidebar.className = "pages__sidebar";
    root.appendChild(sidebar);

    const nextOpen = toggleSidebarState({
      root,
      currentOpen: true,
      force: false,
    });

    expect(nextOpen).toBe(false);
    expect(sidebar.classList.contains("collapsed")).toBe(true);
  });
});
