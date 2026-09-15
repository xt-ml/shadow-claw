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

    expect(sendSpy).toHaveBeenCalledWith("client-target", "send-message", {
      text: "Hello ShadowClaw",
      groupId: undefined,
    });
    expect(logSpy).toHaveBeenCalledWith("Message successfully dispatched.");
  });
});
