import { OPFS_ROOT } from "../config/config.js";

function createDOMException(message: string, name: string): DOMException {
  if (typeof DOMException !== "undefined") {
    try {
      return new DOMException(message, name);
    } catch {
      // Fall back if constructor fails
    }
  }

  const err = new Error(message) as any;
  err.name = name;

  return err;
}

function makeAsyncIterator<T>(
  gen: () => AsyncGenerator<T>,
): FileSystemDirectoryHandleAsyncIterator<T> {
  const iterator = gen();
  (iterator as any)[Symbol.asyncDispose ?? Symbol.for("Symbol.asyncDispose")] =
    async () => {};

  return iterator as any;
}

/**
 * In-memory implementation of FileSystemSyncAccessHandle.
 */
export class MemorySyncAccessHandle {
  private _file: MemoryFileHandle;
  private _closed = false;

  constructor(file: MemoryFileHandle) {
    this._file = file;
  }

  close(): void {
    this._closed = true;
  }

  flush(): void {
    // No-op for in-memory storage
  }

  getSize(): number {
    if (this._closed) {
      throw createDOMException(
        "SyncAccessHandle is closed",
        "InvalidStateError",
      );
    }

    return this._file.getRawData().byteLength;
  }

  read(buffer: ArrayBufferView, options?: { at?: number }): number {
    if (this._closed) {
      throw createDOMException(
        "SyncAccessHandle is closed",
        "InvalidStateError",
      );
    }
    const data = this._file.getRawData();
    const at = options?.at ?? 0;
    if (at >= data.byteLength) {
      return 0;
    }
    const target = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const source = data.subarray(at, at + target.byteLength);
    target.set(source);

    return source.byteLength;
  }

  write(buffer: ArrayBufferView, options?: { at?: number }): number {
    if (this._closed) {
      throw createDOMException(
        "SyncAccessHandle is closed",
        "InvalidStateError",
      );
    }
    const src = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    );
    const at = options?.at ?? 0;
    const current = this._file.getRawData();
    const needed = at + src.byteLength;
    let newBuf: Uint8Array;
    if (needed > current.byteLength) {
      newBuf = new Uint8Array(needed);
      newBuf.set(current);
    } else {
      newBuf = new Uint8Array(current);
    }
    newBuf.set(src, at);
    this._file.setRawData(newBuf);

    return src.byteLength;
  }

  truncate(newSize: number): void {
    if (this._closed) {
      throw createDOMException(
        "SyncAccessHandle is closed",
        "InvalidStateError",
      );
    }
    const current = this._file.getRawData();
    const newBuf = new Uint8Array(newSize);
    newBuf.set(current.subarray(0, Math.min(current.byteLength, newSize)));
    this._file.setRawData(newBuf);
  }
}

/**
 * In-memory implementation of FileSystemWritableFileStream.
 */
export class MemoryWritableStream {
  private _file: MemoryFileHandle;
  private _buffer: Uint8Array;
  private _position = 0;
  private _length = 0;
  private _closed = false;

  constructor(file: MemoryFileHandle, keepExistingData = false) {
    this._file = file;
    const existing = file.getRawData();
    if (keepExistingData) {
      this._buffer = new Uint8Array(existing);
      this._length = existing.byteLength;
    } else {
      this._buffer = new Uint8Array(1024);
      this._length = 0;
    }
  }

  async write(chunk: any): Promise<void> {
    if (this._closed) {
      throw createDOMException("WritableStream is closed", "InvalidStateError");
    }

    let bytes: Uint8Array;
    if (typeof chunk === "string") {
      bytes = new TextEncoder().encode(chunk);
    } else if (chunk instanceof Uint8Array) {
      bytes = chunk;
    } else if (chunk instanceof ArrayBuffer) {
      bytes = new Uint8Array(chunk);
    } else if (typeof Blob !== "undefined" && chunk instanceof Blob) {
      if (typeof chunk.arrayBuffer === "function") {
        bytes = new Uint8Array(await chunk.arrayBuffer());
      } else if (typeof (chunk as any).text === "function") {
        bytes = new TextEncoder().encode(await (chunk as any).text());
      } else if (typeof FileReader !== "undefined") {
        bytes = await new Promise<Uint8Array>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          };
          reader.onerror = () => resolve(new Uint8Array(0));
          reader.readAsArrayBuffer(chunk);
        });
      } else {
        bytes = new Uint8Array(0);
      }
    } else if (chunk && typeof chunk === "object" && "type" in chunk) {
      if (chunk.type === "write") {
        if (typeof chunk.position === "number") {
          this._position = chunk.position;
        }
        const data = chunk.data;
        if (typeof data === "string") {
          bytes = new TextEncoder().encode(data);
        } else if (data instanceof Uint8Array) {
          bytes = data;
        } else if (data instanceof ArrayBuffer) {
          bytes = new Uint8Array(data);
        } else if (typeof Blob !== "undefined" && data instanceof Blob) {
          if (typeof data.arrayBuffer === "function") {
            bytes = new Uint8Array(await data.arrayBuffer());
          } else {
            bytes = new Uint8Array(0);
          }
        } else {
          bytes = new Uint8Array(0);
        }
      } else if (chunk.type === "seek") {
        this._position = chunk.position ?? 0;

        return;
      } else if (chunk.type === "truncate") {
        this._truncate(chunk.size ?? 0);

        return;
      } else {
        bytes = new Uint8Array(0);
      }
    } else {
      bytes = new Uint8Array(0);
    }

    const needed = this._position + bytes.length;
    if (needed > this._buffer.length) {
      const newCapacity = Math.max(this._buffer.length * 2, needed, 1024);
      const newBuf = new Uint8Array(newCapacity);
      newBuf.set(this._buffer);
      this._buffer = newBuf;
    }

    this._buffer.set(bytes, this._position);
    this._position += bytes.length;
    if (this._position > this._length) {
      this._length = this._position;
    }
  }

  private _truncate(newSize: number): void {
    if (newSize < this._length) {
      this._length = newSize;
    } else if (newSize > this._length) {
      if (newSize > this._buffer.length) {
        const newBuf = new Uint8Array(newSize);
        newBuf.set(this._buffer);
        this._buffer = newBuf;
      }
      this._length = newSize;
    }
    if (this._position > newSize) {
      this._position = newSize;
    }
  }

  async seek(position: number): Promise<void> {
    if (this._closed) {
      throw createDOMException("WritableStream is closed", "InvalidStateError");
    }
    this._position = position;
  }

  async truncate(size: number): Promise<void> {
    if (this._closed) {
      throw createDOMException("WritableStream is closed", "InvalidStateError");
    }
    this._truncate(size);
  }

  async close(): Promise<void> {
    if (this._closed) {
      return;
    }
    this._closed = true;
    const finalData = this._buffer.slice(0, this._length);
    this._file.setRawData(finalData);
  }

  async abort(): Promise<void> {
    this._closed = true;
  }
}

/**
 * In-memory implementation of FileSystemFileHandle.
 */
export class MemoryFileHandle implements FileSystemFileHandle {
  readonly kind = "file" as const;
  readonly name: string;
  private _data: Uint8Array;
  private _lastModified: number;

  constructor(name: string, initialData: Uint8Array = new Uint8Array()) {
    this.name = name;
    this._data = initialData;
    this._lastModified = Date.now();
  }

  getRawData(): Uint8Array {
    return this._data;
  }

  setRawData(data: Uint8Array): void {
    this._data = data;
    this._lastModified = Date.now();
  }

  private _getArrayBuffer(): ArrayBuffer {
    const ab = new ArrayBuffer(this._data.byteLength);
    new Uint8Array(ab).set(this._data);

    return ab;
  }

  async getFile(): Promise<File> {
    const arrayBuffer = this._getArrayBuffer();
    const data = this._data;
    const name = this.name;
    const lastModified = this._lastModified;

    const fileObj = {
      name,
      size: data.byteLength,
      type: "",
      lastModified,
      async text(): Promise<string> {
        return new TextDecoder().decode(data);
      },
      async arrayBuffer(): Promise<ArrayBuffer> {
        return arrayBuffer;
      },
      slice(start = 0, end = data.byteLength): Blob {
        return new Blob([arrayBuffer.slice(start, end)]);
      },
    };

    if (typeof File !== "undefined") {
      try {
        const file = new File([arrayBuffer], this.name, {
          lastModified: this._lastModified,
        });
        if (typeof (file as any).text !== "function") {
          (file as any).text = fileObj.text;
        }
        if (typeof (file as any).arrayBuffer !== "function") {
          (file as any).arrayBuffer = fileObj.arrayBuffer;
        }

        return file;
      } catch {
        // Continue to fallback
      }
    }

    return fileObj as any;
  }

  async createWritable(
    options?: FileSystemCreateWritableOptions,
  ): Promise<FileSystemWritableFileStream> {
    return new MemoryWritableStream(
      this,
      options?.keepExistingData ?? false,
    ) as any;
  }

  async createSyncAccessHandle(): Promise<any> {
    return new MemorySyncAccessHandle(this);
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return this === (other as any);
  }

  async queryPermission(): Promise<PermissionState> {
    return "granted";
  }

  async requestPermission(): Promise<PermissionState> {
    return "granted";
  }
}

/**
 * In-memory implementation of FileSystemDirectoryHandle.
 */
export class MemoryDirectoryHandle implements FileSystemDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name: string;
  private _entries = new Map<
    string,
    MemoryDirectoryHandle | MemoryFileHandle
  >();

  constructor(name: string) {
    this.name = name;
  }

  _setEntry(
    name: string,
    handle: MemoryDirectoryHandle | MemoryFileHandle,
  ): void {
    this._entries.set(name, handle);
  }

  async getDirectoryHandle(
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle> {
    if (name === "." || name === "") {
      return this;
    }
    if (name === "..") {
      throw createDOMException(
        "Cannot navigate to parent directory with '..'",
        "SecurityError",
      );
    }

    const existing = this._entries.get(name);
    if (existing) {
      if (existing.kind === "directory") {
        return existing as MemoryDirectoryHandle;
      }
      throw createDOMException(
        `"${name}" is a file, not a directory`,
        "TypeMismatchError",
      );
    }

    if (options?.create) {
      const newDir = new MemoryDirectoryHandle(name);
      this._entries.set(name, newDir);

      return newDir;
    }

    throw createDOMException(
      `A requested file or directory could not be found at "${name}"`,
      "NotFoundError",
    );
  }

  async getFileHandle(
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    if (name === "." || name === ".." || name === "") {
      throw createDOMException(
        `Invalid file name "${name}"`,
        "TypeMismatchError",
      );
    }

    const existing = this._entries.get(name);
    if (existing) {
      if (existing.kind === "file") {
        return existing as MemoryFileHandle;
      }
      throw createDOMException(
        `"${name}" is a directory, not a file`,
        "TypeMismatchError",
      );
    }

    if (options?.create) {
      const newFile = new MemoryFileHandle(name);
      this._entries.set(name, newFile);

      return newFile;
    }

    throw createDOMException(
      `A requested file could not be found at "${name}"`,
      "NotFoundError",
    );
  }

  async removeEntry(
    name: string,
    options?: FileSystemRemoveOptions,
  ): Promise<void> {
    const existing = this._entries.get(name);
    if (!existing) {
      throw createDOMException(`Entry "${name}" not found`, "NotFoundError");
    }

    if (
      existing.kind === "directory" &&
      (existing as MemoryDirectoryHandle)._entries.size > 0 &&
      !options?.recursive
    ) {
      throw createDOMException(
        `Directory "${name}" is not empty`,
        "InvalidModificationError",
      );
    }

    this._entries.delete(name);
  }

  async resolve(
    possibleDescendant: FileSystemHandle,
  ): Promise<string[] | null> {
    if (this === (possibleDescendant as any)) {
      return [];
    }

    for (const [name, handle] of this._entries.entries()) {
      if (handle === (possibleDescendant as any)) {
        return [name];
      }
      if (handle.kind === "directory") {
        const childPath = await (handle as MemoryDirectoryHandle).resolve(
          possibleDescendant,
        );
        if (childPath) {
          return [name, ...childPath];
        }
      }
    }

    return null;
  }

  entries(): FileSystemDirectoryHandleAsyncIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  > {
    const self = this;

    return makeAsyncIterator(async function* () {
      for (const [name, handle] of self._entries.entries()) {
        yield [name, handle as any];
      }
    });
  }

  values(): FileSystemDirectoryHandleAsyncIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  > {
    const self = this;

    return makeAsyncIterator(async function* () {
      for (const handle of self._entries.values()) {
        yield handle as any;
      }
    });
  }

  keys(): FileSystemDirectoryHandleAsyncIterator<string> {
    const self = this;

    return makeAsyncIterator(async function* () {
      for (const name of self._entries.keys()) {
        yield name;
      }
    });
  }

  [Symbol.asyncIterator](): FileSystemDirectoryHandleAsyncIterator<
    [string, FileSystemDirectoryHandle | FileSystemFileHandle]
  > {
    return this.entries();
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return this === (other as any);
  }

  async queryPermission(): Promise<PermissionState> {
    return "granted";
  }

  async requestPermission(): Promise<PermissionState> {
    return "granted";
  }
}

let memoryOpfsRoot: MemoryDirectoryHandle | null = null;

/**
 * Get or create the singleton in-memory root for OPFS fallback.
 */
export function getMemoryOpfsRoot(): FileSystemDirectoryHandle {
  if (!memoryOpfsRoot) {
    const root = new MemoryDirectoryHandle("memory-root");
    const opfsChild = new MemoryDirectoryHandle(OPFS_ROOT);
    root._setEntry(OPFS_ROOT, opfsChild);
    memoryOpfsRoot = opfsChild;
  }

  return memoryOpfsRoot;
}

/**
 * Check if the in-memory storage fallback is currently active.
 */
export function isMemoryStorageFallbackActive(): boolean {
  return memoryOpfsRoot !== null;
}

/**
 * Clear the in-memory OPFS root (primarily for tests).
 */
export function resetMemoryOpfsRoot(): void {
  memoryOpfsRoot = null;
}
