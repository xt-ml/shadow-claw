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
});
