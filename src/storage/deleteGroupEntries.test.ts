import { jest } from "@jest/globals";

const getGroupDir = jest.fn();
const parsePath = jest.fn();

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir,
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath,
}));

const { deleteGroupFile } = await import("./deleteGroupFile.js");
const { deleteGroupDirectory } = await import("./deleteGroupDirectory.js");

describe("deleteGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes a file from nested directory", async () => {
    const dir: any = {
      getDirectoryHandle: jest.fn(async () => dir),
      removeEntry: jest.fn(async () => {}),
    };

    (getGroupDir as any).mockResolvedValue(dir);
    (parsePath as any).mockReturnValue({
      dirs: ["a", "b"],
      filename: "file.txt",
    });

    await deleteGroupFile({} as any, "g1", "a/b/file.txt");

    expect(getGroupDir).toHaveBeenCalledWith({} as any, "g1");

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
    const dir: any = {
      getDirectoryHandle: jest.fn(async () => dir),
      removeEntry: jest.fn(async () => {}),
    };

    (getGroupDir as any).mockResolvedValue(dir);
    (parsePath as any).mockReturnValue({ dirs: ["x"], filename: "to-remove" });

    await deleteGroupDirectory({} as any, "g2", "x/to-remove/");

    expect(getGroupDir).toHaveBeenCalledWith({} as any, "g2");

    expect(parsePath).toHaveBeenCalledWith("x/to-remove");

    expect(dir.getDirectoryHandle).toHaveBeenCalledWith("x");

    expect(dir.removeEntry).toHaveBeenCalledWith("to-remove", {
      recursive: true,
    });
  });
});
