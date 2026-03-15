import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({ parsePath: jest.fn() }));
jest.unstable_mockModule("./storage.mjs", () => ({
  getStorageStatus: jest.fn().mockResolvedValue({
    type: "opfs",
    permission: "granted",
    name: "OPFS",
  }),
}));
jest.unstable_mockModule("./writeFileHandle.mjs", () => ({
  writeFileHandle: jest.fn().mockResolvedValue(undefined),
  writeOpfsPathViaWorker: jest.fn().mockResolvedValue(undefined),
}));

const { writeGroupFile } = await import("./writeGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");
const { getStorageStatus } = await import("./storage.mjs");
const { writeFileHandle, writeOpfsPathViaWorker } =
  await import("./writeFileHandle.mjs");

describe("writeGroupFile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("writes text content to target file", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };

    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    await writeGroupFile({}, "g", "d/f.txt", "hello");

    expect(writeFileHandle).toHaveBeenCalledWith(fileHandle, "hello");
  });

  it("falls back to OPFS worker write only when direct handle write is unsupported", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    writeFileHandle.mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await writeGroupFile({}, "g:01", "d/f.txt", "hello");

    expect(getStorageStatus).toHaveBeenCalledTimes(1);
    expect(writeOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "g-01", "d", "f.txt"],
      "hello",
    );
  });

  it("does not fallback to OPFS worker write for local-folder storage", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    getStorageStatus.mockResolvedValueOnce({
      type: "local",
      permission: "granted",
      name: "My Folder",
    });

    writeFileHandle.mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await expect(
      writeGroupFile({}, "g:01", "d/f.txt", "hello"),
    ).rejects.toThrow("Writable file streams are not supported");

    expect(writeOpfsPathViaWorker).not.toHaveBeenCalled();
  });
});
