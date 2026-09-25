import {
  mkdir,
  readdir,
  readFile,
  rm,
  rmdir,
  stat,
  unlink,
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
   * Compare two handles for equality.
   */
  async isSameEntry(other: unknown): Promise<boolean> {
    if (!other || typeof other !== "object") return false;
    return (
      (other as any).kind === this.kind && (other as any)._path === this._path
    );
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
    write(
      data:
        | string
        | ArrayBuffer
        | Uint8Array
        | Blob
        | { type?: string; data?: any },
    ): Promise<void>;
    close(): Promise<void>;
  }> {
    const chunks: Buffer[] = [];
    const filePath = this._path;

    const writeChunk = async (
      data:
        | string
        | ArrayBuffer
        | Uint8Array
        | Blob
        | { type?: string; data?: any },
    ): Promise<void> => {
      if (typeof data === "string") {
        chunks.push(Buffer.from(data, "utf8"));
      } else if (data instanceof Uint8Array) {
        chunks.push(Buffer.from(data));
      } else if (data instanceof ArrayBuffer) {
        chunks.push(Buffer.from(data));
      } else if (data instanceof Blob) {
        if (typeof (data as any).arrayBuffer === "function") {
          const ab = await (data as any).arrayBuffer();
          chunks.push(Buffer.from(ab));
        } else if (typeof (data as any).bytes === "function") {
          const b = await (data as any).bytes();
          chunks.push(Buffer.from(b));
        } else if (typeof (data as any).text === "function") {
          const txt = await (data as any).text();
          chunks.push(Buffer.from(txt, "utf8"));
        } else if ((data as any)._buffer) {
          chunks.push(Buffer.from((data as any)._buffer));
        } else if (typeof FileReader !== "undefined") {
          const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(data);
          });
          chunks.push(Buffer.from(ab));
        }
      } else if (data && typeof data === "object" && "data" in data) {
        await writeChunk(data.data);
      } else {
        chunks.push(Buffer.from(new Uint8Array(data as any)));
      }
    };

    return {
      write: writeChunk,
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
  private _rootPath: string;

  constructor(fsPath: string, rootPath?: string) {
    this._path = path.resolve(fsPath);
    this._rootPath = rootPath ? path.resolve(rootPath) : this._path;
    this.name = path.basename(this._path) || this._path;
  }

  private _resolveChild(name: string): string {
    if (!name || name === "." || name.includes("\0")) {
      const err: any = new Error(`Invalid path name: "${name}"`);
      err.name = "TypeError";
      throw err;
    }
    const childPath = path.resolve(this._path, name);
    const relFromDir = path.relative(this._path, childPath);
    const relFromRoot = path.relative(this._rootPath, childPath);

    if (
      relFromDir.startsWith("..") ||
      path.isAbsolute(relFromDir) ||
      relFromRoot.startsWith("..") ||
      path.isAbsolute(relFromRoot)
    ) {
      const err: any = new Error(
        `SecurityError: Path traversal outside workspace root is not allowed: "${name}"`,
      );
      err.name = "SecurityError";
      throw err;
    }

    return childPath;
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
    const childPath = this._resolveChild(name);

    if (options?.create) {
      await mkdir(childPath, { recursive: true });
    } else if (!existsSync(childPath)) {
      const err: any = new Error(`NotFoundError: ${childPath} does not exist`);
      err.name = "NotFoundError";
      throw err;
    }

    const st = await stat(childPath);
    if (!st.isDirectory()) {
      const err: any = new Error(
        `TypeMismatchError: "${name}" is a file, not a directory`,
      );
      err.name = "TypeMismatchError";
      throw err;
    }

    return new NodeFsDirectoryHandle(childPath, this._rootPath);
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
    const filePath = this._resolveChild(name);

    if (options?.create) {
      if (!existsSync(filePath)) {
        await writeFile(filePath, "");
      }
    } else if (!existsSync(filePath)) {
      const err: any = new Error(`NotFoundError: ${filePath} does not exist`);
      err.name = "NotFoundError";
      throw err;
    }

    const st = await stat(filePath);
    if (st.isDirectory()) {
      const err: any = new Error(
        `TypeMismatchError: "${name}" is a directory, not a file`,
      );
      err.name = "TypeMismatchError";
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
          yield [name, new NodeFsDirectoryHandle(childPath, this._rootPath)];
        } else {
          yield [name, new NodeFsFileHandle(childPath)];
        }
      } catch {
        // Skip unreadable entries
      }
    }
  }

  /**
   * Compare two handles for equality.
   */
  async isSameEntry(other: unknown): Promise<boolean> {
    if (!other || typeof other !== "object") return false;
    return (
      (other as any).kind === this.kind && (other as any)._path === this._path
    );
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
    const childPath = this._resolveChild(name);
    if (!existsSync(childPath)) {
      const err: any = new Error(`NotFoundError: ${childPath} does not exist`);
      err.name = "NotFoundError";
      throw err;
    }

    const st = await stat(childPath);
    if (st.isDirectory()) {
      if (options?.recursive) {
        await rm(childPath, { recursive: true });
      } else {
        try {
          await rmdir(childPath);
        } catch (rmdirErr: any) {
          if (rmdirErr.code === "ENOTEMPTY") {
            const err: any = new Error(
              `InvalidModificationError: directory is not empty: "${name}"`,
            );
            err.name = "InvalidModificationError";
            throw err;
          }
          throw rmdirErr;
        }
      }
    } else {
      await unlink(childPath);
    }
  }
}

let _currentStorageRootPath: string | null = null;

/**
 * Get the active filesystem path of the storage root (if headless Node FS handle).
 */
export function getStorageRootPath(): string | null {
  return _currentStorageRootPath;
}

/**
 * Set the storage root to a real filesystem directory (headless CLI mode).
 */
export function setStorageRootFromPath(fsPath: string): void {
  _currentStorageRootPath = path.resolve(fsPath);
  setStorageRoot(
    new NodeFsDirectoryHandle(fsPath) as unknown as FileSystemDirectoryHandle,
  );
}

// Auto-register so storage.ts setStorageRootFromPath delegates here seamlessly
(globalThis as any).__setStorageRootFromPath = setStorageRootFromPath;
(globalThis as any).__getStorageRootPath = getStorageRootPath;
