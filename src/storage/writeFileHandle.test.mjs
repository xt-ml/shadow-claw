import { jest } from "@jest/globals";
import { TextEncoder } from "node:util";

import { writeFileHandle, writeOpfsPathViaWorker } from "./writeFileHandle.mjs";

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}

describe("writeFileHandle", () => {
  it("uses createWritable when available", async () => {
    const writable = {
      write: jest.fn(),
      close: jest.fn(),
    };

    const fileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };

    await writeFileHandle(fileHandle, "hello");

    expect(fileHandle.createWritable).toHaveBeenCalledTimes(1);
    expect(writable.write).toHaveBeenCalledWith("hello");
    expect(writable.close).toHaveBeenCalledTimes(1);
  });

  it("falls back to legacy createWriteable", async () => {
    const writable = {
      write: jest.fn(),
      close: jest.fn(),
    };

    const fileHandle = {
      createWriteable: jest.fn().mockResolvedValue(writable),
    };

    await writeFileHandle(fileHandle, "hello");

    expect(fileHandle.createWriteable).toHaveBeenCalledTimes(1);
    expect(writable.write).toHaveBeenCalledWith("hello");
    expect(writable.close).toHaveBeenCalledTimes(1);
  });

  it("falls back to createSyncAccessHandle when stream writer is unavailable", async () => {
    const syncHandle = {
      truncate: jest.fn(),
      write: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
    };

    const fileHandle = {
      createSyncAccessHandle: jest.fn().mockResolvedValue(syncHandle),
    };

    await writeFileHandle(fileHandle, "abc");

    expect(fileHandle.createSyncAccessHandle).toHaveBeenCalledTimes(1);
    expect(syncHandle.truncate).toHaveBeenCalledWith(0);
    expect(syncHandle.write).toHaveBeenCalledWith(
      new Uint8Array([97, 98, 99]),
      { at: 0 },
    );
    expect(syncHandle.flush).toHaveBeenCalledTimes(1);
    expect(syncHandle.close).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when no writable APIs are available", async () => {
    await expect(writeFileHandle({}, "x")).rejects.toThrow(
      "Writable file streams are not supported",
    );
  });
});

describe("writeOpfsPathViaWorker", () => {
  it("throws when Worker is not available", async () => {
    // jest-jsdom does not expose Worker.
    await expect(
      writeOpfsPathViaWorker(["shadowclaw", "groups", "g1", "f.txt"], "x"),
    ).rejects.toThrow("Writable file streams are not supported");
  });

  it("sends path segments and bytes to the inline worker", async () => {
    let postedData;
    let postedTransfer;
    let onMessageHandler;
    const fakeWorker = {
      terminate: jest.fn(),
      postMessage: jest.fn((data, transfer) => {
        postedData = data;
        postedTransfer = transfer;
        setTimeout(() => onMessageHandler({ data: { ok: true } }), 0);
      }),
      set onmessage(fn) {
        onMessageHandler = fn;
      },
      set onerror(_fn) {},
    };

    const origWorker = globalThis.Worker;
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    try {
      // @ts-ignore
      globalThis.Worker = jest.fn(() => fakeWorker);
      // @ts-ignore
      URL.createObjectURL = jest.fn(() => "blob:mock");
      URL.revokeObjectURL = jest.fn();

      const segments = ["shadowclaw", "groups", "g1", "hello.txt"];
      await writeOpfsPathViaWorker(segments, "hello worker");

      expect(globalThis.Worker).toHaveBeenCalledTimes(1);
      expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1);
      expect(postedData.pathSegments).toEqual(segments);
      expect(postedData.bytes).toEqual(
        new TextEncoder().encode("hello worker"),
      );
      expect(postedTransfer).toEqual([postedData.bytes.buffer]);
      expect(fakeWorker.terminate).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.Worker = origWorker;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it("rejects when the inline worker reports an error", async () => {
    let onMessageHandler;
    const fakeWorker = {
      terminate: jest.fn(),
      postMessage: jest.fn(() => {
        setTimeout(
          () => onMessageHandler({ data: { error: "sync handle failed" } }),
          0,
        );
      }),
      set onmessage(fn) {
        onMessageHandler = fn;
      },
      set onerror(_fn) {},
    };

    const origWorker = globalThis.Worker;
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    try {
      // @ts-ignore
      globalThis.Worker = jest.fn(() => fakeWorker);
      // @ts-ignore
      URL.createObjectURL = jest.fn(() => "blob:mock");
      URL.revokeObjectURL = jest.fn();

      await expect(
        writeOpfsPathViaWorker(["shadowclaw", "f.txt"], "x"),
      ).rejects.toThrow("sync handle failed");
    } finally {
      globalThis.Worker = origWorker;
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });
});
