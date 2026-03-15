import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();
const mockParsePath = jest.fn();

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({
  parsePath: mockParsePath,
}));

const { readGroupFileBytes } = await import("./readGroupFileBytes.mjs");

describe("readGroupFileBytes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads bytes via OPFS sync access handle when available", async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]); // %PDF
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
    mockParsePath.mockReturnValue({ dirs: ["nested"], filename: "a.pdf" });

    const content = await readGroupFileBytes({}, "g1", "nested/a.pdf");

    expect(Array.from(content)).toEqual(Array.from(bytes));

    expect(groupDir.getDirectoryHandle).toHaveBeenCalledWith("nested");

    expect(groupDir.getFileHandle).toHaveBeenCalledWith("a.pdf");

    expect(fileHandle.createSyncAccessHandle).toHaveBeenCalledTimes(1);

    expect(syncHandle.close).toHaveBeenCalledTimes(1);
  });

  it("falls back to File API arrayBuffer when sync access is unavailable", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fileHandle = {
      createSyncAccessHandle: jest.fn(async () => {
        throw new Error("not-opfs");
      }),
      getFile: jest.fn(async () => ({
        arrayBuffer: async () => bytes.buffer,
      })),
    };

    const groupDir = {
      getDirectoryHandle: jest.fn(async () => groupDir),
      getFileHandle: jest.fn(async () => fileHandle),
    };

    mockGetGroupDir.mockResolvedValue(groupDir);
    mockParsePath.mockReturnValue({ dirs: [], filename: "b.bin" });

    const content = await readGroupFileBytes({}, "g2", "b.bin");

    expect(Array.from(content)).toEqual([1, 2, 3, 4]);

    expect(fileHandle.getFile).toHaveBeenCalledTimes(1);
  });
});
