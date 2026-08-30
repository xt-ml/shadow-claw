import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/groupFileExists.js", () => ({
  groupFileExists: jest.fn(),
}));

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeOpenFile } = await import("./open-file.js");
const { groupFileExists } = await import("../../../storage/groupFileExists.js");
const { post } = await import("../../utils/post.js");

describe("executeOpenFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if path is missing or invalid", async () => {
    const result1 = await executeOpenFile(mockDb, {}, groupId);
    expect(result1).toBe("Error: open_file requires a valid path string.");

    const result2 = await executeOpenFile(mockDb, { path: 123 }, groupId);
    expect(result2).toBe("Error: open_file requires a valid path string.");
  });

  it("returns error if file does not exist", async () => {
    (groupFileExists as jest.Mock<any>).mockResolvedValue(false);

    const result = await executeOpenFile(
      mockDb,
      { path: "missing.txt" },
      groupId,
    );
    expect(result).toBe("Error: file not found: missing.txt");
    expect(post).not.toHaveBeenCalled();
  });

  it("posts open-file event and returns success when file exists", async () => {
    (groupFileExists as jest.Mock<any>).mockResolvedValue(true);

    const result = await executeOpenFile(
      mockDb,
      { path: "document.pdf" },
      groupId,
    );
    expect(result).toBe("Opening file in viewer: document.pdf");
    expect(post).toHaveBeenCalledWith({
      type: "open-file",
      payload: { groupId, path: "document.pdf" },
    });
  });
});
