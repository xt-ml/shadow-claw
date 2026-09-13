import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { setStorageRoot } from "./storage.js";

/**
 * Node.js `FileSystemFileHandle`-compatible adapter backed by `node:fs`.
 *
 * Implements the subset of the FileSystemFileHandle API used by
 * readGroupFile, writeGroupFile, discoverSkills, and loadDeclarativeTools.
 */
export class NodeFsFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private _path: string;

  constructor(fsPath: string) {
    this._path = fsPath;
    this.name = path.basename(fsPath);
  }

  /**
   * Returns a File-like object with a `.text()` method.
   */
  async getFile(): Promise<{
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    size: number;
    type: string;
  }> {
    const buf = await readFile(this._path);
    return {
      size: buf.length,
      type: "application/octet-stream",
      async text() {
        return buf.toString("utf8");
      },
      async arrayBuffer() {
        return buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength,
        ) as ArrayBuffer;
      },
    };
  }

  /**
   * Returns a writable stream that overwrites the file on close.
   */
  async createWritable(): Promise<{
    write(data: string | ArrayBuffer | Uint8Array): Promise<void>;
    close(): Promise<void>;
  }> {
    const chunks: Buffer[] = [];
    const filePath = this._path;

    return {
      async write(data: string | ArrayBuffer | Uint8Array) {
        if (typeof data === "string") {
          chunks.push(Buffer.from(data, "utf8"));
        } else if (data instanceof Uint8Array) {
          chunks.push(Buffer.from(data));
        } else {
          chunks.push(Buffer.from(new Uint8Array(data)));
        }
      },
      async close() {
        const combined = Buffer.concat(chunks);
        await writeFile(filePath, combined);
      },
    };
  }
}

/**
 * Node.js `FileSystemDirectoryHandle`-compatible adapter backed by `node:fs`.
 *
 * Implements the subset of the FileSystemDirectoryHandle API used by:
 * - `getGroupDir` / `getNestedDir`
 * - `readGroupFile` / `writeGroupFile` / `deleteGroupFile`
 * - `discoverSkills` (entries iteration)
 * - `loadDeclarativeTools` (entries iteration)
 * - `listSkillResources` (entries iteration)
 */
export class NodeFsDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private _path: string;

  constructor(fsPath: string) {
    this._path = fsPath;
    this.name = path.basename(fsPath) || fsPath;
  }

  /**
   * Get a child directory handle.
   * @param name - Directory name (single path segment)
   * @param options - `{ create: true }` creates the directory if it doesn't exist
   */
  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<NodeFsDirectoryHandle> {
    const childPath = path.join(this._path, name);

    if (options?.create) {
      await mkdir(childPath, { recursive: true });
    } else if (!existsSync(childPath)) {
      const err: any = new Error(`NotFoundError: ${childPath} does not exist`);
      err.name = "NotFoundError";
      throw err;
    }

    return new NodeFsDirectoryHandle(childPath);
  }

  /**
   * Get a child file handle.
   * @param name - File name (single path segment)
   * @param options - `{ create: true }` creates an empty file if it doesn't exist
   */
  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<NodeFsFileHandle> {
    const filePath = path.join(this._path, name);

    if (options?.create) {
      if (!existsSync(filePath)) {
        await writeFile(filePath, "");
      }
    } else if (!existsSync(filePath)) {
      const err: any = new Error(`NotFoundError: ${filePath} does not exist`);
      err.name = "NotFoundError";
      throw err;
    }

    return new NodeFsFileHandle(filePath);
  }

  /**
   * Async iterator over child entries.
   * Yields `[name, handle]` pairs where handle is either
   * `NodeFsDirectoryHandle` or `NodeFsFileHandle`.
   */
  async *entries(): AsyncGenerator<
    [string, NodeFsDirectoryHandle | NodeFsFileHandle]
  > {
    let names: string[];
    try {
      names = await readdir(this._path);
    } catch {
      return;
    }

    for (const name of names) {
      const childPath = path.join(this._path, name);
      try {
        const s = await stat(childPath);
        if (s.isDirectory()) {
          yield [name, new NodeFsDirectoryHandle(childPath)];
        } else {
          yield [name, new NodeFsFileHandle(childPath)];
        }
      } catch {
        // Skip unreadable entries
      }
    }
  }

  /**
   * Remove a child entry.
   * @param name - Name of file or directory to remove
   * @param options - `{ recursive: true }` removes directories recursively
   */
  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const childPath = path.join(this._path, name);
    await rm(childPath, {
      recursive: options?.recursive ?? false,
      force: true,
    });
  }
}

/**
 * Set the storage root to a real filesystem directory (headless CLI mode).
 */
export function setStorageRootFromPath(fsPath: string): void {
  setStorageRoot(
    new NodeFsDirectoryHandle(fsPath) as unknown as FileSystemDirectoryHandle,
  );
}

// Auto-register so storage.ts setStorageRootFromPath delegates here seamlessly
(globalThis as any).__setStorageRootFromPath = setStorageRootFromPath;
