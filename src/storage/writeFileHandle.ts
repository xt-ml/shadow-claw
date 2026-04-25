export type WriteContent = string | Blob | ArrayBuffer | Uint8Array;

/**
 * Write data to a FileSystemFileHandle across browser implementations.
 */
export async function writeFileHandle(
  fileHandle: FileSystemFileHandle,
  content: WriteContent,
): Promise<void> {
  const createWritable = fileHandle?.createWritable;
  const legacyCreateWriteable = Reflect.get(fileHandle, "createWriteable");
  const openWritable =
    typeof createWritable === "function"
      ? createWritable.bind(fileHandle)
      : typeof legacyCreateWriteable === "function"
        ? legacyCreateWriteable.bind(fileHandle)
        : null;

  if (openWritable) {
    const writable = await openWritable();
    await writable.write(toWritableChunk(content));
    await writable.close();

    return;
  }

  // @ts-ignore - createSyncAccessHandle exists for OPFS handles but is not in the standard FileSystemFileHandle type.
  if (typeof (fileHandle as any).createSyncAccessHandle === "function") {
    // @ts-ignore - createSyncAccessHandle exists for OPFS handles.
    const syncHandle = await (fileHandle as any).createSyncAccessHandle();

    try {
      const bytes = await toUint8Array(content);

      // Replace file content atomically when using sync handles.
      syncHandle.truncate(0);
      syncHandle.write(bytes, { at: 0 });
      if (typeof syncHandle.flush === "function") {
        syncHandle.flush();
      }
    } finally {
      syncHandle.close();
    }

    return;
  }

  throw new Error(
    "Writable file streams are not supported by this browser/storage backend.",
  );
}

/**
 * Write a file in the Origin Private File System (OPFS) by navigating to it
 * via path segments inside an inline Web Worker.
 */
export async function writeOpfsPathViaWorker(
  pathSegments: string[],
  content: WriteContent,
): Promise<void> {
  if (typeof globalThis.Worker !== "function") {
    throw new Error(
      "Writable file streams are not supported by this browser/storage backend.",
    );
  }

  const bytes = await toUint8Array(content);

  return new Promise((resolve, reject) => {
    let blobUrl = "";
    let worker: Worker | null = null;

    try {
      // The worker navigates OPFS by path entirely on its own side —
      // no handle objects are transferred across the boundary.
      const src = [
        "self.onmessage = async (e) => {",
        "  try {",
        "    const { pathSegments, bytes } = e.data;",
        "    let dir = await navigator.storage.getDirectory();",
        "    for (let i = 0; i < pathSegments.length - 1; i++) {",
        "      dir = await dir.getDirectoryHandle(pathSegments[i], { create: true });",
        "    }",
        "    const filename = pathSegments[pathSegments.length - 1];",
        "    const fh = await dir.getFileHandle(filename, { create: true });",
        "    const h = await fh.createSyncAccessHandle();",
        "    try {",
        "      h.truncate(0);",
        "      h.write(bytes, { at: 0 });",
        "      if (typeof h.flush === 'function') h.flush();",
        "    } finally { h.close(); }",
        "    self.postMessage({ ok: true });",
        "  } catch (err) {",
        "    self.postMessage({ error: err.message || String(err) });",
        "  }",
        "};",
      ].join("\n");

      blobUrl = URL.createObjectURL(
        new Blob([src], { type: "text/javascript" }),
      );
      worker = new Worker(blobUrl);
    } catch {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }

      reject(
        new Error(
          "Writable file streams are not supported by this browser/storage backend.",
        ),
      );

      return;
    }

    const cleanup = () => {
      if (worker) {
        worker.terminate();
      }

      URL.revokeObjectURL(blobUrl);
    };

    worker.onmessage = (e) => {
      cleanup();
      if (e.data?.error) {
        reject(new Error(e.data.error));
      } else {
        resolve();
      }
    };

    worker.onerror = (e) => {
      cleanup();
      reject(new Error(e.message || "Worker file write failed"));
    };

    worker.postMessage({ pathSegments, bytes }, [bytes.buffer]);
  });
}

function toWritableChunk(content: WriteContent): string | Blob {
  if (typeof content === "string" || content instanceof Blob) {
    return content;
  }

  if (content instanceof Uint8Array) {
    const copy = new Uint8Array(content.byteLength);
    copy.set(content);

    return new Blob([copy]);
  }

  return new Blob([content]);
}

/**
 * Convert input content to a Uint8Array.
 */
async function toUint8Array(content: WriteContent): Promise<Uint8Array> {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (typeof content === "string") {
    return new TextEncoder().encode(content);
  }

  if (content instanceof Blob) {
    return new Uint8Array(await content.arrayBuffer());
  }

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content);
  }

  return new Uint8Array();
}
