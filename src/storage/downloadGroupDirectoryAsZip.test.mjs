import { jest } from "@jest/globals";

jest.unstable_mockModule("zip", () => ({
  BlobWriter: class {
    async getData() {
      return new Blob(["z"]);
    }
  },
  ZipWriter: class {
    async close() {}
  },
}));

jest.unstable_mockModule("./addDirToZip.mjs", () => ({
  addDirToZip: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

const { downloadGroupDirectoryAsZip } =
  await import("./downloadGroupDirectoryAsZip.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");

describe("downloadGroupDirectoryAsZip", () => {
  it("walks to target dir and downloads zip", async () => {
    const child = {};
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(child) };
    getGroupDir.mockResolvedValue(root);

    URL.createObjectURL ||= () => "";
    URL.revokeObjectURL ||= () => {};

    const createSpy = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:dir");

    const revokeSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadGroupDirectoryAsZip({}, "g", "logs");

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("logs");

    expect(clickSpy).toHaveBeenCalled();

    expect(revokeSpy).toHaveBeenCalledWith("blob:dir");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
