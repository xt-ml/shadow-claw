import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runTasksCommand } from "./tasks.js";
import { CliControlClient } from "../utils/control-client.js";

describe("runTasksCommand", () => {
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = 0;
  });

  it("lists tasks when tasks are returned", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: true,
        data: {
          tasks: [
            { name: "Daily Backup", enabled: true, schedule: "0 0 * * *" },
            { name: "Cleanup", enabled: false, schedule: "manual" },
          ],
        },
      });

    await runTasksCommand({ client: "test-client" });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Tasks on test-client"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      "  1. [enabled] Daily Backup (0 0 * * *)",
    );
    expect(logSpy).toHaveBeenCalledWith("  2. [disabled] Cleanup (manual)");
  });

  it("prints empty message when no tasks exist", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: true,
        data: { tasks: [] },
      });

    await runTasksCommand({ client: "test-client" });

    expect(logSpy).toHaveBeenCalledWith("No tasks configured on client.");
  });
});
