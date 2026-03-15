import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/readGroupFile.mjs", () => ({
  readGroupFile: jest.fn(),
}));

describe("safeRead", () => {
  let safeRead;
  let readGroupFile;

  beforeEach(async () => {
    const readGroupFileModule = await import("../storage/readGroupFile.mjs");
    readGroupFile = readGroupFileModule.readGroupFile;

    const safeReadModule = await import("./safeRead.mjs");
    safeRead = safeReadModule.safeRead;
  });

  const db = /** @type {any} */ ({});
  const groupId = "test-group";
  const path = "test.txt";

  it("should return file content on successful read", async () => {
    const mockContent = "hello world";
    readGroupFile.mockResolvedValue(mockContent);

    const result = await safeRead(db, groupId, path);

    expect(result).toBe(mockContent);

    expect(readGroupFile).toHaveBeenCalledWith(db, groupId, path);
  });

  it("should return null when readGroupFile throws", async () => {
    readGroupFile.mockRejectedValue(new Error("File not found"));

    const result = await safeRead(db, groupId, path);

    expect(result).toBeNull();
  });
});
