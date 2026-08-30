import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/moveGroupEntry.js", () => ({
  moveGroupEntry: jest.fn(),
}));

const { executeMoveFile } = await import("./move-file.js");
const { moveGroupEntry } = await import("../../../storage/moveGroupEntry.js");

describe("executeMoveFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws error when source_path or target_path is missing", async () => {
    await expect(
      executeMoveFile(mockDb, { source_path: "a" }, groupId),
    ).rejects.toThrow("Missing source_path or target_path parameter");
  });

  it("moves entry within same group", async () => {
    (moveGroupEntry as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeMoveFile(
      mockDb,
      { source_path: "old.md", target_path: "new.md" },
      groupId,
    );

    expect(result).toBe("Moved old.md to new.md");
    expect(moveGroupEntry).toHaveBeenCalledWith(
      mockDb,
      groupId,
      groupId,
      "old.md",
      "new.md",
    );
  });

  it("moves entry across different groups", async () => {
    (moveGroupEntry as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeMoveFile(
      mockDb,
      {
        source_path: "old.md",
        target_path: "new.md",
        source_group_id: "group-a",
        target_group_id: "group-b",
      },
      groupId,
    );

    expect(result).toBe("Moved old.md to new.md (from group-a to group-b)");
    expect(moveGroupEntry).toHaveBeenCalledWith(
      mockDb,
      "group-a",
      "group-b",
      "old.md",
      "new.md",
    );
  });
});
