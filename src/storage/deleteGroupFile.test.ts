import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./parsePath.js", () => ({
  parsePath: jest.fn(),
}));

jest.unstable_mockModule("./ensureMainGroupMemory.js", () => ({
  setMainGroupMemorySuppressed: jest.fn(),
}));

jest.unstable_mockModule("./ensureMainGroupIndex.js", () => ({
  setMainGroupIndexSuppressed: jest.fn(),
}));

jest.unstable_mockModule("../config/config.js", () => ({
  DEFAULT_GROUP_ID: "br-main",
}));

const { deleteGroupFile } = await import("./deleteGroupFile.js");
const { getGroupDir } = await import("./getGroupDir.js");
const { parsePath } = await import("./parsePath.js");
const { setMainGroupMemorySuppressed } =
  await import("./ensureMainGroupMemory.js");
const { setMainGroupIndexSuppressed } =
  await import("./ensureMainGroupIndex.js");

describe("deleteGroupFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(setMainGroupMemorySuppressed).not.toHaveBeenCalled();
    expect(setMainGroupIndexSuppressed).not.toHaveBeenCalled();
  });

  it("suppresses MEMORY.md and index.html in main group when deleted", async () => {
    const root: any = {
      removeEntry: (jest.fn() as any).mockResolvedValue(undefined),
    };

    (getGroupDir as any).mockResolvedValue(root);

    (parsePath as any).mockReturnValue({ dirs: [], filename: "index.html" });
    await deleteGroupFile({} as any, "br-main", "index.html");

    expect(root.removeEntry).toHaveBeenCalledWith("index.html");
    expect(setMainGroupIndexSuppressed).toHaveBeenCalledWith(
      expect.anything(),
      true,
    );
    expect(setMainGroupMemorySuppressed).not.toHaveBeenCalled();

    jest.clearAllMocks();

    (parsePath as any).mockReturnValue({ dirs: [], filename: "MEMORY.md" });
    await deleteGroupFile({} as any, "br-main", "MEMORY.md");

    expect(root.removeEntry).toHaveBeenCalledWith("MEMORY.md");
    expect(setMainGroupMemorySuppressed).toHaveBeenCalledWith(
      expect.anything(),
      true,
    );
    expect(setMainGroupIndexSuppressed).not.toHaveBeenCalled();
  });
});
