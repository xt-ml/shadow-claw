import { jest } from "@jest/globals";

// Mock readGroupFile
jest.unstable_mockModule("./read-group-file.js", () => ({
  readGroupFile: jest.fn(),
}));

const { groupFileExists } = await import("./group-file-exists.js");
const { readGroupFile } = await import("./read-group-file.js");

describe("groupFileExists", () => {
  const db: any = {} as any;
  const groupId = "test-group";
  const filePath = "test.txt";

  it("should return true if file can be read", async () => {
    (readGroupFile as any).mockResolvedValue("content");

    const exists = await groupFileExists(db, groupId, filePath);

    expect(exists).toBe(true);
  });

  it("should return false if file cannot be read", async () => {
    (readGroupFile as any).mockRejectedValue(new Error("File not found"));

    const exists = await groupFileExists(db, groupId, filePath);

    expect(exists).toBe(false);
  });
});
