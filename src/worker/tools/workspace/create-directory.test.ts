import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/createGroupDirectory.js", () => ({
  createGroupDirectory: jest.fn(),
}));

const { executeCreateDirectory } = await import("./create-directory.js");
const { createGroupDirectory } =
  await import("../../../storage/createGroupDirectory.js");

describe("executeCreateDirectory", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws error when path parameter is missing", async () => {
    await expect(executeCreateDirectory(mockDb, {}, groupId)).rejects.toThrow(
      "Missing path parameter",
    );
  });

  it("creates directory successfully", async () => {
    (createGroupDirectory as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeCreateDirectory(
      mockDb,
      { path: "docs/images" },
      groupId,
    );
    expect(result).toBe("Created directory docs/images");
    expect(createGroupDirectory).toHaveBeenCalledWith(
      mockDb,
      groupId,
      "docs/images",
    );
  });
});
