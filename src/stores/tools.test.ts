import { jest } from "@jest/globals";

const mockGetConfig = jest.fn();
const mockSetConfig = jest.fn();

jest.unstable_mockModule("../db/setConfig.js", () => ({
  getConfig: mockGetConfig,
}));
jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const { ToolsStore } = await import("./tools.js");
const { NANO_BUILTIN_PROFILE } = await import("../prompt-api-provider.js");

const db: any = {} as any;

describe("ToolsStore — built-in Nano profile", () => {
  let store;

  beforeEach(() => {
    jest.clearAllMocks();

    (mockGetConfig as any).mockResolvedValue(undefined);

    (mockSetConfig as any).mockResolvedValue(undefined);
    store = new ToolsStore();
  });

  it("includes the built-in Nano profile in profiles list", () => {
    const profiles = store.profiles;
    expect(profiles[0]).toBe(NANO_BUILTIN_PROFILE);
    expect(profiles[0].id).toBe("__builtin_nano");
  });

  it("resolves built-in profile as activeProfile when activated", async () => {
    await store.activateProfile(db, NANO_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(NANO_BUILTIN_PROFILE.id);
    expect(store.activeProfile).toBe(NANO_BUILTIN_PROFILE);
  });

  it("applies built-in profile settings on activate", async () => {
    await store.activateProfile(db, NANO_BUILTIN_PROFILE.id);
    expect([...store.enabledToolNames]).toEqual(
      expect.arrayContaining(NANO_BUILTIN_PROFILE.enabledToolNames),
    );
    expect(store.systemPromptOverride).toBe(
      NANO_BUILTIN_PROFILE.systemPromptOverride,
    );
  });

  it("refuses to delete the built-in profile", async () => {
    await store.deleteProfile(db, NANO_BUILTIN_PROFILE.id);
    // Should still be in the list
    expect(
      store.profiles.find((p) => p.id === NANO_BUILTIN_PROFILE.id),
    ).toBeTruthy();
    // setConfig should NOT have been called
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("findProfilesForProvider returns built-in for prompt_api", () => {
    const matches = store.findProfilesForProvider("prompt_api");
    expect(matches.some((p) => p.id === NANO_BUILTIN_PROFILE.id)).toBe(true);
  });

  it("does not return built-in for non-matching provider", () => {
    const matches = store.findProfilesForProvider("openai");
    expect(matches.some((p) => p.id === NANO_BUILTIN_PROFILE.id)).toBe(false);
  });

  it("deactivates profile when a tool is manually toggled", async () => {
    await store.activateProfile(db, NANO_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(NANO_BUILTIN_PROFILE.id);

    await store.setToolEnabled(db, "fetch_url", true);

    expect(store.activeProfileId).toBeNull();
    expect(mockSetConfig).toHaveBeenCalledWith(db, "active_tool_profile", null);
  });

  it("deactivates profile when all tools are set manually", async () => {
    await store.activateProfile(db, NANO_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(NANO_BUILTIN_PROFILE.id);

    await store.setAllEnabled(db, ["read_file", "write_file", "show_toast"]);

    expect(store.activeProfileId).toBeNull();
  });
});
