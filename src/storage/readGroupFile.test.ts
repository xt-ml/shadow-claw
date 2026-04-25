import { jest } from "@jest/globals";

const mockGetGroupDir = jest.fn();
const mockParsePath = jest.fn();

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: mockParsePath,
}));

const { readGroupFile } = await import("./readGroupFile.js");

describe("readGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads via OPFS sync access handle when available", async () => {
    const originalTextDecoder = globalThis.TextDecoder;

    (globalThis.TextDecoder as any) = class {
      decode() {
        return "hello";
      }
    };

    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    const syncHandle: any = {
      getSize: jest.fn(() => bytes.length),
      read: jest.fn((buf: any) => {
        buf.set(bytes);
      }),
      close: jest.fn(),
    };

    const fileHandle: any = {
      createSyncAccessHandle: jest.fn(async () => syncHandle),
    };

    const groupDir: any = {
      getDirectoryHandle: jest.fn(async () => groupDir),
      getFileHandle: jest.fn(async () => fileHandle),
    };

    (mockGetGroupDir as any).mockResolvedValue(groupDir);
    (mockParsePath as any).mockReturnValue({
      dirs: ["nested"],
      filename: "a.txt",
    });

    const content = await readGroupFile({} as any, "g1", "nested/a.txt");

    expect(content).toBe("hello");

    expect(groupDir.getDirectoryHandle).toHaveBeenCalledWith("nested");

    expect(groupDir.getFileHandle).toHaveBeenCalledWith("a.txt");

    expect(fileHandle.createSyncAccessHandle).toHaveBeenCalledTimes(1);

    expect(syncHandle.close).toHaveBeenCalledTimes(1);

    globalThis.TextDecoder = originalTextDecoder;
  });

  it("falls back to File API when sync access is unavailable", async () => {
    const fileHandle: any = {
      createSyncAccessHandle: jest.fn(async () => {
        throw new Error("not-opfs");
      }),
      getFile: jest.fn(async () => ({ text: async () => "fallback" })),
    };

    const groupDir: any = {
      getDirectoryHandle: jest.fn(async () => groupDir),
      getFileHandle: jest.fn(async () => fileHandle),
    };

    (mockGetGroupDir as any).mockResolvedValue(groupDir);
    (mockParsePath as any).mockReturnValue({ dirs: [], filename: "b.txt" });

    const content = await readGroupFile({} as any, "g2", "b.txt");

    expect(content).toBe("fallback");

    expect(fileHandle.getFile).toHaveBeenCalledTimes(1);
  });
});
