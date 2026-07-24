import { jest } from "@jest/globals";

describe("processRoomQueryParam", () => {
  let win: Window;
  let shadowRoot: ShadowRoot;
  let shadowClaw: any;
  let db: any;
  let orchestrator: any;
  let mockOrchestratorStore: any;
  let processRoomQueryParam: any;

  let mockUlid: any;
  let mockShowPage: any;
  let mockShowError: any;
  let mockShowSuccess: any;
  let mockReplaceState: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    shadowClaw = {};
    db = {};

    mockReplaceState = jest.fn();
    win = {
      location: { href: "http://localhost?room=r1&host=h1&name=n1" },
      history: { replaceState: mockReplaceState },
    } as any;

    globalThis.window.history.pushState(
      {},
      "",
      "http://localhost?room=r1&host=h1&name=n1",
    );

    orchestrator = {
      getPeerJsConfig: jest.fn(),
      configurePeerJs: jest.fn(),
      setChannelEnabled: jest.fn(),
      joinRoomViaLink: jest.fn(),
    };

    mockUlid = jest.fn().mockReturnValue("test-ulid");
    mockShowPage = jest.fn();
    mockShowError = jest.fn();
    mockShowSuccess = jest.fn();
    mockOrchestratorStore = {
      switchConversation: jest.fn(),
    };

    jest.unstable_mockModule("../../../utils/ulid.js", () => ({
      ulid: mockUlid,
    }));
    jest.unstable_mockModule("../utils/showPage.js", () => ({
      showPage: mockShowPage,
    }));
    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showError: mockShowError,
      showSuccess: mockShowSuccess,
    }));

    const module = await import("./processRoomQueryParam.js");
    processRoomQueryParam = module.processRoomQueryParam;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if db is not provided", async () => {
    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      null,
      orchestrator,
      mockOrchestratorStore,
    );
    expect(orchestrator.getPeerJsConfig).not.toHaveBeenCalled();
  });

  it("should return early if room or host is missing", async () => {
    globalThis.window.history.pushState({}, "", "http://localhost");
    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );
    expect(orchestrator.getPeerJsConfig).not.toHaveBeenCalled();

    globalThis.window.history.pushState({}, "", "http://localhost?room=r1");
    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );
    expect(orchestrator.getPeerJsConfig).not.toHaveBeenCalled();

    globalThis.window.history.pushState({}, "", "http://localhost?host=h1");
    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );
    expect(orchestrator.getPeerJsConfig).not.toHaveBeenCalled();
  });

  it("should process room join successfully", async () => {
    orchestrator.getPeerJsConfig.mockReturnValue({
      myPeerId: "my-id",
      trustedPeerIds: [],
      serverHost: "host",
      serverPort: 443,
      serverPath: "/path",
      serverSecure: true,
      enabled: false,
    });

    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );

    expect(orchestrator.configurePeerJs).toHaveBeenCalledWith(
      db,
      "my-id",
      ["h1"],
      "host",
      443,
      "/path",
      true,
    );
    expect(orchestrator.setChannelEnabled).toHaveBeenCalledWith(
      db,
      "peerjs",
      true,
    );
    expect(orchestrator.joinRoomViaLink).toHaveBeenCalledWith("r1", "h1", "n1");
    expect(mockOrchestratorStore.switchConversation).toHaveBeenCalledWith(
      db,
      "room:r1",
    );
    expect(mockShowPage).toHaveBeenCalledWith(
      shadowRoot,
      shadowClaw,
      db,
      mockOrchestratorStore,
      "chat",
    );

    expect(mockReplaceState).toHaveBeenCalledWith({}, "", "/");
    expect(mockShowSuccess).toHaveBeenCalledWith('Joined room "n1"');
  });

  it("should generate a new peer ID if one is not configured", async () => {
    orchestrator.getPeerJsConfig.mockReturnValue({
      trustedPeerIds: [],
      serverHost: "host",
      serverPort: 443,
      serverPath: "/path",
      serverSecure: true,
      enabled: true,
    });

    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );

    expect(orchestrator.configurePeerJs).toHaveBeenCalledWith(
      db,
      "test-ulid",
      ["h1"],
      "host",
      443,
      "/path",
      true,
    );
    expect(orchestrator.setChannelEnabled).not.toHaveBeenCalled();
  });

  it("should handle error", async () => {
    orchestrator.getPeerJsConfig.mockImplementation(() => {
      throw new Error("test error");
    });

    await processRoomQueryParam(
      win,
      shadowRoot,
      shadowClaw,
      db,
      orchestrator,
      mockOrchestratorStore,
    );

    expect(mockShowError).toHaveBeenCalledWith(
      "Failed to join room: test error",
      6000,
    );
  });
});
