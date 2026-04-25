import { jest } from "@jest/globals";

jest.unstable_mockModule("./db/getEnabledTasks.js", () => ({
  getEnabledTasks: jest.fn(),
}));

jest.unstable_mockModule("./db/updateTaskLastRun.js", () => ({
  updateTaskLastRun: jest.fn(),
}));

const { TaskScheduler, matchesCron } = await import("./task-scheduler.js");
const { getEnabledTasks } = await import("./db/getEnabledTasks.js");
const { updateTaskLastRun } = await import("./db/updateTaskLastRun.js");

describe("matchesCron", () => {
  it("matches wildcards and exact values", () => {
    const d = new Date("2026-03-09T12:30:00");

    expect(matchesCron("30 12 * * *", d)).toBe(true);

    expect(matchesCron("29 12 * * *", d)).toBe(false);
  });

  it("supports ranges/lists/steps", () => {
    const d = new Date("2026-03-09T12:30:00");

    expect(matchesCron("*/15 10-13 * * 1,2,3", d)).toBe(true);
  });
});

describe("TaskScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs due task once per minute", async () => {
    const runner = (jest.fn() as any).mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);
    const now = Date.now();

    (getEnabledTasks as any).mockResolvedValue([
      { id: "t1", schedule: "* * * * *", lastRun: null },
    ]);

    await scheduler.tick();

    expect(updateTaskLastRun).toHaveBeenCalledWith("t1", expect.any(Number));

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));

    (getEnabledTasks as any).mockResolvedValue([
      { id: "t1", schedule: "* * * * *", lastRun: now },
    ]);

    expect(
      scheduler.ranThisMinute({ lastRun: now } as any, new Date(now)),
    ).toBe(true);
  });

  it("start is idempotent and stop clears interval", () => {
    jest.useFakeTimers();
    const scheduler = new TaskScheduler(async () => {});
    const tickSpy = jest.spyOn(scheduler, "tick").mockResolvedValue(undefined);

    scheduler.start();
    const firstInterval = scheduler.interval;
    scheduler.start();

    expect(scheduler.interval).toBe(firstInterval);

    expect(tickSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();

    expect(scheduler.interval).toBeNull();
    jest.useRealTimers();
  });

  it("does NOT catch up missed tasks from the past", async () => {
    const runner = (jest.fn() as any).mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);

    // Task was last run yesterday at midnight; it's now 8 AM the next day
    // Schedule is "0 0 * * *" (daily at midnight) — it should have run at 00:00 today
    // but we no longer auto-fire missed tasks
    const lastRun = new Date("2026-03-16T00:00:00").getTime();
    const now = new Date("2026-03-17T08:00:00");

    (getEnabledTasks as any).mockResolvedValue([
      { id: "t2", schedule: "0 0 * * *", lastRun, enabled: true },
    ]);

    jest.useFakeTimers();
    jest.setSystemTime(now);

    await scheduler.tick();

    expect(updateTaskLastRun).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
