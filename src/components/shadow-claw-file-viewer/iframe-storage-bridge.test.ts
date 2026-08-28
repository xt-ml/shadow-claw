/**
 * @jest-environment jsdom
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("iframe-storage-bridge.js (Sandboxed IFrame Polyfills & Storage Proxy)", () => {
  let originalShowOpenFilePicker: any;
  let originalShowSaveFilePicker: any;

  beforeEach(() => {
    originalShowOpenFilePicker = (window as any).showOpenFilePicker;
    originalShowSaveFilePicker = (window as any).showSaveFilePicker;

    // Load and execute iframe-storage-bridge.js in jsdom window context
    const bridgeScriptPath = path.resolve(
      __dirname,
      "iframe-storage-bridge.js",
    );
    const scriptCode = fs.readFileSync(bridgeScriptPath, "utf-8");
    // eslint-disable-next-line no-eval
    eval(scriptCode);
  });

  afterEach(() => {
    delete (window as any).showOpenFilePicker;
    delete (window as any).showSaveFilePicker;
    if (originalShowOpenFilePicker) {
      (window as any).showOpenFilePicker = originalShowOpenFilePicker;
    }
    if (originalShowSaveFilePicker) {
      (window as any).showSaveFilePicker = originalShowSaveFilePicker;
    }
  });

  describe("showOpenFilePicker Polyfill", () => {
    test("defines showOpenFilePicker on window", () => {
      expect(typeof (window as any).showOpenFilePicker).toBe("function");
    });

    test("handles file selection via input polyfill", async () => {
      const dummyFile = new File(["hello world"], "test.txt", {
        type: "text/plain",
      });

      const originalClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
        Object.defineProperty(this, "files", {
          value: [dummyFile],
          writable: false,
        });
        if (typeof this.onchange === "function") {
          this.onchange({} as any);
        }
      };

      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: false,
          types: [{ accept: { "text/plain": [".txt"] } }],
        });

        expect(handles).toHaveLength(1);
        expect(handles[0].kind).toBe("file");
        expect(handles[0].name).toBe("test.txt");

        const file = await handles[0].getFile();
        expect(file.name).toBe("test.txt");
      } finally {
        HTMLInputElement.prototype.click = originalClick;
      }
    });

    test("handles cancellation gracefully", async () => {
      const originalClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
        if (typeof this.oncancel === "function") {
          this.oncancel({} as any);
        }
      };

      try {
        await expect((window as any).showOpenFilePicker()).rejects.toThrow(
          "The user aborted a request.",
        );
      } finally {
        HTMLInputElement.prototype.click = originalClick;
      }
    });
  });

  describe("showSaveFilePicker Polyfill", () => {
    test("defines showSaveFilePicker on window", () => {
      expect(typeof (window as any).showSaveFilePicker).toBe("function");
    });

    test("creates writable file handle and triggers anchor download on close", async () => {
      let createdUrl = "";
      const originalCreateObjectUrl = URL.createObjectURL;
      URL.createObjectURL = (_blob: Blob) => {
        createdUrl = "blob:test-download";
        return createdUrl;
      };

      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "savegame.json",
          types: [{ accept: { "application/json": [".json"] } }],
        });

        expect(handle.kind).toBe("file");
        expect(handle.name).toBe("savegame.json");

        const writable = await handle.createWritable();
        expect(typeof writable.write).toBe("function");
        expect(typeof writable.close).toBe("function");

        await writable.write(JSON.stringify({ level: 5 }));
        await writable.close();

        expect(createdUrl).toBe("blob:test-download");
      } finally {
        URL.createObjectURL = originalCreateObjectUrl;
      }
    });
  });

  describe("IndexedDB Shim Cursors & Methods", () => {
    test("provides objectStore openCursor, openKeyCursor, and getAllKeys", (done) => {
      const dbRequest = window.indexedDB.open("testdb");
      expect(dbRequest).toBeDefined();

      dbRequest.onsuccess = () => {
        const db = dbRequest.result;
        expect(db).toBeDefined();

        const tx = db.transaction(["store1"]);
        const store = tx.objectStore("store1");

        expect(typeof store.openCursor).toBe("function");
        expect(typeof store.openKeyCursor).toBe("function");
        expect(typeof store.getAllKeys).toBe("function");

        done();
      };
    });
  });

  describe("ServiceWorker Trap", () => {
    test("traps navigator.serviceWorker safely to undefined", () => {
      expect(navigator.serviceWorker).toBeUndefined();
    });
  });
});
