import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/listGroupFiles.js", () => ({
  listGroupFiles: jest.fn(),
}));

const { executeListFiles } = await import("./list-files.js");
const { listGroupFiles } = await import("../../../storage/listGroupFiles.js");

describe("executeListFiles", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists entries when directory has files", async () => {
    (listGroupFiles as jest.Mock<any>).mockResolvedValue([
      "index.ts",
      "utils/",
    ]);

    const result = await executeListFiles(mockDb, { path: "src" }, groupId);
    expect(result).toBe("index.ts\nutils/");
    expect(listGroupFiles).toHaveBeenCalledWith(mockDb, groupId, "src");
  });

  it("defaults path to '.' and returns empty directory message when no files", async () => {
    (listGroupFiles as jest.Mock<any>).mockResolvedValue([]);

    const result = await executeListFiles(mockDb, {}, groupId);
    expect(result).toBe("(empty directory)");
    expect(listGroupFiles).toHaveBeenCalledWith(mockDb, groupId, ".");
  });
});
