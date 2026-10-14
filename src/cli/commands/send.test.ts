import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runSendCommand } from "./send.js";
import { CliControlClient } from "../utils/control-client.js";

describe("runSendCommand", () => {
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

  it("fails when message is empty", async () => {
    await runSendCommand("");
    expect(errorSpy).toHaveBeenCalledWith("Error: Message cannot be empty.");
    expect(process.exitCode).toBe(1);
  });

  it("sends message to targeted client", async () => {
    const sendSpy = jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: true, data: { status: "received" } });

    await runSendCommand("Hello ShadowClaw", { client: "client-target" });

    expect(sendSpy).toHaveBeenCalledWith(
      "client-target",
      "send-message",
      {
        text: "Hello ShadowClaw",
        groupId: undefined,
      },
      120000,
    );
    expect(logSpy).toHaveBeenCalledWith("Message successfully dispatched.");
  });

  it("displays agent response text when reply is present in result", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({
        success: true,
        data: { reply: "I am ready to help you." },
      });

    await runSendCommand("What can you do?", { client: "client-target" });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Response from client-target:"),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("I am ready to help you."),
    );
  });

  it("delegates to sendFile when --file option is provided", async () => {
    const sendFileSpy = jest
      .spyOn(CliControlClient.prototype, "sendFile")
      .mockResolvedValueOnce({
        success: true,
        data: { reply: "File analyzed successfully." },
      });

    await runSendCommand("Please analyze this", {
      client: "client-target",
      file: "data.txt",
    });

    expect(sendFileSpy).toHaveBeenCalledWith(
      "client-target",
      "data.txt",
      expect.objectContaining({
        prompt: "Please analyze this",
      }),
    );
  });

  it("auto-resolves client when client option omitted", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([
        { clientId: "c-first", deviceLabel: "My Laptop" },
      ]);
    const sendSpy = jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: true, data: { status: "ok" } });

    await runSendCommand("Hello first", { timeout: 10, json: true });

    expect(sendSpy).toHaveBeenCalledWith(
      "c-first",
      "send-message",
      { text: "Hello first", groupId: undefined },
      10000,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Targeting client: My Laptop (c-first)"),
    );
  });

  it("errors when client option omitted and no clients connected", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([]);

    await runSendCommand("Hello nobody", {});

    expect(errorSpy).toHaveBeenCalledWith("Error: No clients are connected.");
    expect(process.exitCode).toBe(1);
  });

  it("handles client error response", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockResolvedValueOnce({ success: false, error: "Model timeout" });

    await runSendCommand("Hello failure", { client: "client-target" });

    expect(errorSpy).toHaveBeenCalledWith("Error from client: Model timeout");
    expect(process.exitCode).toBe(1);
  });

  it("handles exception during sending", async () => {
    jest
      .spyOn(CliControlClient.prototype, "sendCommand")
      .mockRejectedValueOnce(new Error("Socket closed"));

    await runSendCommand("Hello exception", { client: "client-target" });

    expect(errorSpy).toHaveBeenCalledWith(
      "Error sending message: Socket closed",
    );
    expect(process.exitCode).toBe(1);
  });
});
