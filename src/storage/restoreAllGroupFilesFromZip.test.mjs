import { jest } from "@jest/globals";

const mockEntry = {
  directory: false,
  filename: "a/b.txt",
  getData: jest.fn(async () => new Blob(["x"])),
};

jest.unstable_mockModule("zip", () => ({
  BlobReader: class {},
  BlobWriter: class {},
  ZipReader: class {
    async getEntries() {
      return [mockEntry];
    }
    async close() {}
  },
}));

jest.unstable_mockModule("./deleteAllGroupFiles.mjs", () => ({
  deleteAllGroupFiles: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

const { restoreAllGroupFilesFromZip } =
  await import("./restoreAllGroupFilesFromZip.mjs");
const { deleteAllGroupFiles } = await import("./deleteAllGroupFiles.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");

describe("restoreAllGroupFilesFromZip", () => {
  it("clears existing files and writes extracted entries", async () => {
    const writable = { write: jest.fn(), close: jest.fn() };
    const fileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };
    const nested = {
      getDirectoryHandle: jest.fn().mockResolvedValue({
        getFileHandle: jest.fn().mockResolvedValue(fileHandle),
      }),
    };
    getGroupDir.mockResolvedValue(nested);

    await restoreAllGroupFilesFromZip({}, "g", new Blob(["zip"]));

    expect(deleteAllGroupFiles).toHaveBeenCalledWith({}, "g");
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalled();
  });
});
