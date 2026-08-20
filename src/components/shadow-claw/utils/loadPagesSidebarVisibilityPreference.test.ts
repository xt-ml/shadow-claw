import { jest } from "@jest/globals";

import { CONFIG_KEYS } from "../../../config/config.js";

describe("loadPagesSidebarVisibilityPreference", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let oStore: any;
  let db: any;
  let loadPagesSidebarVisibilityPreference: any;

  let mockGetConfig: any;
  let mockParseConfigBoolean: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {
      pagesSidebarHidden: false,
      chatSidebarHidden: false,
      tasksSidebarHidden: false,
      filesSidebarHidden: false,
    };
    oStore = {};
    db = {};

    mockGetConfig = jest.fn();
    mockParseConfigBoolean = jest.fn((val) => val === "true");

    jest.unstable_mockModule("../../../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));
    jest.unstable_mockModule("./parseConfigBoolean.js", () => ({
      parseConfigBoolean: mockParseConfigBoolean,
    }));

    const module = await import("./loadPagesSidebarVisibilityPreference.js");
    loadPagesSidebarVisibilityPreference =
      module.loadPagesSidebarVisibilityPreference;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should default all to false if db is not provided", async () => {
    await loadPagesSidebarVisibilityPreference(
      shadowRoot,
      shadowClaw,
      oStore,
      null as any,
    );
    expect(shadowClaw.pagesSidebarHidden).toBe(false);
    expect(shadowClaw.chatSidebarHidden).toBe(false);
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it("should load the preferences and apply them to shadowClaw", async () => {
    mockGetConfig.mockImplementation((_db, key) => {
      if (key === CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN) {
        return Promise.resolve("true");
      }
      if (key === CONFIG_KEYS.SIDEBAR_CHAT_HIDDEN) {
        return Promise.resolve("true");
      }
      return Promise.resolve("false");
    });

    await loadPagesSidebarVisibilityPreference(
      shadowRoot,
      shadowClaw,
      oStore,
      db,
    );

    expect(mockGetConfig).toHaveBeenCalledWith(
      db,
      CONFIG_KEYS.SIDEBAR_PAGES_HIDDEN,
    );
    expect(mockGetConfig).toHaveBeenCalledWith(
      db,
      CONFIG_KEYS.SIDEBAR_CHAT_HIDDEN,
    );
    expect(shadowClaw.pagesSidebarHidden).toBe(true);
    expect(shadowClaw.chatSidebarHidden).toBe(true);
    expect(shadowClaw.tasksSidebarHidden).toBe(false);
    expect(shadowClaw.filesSidebarHidden).toBe(false);
  });

  it("should set properties to false if getConfig throws", async () => {
    mockGetConfig.mockRejectedValue(new Error("DB error"));

    await loadPagesSidebarVisibilityPreference(
      shadowRoot,
      shadowClaw,
      oStore,
      db,
    );

    expect(shadowClaw.pagesSidebarHidden).toBe(false);
    expect(shadowClaw.chatSidebarHidden).toBe(false);
    expect(shadowClaw.tasksSidebarHidden).toBe(false);
    expect(shadowClaw.filesSidebarHidden).toBe(false);
  });
});
