import { jest } from "@jest/globals";

jest.unstable_mockModule("@zip.js/zip.js", () => ({
  BlobWriter: class {
    async getData() {
      return new Blob(["z"]);
    }
  },
  ZipWriter: class {
    async add() {}
    async close() {}
  },
}));

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./addDirToZip.js", () => ({
  addDirToZip: (jest.fn() as any).mockResolvedValue(undefined),
}));

const { downloadAllGroupFilesAsZip } =
  await import("./downloadAllGroupFilesAsZip.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { addDirToZip } = await import("./addDirToZip.js");

describe("downloadAllGroupFilesAsZip", () => {
  it("zips group dir and triggers download", async () => {
    (getGroupDir as any).mockResolvedValue({} as any);

    URL.createObjectURL ||= () => "";
    URL.revokeObjectURL ||= () => {};

    const createSpy = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:zip");

    const revokeSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadAllGroupFilesAsZip({} as any, "g");

    expect(addDirToZip).toHaveBeenCalled();

    expect(createSpy).toHaveBeenCalled();

    expect(clickSpy).toHaveBeenCalled();

    expect(revokeSpy).toHaveBeenCalledWith("blob:zip");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
