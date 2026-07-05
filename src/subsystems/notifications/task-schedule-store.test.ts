import {
  openTaskScheduleStore,
  closeTaskScheduleStore,
  saveScheduledTask,
  deleteScheduledTask,
  getScheduledTask,
  getAllScheduledTasks,
  getEnabledScheduledTasks,
  updateScheduledTaskLastRun,
} from "./task-schedule-store.js";

beforeEach(() => {
  openTaskScheduleStore(":memory:");
});

afterEach(() => {
  closeTaskScheduleStore();
});

const MOCK_TASK: any = {
  id: "task-001",
  groupId: "br:main",
  schedule: "*/5 * * * *",
  prompt: "Check the weather",

  enabled: true,
  lastRun: null,
  createdAt: Date.now(),
};

const MOCK_TASK_2: any = {
  id: "task-002",
  groupId: "br:other",
  schedule: "0 9 * * 1",
  prompt: "Weekly report",

  enabled: true,
  lastRun: null,
  createdAt: Date.now() + 1,
};

describe("task-schedule-store", () => {
  describe("openTaskScheduleStore", () => {
    it("creates tables on first open", () => {
      // If we got here without error, table was created
      const tasks = getAllScheduledTasks();
      expect(tasks).toEqual([]);
    });

    it("is idempotent — second call returns same DB", () => {
      const db1 = openTaskScheduleStore(":memory:");
      const db2 = openTaskScheduleStore(":memory:");
      expect(db1).toBe(db2);
    });
  });

  describe("saveScheduledTask", () => {
    it("stores a new task", () => {
      saveScheduledTask(MOCK_TASK);
      const tasks = getAllScheduledTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(MOCK_TASK.id);
      expect(tasks[0].group_id).toBe(MOCK_TASK.groupId);
      expect(tasks[0].schedule).toBe(MOCK_TASK.schedule);
      expect(tasks[0].prompt).toBe(MOCK_TASK.prompt);
      expect(tasks[0].enabled).toBe(1);
    });

    it("upserts (replaces) task with same ID", () => {
      saveScheduledTask(MOCK_TASK);
      saveScheduledTask({ ...MOCK_TASK, prompt: "Updated prompt" });
      const tasks = getAllScheduledTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].prompt).toBe("Updated prompt");
    });

    it("stores disabled task with enabled=0", () => {
      saveScheduledTask({ ...MOCK_TASK, enabled: false });
      const task = getScheduledTask(MOCK_TASK.id);

      expect(task!.enabled).toBe(0);
    });
  });

  describe("deleteScheduledTask", () => {
    it("removes a task by ID", () => {
      saveScheduledTask(MOCK_TASK);
      saveScheduledTask(MOCK_TASK_2);
      deleteScheduledTask(MOCK_TASK.id);
      const tasks = getAllScheduledTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(MOCK_TASK_2.id);
    });

    it("does not throw for non-existent ID", () => {
      expect(() => deleteScheduledTask("nonexistent")).not.toThrow();
    });
  });

  describe("getScheduledTask", () => {
    it("returns a task by ID", () => {
      saveScheduledTask(MOCK_TASK);
      const task = getScheduledTask(MOCK_TASK.id);
      expect(task).toBeDefined();

      expect(task!.id).toBe(MOCK_TASK.id);
    });

    it("returns undefined for non-existent ID", () => {
      const task = getScheduledTask("nonexistent");
      expect(task).toBeUndefined();
    });
  });

  describe("getAllScheduledTasks", () => {
    it("returns all tasks", () => {
      saveScheduledTask(MOCK_TASK);
      saveScheduledTask(MOCK_TASK_2);
      const tasks = getAllScheduledTasks();
      expect(tasks).toHaveLength(2);
    });

    it("filters by groupId when provided", () => {
      saveScheduledTask(MOCK_TASK);
      saveScheduledTask(MOCK_TASK_2);
      const tasks = getAllScheduledTasks("br:main");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].group_id).toBe("br:main");
    });
  });

  describe("getEnabledScheduledTasks", () => {
    it("returns only enabled tasks", () => {
      saveScheduledTask(MOCK_TASK);
      saveScheduledTask({ ...MOCK_TASK_2, enabled: false });
      const tasks = getEnabledScheduledTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(MOCK_TASK.id);
    });
  });

  describe("updateScheduledTaskLastRun", () => {
    it("updates the last_run timestamp", () => {
      saveScheduledTask(MOCK_TASK);
      const now = Date.now();
      updateScheduledTaskLastRun(MOCK_TASK.id, now);
      const task = getScheduledTask(MOCK_TASK.id);

      expect(task!.last_run).toBe(now);
    });
  });

  describe("error handling", () => {
    it("throws if store not opened", () => {
      closeTaskScheduleStore();
      expect(() => saveScheduledTask(MOCK_TASK)).toThrow(/not opened/);
      expect(() => deleteScheduledTask("x")).toThrow(/not opened/);
      expect(() => getScheduledTask("x")).toThrow(/not opened/);
      expect(() => getAllScheduledTasks()).toThrow(/not opened/);
      expect(() => getEnabledScheduledTasks()).toThrow(/not opened/);
      expect(() => updateScheduledTaskLastRun("x", 0)).toThrow(/not opened/);
    });
  });

  describe("multi-tenant fields (channel + subscriberId)", () => {
    it("stores and retrieves channel field", () => {
      saveScheduledTask({ ...MOCK_TASK, channel: "br:" });
      const task: any = getScheduledTask(MOCK_TASK.id);

      expect(task.channel).toBe("br:");
    });

    it("stores and retrieves subscriber_id field", () => {
      saveScheduledTask({ ...MOCK_TASK, subscriberId: "sub-abc" });
      const task: any = getScheduledTask(MOCK_TASK.id);

      expect(task.subscriber_id).toBe("sub-abc");
    });

    it("defaults channel and subscriber_id to null when not provided", () => {
      saveScheduledTask(MOCK_TASK);
      const task: any = getScheduledTask(MOCK_TASK.id);

      expect(task.channel).toBeNull();

      expect(task.subscriber_id).toBeNull();
    });

    it("filters getAllScheduledTasks by subscriberId", () => {
      saveScheduledTask({ ...MOCK_TASK, subscriberId: "sub-1" });
      saveScheduledTask({ ...MOCK_TASK_2, subscriberId: "sub-2" });
      const tasks = getAllScheduledTasks(undefined, "sub-1");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].subscriber_id).toBe("sub-1");
    });

    it("filters getAllScheduledTasks by both groupId and subscriberId", () => {
      saveScheduledTask({
        ...MOCK_TASK,
        subscriberId: "sub-1",
      });
      saveScheduledTask({
        ...MOCK_TASK_2,
        groupId: MOCK_TASK.groupId,
        subscriberId: "sub-2",
      });
      const tasks = getAllScheduledTasks(MOCK_TASK.groupId, "sub-1");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(MOCK_TASK.id);
    });
  });
});
