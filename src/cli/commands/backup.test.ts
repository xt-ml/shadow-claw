import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runBackupCommand } from "./backup.js";
import { CliControlClient } from "../utils/control-client.js";

describe("runBackupCommand", () => {
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
    jest.restoreAllMocks();
    process.exitCode = 0;
  });

  it("lists backups when action is list", async () => {
    const listSpy = jest
      .spyOn(CliControlClient.prototype, "listBackups")
      .mockResolvedValueOnce([
        {
          id: "bk-1",
          clientId: "client-a",
          timestamp: 1600000000000,
          totalBytes: 2048000,
          fileCount: 5,
        },
      ]);

    await runBackupCommand("list", {});

    expect(listSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Available backups"),
    );
  });

  it("reports no backups when empty list returned", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listBackups")
      .mockResolvedValueOnce([]);

    await runBackupCommand("list", {});

    expect(logSpy).toHaveBeenCalledWith("No backups found.");
  });

  it("errors when delete action is called without backupId", async () => {
    await runBackupCommand("delete", {});

    expect(errorSpy).toHaveBeenCalledWith(
      "Error: --backup-id is required for delete action.",
    );
    expect(process.exitCode).toBe(1);
  });

  it("deletes backup when backupId is provided", async () => {
    const deleteSpy = jest
      .spyOn(CliControlClient.prototype, "deleteBackup")
      .mockResolvedValueOnce(undefined as any);

    await runBackupCommand("delete", {
      backupId: "bk-123",
      client: "client-1",
    });

    expect(deleteSpy).toHaveBeenCalledWith("bk-123", "client-1");
    expect(logSpy).toHaveBeenCalledWith("Backup bk-123 deleted.");
  });

  it("triggers backup with provided client successfully", async () => {
    const sendSpy = jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: true, data: { fileCount: 10 } });

    await runBackupCommand("trigger", {
      client: "client-target",
      group: "grp-1",
    });

    expect(sendSpy).toHaveBeenCalledWith("client-target", "trigger-backup", {
      groupId: "grp-1",
      token: expect.anything(),
    });
    expect(logSpy).toHaveBeenCalledWith("Backup completed successfully.");
  });

  it("triggers backup falling back to first client from listClients", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([{ clientId: "auto-client" }]);
    const sendSpy = jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: true, data: {} });

    await runBackupCommand("trigger", {});

    expect(sendSpy).toHaveBeenCalledWith("auto-client", "trigger-backup", {
      groupId: undefined,
      token: expect.anything(),
    });
  });

  it("errors when triggering backup and no clients are connected", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([]);

    await runBackupCommand("trigger", {});

    expect(errorSpy).toHaveBeenCalledWith(
      "Error: No clients are connected to back up.",
    );
    expect(process.exitCode).toBe(1);
  });

  it("handles backup failure response", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: false, error: "Disk full" });

    await runBackupCommand("trigger", { client: "client-fail" });

    expect(errorSpy).toHaveBeenCalledWith("Backup failed: Disk full");
    expect(process.exitCode).toBe(1);
  });

  it("handles exception thrown during execution", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listBackups")
      .mockRejectedValueOnce(new Error("Network timeout"));

    await runBackupCommand("list", {});

    expect(errorSpy).toHaveBeenCalledWith(
      "Error executing backup command: Network timeout",
    );
    expect(process.exitCode).toBe(1);
  });
});
