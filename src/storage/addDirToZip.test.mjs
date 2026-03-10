import { jest } from "@jest/globals";

jest.unstable_mockModule("zip", () => ({
  BlobReader: class {
    constructor(file) {
      this.file = file;
    }
  },
}));

const { addDirToZip } = await import("./addDirToZip.mjs");

describe("addDirToZip", () => {
  it("recursively adds files with full paths", async () => {
    const fileHandle = {
      kind: "file",
      getFile: jest.fn().mockResolvedValue(new Blob(["x"])),
    };

    const nestedDir = {
      kind: "directory",
      entries: async function* () {
        yield ["b.txt", fileHandle];
      },
    };

    const root = {
      entries: async function* () {
        yield ["a", nestedDir];
      },
    };

    const zipWriter = { add: jest.fn().mockResolvedValue(undefined) };
    await addDirToZip(zipWriter, root);

    expect(zipWriter.add).toHaveBeenCalledWith("a/b.txt", expect.any(Object));
  });
});
