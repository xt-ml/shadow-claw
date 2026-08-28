import {
  iframeStorageClear,
  iframeStorageDelete,
  iframeStorageGet,
  iframeStorageGetAll,
  iframeStorageSet,
} from "./iframe-storage-proxy.js";

export interface IframeStorageHandlers {
  setItem: typeof iframeStorageSet;
  deleteItem: typeof iframeStorageDelete;
  clear: typeof iframeStorageClear;
  getAll: typeof iframeStorageGetAll;
  getItem: typeof iframeStorageGet;
  putItem: typeof iframeStorageSet;
}

const defaultHandlers: IframeStorageHandlers = {
  setItem: iframeStorageSet,
  deleteItem: iframeStorageDelete,
  clear: iframeStorageClear,
  getAll: iframeStorageGetAll,
  getItem: iframeStorageGet,
  putItem: iframeStorageSet,
};

/**
 * Dispatches an iframe storage proxy command for a given page key.
 */
export async function dispatchStorageProxyCommand(
  method: string,
  args: Record<string, unknown>,
  pageKey: string,
  handlers: IframeStorageHandlers = defaultHandlers,
): Promise<unknown> {
  switch (method) {
    // localStorage-style operations
    case "setItem":
      await handlers.setItem(
        pageKey,
        String(args.key || ""),
        args.value as string,
      );
      return undefined;

    case "removeItem":
      await handlers.deleteItem(pageKey, String(args.key || ""));
      return undefined;

    case "clear":
      await handlers.clear(pageKey);
      return undefined;

    case "getAllItems":
      return await handlers.getAll(pageKey);

    // IndexedDB-style operations
    case "idb-get":
      return await handlers.getItem(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
        String(args.key || ""),
      );

    case "idb-getAll":
      return await handlers.getAll(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
      );

    case "idb-put": {
      const idbKey =
        args.key != null ? String(args.key) : `__auto_${Date.now()}`;
      await handlers.putItem(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
        idbKey,
        args.value,
      );
      return idbKey;
    }

    case "idb-delete":
      await handlers.deleteItem(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
        String(args.key || ""),
      );
      return undefined;

    case "idb-clear":
      await handlers.clear(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
      );
      return undefined;

    case "idb-deleteDatabase":
      await handlers.clear(`${pageKey}::idb::${args.dbName}::__default__`);
      return undefined;

    case "idb-count": {
      const items = (await handlers.getAll(
        `${pageKey}::idb::${args.dbName}::${args.storeName}`,
      )) as Record<string, unknown>;
      return Object.keys(items).length;
    }

    default:
      throw new Error(`Unknown storage proxy method: ${method}`);
  }
}

/**
 * Executes a storage proxy command and posts the result back to the iframe source window.
 */
export async function handleStorageProxyMessage(
  source: WindowProxy,
  requestId: string,
  method: string,
  args: Record<string, unknown>,
  pageKey: string,
  handlers: IframeStorageHandlers = defaultHandlers,
): Promise<void> {
  if (!requestId) {
    return;
  }

  try {
    const result = await dispatchStorageProxyCommand(
      method,
      args,
      pageKey,
      handlers,
    );
    source.postMessage(
      {
        type: "shadow-claw-storage-proxy-result",
        requestId,
        result: result ?? null,
      },
      "*",
    );
  } catch (err) {
    source.postMessage(
      {
        type: "shadow-claw-storage-proxy-result",
        requestId,
        error: err instanceof Error ? err.message : String(err),
      },
      "*",
    );
  }
}
