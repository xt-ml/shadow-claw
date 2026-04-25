import { jest } from "@jest/globals";

jest.unstable_mockModule("@zip.js/zip.js", () => ({
  BlobWriter: class {
    async getData() {
      return new Blob(["z"]);
    }
  },
  ZipWriter: class {
    async close() {}
  },
}));

jest.unstable_mockModule("./addDirToZip.js", () => ({
  addDirToZip: (jest.fn() as any).mockResolvedValue(undefined),
}));

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

const { downloadGroupDirectoryAsZip } =
  await import("./downloadGroupDirectoryAsZip.js");
const { getGroupDir } = await import("./getGroupDir.js");

describe("downloadGroupDirectoryAsZip", () => {
  it("walks to target dir and downloads zip", async () => {
    const child: any = {};

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(child),
    };

    (getGroupDir as any).mockResolvedValue(root);

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

    await downloadGroupDirectoryAsZip({} as any, "g", "logs");

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("logs");

    expect(clickSpy).toHaveBeenCalled();

    expect(revokeSpy).toHaveBeenCalledWith("blob:dir");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
