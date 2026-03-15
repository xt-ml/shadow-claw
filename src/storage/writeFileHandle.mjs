/**
 * Write data to a FileSystemFileHandle across browser implementations.
 * Supports standard createWritable(), a legacy createWriteable() spelling,
 * and createSyncAccessHandle() when available.
 *
 * @param {FileSystemFileHandle} fileHandle
 * @param {string | Blob | ArrayBuffer | Uint8Array} content
 *
 * @returns {Promise<void>}
 */
export async function writeFileHandle(fileHandle, content) {
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

  if (typeof fileHandle?.createSyncAccessHandle === "function") {
    // @ts-ignore - createSyncAccessHandle exists for OPFS handles.
    const syncHandle = await fileHandle.createSyncAccessHandle();

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
 * via path segments inside an inline Web Worker, where createSyncAccessHandle
 * is available even on browsers (e.g. Safari on iPad) where main-thread OPFS
 * handles lack any writable API.
 *
 * FileSystemFileHandle / FileSystemDirectoryHandle are NOT structured-cloneable
 * in Safari, so the worker must obtain its own handle from scratch.
 *
 * @param {string[]} pathSegments - Full path from the raw OPFS root, e.g.
 *   ["shadowclaw", "groups", "g01", "workspace", "README.md"]
 *   All segments except the last are directories; the last is the filename.
 * @param {string | Blob | ArrayBuffer | Uint8Array} content
 *
 * @returns {Promise<void>}
 */
export async function writeOpfsPathViaWorker(pathSegments, content) {
  if (typeof globalThis.Worker !== "function") {
    throw new Error(
      "Writable file streams are not supported by this browser/storage backend.",
    );
  }

  const bytes = await toUint8Array(content);

  return new Promise((resolve, reject) => {
    /** @type {string} */
    let blobUrl = "";
    /** @type {Worker | null} */
    let worker = null;

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
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      reject(
        new Error(
          "Writable file streams are not supported by this browser/storage backend.",
        ),
      );
      return;
    }

    const cleanup = () => {
      if (worker) worker.terminate();
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

/**
 * @param {string | Blob | ArrayBuffer | Uint8Array} content
 *
 * @returns {string | Blob}
 */
function toWritableChunk(content) {
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
 * @param {string | Blob | ArrayBuffer | Uint8Array} content
 *
 * @returns {Promise<Uint8Array>}
 */
async function toUint8Array(content) {
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
