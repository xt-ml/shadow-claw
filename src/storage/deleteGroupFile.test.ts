import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: jest.fn(),
}));

const { deleteGroupFile } = await import("./deleteGroupFile.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");

describe("deleteGroupFile", () => {
  it("navigates dirs and removes target file", async () => {
    const nested: any = {
      removeEntry: (jest.fn() as any).mockResolvedValue(undefined),
    };
    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(nested),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: ["a"], filename: "x.txt" });

    await deleteGroupFile({} as any, "g", "a/x.txt");

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("a");

    expect(nested.removeEntry).toHaveBeenCalledWith("x.txt");
  });
});
