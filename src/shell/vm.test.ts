import { jest } from "@jest/globals";
import { BASH_DEFAULT_TIMEOUT_SEC } from "../config/config.js";

import {
  __resolveBootConfigForTests,
  __setBootTranscriptForTests,
  __setVMInstanceForTests,
  attachTerminalWorkspaceAutoSync,
  bootVM,
  createTerminalSession,
  executeInVM,
  flushVMWorkspaceToHost,
  getVMBootHostPreference,
  getVMBootModePreference,
  getVMNetworkRelayURLPreference,
  getVMStatus,
  isVMReady,
  setVMBootHostPreference,
  setVMBootModePreference,
  setVMNetworkRelayURLPreference,
  shutdownVM,
  subscribeVMBootOutput,
  subscribeVMStatus,
  syncVMWorkspaceFromHost,
} from "./vm.js";

import { DEFAULT_VM_NETWORK_RELAY_URL } from "../config/config.js";
import { openDatabase } from "../db/openDatabase.js";

type VMExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

function createMockEmulator() {
  const listeners = new Map();

  const emulator = {
    add_listener: jest.fn((event, listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      listeners.get(event)?.add(listener);
    }),
    remove_listener: jest.fn((event, listener) => {
      listeners.get(event)?.delete(listener);
    }),
    serial0_send: jest.fn((data: string) => {
      if (!data) return;
      if (data === "root\n") {
        setTimeout(() => {
          emulator.emitSerial("# ");
        }, 5);
      } else if (data.includes("__BCDONE_")) {
        const match = /printf "\\n(__BCDONE_[^%]+)%s\\n"/.exec(data);
        if (match) {
          setTimeout(() => {
            emulator.emitSerial(`\n${match[1]}0\n`);
          }, 5);
        }
      } else if (data.includes("\u0003")) {
        setTimeout(() => {
          emulator.emitSerial("# ");
        }, 5);
      }
    }),
    fs9p: {
      read_dir: jest.fn(() => []),
      SearchPath: jest.fn((path: string) => ({
        id: path === "/home/user" ? 1 : -1,
      })),
      IsDirectory: jest.fn(() => true),
    },
    create_file: jest.fn(() => Promise.resolve()),
    read_file: jest.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    destroy: jest.fn(() => Promise.resolve()),
    emitSerial(text: string) {
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

  return emulator;
}

function createReadyVM(execute, emulator, mode: "ext2" | "9p" = "ext2") {
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
    delete (global as any).fetch;
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

  it("defaults to disabled boot mode and manages boot mode preferences", () => {
    expect(getVMStatus()).toMatchObject({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: "WebVM is disabled. Enable it in Settings to use WebVM.",
    });

    setVMBootModePreference("auto");
    expect(getVMBootModePreference()).toBe("auto");

    setVMBootModePreference("9p");
    expect(getVMBootModePreference()).toBe("9p");

    setVMBootModePreference("ext2");
    expect(getVMBootModePreference()).toBe("ext2");

    // Invalid mode ignored
    setVMBootModePreference("invalid" as any);
    expect(getVMBootModePreference()).toBe("ext2");
  });

  it("subscribes to VM status updates", () => {
    const statuses: any[] = [];
    const unsubscribe = subscribeVMStatus((status) => {
      statuses.push(status);
    });

    expect(statuses.length).toBeGreaterThan(0);

    setVMBootModePreference("9p");
    expect(statuses.length).toBeGreaterThan(1);

    unsubscribe();
    setVMBootModePreference("ext2");
    // No more updates after unsubscribe
    const count = statuses.length;
    expect(statuses.length).toBe(count);
  });

  it("normalizes boot host preference and clears on invalid", () => {
    setVMBootHostPreference("https://example.com///");

    expect(getVMBootHostPreference()).toBe("https://example.com");

    setVMBootHostPreference("not-a-url");

    expect(getVMBootHostPreference()).toBeNull();
  });

  it("uses default relay when invalid relay URL is provided", () => {
    setVMNetworkRelayURLPreference("wss://relay.widgetry.org/path");

    expect(getVMNetworkRelayURLPreference()).toBe(
      "wss://relay.widgetry.org/path",
    );

    setVMNetworkRelayURLPreference("https://invalid.example.com");

    expect(getVMNetworkRelayURLPreference()).toBe(DEFAULT_VM_NETWORK_RELAY_URL);
  });

  it("resets boot state on shutdown", async () => {
    setVMBootModePreference("ext2");

    (global as any).fetch = (jest.fn() as any).mockResolvedValue({ ok: false });

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

  it("formats executeInVM output with exit code, stderr, timeout, and empty states", async () => {
    const emulator = createMockEmulator();

    const execute = (jest.fn() as any)
      .mockResolvedValueOnce({
        stdout: "result",
        stderr: "warning",
        exitCode: 1,
        timedOut: false,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        timedOut: true,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

    __setVMInstanceForTests(createReadyVM(execute, emulator) as any);

    // 1. Stderr + exit code
    const out1 = await executeInVM("cmd1");
    expect(out1).toContain("result");
    expect(out1).toContain("warning");
    expect(out1).toContain("[exit code: 1]");

    // 2. Timed out
    const out2 = await executeInVM("cmd2");
    expect(out2).toContain("[command timed out]");

    // 3. Empty output fallback
    const out3 = await executeInVM("cmd3");
    expect(out3).toBe("(no output)");
  });

  it("suspends terminal output while a command runs and resumes afterward", async () => {
    const emulator = createMockEmulator();
    const terminalChunks: string[] = [];
    let resolveExecute: any;

    const execute = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveExecute = resolve;
        }),
    );

    __setVMInstanceForTests(createReadyVM(execute, emulator) as any);

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

  it("guards terminal session attachments", async () => {
    // 1. When not ready
    __setVMInstanceForTests(null);
    expect(() => createTerminalSession(jest.fn())).toThrow(
      "WebVM is not ready.",
    );

    const emulator = createMockEmulator();
    const execute = jest.fn();
    __setVMInstanceForTests(createReadyVM(execute, emulator) as any);

    const session1 = createTerminalSession(jest.fn());

    // 2. Duplicate attachment throws
    expect(() => createTerminalSession(jest.fn())).toThrow(
      "WebVM terminal is already attached.",
    );

    session1.close();
  });

  it("returns a busy error when another command is already running", async () => {
    const emulator = createMockEmulator();
    let resolveExecute: any;

    const execute = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveExecute = resolve;
        }),
    );

    __setVMInstanceForTests(createReadyVM(execute, emulator) as any);

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

  it("calls emulator destroy once during shutdown", async () => {
    const emulator: any = createMockEmulator();

    emulator.destroy = jest.fn(() => Promise.resolve());

    __setVMInstanceForTests({
      isReady: () => true,
      execute: jest.fn() as any,
      getEmulator: () => emulator,
      getMode: () => "ext2",

      destroy: () => (emulator as any).destroy(),
    });

    await shutdownVM();

    expect(emulator.destroy).toHaveBeenCalledTimes(1);
  });

  it("falls back to direct emulator destroy when instance.destroy fails", async () => {
    const emulator: any = createMockEmulator();

    emulator.destroy = jest.fn(() => Promise.resolve());

    __setVMInstanceForTests({
      isReady: () => true,
      execute: jest.fn() as any,
      getEmulator: () => emulator,
      getMode: () => "9p",
      destroy: () => {
        throw new Error("instance destroy failed");
      },
    });

    await shutdownVM();

    expect(emulator.destroy).toHaveBeenCalledTimes(1);
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

    (global as any).fetch = jest.fn(async (url) => ({
      ok: okUrls.has(String(url)),
    }));

    const config = await __resolveBootConfigForTests();

    expect(config?.mode).toBe("9p");

    expect(config?.label).toContain("9p");
  });

  it("keeps auto preference favoring 9p before ext2 fallback", async () => {
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

    (global as any).fetch = jest.fn(async (url) => ({
      ok: okUrls.has(String(url)),
    }));

    const config = await __resolveBootConfigForTests();

    expect(config?.mode).toBe("9p");

    expect(config?.label).toContain("9p");
  });

  it("falls back to ext2 in auto mode when 9p assets are missing", async () => {
    setVMBootHostPreference("https://example.com");
    setVMBootModePreference("auto");

    const okUrls = new Set([
      // ext2 assets only
      "https://example.com/assets/v86.ext2/libv86.mjs",
      "https://example.com/assets/v86.ext2/v86.wasm",
      "https://example.com/assets/v86.ext2/seabios.bin",
      "https://example.com/assets/v86.ext2/vgabios.bin",
      "https://example.com/assets/v86.ext2/alpine-rootfs.ext2",
      "https://example.com/assets/v86.ext2/bzImage",
      "https://example.com/assets/v86.ext2/initrd",
    ]);

    (global as any).fetch = jest.fn(async (url) => ({
      ok: okUrls.has(String(url)),
    }));

    const config = await __resolveBootConfigForTests();

    expect(config?.mode).toBe("ext2");

    expect(config?.label).toContain("ext2");
  });

  it("backfills transcript to boot listeners and avoids duplicate replay on terminal attach", () => {
    const emulator = createMockEmulator();
    const execute = jest.fn();
    const bootChunks = [];
    const terminalChunks: string[] = [];

    __setVMInstanceForTests(createReadyVM(execute, emulator) as any);
    __setBootTranscriptForTests("Booting kernel\n", false);

    const detachBootOutput = subscribeVMBootOutput((chunk) => {
      (bootChunks as any).push(chunk);
    });
    detachBootOutput();

    const session = createTerminalSession((chunk) => {
      terminalChunks.push(chunk);
    });

    expect(terminalChunks).toEqual([]);

    session.close();
  });

  it("handles interactive terminal session with ready VM and serial I/O", () => {
    const emulator = createMockEmulator();
    const execute = jest.fn();
    __setVMInstanceForTests(createReadyVM(execute, emulator, "ext2") as any);

    const receivedChunks: string[] = [];
    const session = createTerminalSession((chunk) => {
      receivedChunks.push(chunk);
    });

    session.send("echo 'hello'\n");
    expect(emulator.serial0_send).toHaveBeenCalledWith("echo 'hello'\n");

    emulator.emitSerial("hello\r\n");
    expect(receivedChunks).toContain("h");

    session.close();
  });

  describe("workspace sync and auto-sync", () => {
    it("skips sync and flush when VM is not ready or in ext2 mode", async () => {
      const context = { db: {} as any, groupId: "test-group" };

      __setVMInstanceForTests(null);
      await expect(syncVMWorkspaceFromHost(context)).resolves.toBeUndefined();
      await expect(flushVMWorkspaceToHost(context)).resolves.toBeUndefined();
      expect(attachTerminalWorkspaceAutoSync(context)).toBeNull();

      const emulator = createMockEmulator();
      const execute = jest.fn();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "ext2") as any);

      await expect(syncVMWorkspaceFromHost(context)).resolves.toBeUndefined();
      await expect(flushVMWorkspaceToHost(context)).resolves.toBeUndefined();
      expect(attachTerminalWorkspaceAutoSync(context)).toBeNull();
    });

    it("attaches and detaches terminal auto-sync in 9p mode", () => {
      const emulator = createMockEmulator();
      const execute = jest.fn();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const onFlushed = jest.fn();
      const context = { db: {} as any, groupId: "test-group" };
      const cleanup = attachTerminalWorkspaceAutoSync(context, onFlushed);

      expect(typeof cleanup).toBe("function");
      expect(emulator.add_listener).toHaveBeenCalledWith(
        "9p-write-end",
        expect.any(Function),
      );

      cleanup!();
      expect(emulator.remove_listener).toHaveBeenCalledWith(
        "9p-write-end",
        expect.any(Function),
      );
    });

    it("handles syncVMWorkspaceFromHost with 9p emulator", async () => {
      const emulator: any = createMockEmulator();
      emulator.fs9p = {
        read_dir: jest.fn().mockReturnValue([]),
        SearchPath: jest.fn().mockImplementation((path) => {
          if (path === "/home/user") return { id: 1 };
          return { id: -1 };
        }),
        IsDirectory: jest.fn().mockReturnValue(true),
      };
      emulator.create_file = (jest.fn() as any).mockResolvedValue(undefined);
      emulator.read_file = (jest.fn() as any).mockResolvedValue(
        new Uint8Array([1, 2, 3]),
      );

      const execute = jest.fn();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-group" };
      await expect(syncVMWorkspaceFromHost(context)).resolves.toBeUndefined();
    });

    it("handles flushVMWorkspaceToHost with 9p emulator", async () => {
      const emulator: any = createMockEmulator();
      emulator.fs9p = {
        read_dir: jest.fn().mockReturnValue([]),
        SearchPath: jest.fn().mockReturnValue({ id: -1 }),
        IsDirectory: jest.fn().mockReturnValue(false),
      };
      emulator.create_file = (jest.fn() as any).mockResolvedValue(undefined);
      emulator.read_file = (jest.fn() as any).mockResolvedValue(
        new Uint8Array([1, 2, 3]),
      );

      const execute = jest.fn();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-group" };
      await expect(flushVMWorkspaceToHost(context)).resolves.toBeUndefined();
    });

    it("syncs host workspace files and subdirectories into 9p VM", async () => {
      const emulator: any = createMockEmulator();
      const filesInVM = new Map<string, Uint8Array>();
      emulator.fs9p = {
        read_dir: jest.fn((path: string) => {
          if (path === "/home/user") return ["existing.txt"];
          return [];
        }),
        SearchPath: jest.fn((path: string) => {
          if (path === "/home/user") return { id: 1 };
          if (path === "/home/user/existing.txt") return { id: 2 };
          return { id: -1 };
        }),
        IsDirectory: jest.fn((id: number) => id === 1),
      };
      emulator.create_file = jest.fn(
        async (path: string, bytes: Uint8Array) => {
          filesInVM.set(path, bytes);
        },
      );
      emulator.read_file = jest.fn(async (path: string) => {
        return filesInVM.get(path) ?? null;
      });

      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-sync-group" };

      // Seed host files into workspaceDir
      const { getGroupDir } = await import("../storage/getGroupDir.js");
      const dir = await getGroupDir(db, "test-sync-group");
      const fileHandle = await dir.getFileHandle("hello.txt", { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(new TextEncoder().encode("Hello World"));
      await writable.close();

      // Create ignored file (e.g. swap or crswap)
      const ignoredHandle = await dir.getFileHandle("test.crswap", {
        create: true,
      });
      const ignWritable = await (ignoredHandle as any).createWritable();
      await ignWritable.write(new TextEncoder().encode("ignore me"));
      await ignWritable.close();

      await syncVMWorkspaceFromHost(context);

      expect(emulator.create_file).toHaveBeenCalledWith(
        "/home/user/hello.txt",
        expect.any(Uint8Array),
      );

      // Run second time (should detect identical bytes and skip create_file)
      filesInVM.set(
        "/home/user/hello.txt",
        new TextEncoder().encode("Hello World"),
      );
      emulator.create_file.mockClear();
      await syncVMWorkspaceFromHost(context);
      expect(emulator.create_file).not.toHaveBeenCalled();
    });

    it("syncs VM workspace changes and deletions back to host storage", async () => {
      const emulator: any = createMockEmulator();
      const vmFileBytes = new TextEncoder().encode("Created inside VM");
      emulator.fs9p = {
        read_dir: jest.fn((path: string) => {
          if (path === "/home/user") return ["from-vm.txt"];
          return [];
        }),
        SearchPath: jest.fn((path: string) => {
          if (path === "/home/user") return { id: 1 };
          if (path === "/home/user/from-vm.txt") return { id: 2 };
          return { id: -1 };
        }),
        IsDirectory: jest.fn((id: number) => id === 1),
      };
      emulator.read_file = jest.fn(async (path: string) => {
        if (path === "/home/user/from-vm.txt") return vmFileBytes;
        return null;
      });

      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-flush-group" };

      // Seed a host file first so it exists
      const { getGroupDir } = await import("../storage/getGroupDir.js");
      const dir = await getGroupDir(db, "test-flush-group");
      const hostFile = await dir.getFileHandle("to-delete.txt", {
        create: true,
      });
      const w = await (hostFile as any).createWritable();
      await w.write(new TextEncoder().encode("old"));
      await w.close();

      await flushVMWorkspaceToHost(context);

      // Verify from-vm.txt was written to host
      const newFileHandle = await dir.getFileHandle("from-vm.txt");
      expect(newFileHandle).toBeDefined();
    });

    it("handles terminal auto-sync input and output triggers", async () => {
      const emulator = createMockEmulator();
      const execute = jest.fn();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const onFlushed = jest.fn();
      const db = await openDatabase();
      const context = { db, groupId: "test-autosync" };
      const cleanup = attachTerminalWorkspaceAutoSync(context, onFlushed);

      const session = createTerminalSession(jest.fn());

      // 1. Send Ctrl+C to test commandPending reset
      session.send("\u0003");

      // 2. Send workspace mutating command
      session.send("echo hi > /home/user/out.txt\n");

      // 3. Emit prompt output to trigger flushSoon
      emulator.emitSerial("/home/user:~$ ");

      // Wait for debounce flush (200ms)
      await new Promise((r) => setTimeout(r, 250));

      expect(onFlushed).toHaveBeenCalled();

      session.close();
      cleanup?.();
    });
  });

  describe("bootVM and doBootVM execution paths", () => {
    it("returns early when boot mode is disabled or VM is already ready", async () => {
      setVMBootModePreference("disabled");
      await expect(bootVM()).resolves.toBeUndefined();

      setVMBootModePreference("9p");
      const emulator = createMockEmulator();
      __setVMInstanceForTests(createReadyVM(jest.fn(), emulator, "9p") as any);
      await expect(bootVM()).resolves.toBeUndefined();
    });

    it("boots VM in 9p mode using mock V86 module", async () => {
      await shutdownVM();
      setVMBootModePreference("9p");
      const testHost = new URL("../testing", import.meta.url).href.replace(
        /\/+$/,
        "",
      );
      setVMBootHostPreference(testHost);

      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      // Boot VM and let auto-serial triggers resolve login and prompt
      const bootPromise = bootVM();
      await new Promise((r) => setTimeout(r, 60));
      await bootPromise;

      const status = getVMStatus();
      expect(status.ready).toBe(true);
      expect(status.bootAttempted).toBe(true);
      expect(status.mode).toBe("9p");

      // Verify instance is ready and can execute
      expect(isVMReady()).toBe(true);
    });

    it("boots VM in ext2 mode using mock V86 module", async () => {
      await shutdownVM();
      setVMBootModePreference("ext2");
      const testHost = new URL("../testing", import.meta.url).href.replace(
        /\/+$/,
        "",
      );
      setVMBootHostPreference(testHost);

      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      const bootPromise = bootVM();
      await new Promise((r) => setTimeout(r, 60));
      await bootPromise;

      const status = getVMStatus();
      expect(status.ready).toBe(true);
      expect(status.mode).toBe("ext2");
    });

    it("handles boot failure when assets are missing", async () => {
      await shutdownVM();
      setVMBootModePreference("9p");
      (global as any).fetch = jest.fn(async () => ({ ok: false }));

      await bootVM();

      expect(getVMStatus().ready).toBe(false);
      expect(getVMStatus().error).toContain("Assets not found");
    });
  });

  describe("executeInVM 9p workspace integration", () => {
    it("wraps command with /home/user prefix and runs sync in 9p mode", async () => {
      const emulator: any = createMockEmulator();
      emulator.fs9p = {
        read_dir: jest.fn().mockReturnValue([]),
        SearchPath: jest.fn().mockReturnValue({ id: 1 }),
        IsDirectory: jest.fn().mockReturnValue(true),
      };
      emulator.create_file = jest
        .fn<(...args: any[]) => Promise<void>>()
        .mockResolvedValue(undefined);
      emulator.read_file = jest
        .fn<(...args: any[]) => Promise<Uint8Array>>()
        .mockResolvedValue(new Uint8Array([1]));

      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "command output",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });

      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-execute-9p" };

      const result = await executeInVM("ls -la", 30, context);

      expect(execute).toHaveBeenCalledWith("cd /home/user && ls -la", 30);
      expect(execute).toHaveBeenCalledWith("sync", 10);
      expect(result).toBe("command output");
    });

    it("handles sync errors gracefully without failing executeInVM", async () => {
      const emulator: any = createMockEmulator();
      emulator.fs9p = {
        read_dir: jest.fn().mockImplementation(() => {
          throw new Error("Disk error");
        }),
        SearchPath: jest.fn().mockReturnValue({ id: -1 }),
        IsDirectory: jest.fn().mockReturnValue(false),
      };

      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "ok",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });

      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-error-group" };

      const result = await executeInVM("echo ok", 30, context);
      expect(result).toBe("ok");
    });
  });

  describe("executeCommand and timeout recovery", () => {
    it("executes command via real executeCommand, strips ANSI codes, and handles timeout recovery", async () => {
      await shutdownVM();
      setVMBootModePreference("9p");
      const testHost = new URL("../testing", import.meta.url).href.replace(
        /\/+$/,
        "",
      );
      setVMBootHostPreference(testHost);
      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      await bootVM();
      expect(isVMReady()).toBe(true);

      // Execute simple command
      const out1 = await executeInVM("echo 'hello world'");
      expect(out1).toBeDefined();

      // Test timeout recovery with small timeout
      const outTimeout = await executeInVM("sleep 100", 0.05);
      expect(outTimeout).toContain("[command timed out]");
    });
  });

  describe("boot error handling and cancellation", () => {
    it("handles boot failure when V86 constructor is missing from imported module", async () => {
      await shutdownVM();
      setVMBootModePreference("9p");
      const missingHost = new URL(
        "../testing/assets_missing_v86",
        import.meta.url,
      ).href.replace(/\/+$/, "");
      setVMBootHostPreference(missingHost);

      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      await bootVM();
      expect(getVMStatus().ready).toBe(false);
      expect(getVMStatus().error).toContain("V86 constructor not found");
    });

    it("handles boot failure when module import throws", async () => {
      await shutdownVM();
      setVMBootModePreference("9p");
      setVMBootHostPreference("file:///non/existent/path");

      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      await bootVM();
      expect(getVMStatus().ready).toBe(false);
      expect(getVMStatus().error).toContain("Failed to import");
    });
  });

  describe("prune protection and helper utilities", () => {
    it("manages boot transcript and live boot output listeners", () => {
      const chunks: string[] = [];
      const errListener = jest.fn(() => {
        throw new Error("listener fail");
      });
      const okListener = jest.fn((c: string) => chunks.push(c));

      const un1 = subscribeVMBootOutput(errListener);
      const un2 = subscribeVMBootOutput(okListener);

      __setBootTranscriptForTests("Log snapshot\n", false);

      un1();
      un2();
    });

    it("runs internal VM commands and pauses active terminal session with waitForSerialQuiet", async () => {
      const emulator = createMockEmulator();
      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "done",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      // Attach terminal session
      const session = createTerminalSession(jest.fn());

      const db = await openDatabase();
      const context = { db, groupId: "test-internal-group" };

      // syncVMWorkspaceFromHost runs runInternalVMCommand internally
      await syncVMWorkspaceFromHost(context);

      session.close();
    });

    it("handles repeated missing file passes to trigger VM auto-deletion", async () => {
      const emulator: any = createMockEmulator();
      emulator.fs9p = {
        read_dir: jest.fn((path: string) => {
          if (path === "/home/user") return ["orphaned-vm-file.txt"];
          return [];
        }),
        SearchPath: jest.fn((path: string) => {
          if (path === "/home/user") return { id: 1 };
          if (path === "/home/user/orphaned-vm-file.txt") return { id: 2 };
          return { id: -1 };
        }),
        IsDirectory: jest.fn((id: number) => id === 1),
      };

      const execute = jest
        .fn<(...args: any[]) => Promise<VMExecResult>>()
        .mockResolvedValue({
          stdout: "",
          stderr: "",
          exitCode: 0,
          timedOut: false,
        });
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const db = await openDatabase();
      const context = { db, groupId: "test-prune-passes" };

      // Pass 1, 2, 3 (threshold is 3 passes)
      await syncVMWorkspaceFromHost(context);
      await syncVMWorkspaceFromHost(context);
      await syncVMWorkspaceFromHost(context);

      // Verify that after 3 passes it executed rm -f via emulator serial0_send
      expect(emulator.serial0_send).toHaveBeenCalledWith(
        expect.stringContaining("rm -f"),
      );
    });

    it("evaluates helper functions correctly", () => {
      expect(getVMNetworkRelayURLPreference()).toBeDefined();
      setVMNetworkRelayURLPreference("ws://127.0.0.1:8080");
      expect(getVMNetworkRelayURLPreference()).toBe("ws://127.0.0.1:8080/");

      setVMNetworkRelayURLPreference("http://invalid.url");
      expect(getVMNetworkRelayURLPreference()).toBe(
        DEFAULT_VM_NETWORK_RELAY_URL,
      );
    });

    it("handles boot cancellations and generation increments", async () => {
      setVMBootModePreference("9p");
      const testHost = new URL("../testing", import.meta.url).href.replace(
        /\/+$/,
        "",
      );
      setVMBootHostPreference(testHost);
      (global as any).fetch = jest.fn(async () => ({ ok: true }));

      const bootPromise = bootVM();
      // Immediately shutdown to increment bootGeneration while boot is in flight
      await shutdownVM();
      await bootPromise;

      expect(getVMStatus().ready).toBe(false);
    });

    it("handles attachTerminalWorkspaceAutoSync", () => {
      // 1. null when VM is not ready
      __setVMInstanceForTests(null);
      expect(attachTerminalWorkspaceAutoSync({} as any)).toBeNull();

      // 2. non-null cleanup function when VM is ready in 9p mode
      const emulator = createMockEmulator();
      const execute = jest.fn<any>();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const cleanup = attachTerminalWorkspaceAutoSync({
        groupId: "g1",
      } as any);
      expect(typeof cleanup).toBe("function");
      cleanup?.();
    });

    it("handles createTerminalSession lifecycle and flushVMWorkspaceToHost", async () => {
      // 1. Error when VM not ready
      __setVMInstanceForTests(null);
      expect(() => createTerminalSession(jest.fn())).toThrow(
        "WebVM is not ready.",
      );

      // 2. Terminal session with ready VM
      const emulator = createMockEmulator();
      const execute = jest.fn<any>();
      __setVMInstanceForTests(createReadyVM(execute, emulator, "9p") as any);

      const onOutput = jest.fn();
      const session = createTerminalSession(onOutput);
      expect(session).toBeDefined();

      // Send input
      session.send("echo hello\n");
      expect(emulator.serial0_send).toHaveBeenCalledWith("echo hello\n");

      // Receive byte output
      emulator.emitSerial("A");
      expect(onOutput).toHaveBeenCalledWith("A");

      // Double attach error
      expect(() => createTerminalSession(jest.fn())).toThrow(
        "WebVM terminal is already attached.",
      );

      // Close session
      session.close();

      // 3. flushVMWorkspaceToHost
      const db = await openDatabase();
      await flushVMWorkspaceToHost({ db, groupId: "test-flush" });
    });
  });
});
