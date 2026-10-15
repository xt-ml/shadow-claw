import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("./get-nested-dir.js", () => ({
  getNestedDir: jest.fn(),
}));

jest.unstable_mockModule("./storage.js", () => ({
  getOpfsRootDirName: jest.fn(() => "shadowclaw"),
  getStorageRoot: jest.fn(),
}));

const { getGroupDir } = await import("./get-group-dir.js");
const { getNestedDir } = await import("./get-nested-dir.js");
const { getStorageRoot } = await import("./storage.js");

describe("getGroupDir", () => {
  it("should sanitize groupId and call getNestedDir", async () => {
    const db: any = {} as any;
    const root: any = { name: "root" };

    (getStorageRoot as any).mockResolvedValue(root);

    (getNestedDir as any).mockResolvedValue("group-dir-handle");

    const result = await getGroupDir(db, "user:123");

    expect(result).toBe("group-dir-handle");

    expect(getStorageRoot).toHaveBeenCalledWith(db);

    expect(getNestedDir).toHaveBeenCalledWith(root, "groups", "user-123");
  });

  it("should handle groupIds without colons", async () => {
    const db: any = {} as any;
    const root: any = { name: "root" };

    (getStorageRoot as any).mockResolvedValue(root);

    (getNestedDir as any).mockResolvedValue("group-dir-handle");

    const result = await getGroupDir(db, "mygroup");

    expect(result).toBe("group-dir-handle");

    expect(getNestedDir).toHaveBeenCalledWith(root, "groups", "mygroup");
  });
});
