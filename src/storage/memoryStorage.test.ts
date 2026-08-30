import {
  MemoryDirectoryHandle,
  MemoryFileHandle,
  MemorySyncAccessHandle,
  getMemoryOpfsRoot,
  isMemoryStorageFallbackActive,
  resetMemoryOpfsRoot,
} from "./memoryStorage.js";

describe("memoryStorage", () => {
  beforeEach(() => {
    resetMemoryOpfsRoot();
  });

  describe("MemoryFileHandle", () => {
    it("creates a file and reads/writes text data", async () => {
      const fileHandle = new MemoryFileHandle("test.txt");
      expect(fileHandle.kind).toBe("file");
      expect(fileHandle.name).toBe("test.txt");

      const writable = await fileHandle.createWritable();
      await writable.write("Hello World");
      await writable.close();

      const file = await fileHandle.getFile();
      expect(await file.text()).toBe("Hello World");
      expect(file.size).toBe(11);
    });

    it("writes binary chunks (Uint8Array / ArrayBuffer / Blob)", async () => {
      const fileHandle = new MemoryFileHandle("binary.dat");
      const writable = await fileHandle.createWritable();

      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5]).buffer;
      const chunk3 = new Blob(["67"]);

      await writable.write(chunk1);
      await writable.write(chunk2);
      await writable.write(chunk3);
      await writable.close();

      const file = await fileHandle.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5, 54, 55]);
    });

    it("supports structured write, seek, truncate operations", async () => {
      const fileHandle = new MemoryFileHandle("stream.txt");
      const writable = await fileHandle.createWritable();

      await writable.write("AAAA");
      await writable.write({ type: "seek", position: 1 });
      await writable.write("BB");
      await writable.close();

      const file = await fileHandle.getFile();
      expect(await file.text()).toBe("ABBA");

      const writable2 = await fileHandle.createWritable({
        keepExistingData: true,
      });
      await writable2.truncate(2);
      await writable2.close();

      const file2 = await fileHandle.getFile();
      expect(await file2.text()).toBe("AB");
    });

    it("supports MemorySyncAccessHandle read, write, truncate, getSize, flush and close", async () => {
      const fileHandle = new MemoryFileHandle("sync.dat");
      const syncHandle: MemorySyncAccessHandle =
        await fileHandle.createSyncAccessHandle();

      expect(syncHandle.getSize()).toBe(0);

      const writeData = new Uint8Array([10, 20, 30, 40]);
      const written = syncHandle.write(writeData, { at: 0 });
      expect(written).toBe(4);
      expect(syncHandle.getSize()).toBe(4);

      syncHandle.flush(); // No-op

      const readBuffer = new Uint8Array(4);
      const readBytes = syncHandle.read(readBuffer, { at: 0 });
      expect(readBytes).toBe(4);
      expect(Array.from(readBuffer)).toEqual([10, 20, 30, 40]);

      // Read past end
      const emptyBuffer = new Uint8Array(2);
      expect(syncHandle.read(emptyBuffer, { at: 100 })).toBe(0);

      // Truncate
      syncHandle.truncate(2);
      expect(syncHandle.getSize()).toBe(2);

      // Close and verify operations throw
      syncHandle.close();
      expect(() => syncHandle.getSize()).toThrow();
      expect(() => syncHandle.read(readBuffer)).toThrow();
      expect(() => syncHandle.write(writeData)).toThrow();
      expect(() => syncHandle.truncate(1)).toThrow();
    });

    it("handles permissions and equality", async () => {
      const fileHandle = new MemoryFileHandle("test.txt");
      expect(await fileHandle.queryPermission()).toBe("granted");
      expect(await fileHandle.requestPermission()).toBe("granted");
      expect(await fileHandle.isSameEntry(fileHandle)).toBe(true);
      expect(
        await fileHandle.isSameEntry(new MemoryFileHandle("test.txt")),
      ).toBe(false);
    });
  });

  describe("MemoryDirectoryHandle", () => {
    it("creates directories and files recursively", async () => {
      const dir = new MemoryDirectoryHandle("root");
      const subDir = await dir.getDirectoryHandle("sub", { create: true });
      expect(subDir.kind).toBe("directory");
      expect(subDir.name).toBe("sub");

      const file = await subDir.getFileHandle("file.txt", { create: true });
      expect(file.kind).toBe("file");
      expect(file.name).toBe("file.txt");

      const existingSub = await dir.getDirectoryHandle("sub");
      expect(existingSub).toBe(subDir);

      const existingFile = await subDir.getFileHandle("file.txt");
      expect(existingFile).toBe(file);
    });

    it("handles special directory names (. and ..)", async () => {
      const dir = new MemoryDirectoryHandle("root");
      const current = await dir.getDirectoryHandle(".");
      expect(current).toBe(dir);

      await expect(dir.getDirectoryHandle("..")).rejects.toThrow();
    });

    it("throws NotFoundError when entry does not exist and create is false", async () => {
      const dir = new MemoryDirectoryHandle("root");
      await expect(dir.getDirectoryHandle("missing")).rejects.toThrow();
      await expect(dir.getFileHandle("missing.txt")).rejects.toThrow();
    });

    it("throws TypeMismatchError when getting directory as file or vice versa", async () => {
      const dir = new MemoryDirectoryHandle("root");
      await dir.getDirectoryHandle("sub", { create: true });
      await dir.getFileHandle("file.txt", { create: true });

      await expect(dir.getFileHandle("sub")).rejects.toThrow();
      await expect(dir.getDirectoryHandle("file.txt")).rejects.toThrow();
    });

    it("resolves descendant handle paths", async () => {
      const root = new MemoryDirectoryHandle("root");
      const folderA = await root.getDirectoryHandle("folderA", {
        create: true,
      });
      const folderB = await folderA.getDirectoryHandle("folderB", {
        create: true,
      });
      const file = await folderB.getFileHandle("item.txt", { create: true });

      expect(await root.resolve(root)).toEqual([]);
      expect(await root.resolve(folderA)).toEqual(["folderA"]);
      expect(await root.resolve(file)).toEqual([
        "folderA",
        "folderB",
        "item.txt",
      ]);

      const unrelated = new MemoryFileHandle("unrelated.txt");
      expect(await root.resolve(unrelated)).toBeNull();
    });

    it("iterates entries, keys, and values", async () => {
      const dir = new MemoryDirectoryHandle("root");
      await dir.getDirectoryHandle("b_dir", { create: true });
      await dir.getFileHandle("a_file.txt", { create: true });

      const entries: string[] = [];
      for await (const [name, handle] of dir.entries()) {
        entries.push(`${name}:${handle.kind}`);
      }
      expect(entries).toEqual(["b_dir:directory", "a_file.txt:file"]);

      const keys: string[] = [];
      for await (const k of dir.keys()) {
        keys.push(k);
      }
      expect(keys).toEqual(["b_dir", "a_file.txt"]);

      const values: string[] = [];
      for await (const v of dir.values()) {
        values.push(v.name);
      }
      expect(values).toEqual(["b_dir", "a_file.txt"]);

      // async iterator fallback
      const directEntries: string[] = [];
      for await (const [name, handle] of dir) {
        directEntries.push(`${name}:${handle.kind}`);
      }
      expect(directEntries).toEqual(["b_dir:directory", "a_file.txt:file"]);
    });

    it("removes files and empty/recursive directories", async () => {
      const dir = new MemoryDirectoryHandle("root");
      const sub = await dir.getDirectoryHandle("sub", { create: true });
      await sub.getFileHandle("child.txt", { create: true });

      // Removing non-empty dir without recursive flag should throw
      await expect(
        dir.removeEntry("sub", { recursive: false }),
      ).rejects.toThrow();

      // Removing non-empty dir with recursive flag should succeed
      await dir.removeEntry("sub", { recursive: true });
      await expect(dir.getDirectoryHandle("sub")).rejects.toThrow();
    });
  });

  describe("getMemoryOpfsRoot & isMemoryStorageFallbackActive", () => {
    it("returns a singleton OPFS root child and reports fallback active", () => {
      expect(isMemoryStorageFallbackActive()).toBe(false);
      const root1 = getMemoryOpfsRoot();
      expect(isMemoryStorageFallbackActive()).toBe(true);

      const root2 = getMemoryOpfsRoot();
      expect(root1).toBe(root2);
      expect(root1.name).toBeTruthy();

      resetMemoryOpfsRoot();
      expect(isMemoryStorageFallbackActive()).toBe(false);
    });
  });
});
