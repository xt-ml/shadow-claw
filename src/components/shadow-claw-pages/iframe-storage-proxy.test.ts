import {
  iframeStorageSet,
  iframeStorageGet,
  iframeStorageGetAll,
  iframeStorageDelete,
  iframeStorageClear,
} from "./iframe-storage-proxy.js";

describe("iframe-storage-proxy (IndexedDB Key-Value Store for Opaque IFrames)", () => {
  const ns1 = "page-123";
  const ns2 = "page-456";

  beforeEach(async () => {
    await iframeStorageClear(ns1);
    await iframeStorageClear(ns2);
  });

  test("sets and gets items within a specific namespace", async () => {
    await iframeStorageSet(ns1, "theme", "dark");
    await iframeStorageSet(ns1, "score", 42);

    const theme = await iframeStorageGet(ns1, "theme");
    const score = await iframeStorageGet(ns1, "score");
    const missing = await iframeStorageGet(ns1, "missingKey");

    expect(theme).toBe("dark");
    expect(score).toBe(42);
    expect(missing).toBeUndefined();
  });

  test("isolates keys across different namespaces", async () => {
    await iframeStorageSet(ns1, "keyA", "val-ns1");
    await iframeStorageSet(ns2, "keyA", "val-ns2");

    const val1 = await iframeStorageGet(ns1, "keyA");
    const val2 = await iframeStorageGet(ns2, "keyA");

    expect(val1).toBe("val-ns1");
    expect(val2).toBe("val-ns2");
  });

  test("gets all key-value pairs for a namespace", async () => {
    await iframeStorageSet(ns1, "setting1", "alpha");
    await iframeStorageSet(ns1, "setting2", "beta");
    await iframeStorageSet(ns2, "setting3", "gamma");

    const allNs1 = await iframeStorageGetAll(ns1);
    expect(allNs1).toEqual({
      setting1: "alpha",
      setting2: "beta",
    });
  });

  test("deletes an item by key in a namespace", async () => {
    await iframeStorageSet(ns1, "foo", "bar");
    expect(await iframeStorageGet(ns1, "foo")).toBe("bar");

    await iframeStorageDelete(ns1, "foo");
    expect(await iframeStorageGet(ns1, "foo")).toBeUndefined();
  });

  test("clears all items for a specific namespace without affecting others", async () => {
    await iframeStorageSet(ns1, "k1", "v1");
    await iframeStorageSet(ns1, "k2", "v2");
    await iframeStorageSet(ns2, "k3", "v3");

    await iframeStorageClear(ns1);

    const ns1All = await iframeStorageGetAll(ns1);
    const ns2Val = await iframeStorageGet(ns2, "k3");

    expect(ns1All).toEqual({});
    expect(ns2Val).toBe("v3");
  });
});
