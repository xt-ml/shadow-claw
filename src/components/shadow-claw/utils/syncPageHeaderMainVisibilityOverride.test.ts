import { jest } from "@jest/globals";

describe("syncPageHeaderMainVisibilityOverride", () => {
  let shadowRoot: ShadowRoot;
  let syncPageHeaderMainVisibilityOverride: any;
  let mockGetPageHeaderElements: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });

    mockGetPageHeaderElements = jest.fn().mockReturnValue([]);

    jest.unstable_mockModule("./getPageHeaderElements.js", () => ({
      getPageHeaderElements: mockGetPageHeaderElements,
    }));

    const module = await import("./syncPageHeaderMainVisibilityOverride.js");
    syncPageHeaderMainVisibilityOverride =
      module.syncPageHeaderMainVisibilityOverride;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if shadowRoot is null", () => {
    syncPageHeaderMainVisibilityOverride(null, true);
    expect(mockGetPageHeaderElements).not.toHaveBeenCalled();
  });

  it("should call setMainCollapsedOverride on all header elements", () => {
    const h1 = { setMainCollapsedOverride: jest.fn() };
    const h2 = { setMainCollapsedOverride: jest.fn() };
    const h3 = {}; // Missing function

    mockGetPageHeaderElements.mockReturnValue([h1, h2, h3]);

    syncPageHeaderMainVisibilityOverride(shadowRoot, true);

    expect(mockGetPageHeaderElements).toHaveBeenCalledWith(shadowRoot);
    expect(h1.setMainCollapsedOverride).toHaveBeenCalledWith(true);
    expect(h2.setMainCollapsedOverride).toHaveBeenCalledWith(true);
  });
});
