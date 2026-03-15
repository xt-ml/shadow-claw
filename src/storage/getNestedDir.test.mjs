import { getNestedDir } from "./getNestedDir.mjs";
import { jest } from "@jest/globals";

describe("getNestedDir", () => {
  it("should get a single level directory", async () => {
    const mockHandle = {
      getDirectoryHandle: jest.fn().mockResolvedValue("nested-handle"),
    };

    const result = await getNestedDir(mockHandle, "sub");

    expect(result).toBe("nested-handle");

    expect(mockHandle.getDirectoryHandle).toHaveBeenCalledWith("sub", {
      create: true,
    });
  });

  it("should get multiple levels of directories", async () => {
    const level2 = { name: "level2" };
    const level1 = {
      name: "level1",
      getDirectoryHandle: jest.fn().mockResolvedValue(level2),
    };
    const root = {
      name: "root",
      getDirectoryHandle: jest.fn().mockResolvedValue(level1),
    };

    const result = await getNestedDir(root, "a", "b");

    expect(result).toBe(level2);

    expect(root.getDirectoryHandle).toHaveBeenCalledWith("a", { create: true });

    expect(level1.getDirectoryHandle).toHaveBeenCalledWith("b", {
      create: true,
    });
  });

  it("should return root if no segments provided", async () => {
    const root = { name: "root" };
    const result = await getNestedDir(root);

    expect(result).toBe(root);
  });
});
