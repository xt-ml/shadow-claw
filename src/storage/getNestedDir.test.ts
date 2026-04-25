import { getNestedDir } from "./getNestedDir.js";
import { jest } from "@jest/globals";

describe("getNestedDir", () => {
  it("should get a single level directory", async () => {
    const mockHandle: any = {
      getDirectoryHandle: (jest.fn() as any).mockResolvedValue("nested-handle"),
    };

    const result = await getNestedDir(mockHandle, "sub");

    expect(result).toBe("nested-handle");

    expect(mockHandle.getDirectoryHandle).toHaveBeenCalledWith("sub", {
      create: true,
    });
  });

  it("should get multiple levels of directories", async () => {
    const level2: any = { name: "level2" };
    const level1: any = {
      name: "level1",

      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(level2),
    };
    const root: any = {
      name: "root",

      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(level1),
    };

    const result = await getNestedDir(root, "a", "b");

    expect(result).toBe(level2);

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("a", { create: true });

    expect(level1.getDirectoryHandle).toHaveBeenCalledWith("b", {
      create: true,
    });
  });

  it("should return root if no segments provided", async () => {
    const root: any = { name: "root" };

    const result = await getNestedDir(root);

    expect(result).toBe(root);
  });

  it("should throw when isSameEntry detects a stale handle", async () => {
    const root: any = {
      name: "root",

      getDirectoryHandle: (jest.fn() as any).mockResolvedValue({
        name: "child",

        isSameEntry: (jest.fn() as any).mockResolvedValue(true),
      }),

      isSameEntry: (jest.fn() as any).mockResolvedValue(true),
    };

    await expect(getNestedDir(root, "child")).rejects.toThrow(
      /resolved to the same directory/,
    );
  });

  it("should succeed when isSameEntry returns false", async () => {
    const child: any = {
      name: "child",

      isSameEntry: (jest.fn() as any).mockResolvedValue(false),
    };
    const root: any = {
      name: "root",

      getDirectoryHandle: (jest.fn() as any).mockResolvedValue(child),

      isSameEntry: (jest.fn() as any).mockResolvedValue(false),
    };

    const result = await getNestedDir(root, "child");
    expect(result).toBe(child);
  });
});
