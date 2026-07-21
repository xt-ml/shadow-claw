import { jest } from "@jest/globals";

import { applyPagesSidebarVisibility } from "./applyPagesSidebarVisibility";

describe("applyPagesSidebarVisibility", () => {
  let shadow: ShadowRoot | null;
  let shadowClaw: {
    pagesSidebarHidden: boolean;
  };
  let pagesNavItem: HTMLElement;

  beforeEach(() => {
    // Mock ShadowRoot
    shadow = {
      querySelector: jest.fn(),
    } as unknown as ShadowRoot;

    // Mock ShadowClaw
    shadowClaw = {
      pagesSidebarHidden: false,
    };

    // Mock HTMLElement (pagesNavItem)
    pagesNavItem = {
      hidden: false,
      setAttribute: jest.fn(),
    } as unknown as HTMLElement;

    // Make querySelector return our mock pagesNavItem
    (shadow.querySelector as jest.Mock).mockReturnValue(pagesNavItem);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return early if shadow is null", () => {
    shadow = null;
    applyPagesSidebarVisibility(shadow, shadowClaw);
  });

  it("should return early if pagesNavItem is null", () => {
    (shadow!.querySelector as jest.Mock).mockReturnValue(null);
    applyPagesSidebarVisibility(shadow, shadowClaw);
    expect(pagesNavItem.setAttribute).not.toHaveBeenCalled();
  });

  it("should set hidden attribute and aria-hidden when pagesSidebarHidden is true", () => {
    shadowClaw.pagesSidebarHidden = true;
    applyPagesSidebarVisibility(shadow, shadowClaw);
    expect(pagesNavItem.hidden).toBe(true);
    expect(pagesNavItem.setAttribute).toHaveBeenCalledWith(
      "aria-hidden",
      "true",
    );
  });

  it("should set hidden attribute and aria-hidden when pagesSidebarHidden is false", () => {
    shadowClaw.pagesSidebarHidden = false;
    applyPagesSidebarVisibility(shadow, shadowClaw);
    expect(pagesNavItem.hidden).toBe(false);
    expect(pagesNavItem.setAttribute).toHaveBeenCalledWith(
      "aria-hidden",
      "false",
    );
  });

  it("should call querySelector with correct selector", () => {
    applyPagesSidebarVisibility(shadow, shadowClaw);
    expect(shadow!.querySelector).toHaveBeenCalledWith(
      '.nav-item[data-page="pages"]',
    );
  });
});
