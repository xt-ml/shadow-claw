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
const { DEFAULT_BUILTIN_PROFILE } =
  await import("../subsystems/providers/prompt-api-provider.js");

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
    expect(profiles[0]).toBe(DEFAULT_BUILTIN_PROFILE);
    expect(profiles[0].id).toBe("__builtin_default");
  });

  it("resolves built-in profile as activeProfile when activated", async () => {
    await store.activateProfile(db, DEFAULT_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(DEFAULT_BUILTIN_PROFILE.id);
    expect(store.activeProfile).toBe(DEFAULT_BUILTIN_PROFILE);
  });

  it("applies built-in profile settings on activate", async () => {
    await store.activateProfile(db, DEFAULT_BUILTIN_PROFILE.id);
    expect([...store.enabledToolNames]).toEqual(
      expect.arrayContaining(DEFAULT_BUILTIN_PROFILE.enabledToolNames),
    );
    expect(store.systemPromptOverride).toBe(
      DEFAULT_BUILTIN_PROFILE.systemPromptOverride,
    );
  });

  it("refuses to delete the built-in profile", async () => {
    await store.deleteProfile(db, DEFAULT_BUILTIN_PROFILE.id);
    // Should still be in the list
    expect(
      store.profiles.find((p) => p.id === DEFAULT_BUILTIN_PROFILE.id),
    ).toBeTruthy();
    // setConfig should NOT have been called
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("findProfilesForProvider returns built-in for prompt_api", () => {
    const matches = store.findProfilesForProvider("prompt_api");
    expect(matches.some((p) => p.id === DEFAULT_BUILTIN_PROFILE.id)).toBe(true);
  });

  it("does not return built-in for non-matching provider", () => {
    const matches = store.findProfilesForProvider("openai");
    expect(matches.some((p) => p.id === DEFAULT_BUILTIN_PROFILE.id)).toBe(
      false,
    );
  });

  it("deactivates profile when a tool is manually toggled", async () => {
    await store.activateProfile(db, DEFAULT_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(DEFAULT_BUILTIN_PROFILE.id);

    await store.setToolEnabled(db, "fetch_url", true);

    expect(store.activeProfileId).toBeNull();
    expect(mockSetConfig).toHaveBeenCalledWith(db, "active_tool_profile", null);
  });

  it("deactivates profile when all tools are set manually", async () => {
    await store.activateProfile(db, DEFAULT_BUILTIN_PROFILE.id);
    expect(store.activeProfileId).toBe(DEFAULT_BUILTIN_PROFILE.id);

    await store.setAllEnabled(db, ["read_file", "write_file", "show_toast"]);

    expect(store.activeProfileId).toBeNull();
  });
});

describe("ToolsStore — declarative tools management", () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGetConfig as any).mockResolvedValue(undefined);
    (mockSetConfig as any).mockResolvedValue(undefined);
    store = new ToolsStore();
  });

  it("defaults to enabling all declarative tools when not explicitly configured", () => {
    expect(store.declarativeToolNamesEnabled).toBeNull();
    expect(store.isDeclarativeToolEnabled("generate_random_number")).toBe(true);
  });

  it("toggles declarative tools and persists enabled state", async () => {
    await store.setDeclarativeToolEnabled(db, "generate_random_number", false);
    expect(store.isDeclarativeToolEnabled("generate_random_number")).toBe(
      false,
    );
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      "declarative_tools_enabled",
      expect.not.arrayContaining(["generate_random_number"]),
    );

    await store.setDeclarativeToolEnabled(db, "generate_random_number", true);
    expect(store.isDeclarativeToolEnabled("generate_random_number")).toBe(true);
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      "declarative_tools_enabled",
      expect.arrayContaining(["generate_random_number"]),
    );
  });

  it("supports setting all declarative tools enabled or disabled", async () => {
    await store.setAllDeclarativeEnabled(db, ["tool_a", "tool_b"]);
    expect(store.isDeclarativeToolEnabled("tool_a")).toBe(true);
    expect(store.isDeclarativeToolEnabled("tool_b")).toBe(true);
    expect(store.isDeclarativeToolEnabled("tool_c")).toBe(false);

    await store.setAllDeclarativeEnabled(db, []);
    expect(store.isDeclarativeToolEnabled("tool_a")).toBe(false);
  });

  it("exports and imports declarative tools enabled state in backups", async () => {
    await store.setAllDeclarativeEnabled(db, ["tool_x"]);
    const backupJson = store.exportBackup();
    const parsed = JSON.parse(backupJson);
    expect(parsed.declarativeToolsEnabled).toEqual(["tool_x"]);

    const newStore = new ToolsStore();
    await newStore.importBackup(db, backupJson);
    expect(newStore.isDeclarativeToolEnabled("tool_x")).toBe(true);
    expect(newStore.isDeclarativeToolEnabled("tool_y")).toBe(false);
  });
});
