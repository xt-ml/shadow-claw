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

const { uploadGroupFile } = await import("./uploadGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");
const { getStorageStatus } = await import("./storage.mjs");
const { writeFileHandle, writeOpfsPathViaWorker } =
  await import("./writeFileHandle.mjs");

describe("uploadGroupFile", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates nested dirs and writes blob", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };

    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.bin" });

    const blob = new Blob(["hi"]);
    await uploadGroupFile({}, "g", "d/f.bin", blob);

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("d", { create: true });
    expect(writeFileHandle).toHaveBeenCalledWith(fileHandle, blob);
  });

  it("falls back to OPFS worker write only when direct handle write is unsupported", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.bin" });

    const blob = new Blob(["hi"]);
    writeFileHandle.mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await uploadGroupFile({}, "g:01", "d/f.bin", blob);

    expect(getStorageStatus).toHaveBeenCalledTimes(1);
    expect(writeOpfsPathViaWorker).toHaveBeenCalledWith(
      ["shadowclaw", "groups", "g-01", "d", "f.bin"],
      blob,
    );
  });

  it("does not fallback to OPFS worker write for local-folder storage", async () => {
    const fileHandle = {};
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.bin" });

    getStorageStatus.mockResolvedValueOnce({
      type: "local",
      permission: "granted",
      name: "My Folder",
    });

    const blob = new Blob(["hi"]);
    writeFileHandle.mockRejectedValueOnce(
      new Error(
        "Writable file streams are not supported by this browser/storage backend.",
      ),
    );

    await expect(uploadGroupFile({}, "g:01", "d/f.bin", blob)).rejects.toThrow(
      "Writable file streams are not supported",
    );

    expect(writeOpfsPathViaWorker).not.toHaveBeenCalled();
  });
});
