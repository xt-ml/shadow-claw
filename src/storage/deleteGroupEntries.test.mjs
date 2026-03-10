import { jest } from "@jest/globals";

const getGroupDir = jest.fn();
const parsePath = jest.fn();

jest.unstable_mockModule("./getGroupDir.mjs", () => ({
  getGroupDir,
}));

jest.unstable_mockModule("./parsePath.mjs", () => ({
  parsePath,
}));

const { deleteGroupFile } = await import("./deleteGroupFile.mjs");
const { deleteGroupDirectory } = await import("./deleteGroupDirectory.mjs");

describe("deleteGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a file from nested directory", async () => {
    const dir = {
      getDirectoryHandle: jest.fn(async () => dir),
      removeEntry: jest.fn(async () => {}),
    };

    getGroupDir.mockResolvedValue(dir);
    parsePath.mockReturnValue({ dirs: ["a", "b"], filename: "file.txt" });

    await deleteGroupFile({}, "g1", "a/b/file.txt");

    expect(getGroupDir).toHaveBeenCalledWith({}, "g1");
    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("a");
    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("b");
    expect(dir.removeEntry).toHaveBeenCalledWith("file.txt");
  });
});

describe("deleteGroupDirectory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes directory recursively and trims trailing slash", async () => {
    const dir = {
      getDirectoryHandle: jest.fn(async () => dir),
      removeEntry: jest.fn(async () => {}),
    };

    getGroupDir.mockResolvedValue(dir);
    parsePath.mockReturnValue({ dirs: ["x"], filename: "to-remove" });

    await deleteGroupDirectory({}, "g2", "x/to-remove/");

    expect(getGroupDir).toHaveBeenCalledWith({}, "g2");
    expect(parsePath).toHaveBeenCalledWith("x/to-remove");
    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("x");
    expect(dir.removeEntry).toHaveBeenCalledWith("to-remove", {
      recursive: true,
    });
  });
});
