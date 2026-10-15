import { jest } from "@jest/globals";

const mockCopyGroupEntry = jest.fn() as any;
const mockGetGroupDir = jest.fn() as any;
const mockParsePath = jest.fn() as any;

jest.unstable_mockModule("./copy-group-entry.js", () => ({
  copyGroupEntry: mockCopyGroupEntry,
}));

jest.unstable_mockModule("./get-group-dir.js", () => ({
  getGroupDir: mockGetGroupDir,
}));

jest.unstable_mockModule("./parse-path.js", () => ({
  parsePath: mockParsePath,
}));

const { moveGroupEntry } = await import("./move-group-entry.js");

describe("moveGroupEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("moves a file by copying and deleting the source", async () => {
    const parentDir: any = {
      removeEntry: jest.fn(async () => undefined),
    };

    const rootDir: any = {
      getDirectoryHandle: jest.fn(async (name: string) => {
        if (name === "src") {
          return parentDir;
        }

        throw new Error("missing");
      }),
    };

    mockGetGroupDir.mockResolvedValue(rootDir);
    mockParsePath.mockReturnValue({ dirs: ["src"], filename: "old.txt" });
    mockCopyGroupEntry.mockResolvedValue(undefined);

    await moveGroupEntry({} as any, "g", "g", "src/old.txt", "tgt/new.txt");

    expect(mockCopyGroupEntry).toHaveBeenCalledWith(
      {} as any,
      "g",
      "g",
      "src/old.txt",
      "tgt/new.txt",
    );
    expect(rootDir.getDirectoryHandle).toHaveBeenCalledWith("src");
    expect(parentDir.removeEntry).toHaveBeenCalledWith("old.txt", {
      recursive: true,
    });
  });
});
