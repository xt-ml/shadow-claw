import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({ parsePath: jest.fn() }));

const { downloadGroupFile } = await import("./downloadGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");

describe("downloadGroupFile", () => {
  it("creates link and triggers click", async () => {
    const file = new Blob(["x"]);
    const fileHandle = { getFile: jest.fn().mockResolvedValue(file) };
    const nested = { getFileHandle: jest.fn().mockResolvedValue(fileHandle) };
    const root = { getDirectoryHandle: jest.fn().mockResolvedValue(nested) };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    URL.createObjectURL ||= () => "";
    URL.revokeObjectURL ||= () => {};
    const urlSpy = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:1");
    const revokeSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadGroupFile({}, "g", "d/f.txt");

    expect(urlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith("blob:1");

    urlSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
