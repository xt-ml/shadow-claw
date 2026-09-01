import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { runPeerIdCommand } from "./peer-id.mjs";
import {
  getCliPeerIdFilePath,
  readCliPeerId,
} from "../utils/webrtc-control-client.mjs";

describe("runPeerIdCommand", () => {
  let tempDir;
  let logSpy;

  beforeEach(() => {
    tempDir = path.join(
      os.tmpdir(),
      "test-cli-peer-id-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2),
    );
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (logSpy) logSpy.mockRestore();
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  it("creates and retrieves a new peer ID if none exists", async () => {
    const result = await runPeerIdCommand("get", { cacheDir: tempDir });
    expect(result.peerId).toMatch(/^cli-[0-9a-z]+$/);
    expect(result.isRenewed).toBe(true);

    const saved = readCliPeerId(tempDir);
    expect(saved).toBe(result.peerId);
  });

  it("returns existing peer ID without changing it on subsequent calls", async () => {
    const res1 = await runPeerIdCommand("get", { cacheDir: tempDir });
    const res2 = await runPeerIdCommand("get", { cacheDir: tempDir });

    expect(res2.peerId).toBe(res1.peerId);
    expect(res2.isRenewed).toBe(false);
  });

  it("renews peer ID when action is 'renew'", async () => {
    const res1 = await runPeerIdCommand("get", { cacheDir: tempDir });
    const res2 = await runPeerIdCommand("renew", { cacheDir: tempDir });

    expect(res2.peerId).not.toBe(res1.peerId);
    expect(res2.isRenewed).toBe(true);
    expect(readCliPeerId(tempDir)).toBe(res2.peerId);
  });

  it("renews peer ID when --renew flag is passed", async () => {
    const res1 = await runPeerIdCommand("get", { cacheDir: tempDir });
    const res2 = await runPeerIdCommand("get", {
      cacheDir: tempDir,
      renew: true,
    });

    expect(res2.peerId).not.toBe(res1.peerId);
    expect(res2.isRenewed).toBe(true);
  });

  it("sets a custom peer ID when --set is passed", async () => {
    const res = await runPeerIdCommand("get", {
      cacheDir: tempDir,
      set: "custom-my-peer",
    });

    expect(res.peerId).toBe("custom-my-peer");
    expect(res.isRenewed).toBe(true);
    expect(readCliPeerId(tempDir)).toBe("custom-my-peer");
  });

  it("supports quiet mode and json mode", async () => {
    const resQuiet = await runPeerIdCommand("get", {
      cacheDir: tempDir,
      quiet: true,
    });
    expect(resQuiet.peerId).toBeDefined();

    const resJson = await runPeerIdCommand("get", {
      cacheDir: tempDir,
      json: true,
    });
    expect(resJson.peerId).toBe(resQuiet.peerId);
    expect(resJson.filePath).toBe(getCliPeerIdFilePath(tempDir));
  });
});
