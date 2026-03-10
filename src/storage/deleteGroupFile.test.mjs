import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({
  parsePath: jest.fn(),
}));

const { deleteGroupFile } = await import("./deleteGroupFile.mjs");
const { getGroupDir } = await import("./getGroupDir.mjs");
const { parsePath } = await import("./parsePath.mjs");

describe("deleteGroupFile", () => {
  it("navigates dirs and removes target file", async () => {
    const nested = { removeEntry: jest.fn().mockResolvedValue(undefined) };
    const root = {
      getDirectoryHandle: jest.fn().mockResolvedValue(nested),
    };
    getGroupDir.mockResolvedValue(root);
    parsePath.mockReturnValue({ dirs: ["a"], filename: "x.txt" });

    await deleteGroupFile({}, "g", "a/x.txt");

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("a");
    expect(nested.removeEntry).toHaveBeenCalledWith("x.txt");
  });
});
