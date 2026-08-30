import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/readGroupFile.js", () => ({
  readGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

const { executePatchFile } = await import("./patch-file.js");
const { readGroupFile } = await import("../../../storage/readGroupFile.js");
const { writeGroupFile } = await import("../../../storage/writeGroupFile.js");

describe("executePatchFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("patches file successfully when match is unique", async () => {
    (readGroupFile as jest.Mock<any>).mockResolvedValue(
      "const x = 1;\nconst y = 2;\n",
    );
    (writeGroupFile as jest.Mock<any>).mockResolvedValue(undefined);

    const result = await executePatchFile(
      mockDb,
      {
        path: "test.ts",
        old_string: "const x = 1;",
        new_string: "const x = 42;",
      },
      groupId,
    );

    expect(result).toBe("Patched test.ts (12 chars replaced with 13 chars)");
    expect(writeGroupFile).toHaveBeenCalledWith(
      mockDb,
      groupId,
      "test.ts",
      "const x = 42;\nconst y = 2;\n",
    );
  });

  it("returns error when old_string is not found", async () => {
    (readGroupFile as jest.Mock<any>).mockResolvedValue("const a = 1;");

    const result = await executePatchFile(
      mockDb,
      {
        path: "test.ts",
        old_string: "const missing = true;",
        new_string: "const fixed = true;",
      },
      groupId,
    );

    expect(result).toBe("patch_file failed: old_string not found in test.ts");
    expect(writeGroupFile).not.toHaveBeenCalled();
  });

  it("returns error when old_string matches multiple locations", async () => {
    (readGroupFile as jest.Mock<any>).mockResolvedValue("foo bar foo baz");

    const result = await executePatchFile(
      mockDb,
      {
        path: "test.txt",
        old_string: "foo",
        new_string: "qux",
      },
      groupId,
    );

    expect(result).toContain("matches multiple locations in test.txt");
    expect(writeGroupFile).not.toHaveBeenCalled();
  });
});
