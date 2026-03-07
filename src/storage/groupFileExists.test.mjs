import { jest } from "@jest/globals";

// Mock readGroupFile
jest.unstable_mockModule("./readGroupFile.mjs", () => ({
  readGroupFile: jest.fn(),
}));

const { groupFileExists } = await import("./groupFileExists.mjs");
const { readGroupFile } = await import("./readGroupFile.mjs");

describe("groupFileExists", () => {
  const db = {};
  const groupId = "test-group";
  const filePath = "test.txt";

  it("should return true if file can be read", async () => {
    readGroupFile.mockResolvedValue("content");
    const exists = await groupFileExists(db, groupId, filePath);
    expect(exists).toBe(true);
  });

  it("should return false if file cannot be read", async () => {
    readGroupFile.mockRejectedValue(new Error("File not found"));
    const exists = await groupFileExists(db, groupId, filePath);
    expect(exists).toBe(false);
  });
});
