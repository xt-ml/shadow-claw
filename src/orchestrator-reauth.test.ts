import { jest } from "@jest/globals";

const mockGetRemoteMcpConnection = jest.fn() as any;
const mockListRemoteMcpConnections = jest.fn() as any;
const mockReconnectMcpOAuth = jest.fn() as any;
const mockShowToast = jest.fn() as any;

jest.unstable_mockModule("./mcp-connections.js", () => ({
  getRemoteMcpConnection: mockGetRemoteMcpConnection,
  listRemoteMcpConnections: mockListRemoteMcpConnections,
}));
jest.unstable_mockModule("./mcp-reconnect.js", () => ({
  reconnectMcpOAuth: mockReconnectMcpOAuth,
}));
jest.unstable_mockModule("./toast.js", () => ({
  showToast: mockShowToast,
}));

const { Orchestrator } = await import("./orchestrator.js");

describe("Orchestrator MCP Reauth Handler", () => {
  let orchestrator: any;
  let fakeDb: any;
  let mockWorker: any;

  beforeEach(() => {
    orchestrator = new Orchestrator();
    fakeDb = {} as any;
    mockWorker = {
      postMessage: jest.fn(),
    };
    orchestrator.agentWorker = mockWorker;
    jest.clearAllMocks();
  });

  it("handles auto-reconnect success", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      label: "My Server",
      autoReconnectOAuth: true,
    });
    mockReconnectMcpOAuth.mockResolvedValue({ success: true });

    await orchestrator.handleWorkerMessage(fakeDb, {
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-1" },
    });

    // Should show auto-reconnect toast
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("auto-reconnecting"),
      expect.objectContaining({ type: "info" }),
    );

    // Should call reconnectMcpOAuth with silentOnly: true
    expect(mockReconnectMcpOAuth).toHaveBeenCalledWith(fakeDb, "conn-1", {
      silentOnly: true,
    });

    // Should show success toast
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("OAuth reconnected"),
      expect.objectContaining({ type: "success" }),
    );

    // Should post success result back to worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "conn-1", success: true },
    });
  });

  it("handles auto-reconnect failure and surfaces retry action", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      label: "My Server",
      autoReconnectOAuth: true,
    });
    mockReconnectMcpOAuth.mockResolvedValue({
      success: false,
      error: "Silent login failed",
    });

    await orchestrator.handleWorkerMessage(fakeDb, {
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-1" },
    });

    // Should show error toast with "Reconnect Now" action
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("auto-reconnect failed"),
      expect.objectContaining({
        type: "error",
        action: expect.objectContaining({ label: "Reconnect Now" }),
      }),
    );

    // Should post failure result back to worker
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "conn-1", success: false },
    });
  });

  it("handles manual reconnect required (auto-reconnect disabled)", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      label: "My Server",
      autoReconnectOAuth: false,
    });

    await orchestrator.handleWorkerMessage(fakeDb, {
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-1" },
    });

    // Should NOT call reconnectMcpOAuth
    expect(mockReconnectMcpOAuth).not.toHaveBeenCalled();

    // Should show warning toast about manual reconnect
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining("OAuth re-authentication required"),
      expect.objectContaining({ type: "warning" }),
    );

    // Should post failure result back to worker (since it's not resolved yet)
    expect(mockWorker.postMessage).toHaveBeenCalledWith({
      type: "mcp-reauth-result",
      payload: { connectionId: "conn-1", success: false },
    });
  });

  it("emits mcp-reauth-required event for UI", async () => {
    mockGetRemoteMcpConnection.mockResolvedValue({
      id: "conn-1",
      label: "My Server",
      autoReconnectOAuth: false,
    });

    const eventSpy = jest.fn();
    orchestrator.events.on("mcp-reauth-required", eventSpy);

    await orchestrator.handleWorkerMessage(fakeDb, {
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-1" },
    });

    expect(eventSpy).toHaveBeenCalledWith({
      connectionId: "conn-1",
      label: "My Server",
    });
  });
});
