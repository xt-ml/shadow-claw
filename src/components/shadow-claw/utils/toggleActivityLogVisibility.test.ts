import { jest } from "@jest/globals";

describe("toggleActivityLogVisibility", () => {
  let shadowClaw: any;
  let toggleActivityLogVisibility: any;
  let mockSyncActivityLogVisibilityOverride: any;
  let mockUpdateActivityLogToggle: any;
  let originalMatchMedia: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowClaw = {
      shadowRoot: document.createElement("div").attachShadow({ mode: "open" }),
      activityLogCollapsedOverride: null,
    };

    mockSyncActivityLogVisibilityOverride = jest.fn();
    mockUpdateActivityLogToggle = jest.fn();
    originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;

    jest.unstable_mockModule("./syncActivityLogVisibilityOverride.js", () => ({
      syncActivityLogVisibilityOverride: mockSyncActivityLogVisibilityOverride,
    }));
    jest.unstable_mockModule("./updateActivityLogToggle.js", () => ({
      updateActivityLogToggle: mockUpdateActivityLogToggle,
    }));

    const module = await import("./toggleActivityLogVisibility.js");
    toggleActivityLogVisibility = module.toggleActivityLogVisibility;
  });

  afterEach(() => {
    globalThis.matchMedia = originalMatchMedia;
    jest.resetModules();
  });

  it("should toggle from override if it is a boolean", () => {
    shadowClaw.activityLogCollapsedOverride = true;
    toggleActivityLogVisibility(shadowClaw);

    expect(shadowClaw.activityLogCollapsedOverride).toBe(false);
    expect(mockSyncActivityLogVisibilityOverride).toHaveBeenCalledWith(
      shadowClaw.shadowRoot,
      false,
    );
    expect(mockUpdateActivityLogToggle).toHaveBeenCalledWith(
      shadowClaw.shadowRoot,
      false,
    );
  });

  it("should toggle from autoCollapsed (true) if override is not a boolean and matches is false", () => {
    globalThis.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false }) as any;
    toggleActivityLogVisibility(shadowClaw);

    // autoCollapsed is !matches -> true, so it toggles to false
    expect(shadowClaw.activityLogCollapsedOverride).toBe(false);
  });

  it("should toggle from autoCollapsed (false) if override is not a boolean and matches is true", () => {
    globalThis.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
    toggleActivityLogVisibility(shadowClaw);

    // autoCollapsed is !matches -> false, so it toggles to true
    expect(shadowClaw.activityLogCollapsedOverride).toBe(true);
  });

  it("should handle globalThis.matchMedia missing", () => {
    delete (globalThis as any).matchMedia;
    toggleActivityLogVisibility(shadowClaw);

    // autoCollapsed is false, so toggles to true
    expect(shadowClaw.activityLogCollapsedOverride).toBe(true);
  });
});
