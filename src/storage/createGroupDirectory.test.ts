import { jest } from "@jest/globals";

jest.unstable_mockModule("./getGroupDir.js", () => ({
  getGroupDir: jest.fn(),
}));

jest.unstable_mockModule("./storage.js", () => ({
  invalidateStorageRoot: jest.fn(),
  isStaleHandleError: (jest.fn() as any).mockReturnValue(false),
}));

const { createGroupDirectory } = await import("./createGroupDirectory.js");
const { getGroupDir } = await import("./getGroupDir.js");

describe("createGroupDirectory", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("creates nested directories from a relative path", async () => {
    const innerDir: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue({}),
    };

    const root: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(innerDir),
    };

    (getGroupDir as any).mockResolvedValue(root);

    await createGroupDirectory({} as any, "group-1", "parent/child");

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("parent", {
      create: true,
    });

    expect(innerDir.getDirectoryHandle).toHaveBeenCalledWith("child", {
      create: true,
    });
  });

  it("throws for empty paths", async () => {
    await expect(
      createGroupDirectory({} as any, "group-1", ""),
    ).rejects.toThrow("Empty directory path");
  });
});
