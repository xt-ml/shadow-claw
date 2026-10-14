import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runClientsCommand } from "./clients.js";
import { CliControlClient } from "../utils/control-client.js";

describe("runClientsCommand", () => {
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

  it("lists clients when clients are connected", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([
        {
          clientId: "c-1",
          deviceLabel: "Chrome Desktop",
          peerId: "peer-1",
          capabilities: ["notifications"],
          version: "1.0.0",
          lastSeen: Date.now() - 5000,
        },
      ]);

    await runClientsCommand({});

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Connected / registered clients"),
    );
  });

  it("prints message when no clients are connected", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([]);

    await runClientsCommand({});

    expect(logSpy).toHaveBeenCalledWith(
      "No clients currently registered or connected.",
    );
  });

  it("formats client without peerId, empty capabilities, and older lastSeen", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockResolvedValueOnce([
        {
          clientId: "c-old",
          deviceLabel: "Headless Agent",
          capabilities: [],
          version: "2.0.0",
          lastSeen: Date.now() - 125000,
        },
      ]);

    await runClientsCommand({});

    expect(logSpy).toHaveBeenCalledWith("     Capabilities: none");
    expect(logSpy).toHaveBeenCalledWith("     Last seen:    2m ago\n");
  });

  it("handles exception during fetch", async () => {
    jest
      .spyOn(CliControlClient.prototype, "listClients")
      .mockRejectedValueOnce(new Error("Connection refused"));

    await runClientsCommand({});

    expect(errorSpy).toHaveBeenCalledWith(
      "Error fetching clients: Connection refused",
    );
    expect(process.exitCode).toBe(1);
  });
});
