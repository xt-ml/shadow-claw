import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  deleteTaskFromServer,
  shouldStartLocalScheduler,
  syncTaskToServer,
} from "./task.js";

describe("task operations", () => {
  beforeEach(() => {
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
    });
  });

  it("shouldStartLocalScheduler returns true if serviceWorker missing", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { serviceWorker: undefined },
      configurable: true,
    });
    expect(await shouldStartLocalScheduler()).toBe(true);
  });

  it("syncTaskToServer includes subscriberId in request body", async () => {
    await syncTaskToServer(
      { taskServerUrl: "/schedule" } as any,
      {
        id: "t1",
        groupId: "br:main",
        prompt: "hello",
        schedule: "*/5 * * * *",
        enabled: true,
        lastRun: null,
        createdAt: 1,
      } as any,
      "sub-1",
    );

    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      "/schedule/tasks",
      expect.objectContaining({ method: "POST" }),
    );

    const body = JSON.parse((globalThis as any).fetch.mock.calls[0][1].body);
    expect(body.subscriberId).toBe("sub-1");
  });

  it("deleteTaskFromServer includes subscriberId query parameter", async () => {
    await deleteTaskFromServer(
      { taskServerUrl: "/schedule" } as any,
      "t1",
      "sub-2",
    );

    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      "/schedule/tasks/t1?subscriberId=sub-2",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
