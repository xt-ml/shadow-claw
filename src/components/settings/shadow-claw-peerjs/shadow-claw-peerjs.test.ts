import { jest } from "@jest/globals";

const mockCreateRoom = jest
  .fn()
  .mockReturnValue({ roomId: "room-2", name: "New Room" });
const mockListRooms = jest.fn().mockReturnValue([]);

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/room.js",
  () => ({
    createRoom: mockCreateRoom,
    handleRoomInvite: jest.fn(),
    inviteToRoom: jest.fn().mockReturnValue(true),
    joinRoomViaLink: jest.fn(),
    leaveRoom: jest.fn(),
    listRooms: mockListRooms,
  }),
);

jest.unstable_mockModule("qrcode", () => ({
  default: {
    toCanvas: jest.fn(() => Promise.resolve()),
  },
}));

jest.unstable_mockModule("../../../core/effect.js", () => ({
  effect: jest.fn((cb: any) => {
    cb();
    return () => {};
  }),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn(() => Promise.resolve({})),
}));
jest.unstable_mockModule("../../../db/rooms.js", () => ({
  roomGroupId: jest.fn((id: string) => `br:${id}`),
}));

const mockSetChannelEnabled = jest.fn();
const mockGetPeerJsConfig = jest.fn(() => ({
  enabled: true,
  myPeerId: "test-peer-id",
  myAlias: "Test Alias",
  trustedPeerIds: ["trusted-1"],
  serverHost: "localhost",
  serverPort: 9000,
  serverPath: "/myapp",
  serverSecure: false,
}));
const mockConfigurePeerJs = jest.fn();
jest.unstable_mockModule(
  "../../../core/orchestrator/utils/configure-peer-js.js",
  () => ({
    configurePeerJs: mockConfigurePeerJs,
  }),
);

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/channel.js",
  () => ({
    getPeerJsConfig: mockGetPeerJsConfig,
    setChannelEnabled: mockSetChannelEnabled,
  }),
);

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/provider.js",
  () => ({
    setPeerjsMyAlias: jest.fn(),
    setPeerjsPeerAliases: jest.fn(),
    stopTransformersProgressPolling: jest.fn(),
  }),
);

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: {
      getPeerJsConfig: jest.fn(() => ({
        enabled: true,
        myPeerId: "test-peer-id",
        myAlias: "Test Alias",
        trustedPeerIds: ["trusted-1"],
        serverHost: "localhost",
        serverPort: 9000,
        serverPath: "/myapp",
        serverSecure: false,
      })),
      configurePeerJs: jest.fn(),
      peerjs: {
        connectedPeersSignal: { get: jest.fn(() => ["trusted-1"]) },
      },
      roomManager: {
        roomsSignal: { get: jest.fn(() => []) },
        list: jest.fn().mockReturnValue([]),
      },
      listRooms: jest.fn(() => [
        {
          roomId: "room-1",
          name: "Room 1",
          hostPeerId: "test-peer-id",
          members: [{ peerId: "trusted-1", kind: "human" }],
        },
      ]),
      createRoom: jest.fn(() => ({ roomId: "room-2", name: "Room 2" })),
      inviteToRoom: jest.fn(() => true),
      leaveRoom: jest.fn(),
    },
    ready: true,
  },
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ulid"),
}));

const { ShadowClawPeerJs } = await import("./shadow-claw-peerjs.js");
const { orchestratorStore } =
  (await import("../../../stores/orchestrator.js")) as any;
const { showSuccess, showError } =
  (await import("../../../ui/toast.js")) as any;

describe("shadow-claw-peerjs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("should render correctly", async () => {
    const el = new ShadowClawPeerJs();
    document.body.appendChild(el);
    await el.connectedCallback();
    await new Promise((r) => setTimeout(r, 0));

    expect(el.shadowRoot).toBeTruthy();
  });

  it("should generate peer ID", async () => {
    const el = new ShadowClawPeerJs();
    document.body.appendChild(el);
    await el.connectedCallback();

    el.generatePeerId();
    const input = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("mock-ulid");
  });

  it("should create room", async () => {
    const el = new ShadowClawPeerJs();
    document.body.appendChild(el);
    await el.connectedCallback();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="room-new-name-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "New Room";

    el.createRoom();

    expect(mockCreateRoom).toHaveBeenCalledWith(
      orchestratorStore.orchestrator,
      "New Room",
    );
    expect(showSuccess).toHaveBeenCalled();
  });

  it("should save config", async () => {
    const el = new ShadowClawPeerJs();
    document.body.appendChild(el);
    await el.connectedCallback();

    await el.savePeerJsConfig();
    expect(mockConfigurePeerJs).toHaveBeenCalled();
    expect(mockSetChannelEnabled).toHaveBeenCalled();
  });

  it("should copy peer URL", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const mockClipboard = {
      writeText: jest.fn<any>().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    // Set a peer url
    el._currentPeerUrl = "http://localhost/?peer=test";

    await el.copyPeerUrl();
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      "http://localhost/?peer=test",
    );
  });

  it("should show room QR code", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const room = { roomId: "room-1", name: "Room One" };
    await el.showRoomQr(room);

    const group = el.shadowRoot?.querySelector(
      '[data-info="room-qr-group"]',
    ) as HTMLElement;
    const label = el.shadowRoot?.querySelector('[data-info="room-qr-label"]');
    expect(group.hidden).toBe(false);
    expect(label?.textContent).toContain("Room One");

    document.body.removeChild(el);
  });

  it("should add and remove trusted peer rows", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const initialRows =
      el.shadowRoot?.querySelectorAll(".peerjs-trusted-peer-row").length || 0;
    el._appendTrustedPeerRow("peer-xyz", "Peer XYZ");

    const newRows = el.shadowRoot?.querySelectorAll(".peerjs-trusted-peer-row");
    expect(newRows.length).toBe(initialRows + 1);

    // Remove row
    const removeBtn = newRows[newRows.length - 1].querySelector(
      ".save-btn--danger",
    ) as HTMLButtonElement;
    removeBtn?.click();

    expect(
      el.shadowRoot?.querySelectorAll(".peerjs-trusted-peer-row").length,
    ).toBe(initialRows);

    document.body.removeChild(el);
  });

  it("should copy room URL and generate trusted peer options with aliases", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const mockClipboard = {
      writeText: jest.fn<any>().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    const options = el._trustedPeerOptions();
    expect(options.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it("handles copyPeerId and copyPeerUrl", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const mockClipboard = {
      writeText: jest.fn<any>().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    // 1. Copy Peer ID
    const peerIdInput = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement;
    if (peerIdInput) peerIdInput.value = "my-test-peer";
    await el.copyPeerId();
    expect(mockClipboard.writeText).toHaveBeenCalledWith("my-test-peer");

    // 2. Copy Peer URL
    el._currentPeerUrl = "http://localhost/?peer=my-test-peer";
    await el.copyPeerUrl();
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      "http://localhost/?peer=my-test-peer",
    );

    document.body.removeChild(el);
  });

  it("handles savePeerJsConfig", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const hostInput = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-server-host-input"]',
    ) as HTMLInputElement;
    const portInput = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-server-port-input"]',
    ) as HTMLInputElement;

    if (hostInput) hostInput.value = "peer.example.com";
    if (portInput) portInput.value = "9001";

    await el.savePeerJsConfig();
    expect(mockConfigurePeerJs).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "test-peer-id",
      expect.any(Array),
      "peer.example.com",
      9001,
      "/myapp",
      false,
    );

    document.body.removeChild(el);
  });

  it("handles copyRoomUrl, showRoomQr, updateConnectionStatus, and updateQrCode", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const mockClipboard = {
      writeText: jest.fn<any>().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    // 1. copyRoomUrl
    el._currentRoomUrl = "http://localhost/?room=test-room";
    await el.copyRoomUrl();
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      "http://localhost/?room=test-room",
    );

    // 2. showRoomQr
    const room = {
      roomId: "room-1",
      name: "Test Room",
      members: [],
      createdAt: 0,
      updatedAt: 0,
    };
    await el.showRoomQr(room);
    expect(el._currentRoomUrl).toContain("room-1");

    // 4. renderRooms
    const { listRooms } =
      await import("../../../core/orchestrator/utils/operations/room.js");
    const testRooms = [
      {
        roomId: "room-host-1",
        name: "My Host Room",
        hostPeerId: "test-peer-id",
        members: [
          { peerId: "test-peer-id", alias: "Host Me", kind: "human" },
          { peerId: "peer-remote-1", alias: "Agent Remote", kind: "agent" },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        roomId: "room-guest-2",
        name: "Guest Room",
        hostPeerId: "peer-other",
        members: [{ peerId: "peer-other", alias: "Other", kind: "human" }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    (listRooms as jest.Mock<any>).mockReturnValue(testRooms);

    let roomsContainer = el.shadowRoot?.querySelector(
      '[data-info="rooms-list"]',
    );
    if (!roomsContainer) {
      roomsContainer = document.createElement("div");
      roomsContainer.setAttribute("data-info", "rooms-list");
      el.shadowRoot?.appendChild(roomsContainer);
    }

    el.renderRooms();
    expect(roomsContainer.querySelectorAll(".peerjs-room-card").length).toBe(2);

    document.body.removeChild(el);
  });

  it("handles room card button actions: invite, link/qr, and disband/leave", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const { listRooms, inviteToRoom, leaveRoom } =
      await import("../../../core/orchestrator/utils/operations/room.js");

    const testRooms = [
      {
        roomId: "room-host-1",
        name: "My Host Room",
        hostPeerId: "test-peer-id",
        members: [{ peerId: "test-peer-id", alias: "Host Me", kind: "human" }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    (listRooms as jest.Mock<any>).mockReturnValue(testRooms);

    el.renderRooms();

    const card = el.shadowRoot?.querySelector(".peerjs-room-card");
    expect(card).not.toBeNull();

    // Invite button without selected peer (shows error)
    const buttons = Array.from(card?.querySelectorAll("button") || []) as any[];
    const inviteBtn = buttons.find((b: any) => b.textContent === "Invite");
    const linkBtn = buttons.find((b: any) => b.textContent?.includes("Link"));
    const disbandBtn = buttons.find((b: any) => b.textContent === "Disband");
    const select = card?.querySelector("select");

    // 1. Invite without peer
    if (select) select.value = "";
    inviteBtn?.dispatchEvent(new Event("click"));

    // 2. Invite with peer
    if (select) {
      const opt = document.createElement("option");
      opt.value = "trusted-1";
      select.appendChild(opt);
      select.value = "trusted-1";
    }
    inviteBtn?.dispatchEvent(new Event("click"));
    expect(inviteToRoom).toHaveBeenCalledWith(
      expect.anything(),
      "room-host-1",
      "trusted-1",
    );

    // 3. Link/QR
    linkBtn?.dispatchEvent(new Event("click"));

    // 4. Disband
    disbandBtn?.dispatchEvent(new Event("click"));
    expect(leaveRoom).toHaveBeenCalledWith(expect.anything(), "room-host-1");

    document.body.removeChild(el);
  });

  it("handles adding trusted peers and auto-generating Peer ID on save", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const root = el.shadowRoot!;
    const idInput = root.querySelector(
      '[data-setting="peerjs-new-trusted-id-input"]',
    ) as HTMLInputElement;
    const aliasInput = root.querySelector(
      '[data-setting="peerjs-new-trusted-alias-input"]',
    ) as HTMLInputElement;
    const addBtn = root.querySelector('[data-action="add-trusted-peer"]');

    if (idInput && aliasInput && addBtn) {
      idInput.value = "peer-abc";
      aliasInput.value = "Alice";
      addBtn.dispatchEvent(new Event("click"));

      expect(idInput.value).toBe("");
      expect(aliasInput.value).toBe("");

      const rows = root.querySelectorAll(".peerjs-trusted-peer-row");
      expect(rows.length).toBeGreaterThan(0);
    }

    // Clear myPeerIdInput to test auto-generation
    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement;
    if (myPeerIdInput) {
      myPeerIdInput.value = "";
    }

    await el.savePeerJsConfig();
    expect(mockConfigurePeerJs).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("handles peerAliases in render", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    mockGetPeerJsConfig.mockReturnValueOnce({
      enabled: true,
      myPeerId: "peer-1",
      myAlias: "Me",
      trustedPeerIds: ["peer-2"],
      peerAliases: { Bob: "peer-2" },
      serverHost: "localhost",
      serverPort: 9000,
      serverPath: "/",
      serverSecure: false,
    });

    await el.render();

    const status = el.shadowRoot?.querySelector(
      '[data-info="peerjs-trusted-ids-status"]',
    );
    expect(status?.textContent).toContain("Bob");

    document.body.removeChild(el);
  });

  it("throws error in connectedCallback if shadowRoot is missing", async () => {
    const el = new ShadowClawPeerJs();
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await expect(el.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );
  });

  it("handles bindEventListeners null shadowRoot and empty ID input", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // null root guard
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.bindEventListeners();
    delete (el as any).shadowRoot;

    // click add-trusted-peer with empty id
    const root = el.shadowRoot!;
    const idInput = root.querySelector(
      '[data-setting="peerjs-new-trusted-id-input"]',
    ) as HTMLInputElement;
    const addBtn = root.querySelector('[data-action="add-trusted-peer"]');
    if (idInput && addBtn) {
      idInput.value = "";
      addBtn.dispatchEvent(new Event("click"));
    }

    // typing in peer ID input triggers updateQrCode
    const peerInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    );
    peerInput?.dispatchEvent(new Event("input"));

    // action buttons trigger bound event handlers
    root
      .querySelector('[data-action="save-peerjs-config"]')
      ?.dispatchEvent(new Event("click"));
    root
      .querySelector('[data-action="generate-peer-id"]')
      ?.dispatchEvent(new Event("click"));
    root
      .querySelector('[data-action="copy-peer-id"]')
      ?.dispatchEvent(new Event("click"));
    root
      .querySelector('[data-action="copy-peer-url"]')
      ?.dispatchEvent(new Event("click"));
    root
      .querySelector('[data-action="create-room"]')
      ?.dispatchEvent(new Event("click"));
    root
      .querySelector('[data-action="copy-room-url"]')
      ?.dispatchEvent(new Event("click"));

    document.body.removeChild(el);
  });

  it("handles createRoom validation, exceptions, and null guards", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // 1. Empty room name
    const input = el.shadowRoot?.querySelector(
      '[data-setting="room-new-name-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "   ";
    el.createRoom();
    expect(showError).toHaveBeenCalledWith("Enter a room name.", 3000);

    // 2. createRoom throws Error
    if (input) input.value = "Room Error";
    mockCreateRoom.mockImplementationOnce(() => {
      throw new Error("Boom room");
    });
    el.createRoom();
    expect(showError).toHaveBeenCalledWith(
      "Failed to create room: Boom room",
      5000,
    );

    // 3. createRoom throws non-Error
    if (input) input.value = "Room String Error";
    mockCreateRoom.mockImplementationOnce(() => {
      throw "Raw error";
    });
    el.createRoom();
    expect(showError).toHaveBeenCalledWith(
      "Failed to create room: Raw error",
      5000,
    );

    // 4. null root or orchestrator guard
    el.orchestrator = null;
    jest.spyOn(el, "getOrchestrator").mockReturnValue(null);
    el.createRoom();

    document.body.removeChild(el);
  });

  it("handles invitePeerToRoom success, failure, and null orchestrator", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const { inviteToRoom } =
      await import("../../../core/orchestrator/utils/operations/room.js");
    const room = { roomId: "r1", name: "Room 1" };

    // 1. Success
    (inviteToRoom as jest.Mock<any>).mockReturnValueOnce(true);
    el.invitePeerToRoom(room, "peer-123456789");
    expect(showSuccess).toHaveBeenCalledWith(
      'Invited peer-123 to "Room 1".',
      2500,
    );

    // 2. Failure
    (inviteToRoom as jest.Mock<any>).mockReturnValueOnce(false);
    el.invitePeerToRoom(room, "peer-123");
    expect(showError).toHaveBeenCalledWith(
      "Failed to invite peer (are you the host?).",
      4000,
    );

    // 3. Null orchestrator
    jest.spyOn(el, "getOrchestrator").mockReturnValue(null);
    el.invitePeerToRoom(room, "peer-123");

    document.body.removeChild(el);
  });

  it("handles renderRooms empty rooms, member status, open button navigation, and guest leave", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const { listRooms, leaveRoom } =
      await import("../../../core/orchestrator/utils/operations/room.js");

    // 1. Empty rooms list
    (listRooms as jest.Mock<any>).mockReturnValueOnce([]);
    el.renderRooms();
    const listEl = el.shadowRoot?.querySelector('[data-info="rooms-list"]');
    expect(listEl?.textContent).toContain("No rooms yet.");

    // 2. Room with member without alias, open navigation, and guest leave
    const guestRoom = [
      {
        roomId: "guest-room-1",
        name: "Guest Collab",
        hostPeerId: "other-host",
        members: [
          { peerId: "other-host", kind: "human" }, // no alias
          { peerId: "test-peer-id", alias: "Me", kind: "human" },
        ],
      },
    ];
    (listRooms as jest.Mock<any>).mockReturnValueOnce(guestRoom);
    el.renderRooms();

    const card = listEl?.querySelector(".peerjs-room-card");
    expect(card).not.toBeNull();

    // Open button navigation event
    const navSpy = jest.fn();
    document.addEventListener("shadow-claw-navigate", navSpy, { once: true });
    const openBtn = card?.querySelector(
      ".save-btn--secondary",
    ) as HTMLButtonElement;
    openBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { page: "chat", groupId: "br:guest-room-1" },
      }),
    );

    // Leave button for guest
    const leaveBtn = card?.querySelector(
      ".save-btn--danger",
    ) as HTMLButtonElement;
    expect(leaveBtn?.textContent).toBe("Leave");
    leaveBtn?.click();
    expect(leaveRoom).toHaveBeenCalledWith(expect.anything(), "guest-room-1");
    expect(showSuccess).toHaveBeenCalledWith("Left room.", 2500);

    // 3. Null root and listEl guards
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.renderRooms();
    delete (el as any).shadowRoot;

    const savedList = el.shadowRoot.querySelector('[data-info="rooms-list"]');
    savedList.remove();
    el.renderRooms();
    el.shadowRoot.appendChild(savedList);

    document.body.removeChild(el);
  });

  it("handles copyPeerId, copyPeerUrl, and copyRoomUrl error paths", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // 1. copyPeerId empty
    const input = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "";
    await el.copyPeerId();
    expect(showError).toHaveBeenCalledWith("No Peer ID to copy.", 3000);

    // 2. copyPeerId clipboard throws
    if (input) input.value = "peer-id-123";
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn<any>().mockRejectedValue(new Error("Clip fail")),
      },
    });
    await el.copyPeerId();
    expect(showError).toHaveBeenCalledWith("Failed to copy Peer ID.", 3000);

    // 3. copyPeerUrl empty
    el._currentPeerUrl = "";
    await el.copyPeerUrl();
    expect(showError).toHaveBeenCalledWith(
      "No connection URL available. Enter a Peer ID first.",
      3000,
    );

    // 4. copyPeerUrl clipboard throws
    el._currentPeerUrl = "http://localhost/?peer=123";
    await el.copyPeerUrl();
    expect(showError).toHaveBeenCalledWith(
      "Failed to copy connection URL.",
      3000,
    );

    // 5. copyRoomUrl empty
    el._currentRoomUrl = "";
    await el.copyRoomUrl();
    expect(showError).toHaveBeenCalledWith(
      "Create or select a room first.",
      3000,
    );

    // 6. copyRoomUrl clipboard throws
    el._currentRoomUrl = "http://localhost/?room=456";
    await el.copyRoomUrl();
    expect(showError).toHaveBeenCalledWith("Failed to copy room link.", 3000);

    // 7. null root guards
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.copyPeerId();
    delete (el as any).shadowRoot;

    document.body.removeChild(el);
  });

  it("handles render with disabled channel, empty trusted peers, and trusted peer button navigation", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    mockGetPeerJsConfig.mockReturnValueOnce({
      enabled: false,
      myPeerId: "peer-solo",
      myAlias: "Solo",
      trustedPeerIds: [],
      serverHost: "host.local",
      serverPort: 0,
      serverPath: "/path",
      serverSecure: true,
    });

    await el.render();

    const channelStatus = el.shadowRoot?.querySelector(
      '[data-info="peerjs-channel-status"]',
    );
    expect(channelStatus?.textContent).toContain("PeerJS channel is disabled");

    const trustedStatus = el.shadowRoot?.querySelector(
      '[data-info="peerjs-trusted-ids-status"]',
    );
    expect(trustedStatus?.textContent).toContain(
      "Accepting connections from any peer.",
    );

    const portInput = el.shadowRoot?.querySelector(
      '[data-setting="peerjs-server-port-input"]',
    ) as HTMLInputElement;
    expect(portInput.value).toBe("");

    // Test with trustedPeerIds having buttons that dispatch shadow-claw-navigate
    mockGetPeerJsConfig.mockReturnValueOnce({
      enabled: true,
      myPeerId: "peer-solo",
      myAlias: "Solo",
      trustedPeerIds: ["peer-trusted-abc"],
      peerAliases: { "Alice Friend": "peer-trusted-abc" },
      serverHost: "host.local",
      serverPort: 8080,
      serverPath: "/path",
      serverSecure: false,
    });
    // Clear list to trigger population
    const listEl = el.shadowRoot?.querySelector(
      '[data-info="peerjs-trusted-peers-list"]',
    );
    if (listEl) listEl.innerHTML = "";
    await el.render();

    const navSpy = jest.fn();
    document.addEventListener("shadow-claw-navigate", navSpy, { once: true });
    const peerBtn = el.shadowRoot?.querySelector(
      '[data-info="peerjs-trusted-ids-status"] button',
    ) as HTMLButtonElement;
    expect(peerBtn?.textContent).toBe("Alice Friend");
    peerBtn?.click();
    expect(navSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { page: "chat", groupId: "peer:peer-trusted-abc" },
      }),
    );

    // Null guards for render
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.render();
    delete (el as any).shadowRoot;

    jest.spyOn(el, "getOrchestrator").mockReturnValue(null);
    await el.render();

    document.body.removeChild(el);
  });

  it("handles savePeerJsConfig aliases, errors, and null guards", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    // Set up trusted peer rows with alias and without alias
    const root = el.shadowRoot!;
    const list = root.querySelector(
      '[data-info="peerjs-trusted-peers-list"]',
    ) as HTMLElement;
    list.innerHTML = `
      <div class="peerjs-trusted-peer-row">
        <input type="text" data-id="p1" value="p1" />
        <input type="text" class="alias-input" value="Alias 1" />
      </div>
      <div class="peerjs-trusted-peer-row">
        <input type="text" data-id="p2" value="p2" />
        <input type="text" class="alias-input" value="" />
      </div>
    `;

    // 1. configurePeerJs throws Error
    mockConfigurePeerJs.mockRejectedValueOnce(new Error("Config failed"));
    await el.savePeerJsConfig();
    expect(showError).toHaveBeenCalledWith(
      "Error saving PeerJS settings: Config failed",
      6000,
    );

    // 2. configurePeerJs throws non-Error
    mockConfigurePeerJs.mockRejectedValueOnce("Server down");
    await el.savePeerJsConfig();
    expect(showError).toHaveBeenCalledWith(
      "Error saving PeerJS settings: Server down",
      6000,
    );

    // 3. Null db or orchestrator guard
    el.db = null;
    await el.savePeerJsConfig();

    el.db = {};
    jest.spyOn(el, "getOrchestrator").mockReturnValue(null);
    await el.savePeerJsConfig();

    // 4. Null root guard
    jest
      .spyOn(el, "getOrchestrator")
      .mockReturnValue(orchestratorStore.orchestrator);
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.savePeerJsConfig();
    delete (el as any).shadowRoot;

    document.body.removeChild(el);
  });

  it("handles showRoomQr, updateConnectionStatus, updateQrCode, and trusted peer helpers", async () => {
    const el = new ShadowClawPeerJs() as any;
    document.body.appendChild(el);
    await el.connectedCallback();

    const { default: QRCode } = await import("qrcode");

    // 1. showRoomQr QRCode error and null root
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (QRCode.toCanvas as jest.Mock<any>).mockRejectedValueOnce(
      new Error("QR fail"),
    );
    await el.showRoomQr({ roomId: "r-qr", name: "QR Room", hostPeerId: "h1" });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Room QR code render error:",
      expect.any(Error),
    );

    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.showRoomQr({ roomId: "r-qr", name: "QR Room", hostPeerId: "h1" });
    delete (el as any).shadowRoot;

    // 2. updateConnectionStatus with 0 connected peers, null orchestrator, null root
    orchestratorStore.orchestrator.peerjs.connectedPeersSignal.get.mockReturnValueOnce(
      [],
    );
    await el.updateConnectionStatus();
    expect(
      el.shadowRoot.querySelector('[data-info="peerjs-connection-status"]')
        .textContent,
    ).toBe("Not connected.");

    jest.spyOn(el, "getOrchestrator").mockReturnValueOnce(null);
    await el.updateConnectionStatus();
    expect(
      el.shadowRoot.querySelector('[data-info="peerjs-connection-status"]')
        .textContent,
    ).toBe("Not connected.");

    const statusEl = el.shadowRoot.querySelector(
      '[data-info="peerjs-connection-status"]',
    );
    statusEl.remove();
    await el.updateConnectionStatus();
    el.shadowRoot.appendChild(statusEl);

    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.updateConnectionStatus();
    delete (el as any).shadowRoot;

    // 3. updateQrCode with empty peerId, QRCode error, and null root
    const input = el.shadowRoot.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement;
    input.value = "";
    await el.updateQrCode();
    expect(el._currentPeerUrl).toBe("");

    input.value = "my-valid-peer";
    (QRCode.toCanvas as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Canvas fail"),
    );
    await el.updateQrCode();
    expect(consoleSpy).toHaveBeenCalledWith(
      "PeerJS QR code render error:",
      expect.any(Error),
    );

    const qrGroup = el.shadowRoot.querySelector(
      '[data-info="peerjs-qr-group"]',
    );
    const canvas = el.shadowRoot.querySelector(
      '[data-info="peerjs-qr-canvas"]',
    );
    const qrUrlEl = el.shadowRoot.querySelector('[data-info="peerjs-qr-url"]');
    qrGroup.remove();
    canvas.remove();
    qrUrlEl.remove();
    input.value = "";
    await el.updateQrCode();
    input.value = "my-valid-peer";
    await el.updateQrCode();

    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    await el.updateQrCode();
    delete (el as any).shadowRoot;

    consoleSpy.mockRestore();

    // 4. _appendTrustedPeerRow existing id, missing list, null root
    el._appendTrustedPeerRow("already-there", "A");
    el._appendTrustedPeerRow("already-there", "A"); // duplicate returns early

    const list = el.shadowRoot.querySelector(
      '[data-info="peerjs-trusted-peers-list"]',
    );
    list.remove();
    el._appendTrustedPeerRow("no-list", "B");
    el.shadowRoot.appendChild(list);

    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el._appendTrustedPeerRow("null-root", "C");
    delete (el as any).shadowRoot;

    // 5. _trustedPeerOptions with null cfg and matching aliases
    jest.spyOn(el, "getOrchestrator").mockReturnValueOnce(null);
    expect(el._trustedPeerOptions()).toEqual([]);

    mockGetPeerJsConfig.mockReturnValueOnce({
      trustedPeerIds: ["peer-x", "peer-y"],
      peerAliases: { "X-Man": "peer-x" },
    });
    const opts = el._trustedPeerOptions();
    expect(opts).toEqual([
      { id: "peer-x", label: "X-Man (peer-x)" },
      { id: "peer-y", label: "peer-y" },
    ]);

    // 6. setupEffects when orchestratorStore.ready is false
    orchestratorStore.ready = false;
    el.setupEffects();
    orchestratorStore.ready = true;

    // 7. generatePeerId when shadowRoot is null
    Object.defineProperty(el, "shadowRoot", {
      get: () => null,
      configurable: true,
    });
    el.generatePeerId();
    delete (el as any).shadowRoot;

    document.body.removeChild(el);
  });
});
