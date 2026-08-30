import { jest } from "@jest/globals";

const mockGetConfig = jest.fn();
const mockSetConfig = jest.fn();
const mockLoadDeclarativeTools = jest.fn();
const mockFindDeclarativeTool = jest.fn();
const mockParseDeclarativeTool = jest.fn();

jest.unstable_mockModule("../db/getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

jest.unstable_mockModule("../subsystems/tools/declarative.js", () => ({
  loadDeclarativeTools: mockLoadDeclarativeTools,
  findDeclarativeTool: mockFindDeclarativeTool,
  parseDeclarativeTool: mockParseDeclarativeTool,
}));

const { ToolsStore } = await import("./tools.js");
const { DEFAULT_BUILTIN_PROFILE } =
  await import("../subsystems/tools/builtin-profiles.js");

const db: any = {} as any;

describe("ToolsStore — built-in Nano profile", () => {
  let store: any;

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
    expect(
      store.profiles.find((p: any) => p.id === DEFAULT_BUILTIN_PROFILE.id),
    ).toBeTruthy();
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("findProfilesForProvider returns built-in for prompt_api", () => {
    const matches = store.findProfilesForProvider("prompt_api");
    expect(matches.some((p: any) => p.id === DEFAULT_BUILTIN_PROFILE.id)).toBe(
      true,
    );
  });

  it("does not return built-in for non-matching provider", () => {
    const matches = store.findProfilesForProvider("openai");
    expect(matches.some((p: any) => p.id === DEFAULT_BUILTIN_PROFILE.id)).toBe(
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

describe("ToolsStore — custom tools, cloning, profiles & web search config", () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockGetConfig as any).mockResolvedValue(undefined);
    (mockSetConfig as any).mockResolvedValue(undefined);
    store = new ToolsStore();
  });

  it("adds, removes, and clones custom tools", async () => {
    const customTool = {
      name: "custom_math",
      description: "Perform math",
      input_schema: { type: "object", properties: {} },
    };

    await store.addCustomTool(db, customTool);
    expect(store.customTools).toHaveLength(1);
    expect(store.enabledToolNames.has("custom_math")).toBe(true);

    const cloned = await store.cloneTool(
      db,
      "custom_math",
      "custom_math_v2",
      "Perform advanced math",
    );
    expect(cloned).toBe(true);
    expect(store.customTools).toHaveLength(2);

    // Cannot clone with existing name
    const cloneConflict = await store.cloneTool(
      db,
      "custom_math",
      "custom_math_v2",
    );
    expect(cloneConflict).toBe(false);

    // Remove custom tool
    await store.removeCustomTool(db, "custom_math");
    expect(store.customTools).toHaveLength(1);
    expect(store.customTools[0].name).toBe("custom_math_v2");
  });

  it("manages custom tool profiles and updates", async () => {
    const profile = {
      id: "p1",
      name: "Research Profile",
      enabledToolNames: ["web_search", "read_file"],
      customTools: [],
      systemPromptOverride: "You are a researcher",
    };

    await store.addProfile(db, profile);
    expect(store.profiles.find((p: any) => p.id === "p1")).toBeTruthy();

    await store.activateProfile(db, "p1");
    expect(store.activeProfileId).toBe("p1");
    expect(store.systemPromptOverride).toBe("You are a researcher");

    await store.setSystemPromptOverride(db, "Updated Prompt");
    expect(store.systemPromptOverride).toBe("Updated Prompt");

    await store.saveToActiveProfile(db);
    expect(mockSetConfig).toHaveBeenCalled();

    await store.deactivateProfile(db);
    expect(store.activeProfileId).toBeNull();

    await store.deleteProfile(db, "p1");
    expect(store.profiles.find((p: any) => p.id === "p1")).toBeFalsy();
  });

  it("configures web search and search_files options", async () => {
    await store.setWebSearchUseProxy(db, true);
    expect(store.webSearchUseProxy).toBe(true);

    await store.setWebSearchProxyUrl(db, "https://proxy.example.com");
    expect(store.webSearchProxyUrl).toBe("https://proxy.example.com");

    await store.setWebSearchUrl(db, "https://search.example.com?q={query}");
    expect(store.webSearchUrl).toBe("https://search.example.com?q={query}");

    await store.setSearchFilesMaxFileBytes(db, 1024 * 1024);
    expect(store.searchFilesMaxFileBytes).toBe(1024 * 1024);

    await store.setSearchFilesMaxFilesVisited(db, 2000);
    expect(store.searchFilesMaxFilesVisited).toBe(2000);

    await store.setSearchFilesSkipDirs(db, "dist,out,.git");
    expect(store.searchFilesSkipDirs).toBe("dist,out,.git");
    expect(store.searchFilesSkipDirsSet).toEqual(
      new Set(["dist", "out", ".git"]),
    );
  });

  it("loads config from DB on load()", async () => {
    (mockGetConfig as any).mockImplementation(async (_db: any, key: string) => {
      if (key === "enabled_tools") return ["read_file"];
      if (key === "system_prompt_override") return "Loaded Prompt";
      if (key === "web_search_use_proxy") return "true";
      if (key === "search_files_max_file_bytes") return "2048";
      return null;
    });

    await store.load(db);
    expect(store.enabledToolNames.has("read_file")).toBe(true);
    expect(store.systemPromptOverride).toBe("Loaded Prompt");
    expect(store.webSearchUseProxy).toBe(true);
    expect(store.searchFilesMaxFileBytes).toBe(2048);
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

  it("refreshes declarative tools from loader", async () => {
    (mockLoadDeclarativeTools as any).mockResolvedValueOnce({
      tools: [
        {
          name: "custom_decl_tool",
          description: "Declarative tool desc",
          execution: { type: "javascript", script: "return 1;" },
        },
      ],
    });

    const refreshed = await store.refreshDeclarativeTools(db, "br:main");
    expect(refreshed).toHaveLength(1);
    expect(store.declarativeTools).toHaveLength(1);
    expect(store.enabledDeclarativeTools).toHaveLength(1);
  });
});
