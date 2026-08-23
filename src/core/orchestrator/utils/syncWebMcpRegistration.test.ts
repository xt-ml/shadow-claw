import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockRegisterWebMcpTools = jest.fn() as any;
const mockUnregisterWebMcpTools = jest.fn() as any;

jest.unstable_mockModule("../../../subsystems/mcp/webmcp.js", () => ({
  registerWebMcpTools: mockRegisterWebMcpTools,
  unregisterWebMcpTools: mockUnregisterWebMcpTools,
  setWebMcpMode: jest.fn(),
}));

const mockHandleWorkerMessage = jest.fn() as any;
jest.unstable_mockModule("./handleWorkerMessage.js", () => ({
  handleWorkerMessage: mockHandleWorkerMessage,
}));

jest.unstable_mockModule("../../effect.js", () => ({
  effect: (cb: any) => {
    cb();
    return jest.fn();
  },
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    activeGroupId: "group1",
    groups: [{ groupId: "group1", toolTags: ["tool1"] }, { groupId: "group2" }],
  },
}));

jest.unstable_mockModule("../../../stores/tools.js", () => ({
  toolsStore: {
    allTools: [{ name: "tool1" }, { name: "tool2" }],
    enabledTools: [{ name: "tool2" }],
  },
}));

const mockLoadDeclarativeTools = jest.fn() as any;
jest.unstable_mockModule("../../../subsystems/tools/declarative.js", () => ({
  loadDeclarativeTools: mockLoadDeclarativeTools,
}));

const { syncWebMcpRegistration } = await import("./syncWebMcpRegistration.js");

describe("syncWebMcpRegistration", () => {
  let mockOrchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {};
    mockOrchestrator = {
      webMcpEffectCleanup: jest.fn(),
      webMcpToolsEnabled: true,
      webMcpRegistrationLock: Promise.resolve(),
      agentWorker: {},
      handleWorkerMessage: jest.fn(),
    };
    mockLoadDeclarativeTools.mockResolvedValue({
      tools: [
        {
          name: "generate_random_number",
          description: "Generate random number",
        },
        { name: "unpinned_decl_tool", description: "Unpinned tool" },
      ],
    });
  });

  it("should clean up existing effect and unregister if not enabled", () => {
    mockOrchestrator.webMcpToolsEnabled = false;

    const cleanupMock = mockOrchestrator.webMcpEffectCleanup;

    syncWebMcpRegistration(mockOrchestrator, mockDb);

    expect(cleanupMock).toHaveBeenCalled();
    expect(mockOrchestrator.webMcpEffectCleanup).toBeNull();
    expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
  });

  it("should setup effect and register tools (including declarative tools filtered by toolTags) if enabled", async () => {
    // Add generate_random_number to group1's toolTags
    const orchestratorStoreModule =
      await import("../../../stores/orchestrator.js");
    orchestratorStoreModule.orchestratorStore.groups[0].toolTags = [
      "tool1",
      "generate_random_number",
    ];

    syncWebMcpRegistration(mockOrchestrator, mockDb);

    expect(mockOrchestrator.webMcpEffectCleanup).toBeDefined();

    // The effect should run and chain onto webMcpRegistrationLock
    await mockOrchestrator.webMcpRegistrationLock;

    expect(mockUnregisterWebMcpTools).toHaveBeenCalled();
    expect(mockRegisterWebMcpTools).toHaveBeenCalledWith(
      mockOrchestrator.agentWorker,
      expect.any(Function),
      "group1",
      [
        { name: "tool1" },
        {
          name: "generate_random_number",
          description: "Generate random number",
        },
      ],
    );

    // Call the callback to test coverage of handleWorkerMessage
    const cb = mockRegisterWebMcpTools.mock.calls[0][1];
    await cb("test message");
    expect(mockHandleWorkerMessage).toHaveBeenCalledWith(
      mockOrchestrator,
      mockDb,
      "test message",
    );
  });

  it("should handle error in registration lock promise", async () => {
    mockRegisterWebMcpTools.mockRejectedValueOnce(new Error("Test error"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    syncWebMcpRegistration(mockOrchestrator, mockDb);

    await mockOrchestrator.webMcpRegistrationLock;
    expect(consoleError).toHaveBeenCalledWith(
      "WebMCP registration failed:",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});
