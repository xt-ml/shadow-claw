import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * TDD tests for NodeFsDirectoryHandle — a FileSystemDirectoryHandle
 * implementation backed by node:fs.
 *
 * These tests verify that the adapter supports the subset of the
 * FileSystem API used by discoverSkills, loadDeclarativeTools,
 * readGroupFile, writeGroupFile, and getGroupDir.
 */
describe("NodeFsDirectoryHandle", () => {
  let tmpDir: string;
  let root: any; // NodeFsDirectoryHandle

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-nodefs-test-"));
    const { NodeFsDirectoryHandle } = await import("./node-fs-handle.js");
    root = new NodeFsDirectoryHandle(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── Directory operations ──────────────────────────────────────────────

  it("getDirectoryHandle creates a subdirectory with { create: true }", async () => {
    const child = await root.getDirectoryHandle("subdir", { create: true });
    expect(child).toBeDefined();
    expect(existsSync(path.join(tmpDir, "subdir"))).toBe(true);
  });

  it("getDirectoryHandle returns handle for existing directory", async () => {
    await mkdir(path.join(tmpDir, "existing"));
    const child = await root.getDirectoryHandle("existing");
    expect(child).toBeDefined();
  });

  it("getDirectoryHandle throws when directory does not exist and create is false", async () => {
    await expect(root.getDirectoryHandle("missing")).rejects.toThrow();
  });

  it("nested getDirectoryHandle creates nested directories", async () => {
    const a = await root.getDirectoryHandle("a", { create: true });
    const b = await a.getDirectoryHandle("b", { create: true });
    expect(b).toBeDefined();
    expect(existsSync(path.join(tmpDir, "a", "b"))).toBe(true);
  });

  // ── File operations ───────────────────────────────────────────────────

  it("getFileHandle creates a file with { create: true }", async () => {
    const fileHandle = await root.getFileHandle("test.txt", { create: true });
    expect(fileHandle).toBeDefined();
  });

  it("getFileHandle throws for missing file without create flag", async () => {
    await expect(root.getFileHandle("missing.txt")).rejects.toThrow();
  });

  it("getFileHandle throws TypeMismatchError when target is an existing directory", async () => {
    await root.getDirectoryHandle("somedir", { create: true });
    await expect(root.getFileHandle("somedir")).rejects.toThrow(
      /TypeMismatchError/i,
    );
  });

  it("getDirectoryHandle throws TypeMismatchError when target is an existing file", async () => {
    await root.getFileHandle("somefile.txt", { create: true });
    await expect(root.getDirectoryHandle("somefile.txt")).rejects.toThrow(
      /TypeMismatchError/i,
    );
  });

  it("createWritable writes content and getFile reads it back", async () => {
    const fh = await root.getFileHandle("hello.txt", { create: true });
    const writable = await fh.createWritable();
    await writable.write("Hello, world!");
    await writable.close();

    const file = await fh.getFile();
    const text = await file.text();
    expect(text).toBe("Hello, world!");
  });

  it("createWritable overwrites existing content", async () => {
    const fh = await root.getFileHandle("overwrite.txt", { create: true });
    const w1 = await fh.createWritable();
    await w1.write("original");
    await w1.close();
    const w2 = await fh.createWritable();
    await w2.write("replaced");
    await w2.close();
    const file = await fh.getFile();
    expect(await file.text()).toBe("replaced");
  });

  it("getFile returns a Blob/File with correct text content", async () => {
    const fh = await root.getFileHandle("read.txt", { create: true });
    const w = await fh.createWritable();
    await w.write("readable content");
    await w.close();
    const file = await fh.getFile();
    expect(await file.text()).toBe("readable content");
  });

  // ── entries() iteration ───────────────────────────────────────────────

  it("entries() yields [name, handle] pairs for children", async () => {
    await root.getFileHandle("file1.txt", { create: true });
    await root.getFileHandle("file2.txt", { create: true });
    await root.getDirectoryHandle("dir1", { create: true });

    const entries: [string, any][] = [];
    for await (const entry of root.entries()) {
      entries.push(entry as [string, any]);
    }
    const names = entries.map(([n]) => n).sort();
    expect(names).toEqual(["dir1", "file1.txt", "file2.txt"]);
  });

  it("entries() reports kind='directory' for subdirs and kind='file' for files", async () => {
    await root.getFileHandle("f.txt", { create: true });
    await root.getDirectoryHandle("d", { create: true });
    const kindMap: Record<string, string> = {};
    for await (const [name, handle] of root.entries()) {
      kindMap[name as string] = (handle as any).kind;
    }
    expect(kindMap["f.txt"]).toBe("file");
    expect(kindMap["d"]).toBe("directory");
  });

  it("entries() returns empty iterator for empty directory", async () => {
    const entries: any[] = [];
    for await (const entry of root.entries()) {
      entries.push(entry);
    }
    expect(entries).toHaveLength(0);
  });

  // ── removeEntry ───────────────────────────────────────────────────────

  it("removeEntry deletes a file", async () => {
    const fh = await root.getFileHandle("todelete.txt", { create: true });
    const w = await fh.createWritable();
    await w.write("bye");
    await w.close();
    await root.removeEntry("todelete.txt");
    expect(existsSync(path.join(tmpDir, "todelete.txt"))).toBe(false);
  });

  it("removeEntry with recursive: true deletes a directory tree", async () => {
    const sub = await root.getDirectoryHandle("subtree", { create: true });
    const f = await sub.getFileHandle("inner.txt", { create: true });
    const w = await f.createWritable();
    await w.write("inner");
    await w.close();
    await root.removeEntry("subtree", { recursive: true });
    expect(existsSync(path.join(tmpDir, "subtree"))).toBe(false);
  });

  // ── Path traversal security guards ────────────────────────────────────

  it("rejects path traversal backwards up the filesystem tree in getDirectoryHandle", async () => {
    await expect(root.getDirectoryHandle("..")).rejects.toThrow(/traversal/i);
    await expect(root.getDirectoryHandle("../escape")).rejects.toThrow(
      /traversal/i,
    );
    await expect(root.getDirectoryHandle("sub/../../escape")).rejects.toThrow(
      /traversal/i,
    );
  });

  it("rejects path traversal backwards up the filesystem tree in getFileHandle", async () => {
    await expect(root.getFileHandle("../secret.txt")).rejects.toThrow(
      /traversal/i,
    );
    await expect(root.getFileHandle("../../etc/passwd")).rejects.toThrow(
      /traversal/i,
    );
    await expect(root.getFileHandle("sub/../../secret.txt")).rejects.toThrow(
      /traversal/i,
    );
  });

  it("rejects path traversal in removeEntry", async () => {
    await expect(root.removeEntry("..")).rejects.toThrow(/traversal/i);
    await expect(root.removeEntry("../escape")).rejects.toThrow(/traversal/i);
  });

  it("child handles cannot traverse backwards outside workspace root", async () => {
    const child = await root.getDirectoryHandle("sub", { create: true });
    await expect(child.getDirectoryHandle("..")).rejects.toThrow(/traversal/i);
  });

  // ── Binary & Blob writes ──────────────────────────────────────────────

  it("createWritable writes Blob content correctly", async () => {
    const fh = await root.getFileHandle("blob.bin", { create: true });
    const w = await fh.createWritable();
    const blob = new Blob(["binary blob content"]);
    await w.write(blob);
    await w.close();
    const file = await fh.getFile();
    expect(await file.text()).toBe("binary blob content");
  });

  it("createWritable writes ArrayBuffer / Uint8Array content correctly", async () => {
    const fh = await root.getFileHandle("bytes.bin", { create: true });
    const w = await fh.createWritable();
    await w.write(new Uint8Array([65, 66, 67]));
    await w.close();
    const file = await fh.getFile();
    expect(await file.text()).toBe("ABC");
  });

  // ── removeEntry specification compliance ─────────────────────────────

  it("removeEntry throws NotFoundError when entry does not exist", async () => {
    await expect(root.removeEntry("nonexistent.txt")).rejects.toThrow(
      /NotFoundError/i,
    );
  });

  it("removeEntry deletes an empty directory without recursive option", async () => {
    await root.getDirectoryHandle("emptydir", { create: true });
    await root.removeEntry("emptydir");
    await expect(root.getDirectoryHandle("emptydir")).rejects.toThrow(
      /NotFoundError/i,
    );
  });

  it("removeEntry throws when deleting non-empty directory without recursive: true", async () => {
    const sub = await root.getDirectoryHandle("nonemptydir", { create: true });
    await sub.getFileHandle("child.txt", { create: true });
    await expect(root.removeEntry("nonemptydir")).rejects.toThrow();
  });

  // ── isSameEntry ───────────────────────────────────────────────────────

  it("implements isSameEntry on directory handles", async () => {
    const d1 = await root.getDirectoryHandle("testdir", { create: true });
    const d2 = await root.getDirectoryHandle("testdir");
    expect(await d1.isSameEntry(d2)).toBe(true);
    expect(await d1.isSameEntry(root)).toBe(false);
  });

  it("implements isSameEntry on file handles", async () => {
    const f1 = await root.getFileHandle("testfile.txt", { create: true });
    const f2 = await root.getFileHandle("testfile.txt");
    expect(await f1.isSameEntry(f2)).toBe(true);
    expect(await f1.isSameEntry(root as any)).toBe(false);
  });
});

describe("setStorageRootFromPath", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-storageroot-test-"));
  });

  afterEach(async () => {
    // Reset storage root to avoid bleeding state into other tests
    const { invalidateStorageRoot } = await import("./storage.js");
    invalidateStorageRoot();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("setStorageRootFromPath sets the storage root to a NodeFsDirectoryHandle", async () => {
    const { setStorageRootFromPath } = await import("./node-fs-handle.js");
    const { wrapSqliteDatabase } = await import("../db/sqlite/types.js");

    // Open a minimal SQLite DB (needed by getStorageRoot signature)
    const { DatabaseSync } = await import("node:sqlite");
    const raw = new DatabaseSync(path.join(tmpDir, "dummy.db"));
    const db = wrapSqliteDatabase(raw);

    setStorageRootFromPath(tmpDir);

    const { getStorageRoot } = await import("./storage.js");
    const root = await getStorageRoot(db as any);

    // Should be able to create a directory on the returned handle
    const child = await (root as any).getDirectoryHandle("test-child", {
      create: true,
    });
    expect(child).toBeDefined();
    expect(existsSync(path.join(tmpDir, "test-child"))).toBe(true);
    raw.close();
  });
});
