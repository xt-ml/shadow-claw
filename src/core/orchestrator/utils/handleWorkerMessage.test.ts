import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockIsLlamafileResolutionError = jest.fn() as any;
const mockDetectProviderHelpType = jest.fn() as any;
const mockIsTransformersJsResolutionError = jest.fn() as any;

const mockDeleteTask = jest.fn() as any;
const mockGetAllTasks = jest.fn() as any;
const mockRoomIdFromGroupId = jest.fn() as any;
const mockSaveTask = jest.fn() as any;

const mockGetRemoteMcpConnection = jest.fn() as any;
const mockReconnectMcpOAuth = jest.fn() as any;
const mockGetPushUrl = jest.fn() as any;

const mockShowToast = jest.fn() as any;

jest.unstable_mockModule(
  "../../../components/common/help/llamafile.js",
  () => ({
    isLlamafileResolutionError: mockIsLlamafileResolutionError,
  }),
);

jest.unstable_mockModule(
  "../../../components/common/help/providers.js",
  () => ({
    detectProviderHelpType: mockDetectProviderHelpType,
  }),
);

jest.unstable_mockModule(
  "../../../components/common/help/transformers.js",
  () => ({
    isTransformersJsResolutionError: mockIsTransformersJsResolutionError,
  }),
);

jest.unstable_mockModule("../../../config/config.js", () => ({
  DEFAULT_GROUP_ID: "default",
}));

jest.unstable_mockModule("../../../db/deleteTask.js", () => ({
  deleteTask: mockDeleteTask,
}));

jest.unstable_mockModule("../../../db/getAllTasks.js", () => ({
  getAllTasks: mockGetAllTasks,
}));

jest.unstable_mockModule("../../../db/rooms.js", () => ({
  roomIdFromGroupId: mockRoomIdFromGroupId,
}));

jest.unstable_mockModule("../../../db/saveTask.js", () => ({
  saveTask: mockSaveTask,
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    runTask: jest.fn(),
  },
}));

const mockToolsStore = {
  activateProfile: jest.fn(),
  setToolEnabled: jest.fn(),
  enabledTools: ["t1"],
  systemPromptOverride: "override",
};

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: mockToolsStore,
}));

jest.unstable_mockModule("../../../subsystems/mcp/mcp-connections.js", () => ({
  getRemoteMcpConnection: mockGetRemoteMcpConnection,
}));

jest.unstable_mockModule("../../../subsystems/mcp/mcp-reconnect.js", () => ({
  reconnectMcpOAuth: mockReconnectMcpOAuth,
}));

jest.unstable_mockModule(
  "../../../subsystems/notifications/push-client.js",
  () => ({
    getPushUrl: mockGetPushUrl,
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showToast: mockShowToast,
}));

const { handleWorkerMessage } = await import("./handleWorkerMessage.js");

describe("handleWorkerMessage", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockOrchestrator = {
      stopTransformersProgressPolling: jest.fn(),
      clearProviderRequest: jest.fn(),
      inFlightTriggerByGroup: new Map(),
      inFlightEffectiveProviderByGroup: new Map(),
      deliverResponse: (jest.fn() as any).mockResolvedValue(undefined),
      deliverIntermediateResponse: (jest.fn() as any).mockResolvedValue(
        undefined,
      ),
      setState: jest.fn(),
      events: { emit: jest.fn() },
      schedulerTriggeredGroups: new Set(),
      syncTaskToServer: (jest.fn() as any).mockResolvedValue(true),
      deleteTaskFromServer: (jest.fn() as any).mockResolvedValue(true),
      createRoom: jest.fn(),
      inviteToRoom: jest.fn(),
      leaveRoom: jest.fn(),
      getProvider: jest.fn().mockReturnValue("test-prov"),
      providerConfig: { requiresApiKey: true },
      router: {
        setTyping: jest.fn(),
        send: (jest.fn() as any).mockResolvedValue(undefined),
        findChannel: jest.fn(),
      },
      newSession: (jest.fn() as any).mockResolvedValue(undefined),
      handleCompactDone: (jest.fn() as any).mockResolvedValue(undefined),
      agentWorker: { postMessage: jest.fn() },
      roomManager: { broadcastA2UI: jest.fn() },
    };

    mockGetPushUrl.mockResolvedValue("http://push");
    mockGetAllTasks.mockResolvedValue([]);
    global.fetch = (jest.fn() as any).mockResolvedValue({} as any) as any;
  });

  const send = async (msg: any) =>
    handleWorkerMessage(mockOrchestrator, mockDb, msg);

  it("handles response", async () => {
    mockOrchestrator.inFlightTriggerByGroup.set("g1", "x");
    await send({ type: "response", payload: { groupId: "g1", text: "hi" } });
    expect(mockOrchestrator.deliverResponse).toHaveBeenCalledWith(
      mockDb,
      "g1",
      "hi",
    );
    expect(mockOrchestrator.inFlightTriggerByGroup.has("g1")).toBe(false);
  });

  it("handles streaming events", async () => {
    await send({ type: "streaming-start", payload: { groupId: "g1" } });
    expect(mockOrchestrator.setState).toHaveBeenCalledWith("responding", "g1");

    await send({
      type: "streaming-chunk",
      payload: { groupId: "g1", text: "a" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-chunk",
      { groupId: "g1", text: "a" },
    );

    await send({
      type: "intermediate-response",
      payload: { groupId: "g1", text: "b" },
    });
    expect(mockOrchestrator.deliverIntermediateResponse).toHaveBeenCalledWith(
      mockDb,
      "g1",
      "b",
    );

    await send({ type: "streaming-end", payload: { groupId: "g1" } });
    expect(mockOrchestrator.setState).toHaveBeenCalledWith("thinking", "g1");

    await send({ type: "streaming-done", payload: { groupId: "g1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-done",
      { groupId: "g1" },
    );

    await send({
      type: "streaming-error",
      payload: { groupId: "g1", error: "err" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "streaming-error",
      { groupId: "g1", error: "err" },
    );
  });

  it("handles tasks (create, update, delete)", async () => {
    // blocked by recursion
    mockOrchestrator.schedulerTriggeredGroups.add("g1");
    await send({ type: "task-created", payload: { task: { groupId: "g1" } } });
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("blocked"),
      expect.any(Object),
    );

    mockOrchestrator.schedulerTriggeredGroups.clear();

    await send({ type: "task-created", payload: { task: { groupId: "g2" } } });
    expect(mockSaveTask).toHaveBeenCalled();

    await send({ type: "update-task", payload: { task: { groupId: "g2" } } });
    expect(mockSaveTask).toHaveBeenCalledTimes(2);

    await send({ type: "delete-task", payload: { id: "t1", groupId: "g2" } });
    expect(mockDeleteTask).toHaveBeenCalled();
  });

  it("handles room actions", async () => {
    await send({
      type: "room-action",
      payload: { action: "create", name: "r1" },
    });
    expect(mockOrchestrator.createRoom).toHaveBeenCalledWith("r1");

    await send({
      type: "room-action",
      payload: { action: "invite", roomId: "r1", peerId: "p1" },
    });
    expect(mockOrchestrator.inviteToRoom).toHaveBeenCalledWith("r1", "p1");

    await send({
      type: "room-action",
      payload: { action: "leave", roomId: "r1" },
    });
    expect(mockOrchestrator.leaveRoom).toHaveBeenCalledWith("r1");
  });

  it("handles errors", async () => {
    await send({
      type: "error",
      payload: { groupId: "g1", error: "tokens_limit_reached" },
    });
    expect(mockOrchestrator.deliverResponse).toHaveBeenCalledWith(
      mockDb,
      "g1",
      expect.stringContaining("context window"),
    );
  });

  it("handles llamafile error", async () => {
    mockOrchestrator.inFlightEffectiveProviderByGroup.set("g1", {
      providerId: "llamafile",
    });
    mockIsLlamafileResolutionError.mockReturnValue(true);
    await send({
      type: "error",
      payload: { groupId: "g1", error: "llama err" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "provider-help",
      expect.objectContaining({ providerId: "llamafile" }),
    );
  });

  it("handles simple events", async () => {
    await send({ type: "typing", payload: { groupId: "g1" } });
    expect(mockOrchestrator.router.setTyping).toHaveBeenCalledWith("g1", true);

    await send({
      type: "tool-activity",
      payload: { groupId: "g1", tool: "write_file", status: "done" },
    });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("file-change", {
      groupId: "g1",
    });

    await send({
      type: "compact-done",
      payload: { groupId: "g1", summary: "s" },
    });
    expect(mockOrchestrator.handleCompactDone).toHaveBeenCalledWith(
      mockDb,
      "g1",
      "s",
    );

    await send({ type: "task-list-request", payload: { groupId: "g1" } });
    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalled();

    await send({ type: "clear-chat", payload: { groupId: "g1" } });
    expect(mockOrchestrator.newSession).toHaveBeenCalledWith(mockDb, "g1");

    await send({ type: "show-toast", payload: { message: "msg" } });
    expect(mockShowToast).toHaveBeenCalled();
  });

  it("handles manage-tools", async () => {
    await send({
      type: "manage-tools",
      payload: { action: "activate_profile", profileId: "p1" },
    });
    expect(mockToolsStore.activateProfile).toHaveBeenCalledWith(mockDb, "p1");

    await send({
      type: "manage-tools",
      payload: { action: "enable", toolNames: ["t1"] },
    });
    expect(mockToolsStore.setToolEnabled).toHaveBeenCalledWith(
      mockDb,
      "t1",
      true,
    );
  });

  it("handles push notifs", async () => {
    await send({
      type: "send-notification",
      payload: { title: "t", body: "b" },
    });
    expect(mockGetPushUrl).toHaveBeenCalled();
  });

  it("handles send-file", async () => {
    await send({
      type: "send-file",
      payload: { groupId: "g1", path: "test.txt" },
    });
    // Need a tick since it's fire-and-forget IIFE
    await new Promise(process.nextTick);
    expect(mockOrchestrator.router.send).toHaveBeenCalled();
  });

  it("handles send-file rejection", async () => {
    mockOrchestrator.router.send.mockRejectedValueOnce(
      new Error("Send failed"),
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await send({
      type: "send-file",
      payload: { groupId: "g2", path: "fail.txt" },
    });

    await new Promise(process.nextTick);

    expect(consoleError).toHaveBeenCalledWith(
      "send-file: delivery failed:",
      expect.any(Error),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send file"),
      expect.any(Object),
    );
    consoleError.mockRestore();
  });

  it("handles open-file", async () => {
    await send({ type: "open-file", payload: { path: "test.txt" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("open-file", {
      path: "test.txt",
    });
  });

  it("handles render-component", async () => {
    mockOrchestrator.router.findChannel.mockReturnValue({
      sendA2UI: (jest.fn() as any).mockResolvedValue(undefined),
    });
    mockRoomIdFromGroupId.mockReturnValue("r1");

    await send({
      type: "render-component",
      payload: { groupId: "peer:g1", envelope: {} },
    });
    await send({
      type: "render-component",
      payload: { groupId: "room:r1", envelope: {} },
    });

    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "a2ui-surface",
      expect.any(Object),
    );
    expect(mockOrchestrator.roomManager.broadcastA2UI).toHaveBeenCalled();
  });

  it("handles render-component sendA2UI rejection", async () => {
    mockOrchestrator.router.findChannel.mockReturnValue({
      sendA2UI: (jest.fn() as any).mockRejectedValue(new Error("err")),
    });
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await send({
      type: "render-component",
      payload: { groupId: "peer:g1", envelope: {} },
    });

    // Wait for the fire-and-forget catch block
    await new Promise(process.nextTick);

    expect(consoleError).toHaveBeenCalledWith(
      "render-component: peer delivery failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("handles ask-user", async () => {
    await send({ type: "ask-user", payload: { question: "hi" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("ask-user", {
      question: "hi",
    });
  });

  it("handles vm events", async () => {
    await send({ type: "vm-status", payload: { status: "running" } });
    expect(mockOrchestrator.vmStatus).toEqual({ status: "running" });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("vm-status", {
      status: "running",
    });

    await send({ type: "vm-terminal-opened", payload: { termId: "1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-opened",
      { termId: "1" },
    );

    await send({ type: "vm-terminal-output", payload: { output: "hi" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-output",
      { output: "hi" },
    );

    await send({ type: "vm-terminal-closed", payload: { termId: "1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-closed",
      { termId: "1" },
    );

    await send({ type: "vm-workspace-synced", payload: { groupId: "g1" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith("file-change", {
      groupId: "g1",
    });

    await send({ type: "vm-terminal-error", payload: { error: "err" } });
    expect(mockOrchestrator.events.emit).toHaveBeenCalledWith(
      "vm-terminal-error",
      { error: "err" },
    );
  });

  it("handles mcp-reauth-required", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      autoReconnectOAuth: true,
      label: "conn",
    });
    mockReconnectMcpOAuth.mockResolvedValue({ success: true });

    await send({
      type: "mcp-reauth-required",
      payload: { connectionId: "c1" },
    });

    expect(mockReconnectMcpOAuth).toHaveBeenCalled();
    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "c1", success: true },
    });
  });

  it("handles mcp-reauth-required without auto-reconnect", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({ autoReconnectOAuth: false });

    await send({
      type: "mcp-reauth-required",
      payload: { connectionId: "c1" },
    });

    expect(mockOrchestrator.agentWorker.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "c1", success: false },
    });
  });
});
