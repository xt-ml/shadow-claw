import { jest } from "@jest/globals";

const mockJoinRoomViaLink = jest.fn();

describe("handleOrchestratorRoomInvite", () => {
  let handleOrchestratorRoomInvite: any;
  let mockRequestDialog: jest.Mock<any>;

  const mockShadowClaw = {
    orchestrator: {
      joinRoomViaLink: jest.fn<any>(),
    },
  };
  const mockDb = {} as any;
  const mockOStore = { switchConversation: jest.fn() } as any;
  const mockDoc = {} as Document;
  const mockShadow = {} as ShadowRoot | null;
  const mockInvite = {
    roomId: "room-123",
    hostPeerId: "peer-123",
    fromAlias: "user123",
    fromPeerId: "peer-123",
    roomName: "Test Room",
  };

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.unstable_mockModule(
      "../../../core/orchestrator/utils/operations/room.js",
      () => ({
        createRoom: jest.fn(),
        handleRoomInvite: jest.fn(),
        inviteToRoom: jest.fn(),
        joinRoomViaLink: mockJoinRoomViaLink,
        leaveRoom: jest.fn(),
        listRooms: jest.fn(),
      }),
    );

    jest.unstable_mockModule("./requestDialog.js", () => ({
      requestDialog: jest.fn(),
    }));
    jest.unstable_mockModule("./showPage.js", () => ({
      showPage: jest.fn(),
    }));
    jest.unstable_mockModule("../../../ui/toast.js", () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
    }));

    mockRequestDialog = (await import("./requestDialog.js"))
      .requestDialog as jest.Mock<any>;
    handleOrchestratorRoomInvite = (
      await import("./handleOrchestratorRoomInvite.js")
    ).handleOrchestratorRoomInvite;
  });

  it("should return early if db is missing", async () => {
    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      undefined,
      mockOStore,
      mockInvite,
    );
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
    expect(mockOStore.switchConversation).not.toHaveBeenCalled();
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
  });

  it("should return early if invite is missing", async () => {
    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      undefined,
    );
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
  });

  it("should return early if roomId or hostPeerId is missing", async () => {
    const invalidInvite = {
      ...mockInvite,
      roomId: "",
    };
    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      invalidInvite,
    );
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
  });

  it("should request confirmation dialog with correct parameters", async () => {
    const confirmMock = jest.fn<any>().mockResolvedValue(true);

    mockRequestDialog.mockImplementation(
      (_doc: unknown, _shadow: unknown, options: unknown) => {
        expect(options).toMatchObject({
          mode: "confirm",
          title: "Room invitation",
          message: expect.stringContaining("Test Room"),
          confirmLabel: "Join",
          cancelLabel: "Decline",
        });

        return confirmMock();
      },
    );

    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      mockInvite,
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
  });

  it("should not proceed if user declines invitation", async () => {
    const confirmMock = jest.fn<any>().mockResolvedValue(false);

    mockRequestDialog.mockImplementation(
      (_doc: unknown, _shadow: unknown, options: unknown) => {
        expect(options).toMatchObject({
          mode: "confirm",
          title: "Room invitation",
          message: expect.stringContaining("Test Room"),
        });

        return confirmMock();
      },
    );

    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      mockInvite,
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
    expect(mockOStore.switchConversation).not.toHaveBeenCalled();
    expect(mockJoinRoomViaLink).not.toHaveBeenCalled();
  });

  it("should join room and switch conversation on success", async () => {
    const confirmMock = jest.fn<any>().mockResolvedValue(true);
    mockRequestDialog.mockImplementation(
      (_doc: unknown, _shadow: unknown, options: unknown) => {
        expect(options).toMatchObject({
          mode: "confirm",
          title: "Room invitation",
          message: expect.stringContaining("Test Room"),
        });

        return confirmMock();
      },
    );

    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      mockInvite,
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockJoinRoomViaLink).toHaveBeenCalledWith(
      mockShadowClaw.orchestrator,
      "room-123",
      "peer-123",
      "Test Room",
    );
    expect(mockOStore.switchConversation).toHaveBeenCalledWith(
      mockDb,
      "room:room-123",
    );
    expect(mockJoinRoomViaLink).toHaveBeenCalledTimes(1);
  });

  it("should show error if joinRoomViaLink fails", async () => {
    const error = new Error("Room join failed");
    mockJoinRoomViaLink.mockImplementationOnce(() => {
      throw error;
    });

    const confirmMock = jest.fn<any>().mockResolvedValue(true);
    mockRequestDialog.mockImplementation(
      (_doc: unknown, _shadow: unknown, options: unknown) => {
        expect(options).toMatchObject({
          mode: "confirm",
          title: "Room invitation",
          message: expect.stringContaining("Test Room"),
        });

        return confirmMock();
      },
    );

    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      mockInvite,
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockJoinRoomViaLink).toHaveBeenCalled();
    expect(mockOStore.switchConversation).not.toHaveBeenCalled();
    const { showError } = await import("../../../ui/toast.js");
    expect(showError).toHaveBeenCalledWith(
      "Failed to join room: Room join failed",
      6000,
    );
  });

  it("should show success toast on successful join", async () => {
    const confirmMock = jest.fn<any>().mockResolvedValue(true);
    mockRequestDialog.mockImplementation(
      (_doc: unknown, _shadow: unknown, options: unknown) => {
        expect(options).toMatchObject({
          mode: "confirm",
          title: "Room invitation",
          message: expect.stringContaining("Test Room"),
        });

        return confirmMock();
      },
    );

    await handleOrchestratorRoomInvite(
      mockDoc,
      mockShadow,
      mockShadowClaw as any,
      mockDb,
      mockOStore,
      mockInvite,
    );

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(mockJoinRoomViaLink).toHaveBeenCalled();
    expect(mockOStore.switchConversation).toHaveBeenCalled();
    const { showSuccess } = await import("../../../ui/toast.js");
    expect(showSuccess).toHaveBeenCalledWith('Joined room "Test Room"');
  });
});
