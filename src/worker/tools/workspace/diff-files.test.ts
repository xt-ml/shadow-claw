import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

const { executeDiffFiles } = await import("./diff-files.js");
const { readGroupFile } = await import("../../../storage/readGroupFile.js");

describe("executeDiffFiles", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if path_a or path_b is missing", async () => {
    const result1 = await executeDiffFiles(
      mockDb,
      { path_a: "a.txt" },
      groupId,
    );
    expect(result1).toBe("Error: path_a and path_b are required.");

    const result2 = await executeDiffFiles(
      mockDb,
      { path_b: "b.txt" },
      groupId,
    );
    expect(result2).toBe("Error: path_a and path_b are required.");
  });

  it("returns error when reading path_a fails", async () => {
    (readGroupFile as jest.Mock<any>).mockRejectedValueOnce(
      new Error("File A not found"),
    );

    const result = await executeDiffFiles(
      mockDb,
      { path_a: "missing_a.txt", path_b: "b.txt" },
      groupId,
    );

    expect(result).toContain(
      "Error reading missing_a.txt: Error: File A not found",
    );
  });

  it("returns error when reading path_b fails", async () => {
    (readGroupFile as jest.Mock<any>)
      .mockResolvedValueOnce("content a")
      .mockRejectedValueOnce(new Error("File B not found"));

    const result = await executeDiffFiles(
      mockDb,
      { path_a: "a.txt", path_b: "missing_b.txt" },
      groupId,
    );

    expect(result).toContain(
      "Error reading missing_b.txt: Error: File B not found",
    );
  });

  it("returns identical message when files match exactly", async () => {
    (readGroupFile as jest.Mock<any>)
      .mockResolvedValueOnce("line 1\nline 2")
      .mockResolvedValueOnce("line 1\nline 2");

    const result = await executeDiffFiles(
      mockDb,
      { path_a: "a.txt", path_b: "b.txt" },
      groupId,
    );

    expect(result).toBe("Files are identical.");
  });

  it("produces unified-like line diff when files differ", async () => {
    (readGroupFile as jest.Mock<any>)
      .mockResolvedValueOnce("line 1\nline 2 original\nline 3")
      .mockResolvedValueOnce("line 1\nline 2 modified\nline 3");

    const result = await executeDiffFiles(
      mockDb,
      { path_a: "a.txt", path_b: "b.txt" },
      groupId,
    );

    expect(result).toContain("- [Line 2] line 2 original");
    expect(result).toContain("+ [Line 2] line 2 modified");
  });
});
