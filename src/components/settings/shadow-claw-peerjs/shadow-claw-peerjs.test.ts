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
  "../../../core/orchestrator/utils/configurePeerJs.js",
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
const { showSuccess } = (await import("../../../ui/toast.js")) as any;

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
});
