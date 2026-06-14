import {
  openTaskScheduleStore,
  saveScheduledTask,
  getScheduledTask,
} from "./src/notifications/task-schedule-store.js";

import {
  openTaskScheduleStore,
  closeTaskScheduleStore,
  saveScheduledTask,
  getScheduledTask,
  getAllScheduledTasks,
} from "./src/notifications/task-schedule-store.js";

function runTest() {
  openTaskScheduleStore(":memory:");
  saveScheduledTask({
    id: "task-001",
    groupId: "br:main",
    schedule: "*/5 * * * *",
    prompt: "Check the weather",
    enabled: true,
    lastRun: null,
    createdAt: 1781477900213,
  });
  console.log("Task 1:", getScheduledTask("task-001"));
  closeTaskScheduleStore();

  openTaskScheduleStore(":memory:");
  saveScheduledTask({
    id: "task-001",
    groupId: "br:main",
    schedule: "*/5 * * * *",
    prompt: "Check the weather",
    enabled: true,
    lastRun: null,
    createdAt: 1781477900213,
  });
  console.log("Task 2:", getScheduledTask("task-001"));
  closeTaskScheduleStore();
}

runTest();
