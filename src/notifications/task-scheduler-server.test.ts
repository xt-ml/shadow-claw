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
        is_script: 0,
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
      isScript: false,
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
        is_script: 0,
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
        is_script: 0,
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

  it("broadcasts isScript=true for script tasks", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-24T10:30:00"));

    (getEnabledTasks as any).mockReturnValue([
      {
        id: "t2",
        group_id: "br:main",
        schedule: "30 10 * * *",
        prompt: "console.log('hi')",
        is_script: 1,
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    expect(broadcastTaskTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ isScript: true }),
    );
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
        is_script: 0,
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    // Task was still marked as run (to avoid re-trigger loop)
    expect(updateLastRun).toHaveBeenCalled();

    // Wait for the rejected promise to be caught
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));

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
        is_script: 0,
        enabled: 1,
        last_run: null,
        created_at: 1000,
      },
    ]);

    await scheduler.tick();

    // Give the async .then() a chance to run
    jest.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("t1"));
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("no push subscribers"),
    );

    consoleSpy.mockRestore();
  });
});
