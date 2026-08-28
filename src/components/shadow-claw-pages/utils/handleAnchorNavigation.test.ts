import { jest } from "@jest/globals";
import { handleAnchorNavigation } from "./handleAnchorNavigation.js";

describe("handleAnchorNavigation", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    container.setAttribute("data-pages-rendered", "true");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("returns false if container is null or hidden", () => {
    expect(handleAnchorNavigation("#section", null)).toBe(false);
    container.hidden = true;
    expect(handleAnchorNavigation("#section", container)).toBe(false);
  });

  it("scrolls element with matching ID into view and returns true", () => {
    const target = document.createElement("h2");
    target.id = "section-1";
    target.scrollIntoView = jest.fn();
    container.appendChild(target);

    const result = handleAnchorNavigation("#section-1", container);
    expect(result).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("scrolls anchor with matching name attribute into view and returns true", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("name", "heading-2");
    anchor.scrollIntoView = jest.fn();
    container.appendChild(anchor);

    const result = handleAnchorNavigation("heading-2", container);
    expect(result).toBe(true);
    expect(anchor.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("returns false if no element matches anchor", () => {
    expect(handleAnchorNavigation("#non-existent", container)).toBe(false);
  });
});
