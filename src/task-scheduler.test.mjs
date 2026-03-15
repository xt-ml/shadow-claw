import { jest } from "@jest/globals";

jest.unstable_mockModule("./db/getEnabledTasks.mjs", () => ({
  getEnabledTasks: jest.fn(),
}));

jest.unstable_mockModule("./db/updateTaskLastRun.mjs", () => ({
  updateTaskLastRun: jest.fn(),
}));

const { TaskScheduler, matchesCron } = await import("./task-scheduler.mjs");
const { getEnabledTasks } = await import("./db/getEnabledTasks.mjs");
const { updateTaskLastRun } = await import("./db/updateTaskLastRun.mjs");

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
    const runner = jest.fn().mockResolvedValue(undefined);
    const scheduler = new TaskScheduler(runner);
    const now = Date.now();

    getEnabledTasks.mockResolvedValue([
      { id: "t1", schedule: "* * * * *", lastRun: null },
    ]);

    await scheduler.tick();

    expect(updateTaskLastRun).toHaveBeenCalledWith("t1", expect.any(Number));

    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));

    getEnabledTasks.mockResolvedValue([
      { id: "t1", schedule: "* * * * *", lastRun: now },
    ]);

    expect(scheduler.ranThisMinute({ lastRun: now }, new Date(now))).toBe(true);
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
});
