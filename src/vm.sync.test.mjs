import { jest } from "@jest/globals";

const mockGetWorkspaceDir = jest.fn();

jest.unstable_mockModule("./storage/getWorkspaceDir.mjs", () => ({
  getWorkspaceDir: mockGetWorkspaceDir,
}));

const {
  __setVMInstanceForTests,
  attachTerminalWorkspaceAutoSync,
  createTerminalSession,
  executeInVM,
  shutdownVM,
} = await import("./vm.mjs");

/**
 * @param {string} text
 *
 * @returns {Uint8Array}
 */
function asciiBytes(text) {
  return new Uint8Array(Array.from(text, (ch) => ch.charCodeAt(0)));
}

/**
 * @typedef {{ kind: 'file', bytes: Uint8Array } | { kind: 'directory', entries: Map<string, FSNode> }} FSNode
 */

/**
 * @param {Record<string, Uint8Array|string>} initialFiles
 *
 * @returns {FileSystemDirectoryHandle & { hasFile: (path: string) => boolean }}
 */
function createWorkspaceDir(initialFiles = {}) {
  /** @type {FSNode} */
  const root = { kind: "directory", entries: new Map() };

  /**
   * @param {string} path
   * @param {boolean} create
   *
   * @returns {FSNode}
   */
  const getNode = (path, create = false) => {
    const parts = path.split("/").filter(Boolean);

    /** @type {FSNode} */
    let current = root;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const isLeaf = index === parts.length - 1;

      if (current.kind !== "directory") {
        const err = new Error("NotFoundError");
        // @ts-ignore
        err.name = "NotFoundError";
        throw err;
      }

      const existing = current.entries.get(part);
      if (!existing) {
        if (!create) {
          const err = new Error("NotFoundError");
          // @ts-ignore
          err.name = "NotFoundError";
          throw err;
        }

        const node = isLeaf
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

  /**
   * @param {string} name
   * @param {{ create?: boolean }} [opts]
   *
   * @returns {Promise<any>}
   */
  const getDirectoryHandle = async (name, opts = {}) => {
    const create = !!opts.create;
    let node;

    try {
      node = getNode(name, false);
    } catch (err) {
      if (!create) {
        throw err;
      }

      node = { kind: "directory", entries: new Map() };
      root.entries.set(name, node);
    }

    if (node.kind !== "directory") {
      throw new Error("Not a directory");
    }

    return createDirectoryHandle(node);
  };

  /**
   * @param {FSNode & { kind: 'directory' }} dirNode
   *
   * @returns {any}
   */
  const createDirectoryHandle = (dirNode) => ({
    kind: "directory",
    async getDirectoryHandle(name, opts = {}) {
      const existing = dirNode.entries.get(name);
      if (existing) {
        if (existing.kind !== "directory") {
          throw new Error("Not a directory");
        }

        return createDirectoryHandle(existing);
      }

      if (!opts.create) {
        const err = new Error("NotFoundError");
        // @ts-ignore
        err.name = "NotFoundError";
        throw err;
      }

      const created = { kind: "directory", entries: new Map() };
      dirNode.entries.set(name, created);
      return createDirectoryHandle(created);
    },
    async getFileHandle(name, opts = {}) {
      const existing = dirNode.entries.get(name);
      if (existing) {
        if (existing.kind !== "file") {
          throw new Error("Not a file");
        }

        return createFileHandle(existing);
      }

      if (!opts.create) {
        const err = new Error("NotFoundError");
        // @ts-ignore
        err.name = "NotFoundError";
        throw err;
      }

      const created = { kind: "file", bytes: new Uint8Array() };
      dirNode.entries.set(name, created);
      return createFileHandle(created);
    },
    async removeEntry(name) {
      if (!dirNode.entries.has(name)) {
        const err = new Error("NotFoundError");
        // @ts-ignore
        err.name = "NotFoundError";
        throw err;
      }

      dirNode.entries.delete(name);
    },
    async *entries() {
      for (const [name, node] of dirNode.entries.entries()) {
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

  /**
   * @param {FSNode & { kind: 'file' }} fileNode
   *
   * @returns {any}
   */
  const createFileHandle = (fileNode) => ({
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

    /** @type {FSNode & { kind: 'directory' }} */
    let dir = root;
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
 * @param {Map<string, Uint8Array>} vmFiles
 * @param {{ lagCreateWrites?: boolean }} [opts]
 *
 * @returns {any}
 */
function createNinePEmulator(vmFiles, opts = {}) {
  const rootId = 1;
  /** @type {Map<string, Set<(value: any) => void>>} */
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
        if (path !== "/workspace") {
          return [];
        }

        return Array.from(vmFiles.keys()).map((key) => key.split("/")[0]);
      },
      SearchPath(path) {
        if (path === "/workspace") {
          return { id: rootId };
        }

        const rel = path.replace(/^\/workspace\//, "");
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
      const rel = path.replace(/^\/workspace\//, "");
      return vmFiles.get(rel) ?? null;
    },
    async create_file(path, bytes) {
      if (opts.lagCreateWrites) {
        return;
      }

      const rel = path.replace(/^\/workspace\//, "");
      vmFiles.set(
        rel,
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      );
    },
  };
}

describe("vm 9p workspace sync", () => {
  afterEach(async () => {
    mockGetWorkspaceDir.mockReset();
    await shutdownVM();
  });

  it("does not delete a host-only file when VM snapshot is stale right after host seed", async () => {
    const workspaceDir = createWorkspaceDir({ foo: new Uint8Array() });
    mockGetWorkspaceDir.mockResolvedValue(workspaceDir);

    const vmFiles = new Map();
    const emulator = createNinePEmulator(vmFiles, { lagCreateWrites: true });

    const execute = jest.fn().mockResolvedValue({
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
      destroy: jest.fn(),
    });

    await executeInVM("clear", 30, {
      db: /** @type {any} */ ({}),
      groupId: "g1",
    });

    expect(workspaceDir.hasFile("foo")).toBe(true);
  });

  it("still mirrors explicit VM-side file deletions to host", async () => {
    const hostBytes = new Uint8Array([104, 101, 108, 108, 111]);
    const workspaceDir = createWorkspaceDir({ bar: hostBytes });
    mockGetWorkspaceDir.mockResolvedValue(workspaceDir);

    const vmFiles = new Map([["bar", hostBytes]]);
    const emulator = createNinePEmulator(vmFiles);

    const execute = jest.fn(async (command) => {
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
      destroy: jest.fn(),
    });

    await executeInVM("rm bar", 30, {
      db: /** @type {any} */ ({}),
      groupId: "g1",
    });

    expect(workspaceDir.hasFile("bar")).toBe(false);
  });

  it("flushes metadata-only terminal commands when the shell prompt returns", async () => {
    jest.useFakeTimers();

    try {
      const workspaceDir = createWorkspaceDir();
      mockGetWorkspaceDir.mockResolvedValue(workspaceDir);

      const vmFiles = new Map();
      const emulator = createNinePEmulator(vmFiles);
      const onFlushed = jest.fn();

      __setVMInstanceForTests({
        isReady: () => true,
        execute: jest.fn(),
        getEmulator: () => emulator,
        getMode: () => "9p",
        destroy: jest.fn(),
      });

      const detachAutoSync = attachTerminalWorkspaceAutoSync(
        { db: /** @type {any} */ ({}), groupId: "g1" },
        onFlushed,
      );
      const session = createTerminalSession(() => {});

      session.send("touch /workspace/O_O\n");
      vmFiles.set("O_O", new Uint8Array());
      emulator.emitSerial("touch /workspace/O_O\r\nlocalhost:/workspace# ");

      await jest.advanceTimersByTimeAsync(250);

      expect(workspaceDir.hasFile("O_O")).toBe(true);
      expect(onFlushed).toHaveBeenCalledTimes(1);

      detachAutoSync?.();
      session.close();
    } finally {
      jest.useRealTimers();
    }
  });
});
