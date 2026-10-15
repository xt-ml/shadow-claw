import { jest } from "@jest/globals";

describe("togglePageHeaderMainVisibility", () => {
  let shadowClaw: any;
  let togglePageHeaderMainVisibility: any;
  let mockGetActivePageHeaderElement: any;
  let mockSyncPageHeaderMainVisibilityOverride: any;
  let mockUpdateHeaderMainToggle: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowClaw = {
      shadowRoot: document.createElement("div").attachShadow({ mode: "open" }),
      headerMainCollapsedOverride: null,
    };

    mockGetActivePageHeaderElement = jest.fn().mockReturnValue(null);
    mockSyncPageHeaderMainVisibilityOverride = jest.fn();
    mockUpdateHeaderMainToggle = jest.fn();

    jest.unstable_mockModule("./get-active-page-header-element.js", () => ({
      getActivePageHeaderElement: mockGetActivePageHeaderElement,
    }));
    jest.unstable_mockModule(
      "./sync-page-header-main-visibility-override.js",
      () => ({
        syncPageHeaderMainVisibilityOverride:
          mockSyncPageHeaderMainVisibilityOverride,
      }),
    );
    jest.unstable_mockModule("./update-header-main-toggle.js", () => ({
      updateHeaderMainToggle: mockUpdateHeaderMainToggle,
    }));

    const module = await import("./toggle-page-header-main-visibility.js");
    togglePageHeaderMainVisibility = module.togglePageHeaderMainVisibility;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should toggle from override if it is a boolean", () => {
    shadowClaw.headerMainCollapsedOverride = true;
    togglePageHeaderMainVisibility(shadowClaw);

    expect(shadowClaw.headerMainCollapsedOverride).toBe(false);
    expect(mockSyncPageHeaderMainVisibilityOverride).toHaveBeenCalledWith(
      shadowClaw.shadowRoot,
      false,
    );
    expect(mockUpdateHeaderMainToggle).toHaveBeenCalledWith(
      shadowClaw.shadowRoot,
      false,
    );
  });

  it("should toggle from header element state if override is not a boolean", () => {
    mockGetActivePageHeaderElement.mockReturnValue({
      isMainCollapsed: () => true,
    });
    togglePageHeaderMainVisibility(shadowClaw);

    expect(shadowClaw.headerMainCollapsedOverride).toBe(false);
  });

  it("should toggle from false if header element is missing or lacks isMainCollapsed", () => {
    mockGetActivePageHeaderElement.mockReturnValue({});
    togglePageHeaderMainVisibility(shadowClaw);

    expect(shadowClaw.headerMainCollapsedOverride).toBe(true);
  });
});
