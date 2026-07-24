import { jest } from "@jest/globals";

import type { ShadowClawDatabase } from "../../../db/db.js";
import type { Orchestrator } from "../orchestrator.js";

const mockOrchestratorStore = {
  tasks: [] as any[],
  runTask: jest.fn(),
};

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: mockOrchestratorStore,
}));

const { setupPushTaskListener } = await import("./setupPushTaskListener.js");

describe("setupPushTaskListener", () => {
  let mockOrchestrator: Partial<Orchestrator>;
  let originalNavigator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrchestrator = {
      schedulerTriggeredGroups: new Set(),
      syncProxyConfigToServiceWorker: jest.fn(),
      submitMessage: jest.fn(),
    };

    originalNavigator = global.navigator;
  });

  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        configurable: true,
      });
    }
  });

  it("should do nothing if navigator or serviceWorker is undefined", () => {
    Object.defineProperty(global, "navigator", {
      value: undefined,
      configurable: true,
    });

    expect(() =>
      setupPushTaskListener(
        mockOrchestrator as Orchestrator,
        {} as ShadowClawDatabase,
      ),
    ).not.toThrow();
  });

  it("should register a message listener if serviceWorker exists", () => {
    const addEventListenerSpy = jest.fn();
    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          addEventListener: addEventListenerSpy,
        },
      },
      configurable: true,
    });

    setupPushTaskListener(
      mockOrchestrator as Orchestrator,
      {} as ShadowClawDatabase,
    );
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });

  it("should sync proxy config on request-proxy-config message", () => {
    let listener: any;
    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          addEventListener: (event: string, cb: any) => {
            if (event === "message") listener = cb;
          },
        },
      },
      configurable: true,
    });

    setupPushTaskListener(
      mockOrchestrator as Orchestrator,
      {} as ShadowClawDatabase,
    );
    expect(listener).toBeDefined();

    listener({ data: { type: "request-proxy-config" } });
    expect(mockOrchestrator.syncProxyConfigToServiceWorker).toHaveBeenCalled();
  });

  describe("scheduled-task-trigger", () => {
    let listener: any;

    beforeEach(() => {
      Object.defineProperty(global, "navigator", {
        value: {
          serviceWorker: {
            addEventListener: (event: string, cb: any) => {
              if (event === "message") listener = cb;
            },
          },
        },
        configurable: true,
      });

      setupPushTaskListener(
        mockOrchestrator as Orchestrator,
        {} as ShadowClawDatabase,
      );
    });

    it("should ignore events without groupId", () => {
      listener({ data: { type: "scheduled-task-trigger", taskId: "t1" } });
      expect(mockOrchestrator.schedulerTriggeredGroups?.size).toBe(0);
    });

    it("should ignore non-scheduled-task-trigger events", () => {
      listener({ data: { type: "other-event", groupId: "g1" } });
      expect(mockOrchestrator.schedulerTriggeredGroups?.size).toBe(0);
    });

    it("should run existing task from orchestratorStore", async () => {
      const task = { id: "t1", groupId: "g1" };
      mockOrchestratorStore.tasks = [task];

      listener({
        data: { type: "scheduled-task-trigger", taskId: "t1", groupId: "g1" },
      });

      // Wait for runTaskHandler promise
      await new Promise(process.nextTick);

      expect(mockOrchestrator.schedulerTriggeredGroups?.has("g1")).toBe(false); // Cleaned up in finally
      expect(mockOrchestratorStore.runTask).toHaveBeenCalledWith(task);
    });

    it("should run synthetic tool task if task not found in store", async () => {
      mockOrchestratorStore.tasks = [];

      listener({
        data: {
          type: "scheduled-task-trigger",
          taskId: "t2",
          groupId: "g2",
          taskType: "tools",
          tools: ["t1", "t2"],
          prompt: "hello",
        },
      });

      await new Promise(process.nextTick);

      expect(mockOrchestratorStore.runTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t2",
          groupId: "g2",
          type: "tools",
          tools: ["t1", "t2"],
          prompt: "hello",
        }),
      );
    });

    it("should fallback to submitMessage if no task or tools and prompt exists", async () => {
      mockOrchestratorStore.tasks = [];

      listener({
        data: {
          type: "scheduled-task-trigger",
          taskId: "t3",
          groupId: "g3",
          prompt: "hello",
        },
      });

      await new Promise(process.nextTick);

      expect(mockOrchestrator.submitMessage).toHaveBeenCalledWith(
        "hello",
        "g3",
      );
    });

    it("should handle error in runTaskHandler", async () => {
      mockOrchestratorStore.tasks = [];
      mockOrchestrator.submitMessage = jest.fn().mockImplementation(() => {
        throw new Error("Test err");
      });
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      listener({
        data: {
          type: "scheduled-task-trigger",
          taskId: "t4",
          groupId: "g4",
          prompt: "hello",
        },
      });

      await new Promise(process.nextTick);

      expect(consoleError).toHaveBeenCalledWith(
        "Push-triggered task t4 failed:",
        expect.any(Error),
      );
      expect(mockOrchestrator.schedulerTriggeredGroups?.has("g4")).toBe(false);

      consoleError.mockRestore();
    });
  });
});
