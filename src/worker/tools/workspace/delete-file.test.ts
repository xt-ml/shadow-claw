import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/deleteGroupFile.js", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../../storage/deleteGroupDirectory.js", () => ({
  deleteGroupDirectory: jest.fn(),
}));

const { executeDeleteFile } = await import("./delete-file.js");
const { deleteGroupFile } = await import("../../../storage/deleteGroupFile.js");
const { deleteGroupDirectory } =
  await import("../../../storage/deleteGroupDirectory.js");

describe("executeDeleteFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws error when path parameter is missing", async () => {
    await expect(executeDeleteFile(mockDb, {}, groupId)).rejects.toThrow(
      "Missing path parameter",
    );
  });

  it("deletes a file when deleteGroupFile succeeds", async () => {
    (deleteGroupFile as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executeDeleteFile(
      mockDb,
      { path: "file.txt" },
      groupId,
    );
    expect(result).toBe("Deleted file: file.txt");
    expect(deleteGroupFile).toHaveBeenCalledWith(mockDb, groupId, "file.txt");
    expect(deleteGroupDirectory).not.toHaveBeenCalled();
  });

  it("falls back to deleteGroupDirectory when deleteGroupFile fails", async () => {
    (deleteGroupFile as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Is a directory"),
    );
    (deleteGroupDirectory as jest.Mock<any>).mockResolvedValueOnce(undefined);

    const result = await executeDeleteFile(
      mockDb,
      { path: "some-dir" },
      groupId,
    );
    expect(result).toBe("Deleted directory: some-dir");
    expect(deleteGroupDirectory).toHaveBeenCalledWith(
      mockDb,
      groupId,
      "some-dir",
    );
  });

  it("re-throws original error if both file and directory delete fail", async () => {
    const fileError = new Error("File delete error");
    (deleteGroupFile as jest.Mock<any>).mockRejectedValueOnce(fileError);
    (deleteGroupDirectory as jest.Mock<any>).mockRejectedValueOnce(
      new Error("Dir error"),
    );

    await expect(
      executeDeleteFile(mockDb, { path: "bad-path" }, groupId),
    ).rejects.toThrow("File delete error");
  });
});
