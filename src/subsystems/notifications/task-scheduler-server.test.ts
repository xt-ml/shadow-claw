import { jest } from "@jest/globals";

import { ServerTaskScheduler } from "./task-scheduler-server.js";

describe("ServerTaskScheduler", () => {
  /* @type jest.Mock */
  let getEnabledTasks: any;
  /* @type jest.Mock */
  let updateLastRun: any;
  /* @type jest.Mock */
  let broadcastTaskTrigger: any;
  /* @type ServerTaskScheduler */
  let scheduler: any;

  beforeEach(() => {
    getEnabledTasks = jest.fn().mockReturnValue([]);
    updateLastRun = jest.fn();

    broadcastTaskTrigger = (jest.fn() as any).mockResolvedValue(undefined);
    scheduler = new ServerTaskScheduler({
      getEnabledTasks,
      updateLastRun,
      broadcastTaskTrigger,
    });
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  it("fires a due task and sends push trigger", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-03-24T10:30:00");
    jest.setSystemTime(now);

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t1",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "Daily check",
        subscriber_id: "sub-1",
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    expect(updateLastRun).toHaveBeenCalledWith("t1", now.getTime());
    expect(broadcastTaskTrigger).toHaveBeenCalledWith({
      id: "t1",
      groupId: "br:main",
      prompt: "Daily check",
      type: undefined,
      tools: null,
      channel: undefined,
      subscriberId: "sub-1",
    });
  });

  it("does NOT fire a task that doesn't match cron", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-24T10:31:00"));

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t1",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "Daily check",

        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    expect(updateLastRun).not.toHaveBeenCalled();
    expect(broadcastTaskTrigger).not.toHaveBeenCalled();
  });

  it("does NOT double-fire within the same minute", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-03-24T10:30:00");
    jest.setSystemTime(now);

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t1",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "Daily check",

        enabled: 1,
        last_run: now.getTime(),
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    expect(broadcastTaskTrigger).not.toHaveBeenCalled();
  });

  it("start is idempotent", () => {
    jest.useFakeTimers();
    const tickSpy = jest.spyOn(scheduler, "tick").mockResolvedValue(undefined);

    scheduler.start();
    const first = scheduler._interval;
    scheduler.start();

    expect(scheduler._interval).toBe(first);
    expect(tickSpy).toHaveBeenCalledTimes(1);
  });

  it("stop clears the interval", () => {
    jest.useFakeTimers();
    jest.spyOn(scheduler, "tick").mockResolvedValue(undefined);
    scheduler.start();
    expect(scheduler._interval).not.toBeNull();

    scheduler.stop();
    expect(scheduler._interval).toBeNull();
  });

  it("handles broadcastTaskTrigger failure gracefully", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-24T10:30:00"));

    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    (broadcastTaskTrigger as any).mockRejectedValue(new Error("push failed"));

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t1",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "check",
        subscriber_id: "sub-1",
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    // Task was still marked as run (to avoid re-trigger loop)
    expect(updateLastRun).toHaveBeenCalled();

    // Flush microtasks so async catch handlers run deterministically.
    await Promise.resolve();
    await Promise.resolve();

    consoleSpy.mockRestore();
  });

  it("logs a warning when broadcastTaskTrigger returns noSubscribers", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-24T10:30:00"));

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    (broadcastTaskTrigger as any).mockResolvedValue({ noSubscribers: true });

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t1",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "Daily check",
        subscriber_id: "sub-1",
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    // Flush microtasks so async .then() handlers run deterministically.
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("t1"));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("no push subscribers"),
    );

    consoleSpy.mockRestore();
  });

  describe("subscriber isolation in scheduler", () => {
    it("passes subscriberId to broadcastTaskTrigger when task has subscriber_id", async () => {
      jest.useFakeTimers();
      const now = new Date("2026-03-24T10:30:00");
      jest.setSystemTime(now);

      (getEnabledTasks as any).mockReturnValue([
        {
          id: "t1",
          group_id: "br:main",
          schedule: "30 10 * * *",
          prompt: "News check",
          subscriber_id: "sub-knack-123",
          enabled: 1,
          last_run: null,
          created_at: 1000,
        },
      ]);

      await scheduler.tick();

      expect(updateLastRun).toHaveBeenCalledWith("t1", now.getTime());
      expect(broadcastTaskTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "t1",
          subscriberId: "sub-knack-123",
        }),
      );
    });

    it("skips broadcast and logs warning when task has NULL or empty subscriber_id", async () => {
      jest.useFakeTimers();
      const now = new Date("2026-03-24T10:30:00");
      jest.setSystemTime(now);

      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      (getEnabledTasks as any).mockReturnValue([
        {
          id: "legacy-task-1",
          group_id: "br:main",
          schedule: "30 10 * * *",
          prompt: "Legacy prompt",
          subscriber_id: null,
          enabled: 1,
          last_run: null,
          created_at: 1000,
        },
      ]);

      await scheduler.tick();

      // Still updates last run so it doesn't loop
      expect(updateLastRun).toHaveBeenCalledWith(
        "legacy-task-1",
        now.getTime(),
      );
      // Does NOT broadcast
      expect(broadcastTaskTrigger).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("no subscriber_id"),
      );

      warnSpy.mockRestore();
    });

    it("fires multiple due tasks with their respective subscriberIds", async () => {
      jest.useFakeTimers();
      const now = new Date("2026-03-24T10:30:00");
      jest.setSystemTime(now);

      (getEnabledTasks as any).mockReturnValue([
        {
          id: "t-knack",
          group_id: "br:main",
          schedule: "30 10 * * *",
          prompt: "Knack task",
          subscriber_id: "sub-knack",
          enabled: 1,
          last_run: null,
          created_at: 1000,
        },
        {
          id: "t-ipad",
          group_id: "br:main",
          schedule: "30 10 * * *",
          prompt: "iPad task",
          subscriber_id: "sub-ipad",
          enabled: 1,
          last_run: null,
          created_at: 1000,
        },
      ]);

      await scheduler.tick();

      expect(broadcastTaskTrigger).toHaveBeenCalledTimes(2);
      expect(broadcastTaskTrigger).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: "t-knack",
          subscriberId: "sub-knack",
        }),
      );
      expect(broadcastTaskTrigger).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: "t-ipad",
          subscriberId: "sub-ipad",
        }),
      );
    });
  });
});
