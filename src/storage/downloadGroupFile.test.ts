import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({ parsePath: jest.fn() }));

const { downloadGroupFile } = await import("./downloadGroupFile.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");

describe("downloadGroupFile", () => {
  it("creates link and triggers click", async () => {
    const file = new Blob(["x"]);

    const fileHandle: any = {
      getFile: (jest.fn() as any).mockResolvedValue(file),
    };

    const nested: any = {
      getFileHandle: (jest.fn() as any).mockResolvedValue(fileHandle),
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: ["d"], filename: "f.txt" });

    URL.createObjectURL ||= () => "";
    URL.revokeObjectURL ||= () => {};
    const urlSpy = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:1");
    const revokeSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await downloadGroupFile({} as any, "g", "d/f.txt");

    expect(urlSpy).toHaveBeenCalled();

    expect(clickSpy).toHaveBeenCalled();

    expect(revokeSpy).toHaveBeenCalledWith("blob:1");

    urlSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
