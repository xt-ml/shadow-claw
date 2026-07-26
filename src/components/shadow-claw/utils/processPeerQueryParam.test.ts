import { jest } from "@jest/globals";

describe("processPeerQueryParam", () => {
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let orchestrator: any;
  let processPeerQueryParam: any;

  let mockUlid: any;
  let mockShowPage: any;
  let mockOrchestratorStore: any;
  let mockShowError: any;
  let mockShowSuccess: any;
  let mockConfigurePeerJs: any;
  let mockGetPeerJsConfig: any;
  let mockSetChannelEnabled: any;

  let mockReplaceState: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {};
    db = {};
    orchestrator = {
      getPeerJsConfig: jest.fn(),
      configurePeerJs: jest.fn(),
    };

    mockConfigurePeerJs = jest.fn();
    mockGetPeerJsConfig = jest.fn();
    mockSetChannelEnabled = jest.fn();

    mockUlid = jest.fn().mockReturnValue("test-ulid");
    mockShowPage = jest.fn();
    mockShowError = jest.fn();
    mockShowSuccess = jest.fn();
    mockOrchestratorStore = {
      ensurePeerConversation: jest.fn(),
      switchConversation: jest.fn(),
    };

    jest.unstable_mockModule(
      "../../../core/orchestrator/utils/configurePeerJs.js",
      () => ({
        configurePeerJs: mockConfigurePeerJs,
      }),
    );
    jest.unstable_mockModule("../../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));
    jest.unstable_mockModule("../utils/showPage.js", () => ({
      showPage: mockShowPage,
    }));
    jest.unstable_mockModule(
      "../../../core/orchestrator/utils/operations/channel.js",
      () => ({
        getPeerJsConfig: mockGetPeerJsConfig,
        setChannelEnabled: mockSetChannelEnabled,
      }),
    );
    jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
      orchestratorStore: mockOrchestratorStore,
    }));
    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    }));

    // Set URL using history API to avoid JSDOM navigation issues
    globalThis.window.history.pushState(
      {},
      "",
      "http://localhost?peer=test-peer",
    );

    // Mock window.history
    mockReplaceState = jest.fn();
    globalThis.window.history.replaceState = mockReplaceState;

    const module = await import("./processPeerQueryParam.js");
    processPeerQueryParam = module.processPeerQueryParam;
  });
  afterEach(() => {
    jest.resetModules();
  });
  it("should return early if db is not provided", async () => {
    await processPeerQueryParam(shadowRoot, shadowClaw, null, orchestrator);
    expect(mockGetPeerJsConfig).not.toHaveBeenCalled();
  });

  it("should return early if there is no peer param", async () => {
    globalThis.window.history.pushState({}, "", "http://localhost");
    await processPeerQueryParam(shadowRoot, shadowClaw, db, orchestrator);
    expect(mockGetPeerJsConfig).not.toHaveBeenCalled();
  });

  it("should return early if peer param is empty", async () => {
    globalThis.window.history.pushState({}, "", "http://localhost?peer=   ");
    await processPeerQueryParam(shadowRoot, shadowClaw, db, orchestrator);
    expect(mockGetPeerJsConfig).not.toHaveBeenCalled();
  });

  it("should process peer connection, switch conversation, and show chat page", async () => {
    mockGetPeerJsConfig.mockReturnValue({
      myPeerId: "my-id",
      trustedPeerIds: [],
      serverHost: "host",
      serverPort: 443,
      serverPath: "/path",
      serverSecure: true,
      enabled: false,
    });
    mockOrchestratorStore.ensurePeerConversation.mockResolvedValue("group-id");

    await processPeerQueryParam(shadowRoot, shadowClaw, db, orchestrator);

    expect(mockConfigurePeerJs).toHaveBeenCalledWith(
      orchestrator,
      db,
      "my-id",
      ["test-peer"],
      "host",
      443,
      "/path",
      true,
    );
    expect(mockSetChannelEnabled).toHaveBeenCalledWith(
      orchestrator,
      db,
      "peerjs",
      true,
    );
    expect(mockOrchestratorStore.ensurePeerConversation).toHaveBeenCalledWith(
      db,
      "test-peer",
    );
    expect(mockOrchestratorStore.switchConversation).toHaveBeenCalledWith(
      db,
      "group-id",
    );
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      mockOrchestratorStore,
      "chat",
    );

    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/");
    expect(mockShowSuccess).toHaveBeenCalledWith(
      expect.stringContaining("test-pee"),
    );
  });

  it("should generate a new peer ID if one is not configured", async () => {
    mockGetPeerJsConfig.mockReturnValue({
      trustedPeerIds: [],
      serverHost: "host",
      serverPort: 443,
      serverPath: "/path",
      serverSecure: true,
      enabled: true,
    });
    mockOrchestratorStore.ensurePeerConversation.mockResolvedValue("group-id");

    await processPeerQueryParam(shadowRoot, shadowClaw, db, orchestrator);

    expect(mockConfigurePeerJs).toHaveBeenCalledWith(
      orchestrator,
      db,
      "test-ulid",
      ["test-peer"],
      "host",
      443,
      "/path",
      true,
    );
    expect(mockSetChannelEnabled).not.toHaveBeenCalled(); // Already enabled
  });

  it("should handle and show error if an exception occurs", async () => {
    mockGetPeerJsConfig.mockImplementation(() => {
      throw new Error("Config error");
    });

    await processPeerQueryParam(shadowRoot, shadowClaw, db, orchestrator);

    expect(mockShowError).toHaveBeenCalledWith(
      "Failed to process peer parameter: Config error",
      6000,
    );
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});
