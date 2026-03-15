import { jest } from "@jest/globals";

jest.unstable_mockModule("zip", () => ({
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

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./addDirToZip.mjs", () => ({
  addDirToZip: jest.fn().mockResolvedValue(undefined),
}));

const { downloadAllGroupFilesAsZip } =
  await import("./downloadAllGroupFilesAsZip.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { addDirToZip } = await import("./addDirToZip.mjs");

describe("downloadAllGroupFilesAsZip", () => {
  it("zips group dir and triggers download", async () => {
    getGroupDir.mockResolvedValue({});

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

    await downloadAllGroupFilesAsZip({}, "g");

    expect(addDirToZip).toHaveBeenCalled();

    expect(createSpy).toHaveBeenCalled();

    expect(clickSpy).toHaveBeenCalled();

    expect(revokeSpy).toHaveBeenCalledWith("blob:zip");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
