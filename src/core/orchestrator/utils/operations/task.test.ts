/** @jest-environment node */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { Task } from "../../../../db/types.js";
import type { OrchestratorState } from "../../orchestrator-state.js";

const mockRunTask = jest.fn<() => Promise<void>>();
const mockShowToast = jest.fn();

jest.unstable_mockModule("../../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    runTask: mockRunTask,
  },
}));

jest.unstable_mockModule("../../../../ui/toast.js", () => ({
  showToast: mockShowToast,
}));

const {
  deleteTaskFromServer,
  getTaskFetchOptions,
  runTaskAsScheduled,
  shouldStartLocalScheduler,
  shouldDeferTaskToServer,
  syncTaskToServer,
  warnIfNoPushSubscription,
} = await import("./task.js");

describe("task operations", () => {
  let mockFetch: jest.Mock<
    (url: string, init?: RequestInit) => Promise<Response>
  >;
  let originalNavigator: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    originalNavigator = globalThis.navigator;

    mockFetch = jest.fn(
      async () =>
        ({
          ok: true,
          status: 200,
        }) as Response,
    );

    (globalThis as Record<string, unknown>).fetch = mockFetch;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  describe("getTaskFetchOptions & syncTaskToServer", () => {
    it("getTaskFetchOptions defaults baseOptions to empty object", () => {
      const opts = getTaskFetchOptions("http://localhost:8888");
      expect(opts).toEqual(
        expect.objectContaining({
          targetAddressSpace: "loopback",
        }),
      );
    });

    const defaultState: Pick<
      OrchestratorState,
      "taskServerUrl" | "taskServerEnabled" | "pushSubscriptionWarned"
    > = {
      taskServerUrl: "http://localhost:8888",
      taskServerEnabled: true,
      pushSubscriptionWarned: true,
    };

    const scheduledTask: Task = {
      id: "t1",
      groupId: "br:main",
      prompt: "hello",
      schedule: "*/5 * * * *",
      enabled: true,
      lastRun: null,
      createdAt: 1,
    };

    it("silently succeeds when taskServerEnabled is false", async () => {
      const result = await syncTaskToServer(
        { ...defaultState, taskServerEnabled: false },
        scheduledTask,
      );
      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls deleteTaskFromServer if task has no schedule", async () => {
      const unscheduledTask: Task = { ...scheduledTask, schedule: "" };
      const result = await syncTaskToServer(
        defaultState,
        unscheduledTask,
        "sub-del",
      );
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/tasks/t1?subscriberId=sub-del",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("syncs task to server and sets loopback targetAddressSpace for localhost / loopback IPs", async () => {
      for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
        mockFetch.mockClear();
        await syncTaskToServer(
          { ...defaultState, taskServerUrl: `http://${host}:8888/` },
          scheduledTask,
        );
        expect(mockFetch).toHaveBeenCalledWith(
          `http://${host}:8888/tasks`,
          expect.objectContaining({
            method: "POST",
            targetAddressSpace: "loopback",
          }),
        );
      }
    });

    it("sets private targetAddressSpace for private IP ranges and internal domains", async () => {
      const privateHosts = [
        "10.0.0.1",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.1.1",
        "my-server.local",
        "server.lan",
        "box.home",
        "cluster.internal",
        "singlelabelhost",
      ];

      for (const host of privateHosts) {
        mockFetch.mockClear();
        await syncTaskToServer(
          { ...defaultState, taskServerUrl: `http://${host}:9000` },
          scheduledTask,
          "sub-private",
        );
        expect(mockFetch).toHaveBeenCalledWith(
          `http://${host}:9000/tasks`,
          expect.objectContaining({
            targetAddressSpace: "private",
          }),
        );
      }
    });

    it("does not set targetAddressSpace for public hosts", async () => {
      await syncTaskToServer(
        { ...defaultState, taskServerUrl: "https://api.example.com" },
        scheduledTask,
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/tasks",
        expect.not.objectContaining({
          targetAddressSpace: expect.anything(),
        }),
      );
    });

    it("handles invalid URLs in getTaskFetchOptions without throwing", async () => {
      await syncTaskToServer(
        { ...defaultState, taskServerUrl: "http://[invalid-ipv6" },
        scheduledTask,
      );
      expect(mockFetch).toHaveBeenCalled();
    });

    it("uses fallback origin when location is undefined and uses location.origin when defined", () => {
      const optsWithoutLoc = getTaskFetchOptions("/relative-path");
      expect(optsWithoutLoc).toBeDefined();

      Object.defineProperty(globalThis, "location", {
        value: { origin: "http://example.org" },
        configurable: true,
      });
      try {
        const optsWithLoc = getTaskFetchOptions("/relative-path");
        expect(optsWithLoc).toBeDefined();
      } finally {
        delete (globalThis as Record<string, unknown>).location;
      }
    });

    it("returns false and logs error when server rejects sync", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 } as Response);
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await syncTaskToServer(defaultState, scheduledTask);
      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Server rejected task sync:",
        500,
      );

      consoleError.mockRestore();
    });

    it("returns false and logs error when fetch throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failed"));
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await syncTaskToServer(defaultState, scheduledTask);
      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to sync task to server:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });

    it("sends pushNotifications: false when task.pushNotifications is omitted or false", async () => {
      await syncTaskToServer(defaultState, scheduledTask);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/tasks",
        expect.objectContaining({
          body: JSON.stringify({
            ...scheduledTask,
            pushNotifications: false,
          }),
        }),
      );
    });

    it("sends pushNotifications: true when task.pushNotifications is true", async () => {
      await syncTaskToServer(defaultState, {
        ...scheduledTask,
        pushNotifications: true,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/tasks",
        expect.objectContaining({
          body: JSON.stringify({
            ...scheduledTask,
            pushNotifications: true,
          }),
        }),
      );
    });
  });

  describe("deleteTaskFromServer", () => {
    const defaultState: Pick<
      OrchestratorState,
      "taskServerUrl" | "taskServerEnabled"
    > = {
      taskServerUrl: "http://localhost:8888/",
      taskServerEnabled: true,
    };

    it("silently succeeds when taskServerEnabled is false", async () => {
      const result = await deleteTaskFromServer(
        { ...defaultState, taskServerEnabled: false },
        "t1",
      );
      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("deletes task without subscriberId suffix", async () => {
      const result = await deleteTaskFromServer(defaultState, "t1");
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/tasks/t1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("returns false when delete request fails", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await deleteTaskFromServer(defaultState, "t1");
      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Server rejected task deletion:",
        404,
      );

      consoleError.mockRestore();
    });

    it("returns false when delete request throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection reset"));
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await deleteTaskFromServer(defaultState, "t1");
      expect(result).toBe(false);
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to delete task from server:",
        expect.any(Error),
      );

      consoleError.mockRestore();
    });
  });

  describe("runTaskAsScheduled", () => {
    it("refuses to run if task has no groupId", async () => {
      const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const state = { schedulerTriggeredGroups: new Set<string>() };

      await runTaskAsScheduled(state, {
        id: "t1",
        prompt: "do something",
        schedule: "* * * * *",
        enabled: true,
        lastRun: null,
        createdAt: 1,
      } as Task);

      expect(consoleError).toHaveBeenCalled();
      expect(mockRunTask).not.toHaveBeenCalled();
      expect(state.schedulerTriggeredGroups.size).toBe(0);

      consoleError.mockRestore();
    });

    it("adds groupId to schedulerTriggeredGroups and cleans up in finally", async () => {
      const state = { schedulerTriggeredGroups: new Set<string>() };
      let hadGroupDuringExecution = false;

      mockRunTask.mockImplementationOnce(async () => {
        hadGroupDuringExecution = state.schedulerTriggeredGroups.has("br:main");
      });

      const task: Task = {
        id: "t1",
        groupId: "br:main",
        prompt: "do something",
        schedule: "* * * * *",
        enabled: true,
        lastRun: null,
        createdAt: 1,
      };

      await runTaskAsScheduled(state, task);

      expect(hadGroupDuringExecution).toBe(true);
      expect(state.schedulerTriggeredGroups.has("br:main")).toBe(false);
    });
  });

  describe("shouldStartLocalScheduler", () => {
    it("returns true if navigator is undefined", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: undefined,
        configurable: true,
      });
      expect(await shouldStartLocalScheduler()).toBe(true);
    });

    it("returns true if navigator.serviceWorker is missing", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
      });
      expect(await shouldStartLocalScheduler()).toBe(true);
    });

    it("returns true if push subscription is missing", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => null,
              },
            }),
          },
        },
        configurable: true,
      });
      expect(await shouldStartLocalScheduler()).toBe(true);
    });

    it("returns false if push subscription is active", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => ({
                  endpoint: "https://push.example.com",
                }),
              },
            }),
          },
        },
        configurable: true,
      });
      expect(await shouldStartLocalScheduler()).toBe(false);
    });

    it("returns true if service worker check throws", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.reject(new Error("Worker rejected")),
          },
        },
        configurable: true,
      });
      expect(await shouldStartLocalScheduler()).toBe(true);
    });
  });

  describe("shouldDeferTaskToServer", () => {
    const taskWithPush: Task = {
      id: "t-push",
      groupId: "br:main",
      prompt: "hello",
      schedule: "*/5 * * * *",
      enabled: true,
      lastRun: null,
      createdAt: 1,
      pushNotifications: true,
    };

    const taskWithoutPush: Task = {
      id: "t-no-push",
      groupId: "br:main",
      prompt: "hello",
      schedule: "*/5 * * * *",
      enabled: true,
      lastRun: null,
      createdAt: 1,
      pushNotifications: false,
    };

    it("returns false if taskServerEnabled is false", async () => {
      const state = { taskServerEnabled: false };
      expect(await shouldDeferTaskToServer(taskWithPush, state)).toBe(false);
    });

    it("returns false if task does not have pushNotifications enabled", async () => {
      const state = { taskServerEnabled: true };
      expect(await shouldDeferTaskToServer(taskWithoutPush, state)).toBe(false);
    });

    it("returns false if navigator or serviceWorker is missing", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: undefined,
        configurable: true,
      });
      const state = { taskServerEnabled: true };
      expect(await shouldDeferTaskToServer(taskWithPush, state)).toBe(false);
    });

    it("returns false if no active push subscription exists", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => null,
              },
            }),
          },
        },
        configurable: true,
      });
      const state = { taskServerEnabled: true };
      expect(await shouldDeferTaskToServer(taskWithPush, state)).toBe(false);
    });

    it("returns true when task has pushNotifications, taskServerEnabled is true, and push subscription exists", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => ({
                  endpoint: "https://push.example.com",
                }),
              },
            }),
          },
        },
        configurable: true,
      });
      const state = { taskServerEnabled: true };
      expect(await shouldDeferTaskToServer(taskWithPush, state)).toBe(true);
    });
  });

  describe("warnIfNoPushSubscription", () => {
    it("returns early if pushSubscriptionWarned is already true", async () => {
      const state = { pushSubscriptionWarned: true };
      await warnIfNoPushSubscription(state);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it("returns early if navigator or serviceWorker is undefined", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: undefined,
        configurable: true,
      });
      const state = { pushSubscriptionWarned: false };
      await warnIfNoPushSubscription(state);
      expect(mockShowToast).not.toHaveBeenCalled();

      Object.defineProperty(globalThis, "navigator", {
        value: {},
        configurable: true,
      });
      await warnIfNoPushSubscription(state);
      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it("shows toast warning when no push subscription exists", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => null,
              },
            }),
          },
        },
        configurable: true,
      });
      const state = { pushSubscriptionWarned: false };
      await warnIfNoPushSubscription(state);

      expect(state.pushSubscriptionWarned).toBe(true);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Push notifications are not enabled"),
        { type: "warning" },
      );
    });

    it("does not warn when active push subscription exists", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.resolve({
              pushManager: {
                getSubscription: async () => ({ endpoint: "active" }),
              },
            }),
          },
        },
        configurable: true,
      });
      const state = { pushSubscriptionWarned: false };
      await warnIfNoPushSubscription(state);

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it("ignores errors thrown during serviceWorker check", async () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          serviceWorker: {
            ready: Promise.reject(new Error("Push API denied")),
          },
        },
        configurable: true,
      });
      const state = { pushSubscriptionWarned: false };
      await expect(warnIfNoPushSubscription(state)).resolves.not.toThrow();
    });
  });
});
