import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/copyGroupEntry.js", () => ({
  copyGroupEntry: jest.fn(),
}));

const { executeCopyFile } = await import("./copy-file.js");
const { copyGroupEntry } = await import("../../../storage/copyGroupEntry.js");

describe("executeCopyFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws error when source_path or target_path is missing", async () => {
    await expect(
      executeCopyFile(mockDb, { source_path: "a" }, groupId),
    ).rejects.toThrow("Missing source_path or target_path parameter");
    await expect(
      executeCopyFile(mockDb, { target_path: "b" }, groupId),
    ).rejects.toThrow("Missing source_path or target_path parameter");
  });

  it("copies entry within same group", async () => {
    (copyGroupEntry as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeCopyFile(
      mockDb,
      { source_path: "docs/a.md", target_path: "docs/b.md" },
      groupId,
    );

    expect(result).toBe("Copied docs/a.md to docs/b.md");
    expect(copyGroupEntry).toHaveBeenCalledWith(
      mockDb,
      groupId,
      groupId,
      "docs/a.md",
      "docs/b.md",
    );
  });

  it("copies entry across different groups", async () => {
    (copyGroupEntry as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeCopyFile(
      mockDb,
      {
        source_path: "a.md",
        target_path: "b.md",
        source_group_id: "group-1",
        target_group_id: "group-2",
      },
      groupId,
    );

    expect(result).toBe("Copied a.md to b.md (from group-1 to group-2)");
    expect(copyGroupEntry).toHaveBeenCalledWith(
      mockDb,
      "group-1",
      "group-2",
      "a.md",
      "b.md",
    );
  });
});
