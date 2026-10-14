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

  it("prints empty message with group when no tasks exist for group", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: true,
        data: { tasks: [] },
      });

    await runTasksCommand({ client: "test-client", group: "my-group" });

    expect(logSpy).toHaveBeenCalledWith(
      'No tasks configured on client for group "my-group".',
    );
  });

  it("resolves default client from listClients when client option omitted", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([{ clientId: "first-client" }]);
    const sendSpy = jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: true,
        data: {
          tasks: [{ prompt: "Say hello and do things", enabled: true }],
        },
      });

    await runTasksCommand({});

    expect(sendSpy).toHaveBeenCalledWith("first-client", "list-tasks", {
      groupId: undefined,
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("1. [enabled] Say hello and do things (manual)"),
    );
  });

  it("errors when client option omitted and no clients connected", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([]);

    await runTasksCommand({});

    expect(errorSpy).toHaveBeenCalledWith("Error: No clients connected.");
    expect(process.exitCode).toBe(1);
  });

  it("handles sendCommand failure", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: false,
        error: "Client unreachable",
      });

    await runTasksCommand({ client: "offline-client" });

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to list tasks: Client unreachable",
    );
    expect(process.exitCode).toBe(1);
  });

  it("handles exception thrown during execution", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockRejectedValueOnce(new Error("Connection reset"));

    await runTasksCommand({ client: "error-client" });

    expect(errorSpy).toHaveBeenCalledWith(
      "Error executing tasks command: Connection reset",
    );
    expect(process.exitCode).toBe(1);
  });
});
