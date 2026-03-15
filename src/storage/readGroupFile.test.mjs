import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();
const mockParsePath = jest.fn();

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({
  parsePath: mockParsePath,
}));

const { readGroupFile } = await import("./readGroupFile.mjs");

describe("readGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads via OPFS sync access handle when available", async () => {
    const originalTextDecoder = globalThis.TextDecoder;
    globalThis.TextDecoder = class {
      decode() {
        return "hello";
      }
    };

    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    const syncHandle = {
      getSize: jest.fn(() => bytes.length),
      read: jest.fn((buf) => {
        buf.set(bytes);
      }),
      close: jest.fn(),
    };

    const fileHandle = {
      createSyncAccessHandle: jest.fn(async () => syncHandle),
    };

    const groupDir = {
      getDirectoryHandle: jest.fn(async () => groupDir),
      getFileHandle: jest.fn(async () => fileHandle),
    };

    mockGetGroupDir.mockResolvedValue(groupDir);
    mockParsePath.mockReturnValue({ dirs: ["nested"], filename: "a.txt" });

    const content = await readGroupFile({}, "g1", "nested/a.txt");

    expect(content).toBe("hello");

    expect(groupDir.getDirectoryHandle).toHaveBeenCalledWith("nested");

    expect(groupDir.getFileHandle).toHaveBeenCalledWith("a.txt");

    expect(fileHandle.createSyncAccessHandle).toHaveBeenCalledTimes(1);

    expect(syncHandle.close).toHaveBeenCalledTimes(1);

    globalThis.TextDecoder = originalTextDecoder;
  });

  it("falls back to File API when sync access is unavailable", async () => {
    const fileHandle = {
      createSyncAccessHandle: jest.fn(async () => {
        throw new Error("not-opfs");
      }),
      getFile: jest.fn(async () => ({ text: async () => "fallback" })),
    };

    const groupDir = {
      getDirectoryHandle: jest.fn(async () => groupDir),
      getFileHandle: jest.fn(async () => fileHandle),
    };

    mockGetGroupDir.mockResolvedValue(groupDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "b.txt" });

    const content = await readGroupFile({}, "g2", "b.txt");

    expect(content).toBe("fallback");

    expect(fileHandle.getFile).toHaveBeenCalledTimes(1);
  });
});
