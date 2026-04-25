import { jest } from "@jest/globals";

const mockEntry: any = {
  directory: false,
  filename: "a/b.txt",
  getData: jest.fn(async () => new Blob(["x"])),
};

jest.unstable_mockModule("@zip.js/zip.js", () => ({
  BlobReader: class {},
  BlobWriter: class {},
  ZipReader: class {
    async getEntries() {
      return [mockEntry];
    }

    async close() {}
  },
}));

jest.unstable_mockModule("./deleteAllGroupFiles.js", () => ({
  deleteAllGroupFiles: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

const { restoreAllGroupFilesFromZip } =
  await import("./restoreAllGroupFilesFromZip.js");
const { deleteAllGroupFiles } = await import("./deleteAllGroupFiles.js");
const { getGroupDir } = await import("./getGroupDir.js");

describe("restoreAllGroupFilesFromZip", () => {
  it("clears existing files and writes extracted entries", async () => {
    const writable: any = { write: jest.fn(), close: jest.fn() };
    const fileHandle: any = {
      createWritable: (jest.fn() as any).mockResolvedValue(writable),
    };
    const nested: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue({
        getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
      }),
    };

    (getGroupDir as any).mockResolvedValue(nested);

    await restoreAllGroupFilesFromZip({} as any, "g", new Blob(["zip"]));

    expect(deleteAllGroupFiles).toHaveBeenCalledWith({} as any, "g");

    expect(writable.write).toHaveBeenCalled();

    expect(writable.close).toHaveBeenCalled();
  });
});
