import {
  checkAllowedToolGuard,
  checkTaskExecutionGuard,
  checkScheduledTaskBlockedGuard,
  checkHeadlessCapabilityGuard,
  runToolGuards,
} from "./guards.js";

describe("executeTool guards", () => {
  describe("checkAllowedToolGuard", () => {
    it("returns null when tool is allowed", () => {
      expect(
        checkAllowedToolGuard("read_file", ["read_file", "write_file"]),
      ).toBeNull();
      expect(
        checkAllowedToolGuard("read_file", [{ name: "read_file" }]),
      ).toBeNull();
      expect(checkAllowedToolGuard("read_file", undefined)).toBeNull();
    });

    it("returns error string when tool is not allowed", () => {
      const err = checkAllowedToolGuard("bash", ["read_file"]);
      expect(err).toContain(
        'Tool "bash" is not allowed in the current context',
      );
    });
  });

  describe("checkTaskExecutionGuard", () => {
    it("blocks run_task during scheduled task or task execution", () => {
      expect(checkTaskExecutionGuard("run_task", true, false)).toContain(
        'Tool "run_task" cannot be called from within a task execution',
      );
      expect(checkTaskExecutionGuard("run_task", false, true)).toContain(
        'Tool "run_task" cannot be called from within a task execution',
      );
    });

    it("allows run_task outside task execution context", () => {
      expect(checkTaskExecutionGuard("run_task", false, false)).toBeNull();
      expect(checkTaskExecutionGuard("read_file", true, true)).toBeNull();
    });
  });

  describe("checkScheduledTaskBlockedGuard", () => {
    it("blocks task-mutation and notification tools during scheduled task execution", () => {
      const blocked = [
        "create_task",
        "update_task",
        "delete_task",
        "enable_task",
        "disable_task",
        "send_notification",
        "create_room",
        "invite_to_room",
        "leave_room",
      ];
      for (const tool of blocked) {
        expect(checkScheduledTaskBlockedGuard(tool, true)).toContain(
          `Tool "${tool}" is not allowed during scheduled task execution`,
        );
      }
    });

    it("allows non-blocked tools during scheduled task execution", () => {
      expect(checkScheduledTaskBlockedGuard("read_file", true)).toBeNull();
      expect(checkScheduledTaskBlockedGuard("create_task", false)).toBeNull();
    });
  });

  describe("checkHeadlessCapabilityGuard", () => {
    it("returns null for standard tools in default mode", () => {
      expect(checkHeadlessCapabilityGuard("read_file")).toBeNull();
    });
  });

  describe("runToolGuards pipeline", () => {
    it("returns first guard failure", () => {
      const err = runToolGuards("run_task", { isScheduledTask: true });
      expect(err).toBeTruthy();
    });

    it("returns null when all guards pass", () => {
      const err = runToolGuards("read_file", {});
      expect(err).toBeNull();
    });
  });
});
