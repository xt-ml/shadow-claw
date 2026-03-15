import { jest } from "@jest/globals";
import { BASH_DEFAULT_TIMEOUT_SEC } from "./config.mjs";

import {
  __resolveBootConfigForTests,
  __setVMInstanceForTests,
  bootVM,
  createTerminalSession,
  executeInVM,
  getVMBootHostPreference,
  getVMNetworkRelayURLPreference,
  getVMStatus,
  isVMReady,
  setVMBootHostPreference,
  setVMBootModePreference,
  setVMNetworkRelayURLPreference,
  shutdownVM,
} from "./vm.mjs";
import { DEFAULT_VM_NETWORK_RELAY_URL } from "./config.mjs";

function createMockEmulator() {
  /** @type {Map<string, Set<(value: any) => void>>} */
  const listeners = new Map();

  return {
    add_listener: jest.fn((event, listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      listeners.get(event)?.add(listener);
    }),
    remove_listener: jest.fn((event, listener) => {
      listeners.get(event)?.delete(listener);
    }),
    serial0_send: jest.fn(),
    emitSerial(text) {
      const serialListeners = listeners.get("serial0-output-byte");
      if (!serialListeners) {
        return;
      }

      for (const ch of text) {
        for (const listener of serialListeners) {
          listener(ch.charCodeAt(0));
        }
      }
    },
  };
}

function createReadyVM(execute, emulator, mode = "ext2") {
  return {
    isReady: () => true,
    execute,
    getEmulator: () => emulator,
    getMode: () => mode,
    destroy: jest.fn(),
  };
}

describe("vm wrapper", () => {
  afterEach(async () => {
    delete global.fetch;
    await shutdownVM();
  });

  it("reports not ready and returns fallback error output", async () => {
    expect(isVMReady()).toBe(false);
    const out = await executeInVM("echo hi");

    expect(out).toContain("WebVM is not available");
  });

  it("shutdown is safe when VM is not booted", async () => {
    await expect(shutdownVM()).resolves.toBeUndefined();
  });

  it("defaults to disabled boot mode", () => {
    expect(getVMStatus()).toMatchObject({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: "WebVM is disabled. Enable it in Settings to use WebVM.",
    });
  });

  it("normalizes boot host preference and clears on invalid", () => {
    setVMBootHostPreference("https://example.com///");

    expect(getVMBootHostPreference()).toBe("https://example.com");

    setVMBootHostPreference("not-a-url");

    expect(getVMBootHostPreference()).toBeNull();
  });

  it("uses default relay when invalid relay URL is provided", () => {
    setVMNetworkRelayURLPreference("wss://relay.example.com/path");

    expect(getVMNetworkRelayURLPreference()).toBe(
      "wss://relay.example.com/path",
    );

    setVMNetworkRelayURLPreference("https://invalid.example.com");

    expect(getVMNetworkRelayURLPreference()).toBe(DEFAULT_VM_NETWORK_RELAY_URL);
  });

  it("resets boot state on shutdown", async () => {
    setVMBootModePreference("ext2");
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await bootVM();

    expect(getVMStatus().bootAttempted).toBe(true);

    await shutdownVM();

    expect(getVMStatus()).toMatchObject({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    });
  });

  it("suspends terminal output while a command runs and resumes afterward", async () => {
    const emulator = createMockEmulator();
    const terminalChunks = [];
    let resolveExecute;

    const execute = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveExecute = resolve;
        }),
    );

    __setVMInstanceForTests(createReadyVM(execute, emulator));

    const session = createTerminalSession((chunk) => {
      terminalChunks.push(chunk);
    });

    emulator.emitSerial("A");

    expect(terminalChunks).toEqual(["A"]);

    const commandPromise = executeInVM("echo hello");

    expect(execute).toHaveBeenCalledWith(
      "echo hello",
      BASH_DEFAULT_TIMEOUT_SEC,
    );

    session.send("pwd\n");

    expect(emulator.serial0_send).not.toHaveBeenCalled();

    emulator.emitSerial("B");

    expect(terminalChunks).toEqual(["A"]);

    resolveExecute({
      stdout: "hello",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });

    await expect(commandPromise).resolves.toBe("hello");

    emulator.emitSerial("C");

    expect(terminalChunks).toEqual(["A", "C"]);

    session.send("pwd\n");

    expect(emulator.serial0_send).toHaveBeenCalledWith("pwd\n");
  });

  it("returns a busy error when another command is already running", async () => {
    const emulator = createMockEmulator();
    let resolveExecute;

    const execute = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveExecute = resolve;
        }),
    );

    __setVMInstanceForTests(createReadyVM(execute, emulator));

    const firstCommand = executeInVM("sleep 1");
    const secondCommand = await executeInVM("echo second");

    expect(secondCommand).toBe(
      "Error: WebVM is currently busy running another command.",
    );

    resolveExecute({
      stdout: "done",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });

    await expect(firstCommand).resolves.toBe("done");
  });

  it("honors explicit 9p preference even when ext2 assets also exist", async () => {
    setVMBootHostPreference("https://example.com");
    setVMBootModePreference("9p");

    const okUrls = new Set([
      // ext2 assets
      "https://example.com/assets/v86.ext2/libv86.mjs",
      "https://example.com/assets/v86.ext2/v86.wasm",
      "https://example.com/assets/v86.ext2/seabios.bin",
      "https://example.com/assets/v86.ext2/vgabios.bin",
      "https://example.com/assets/v86.ext2/alpine-rootfs.ext2",
      "https://example.com/assets/v86.ext2/bzImage",
      "https://example.com/assets/v86.ext2/initrd",
      // 9p assets
      "https://example.com/assets/v86.9pfs/libv86.mjs",
      "https://example.com/assets/v86.9pfs/v86.wasm",
      "https://example.com/assets/v86.9pfs/seabios.bin",
      "https://example.com/assets/v86.9pfs/vgabios.bin",
      "https://example.com/assets/v86.9pfs/alpine-fs.json",
    ]);

    global.fetch = jest.fn(async (url) => ({ ok: okUrls.has(String(url)) }));

    const config = await __resolveBootConfigForTests();

    expect(config?.mode).toBe("9p");

    expect(config?.label).toContain("9p");
  });

  it("keeps auto preference favoring ext2 before 9p fallback", async () => {
    setVMBootHostPreference("https://example.com");
    setVMBootModePreference("auto");

    const okUrls = new Set([
      // ext2 assets
      "https://example.com/assets/v86.ext2/libv86.mjs",
      "https://example.com/assets/v86.ext2/v86.wasm",
      "https://example.com/assets/v86.ext2/seabios.bin",
      "https://example.com/assets/v86.ext2/vgabios.bin",
      "https://example.com/assets/v86.ext2/alpine-rootfs.ext2",
      "https://example.com/assets/v86.ext2/bzImage",
      "https://example.com/assets/v86.ext2/initrd",
      // 9p assets
      "https://example.com/assets/v86.9pfs/libv86.mjs",
      "https://example.com/assets/v86.9pfs/v86.wasm",
      "https://example.com/assets/v86.9pfs/seabios.bin",
      "https://example.com/assets/v86.9pfs/vgabios.bin",
      "https://example.com/assets/v86.9pfs/alpine-fs.json",
    ]);

    global.fetch = jest.fn(async (url) => ({ ok: okUrls.has(String(url)) }));

    const config = await __resolveBootConfigForTests();

    expect(config?.mode).toBe("ext2");

    expect(config?.label).toContain("ext2");
  });
});
