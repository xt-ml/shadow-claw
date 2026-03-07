import { jest } from "@jest/globals";

// Mock dependencies
jest.unstable_mockModule("./getNestedDir.mjs", () => ({
  getNestedDir: jest.fn(),
}));

jest.unstable_mockModule("./storage.mjs", () => ({
  getStorageRoot: jest.fn(),
}));

const { getGroupDir } = await import("./getGroupDir.mjs");
const { getNestedDir } = await import("./getNestedDir.mjs");
const { getStorageRoot } = await import("./storage.mjs");

describe("getGroupDir", () => {
  it("should sanitize groupId and call getNestedDir", async () => {
    const db = {};
    const root = { name: "root" };
    getStorageRoot.mockResolvedValue(root);
    getNestedDir.mockResolvedValue("group-dir-handle");

    const result = await getGroupDir(db, "user:123");

    expect(result).toBe("group-dir-handle");
    expect(getStorageRoot).toHaveBeenCalledWith(db);
    expect(getNestedDir).toHaveBeenCalledWith(root, "groups", "user-123");
  });

  it("should handle groupIds without colons", async () => {
    const db = {};
    const root = { name: "root" };
    getStorageRoot.mockResolvedValue(root);
    getNestedDir.mockResolvedValue("group-dir-handle");

    const result = await getGroupDir(db, "mygroup");

    expect(result).toBe("group-dir-handle");
    expect(getNestedDir).toHaveBeenCalledWith(root, "groups", "mygroup");
  });
});
