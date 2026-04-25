import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();

jest.unstable_mockModule("./storage/getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./storage/storage.js", () => ({
  getStorageRoot: (jest.fn() as any).mockResolvedValue({ name: "mock-root" }),
  getStorageStatus: jest.fn(() => ({
    type: "opfs",
    permission: "granted",
  })),
}));

const {
  __setVMInstanceForTests,
  attachTerminalWorkspaceAutoSync,
  createTerminalSession,
  executeInVM,
  shutdownVM,
} = await import("./vm.js");

function asciiBytes(text) {
  return new Uint8Array(Array.from(text, (ch: any) => ch.charCodeAt(0)));
}

function createWorkspaceDir(initialFiles = {}) {
  const root: any = {
    kind: "directory",
    entries: new Map(),
  };

  const getNode = (path, create = false) => {
    const parts = path.split("/").filter(Boolean);

    let current: any = root;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLeaf = index === parts.length - 1;

      if (current.kind !== "directory") {
        const err = new Error("NotFoundError");

        err.name = "NotFoundError";

        throw err;
      }

      const existing = current.entries.get(part);
      if (!existing) {
        if (!create) {
          const err = new Error("NotFoundError");

          err.name = "NotFoundError";

          throw err;
        }

        const node: any = isLeaf
          ? { kind: "file", bytes: new Uint8Array() }
          : { kind: "directory", entries: new Map() };

        current.entries.set(part, node);

        current = node;

        continue;
      }

      current = existing;
    }

    return current;
  };

  const createDirectoryHandle = (dirNode: any & { kind: "directory" }) => ({
    kind: "directory",
    async getDirectoryHandle(name, opts: any = {}) {
      const existing = (dirNode as any).entries.get(name);
      if (existing) {
        if (existing.kind !== "directory") {
          throw new Error("Not a directory");
        }

        return createDirectoryHandle(existing);
      }

      if (!opts.create) {
        const err = new Error("NotFoundError");

        err.name = "NotFoundError";

        throw err;
      }

      const created: any = { kind: "directory", entries: new Map() };
      (dirNode as any).entries.set(name, created);

      return createDirectoryHandle(created);
    },
    async getFileHandle(name, opts: any = {}) {
      const existing = (dirNode as any).entries.get(name);
      if (existing) {
        if (existing.kind !== "file") {
          throw new Error("Not a file");
        }

        return createFileHandle(existing);
      }

      if (!opts.create) {
        const err = new Error("NotFoundError");

        err.name = "NotFoundError";

        throw err;
      }

      const created: any = { kind: "file", bytes: new Uint8Array() };
      (dirNode as any).entries.set(name, created);

      return createFileHandle(created);
    },
    async removeEntry(name) {
      if (!(dirNode as any).entries.has(name)) {
        const err = new Error("NotFoundError");

        err.name = "NotFoundError";

        throw err;
      }

      (dirNode as any).entries.delete(name);
    },
    async *entries() {
      for (const [name, node] of (dirNode as any).entries.entries()) {
        if (node.kind === "directory") {
          yield [name, createDirectoryHandle(node)];
        } else {
          yield [name, createFileHandle(node)];
        }
      }
    },
    hasFile(path) {
      try {
        const node = getNode(path, false);

        return node.kind === "file";
      } catch {
        return false;
      }
    },
  });

  const createFileHandle = (fileNode: any & { kind: "file" }) => ({
    kind: "file",
    async getFile() {
      return {
        async arrayBuffer() {
          return fileNode.bytes.slice().buffer;
        },
      };
    },
    async createWritable() {
      return {
        async write(bytes) {
          fileNode.bytes =
            bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        },
        async close() {
          return undefined;
        },
      };
    },
  });

  for (const [path, value] of Object.entries(initialFiles)) {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) {
      continue;
    }

    let dir: any = root;
    for (const part of parts) {
      let next = dir.entries.get(part);
      if (!next) {
        next = { kind: "directory", entries: new Map() };
        dir.entries.set(part, next);
      }

      if (next.kind !== "directory") {
        throw new Error(`Invalid initial path: ${path}`);
      }

      dir = next;
    }

    const bytes = typeof value === "string" ? asciiBytes(value) : value;

    dir.entries.set(fileName, { kind: "file", bytes });
  }

  return createDirectoryHandle(root);
}

/**
 * Creates a mock 9P emulator for testing.
 */
function createNinePEmulator(
  vmFiles: Map<string, Uint8Array>,
  opts: { lagCreateWrites?: boolean } = {},
) {
  const rootId = 1;
  /* @type Map<string, Set<(value: any) => void>> */
  const listeners = new Map();

  return {
    add_listener(event, listener) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }

      listeners.get(event)?.add(listener);
    },
    remove_listener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    serial0_send: jest.fn(),
    emit(event, value) {
      const eventListeners = listeners.get(event);
      if (!eventListeners) {
        return;
      }

      for (const listener of eventListeners) {
        listener(value);
      }
    },
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
    fs9p: {
      read_dir(path) {
        if (path !== "/home/user") {
          return [];
        }

        return Array.from(vmFiles.keys()).map((key: any) => key.split("/")[0]);
      },
      SearchPath(path) {
        if (path === "/home/user") {
          return { id: rootId };
        }

        const rel = path.replace(/^\/home\/user\//, "");
        if (vmFiles.has(rel)) {
          return { id: rootId + 1 };
        }

        return { id: -1 };
      },
      IsDirectory(id) {
        return id === rootId;
      },
    },
    async read_file(path) {
      const rel = path.replace(/^\/home\/user\//, "");

      return vmFiles.get(rel) ?? null;
    },
    async create_file(path, bytes) {
      if ((opts as any).lagCreateWrites) {
        return;
      }

      const rel = path.replace(/^\/home\/user\//, "");
      vmFiles.set(
        rel,
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      );
    },
  };
}

describe("vm 9p workspace sync", () => {
  afterEach(async () => {
    mockGetGroupDir.mockReset();
    await shutdownVM();
  });

  it("does not delete a host-only file when VM snapshot is stale right after host seed", async () => {
    const workspaceDir = createWorkspaceDir({ foo: new Uint8Array() });

    (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

    const vmFiles = new Map();
    const emulator = createNinePEmulator(vmFiles, { lagCreateWrites: true });

    const execute = (jest.fn() as any).mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });

    __setVMInstanceForTests({
      isReady: () => true,
      execute,
      getEmulator: () => emulator,
      getMode: () => "9p",
      destroy: jest.fn() as any,
    });

    await executeInVM("clear", 30, {
      db: {} as any,
      groupId: "g1",
    });

    expect(workspaceDir.hasFile("foo")).toBe(true);
  });

  it("still mirrors explicit VM-side file deletions to host", async () => {
    const hostBytes = new Uint8Array([104, 101, 108, 108, 111]);
    const workspaceDir = createWorkspaceDir({ bar: hostBytes });

    (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

    const vmFiles = new Map([["bar", hostBytes]]);
    const emulator = createNinePEmulator(vmFiles);

    const execute = jest.fn(async (command: any) => {
      if (command.includes("rm bar")) {
        vmFiles.delete("bar");
      }

      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      };
    });

    __setVMInstanceForTests({
      isReady: () => true,
      execute,
      getEmulator: () => emulator,
      getMode: () => "9p",
      destroy: jest.fn() as any,
    });

    await executeInVM("rm bar", 30, {
      db: {} as any,
      groupId: "g1",
    });

    expect(workspaceDir.hasFile("bar")).toBe(false);
  });

  it("flushes metadata-only terminal commands when the shell prompt returns", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: {} as any, groupId: "g1" },
        onFlushed,
      );
      const session = createTerminalSession(() => {});

      session.send("touch /home/user/O_O\n");
      vmFiles.set("O_O", new Uint8Array());
      emulator.emitSerial("touch /home/user/O_O\r\nlocalhost:/home/user# ");

      await jest.advanceTimersByTimeAsync(250);

      expect(workspaceDir.hasFile("O_O")).toBe(true);
      expect(onFlushed).toHaveBeenCalledTimes(1);

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not prune host-only files after terminal ls prompt flush", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir({ file: new Uint8Array() });

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator = createNinePEmulator(vmFiles);

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync({
        db: {} as any,
        groupId: "g1",
      });

      const session = createTerminalSession(() => {});

      session.send("ls -al\n");
      emulator.emitSerial("ls -al\r\nlocalhost:/home/user# ");

      await jest.advanceTimersByTimeAsync(250);

      expect(workspaceDir.hasFile("file")).toBe(true);

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });

  it("ignores idle 9p write-end events before any terminal command", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator: any = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: {} as any, groupId: "g1" },
        onFlushed,
      );

      // No command has been entered yet; background 9p writes should be ignored.

      emulator.emit("9p-write-end");

      emulator.emit("9p-write-end");

      await jest.advanceTimersByTimeAsync(250);

      expect(onFlushed).not.toHaveBeenCalled();

      detachAutoSync?.();
    } finally {
      jest.useRealTimers();
    }
  });

  it("treats no-space shell prompts as command completion", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator: any = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: {} as any, groupId: "g1" },
        onFlushed,
      );

      const session = createTerminalSession(() => {});

      session.send("cat /home/user/foo/Testing\n");
      emulator.emitSerial("output\r\nlocalhost:~#");

      await jest.advanceTimersByTimeAsync(250);
      expect(onFlushed).toHaveBeenCalledTimes(1);

      // Subsequent idle writes should not retrigger flushes once command ended.

      emulator.emit("9p-write-end");

      emulator.emit("9p-write-end");

      await jest.advanceTimersByTimeAsync(250);
      expect(onFlushed).toHaveBeenCalledTimes(1);

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not flush non-workspace commands when prompt returns", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: {} as any, groupId: "g1" },
        onFlushed,
      );

      const session = createTerminalSession(() => {});

      session.send("npm -g root\n");
      emulator.emitSerial(
        "/usr/lib/node_modules\r\nlocalhost:/usr/local/lib# ",
      );

      await jest.advanceTimersByTimeAsync(250);

      expect(onFlushed).not.toHaveBeenCalled();

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });

  it("flushes relative commands when prompt indicates /home/user cwd", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();

      (mockGetGroupDir as any).mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn() as any,
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn() as any,
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: {} as any, groupId: "g1" },
        onFlushed,
      );

      const session = createTerminalSession(() => {});

      emulator.emitSerial("localhost:/home/user# ");

      session.send("touch file.txt\n");
      vmFiles.set("file.txt", new Uint8Array());
      emulator.emitSerial("localhost:/home/user# ");

      await jest.advanceTimersByTimeAsync(250);

      expect(onFlushed).toHaveBeenCalledTimes(1);
      expect(workspaceDir.hasFile("file.txt")).toBe(true);

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });
});
