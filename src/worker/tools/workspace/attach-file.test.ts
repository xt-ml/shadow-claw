import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

const { executeAttachFile } = await import("./attach-file.js");
const { readGroupFile } = await import("../../../storage/readGroupFile.js");

describe("executeAttachFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if path is missing or not a string", async () => {
    const result1 = await executeAttachFile(mockDb, {}, groupId);
    expect(result1).toBe(
      "Error: attach_file_to_chat requires a valid path string.",
    );

    const result2 = await executeAttachFile(mockDb, { path: 42 }, groupId);
    expect(result2).toBe(
      "Error: attach_file_to_chat requires a valid path string.",
    );
  });

  it("returns error if path is empty", async () => {
    const result = await executeAttachFile(mockDb, { path: "   " }, groupId);
    expect(result).toBe(
      "Error: attach_file_to_chat received an empty file path.",
    );
  });

  it("returns error if path contains traversal '..' segments", async () => {
    const result = await executeAttachFile(
      mockDb,
      { path: "../secret.txt" },
      groupId,
    );
    expect(result).toBe(
      "Error: attach_file_to_chat path cannot contain '..' segments.",
    );
  });

  it("returns error when file does not exist", async () => {
    (readGroupFile as jest.Mock<any>).mockRejectedValue(new Error("Not found"));

    const result = await executeAttachFile(
      mockDb,
      { path: "missing.md" },
      groupId,
    );
    expect(result).toContain("could not find missing.md: Not found");
  });

  it("prepares standard markdown link for regular file", async () => {
    (readGroupFile as jest.Mock<any>).mockResolvedValue("file content");

    const result = await executeAttachFile(
      mockDb,
      { path: "docs/guide.md", alt: "User Guide" },
      groupId,
    );

    expect(result).toContain("Attachment prepared: docs/guide.md");
    expect(result).toContain("[User Guide](docs/guide.md)");
  });

  it("prepares image markdown syntax for image file", async () => {
    (readGroupFile as jest.Mock<any>).mockResolvedValue("image data");

    const result = await executeAttachFile(
      mockDb,
      { path: "images/banner.png" },
      groupId,
    );

    expect(result).toContain("Attachment prepared: images/banner.png");
    expect(result).toContain("![banner.png](images/banner.png)");
  });
});
