import { jest } from "@jest/globals";

jest.unstable_mockModule("@zip.js/zip.js", () => ({
  BlobReader: class {
    constructor(file) {
      (this as any).file = file;
    }
  },
}));

const { addDirToZip } = await import("./addDirToZip.js");

describe("addDirToZip", () => {
  it("recursively adds files with full paths", async () => {
    const fileHandle: any = {
      kind: "file",

      getFile: (jest.fn() as any).mockResolvedValue(new Blob(["x"])),
    };

    const nestedDir: any = {
      kind: "directory",
      entries: async function* () {
        yield ["b.txt", fileHandle];
      },
    };

    const root: any = {
      entries: async function* () {
        yield ["a", nestedDir];
      },
    };

    const zipWriter: any = {
      add: (jest.fn() as any).mockResolvedValue(undefined),
    };

    await addDirToZip(zipWriter, root);

    expect(zipWriter.add).toHaveBeenCalledWith("a/b.txt", expect.any(Object));
  });
});
