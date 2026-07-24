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
  let mockSetPagesSidebarHidden: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {};
    oStore = {};
    db = {};

    mockGetConfig = jest.fn();
    mockParseConfigBoolean = jest.fn();
    mockSetPagesSidebarHidden = jest.fn();

    jest.unstable_mockModule("../../../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));
    jest.unstable_mockModule("./parseConfigBoolean.js", () => ({
      parseConfigBoolean: mockParseConfigBoolean,
    }));
    jest.unstable_mockModule("./setPagesSidebarHidden.js", () => ({
      setPagesSidebarHidden: mockSetPagesSidebarHidden,
    }));

    const module = await import("./loadPagesSidebarVisibilityPreference.js");
    loadPagesSidebarVisibilityPreference =
      module.loadPagesSidebarVisibilityPreference;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should call setPagesSidebarHidden with false if db is not provided", async () => {
    await loadPagesSidebarVisibilityPreference(
      shadowRoot,
      shadowClaw,
      oStore,
      null as any,
    );
    expect(mockSetPagesSidebarHidden).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      oStore,
      null,
      false,
    );
    expect(mockGetConfig).not.toHaveBeenCalled();
  });

  it("should load the preference and call setPagesSidebarHidden with the parsed value", async () => {
    mockGetConfig.mockResolvedValue("true");
    mockParseConfigBoolean.mockReturnValue(true);

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
    expect(mockParseConfigBoolean).toHaveBeenCalledWith("true");
    expect(mockSetPagesSidebarHidden).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      oStore,
      db,
      true,
    );
  });

  it("should call setPagesSidebarHidden with false if getConfig throws", async () => {
    mockGetConfig.mockRejectedValue(new Error("DB error"));

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
    expect(mockSetPagesSidebarHidden).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      oStore,
      db,
      false,
    );
  });
});
