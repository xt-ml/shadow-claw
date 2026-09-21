import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runSendFileCommand } from "./send-file.js";
import { CliControlClient } from "../utils/control-client.js";

describe("runSendFileCommand", () => {
  let logSpy: any;
  let errorSpy: any;
  let tempDir: string;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = 0;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-send-file-test-"));
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = 0;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it("fails when filePath is empty", async () => {
    await runSendFileCommand("");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("File path cannot be empty"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("fails when file does not exist", async () => {
    await runSendFileCommand(path.join(tempDir, "nonexistent.txt"));
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("File not found"),
    );
    expect(process.exitCode).toBe(1);
  });

  it("transfers file to specified client", async () => {
    const filePath = path.join(tempDir, "hello.txt");
    fs.writeFileSync(filePath, "Hello World", "utf8");

    const sendFileSpy = jest
      .spyOn(CliControlClient.prototype, "sendFile")
      .mockResolvedValueOnce({
        success: true,
        data: {
          path: "/workspace/transfers/hello.txt",
          fileName: "hello.txt",
          size: 11,
        },
      });

    await runSendFileCommand(filePath, { client: "peer-target-123" });

    expect(sendFileSpy).toHaveBeenCalledWith(
      "peer-target-123",
      filePath,
      expect.objectContaining({
        prompt: undefined,
        name: undefined,
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("successfully transferred to peer-target-123"),
    );
  });

  it("auto-discovers client when none specified", async () => {
    const filePath = path.join(tempDir, "auto.txt");
    fs.writeFileSync(filePath, "Auto test", "utf8");

    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([
        { clientId: "peer-first", deviceLabel: "Target Device" },
      ]);

    const sendFileSpy = jest
      .spyOn(CliControlClient.prototype, "sendFile")
      .mockResolvedValueOnce({
        success: true,
        data: {
          path: "/workspace/transfers/auto.txt",
          fileName: "auto.txt",
          size: 9,
        },
      });

    await runSendFileCommand(filePath, {});

    expect(sendFileSpy).toHaveBeenCalledWith(
      "peer-first",
      filePath,
      expect.any(Object),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Targeting client: Target Device (peer-first)"),
    );
  });

  it("handles --prompt and displays remote agent reply", async () => {
    const filePath = path.join(tempDir, "report.csv");
    fs.writeFileSync(filePath, "col1,col2\n1,2", "utf8");

    jest.spyOn(CliControlClient.prototype, "sendFile").mockResolvedValueOnce({
      success: true,
      data: {
        path: "/workspace/transfers/report.csv",
        fileName: "report.csv",
        size: 13,
        reply: "The CSV has 2 columns and 1 row.",
      },
    });

    await runSendFileCommand(filePath, {
      client: "peer-agent",
      prompt: "Analyze this CSV",
    });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Response from peer-agent:"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("The CSV has 2 columns and 1 row."),
    );
  });
});
