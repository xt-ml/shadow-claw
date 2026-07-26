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
});
