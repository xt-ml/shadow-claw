import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

const { executeReadFile } = await import("./read-file.js");
const { readGroupFileBytes } =
  await import("../../../storage/readGroupFileBytes.js");

describe("executeReadFile", () => {
  const mockDb: any = {};
  const groupId = "test-group";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when neither path nor paths is provided", async () => {
    const result = await executeReadFile(mockDb, {}, groupId);
    expect(result).toBe("Error: read_file requires path or paths.");
  });

  it("reads a single text file successfully", async () => {
    (readGroupFileBytes as jest.Mock<any>).mockResolvedValue(
      new TextEncoder().encode("Hello from file!"),
    );

    const result = await executeReadFile(
      mockDb,
      { path: "hello.txt" },
      groupId,
    );
    expect(result).toBe("Hello from file!");
    expect(readGroupFileBytes).toHaveBeenCalledWith(
      mockDb,
      groupId,
      "hello.txt",
    );
  });

  it("handles single text file read error", async () => {
    (readGroupFileBytes as jest.Mock<any>).mockRejectedValue(
      new Error("File not found"),
    );

    const result = await executeReadFile(
      mockDb,
      { path: "missing.txt" },
      groupId,
    );
    expect(result).toBe("Error reading missing.txt: File not found");
  });

  it("returns error for single binary content", async () => {
    (readGroupFileBytes as jest.Mock<any>).mockResolvedValue(
      new Uint8Array([0x00, 0x01, 0x02, 0x00, 0xff]),
    );

    const result = await executeReadFile(
      mockDb,
      { path: "program.exe" },
      groupId,
    );
    expect(result).toContain(
      "is a binary file and cannot be displayed as text",
    );
  });

  it("reads a single image file as multimodal content blocks", async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    (readGroupFileBytes as jest.Mock<any>).mockResolvedValue(imageBytes);

    const result = await executeReadFile(
      mockDb,
      { path: "photo.png" },
      groupId,
    );
    expect(Array.isArray(result)).toBe(true);
    const blocks = result as any[];
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("text");
    expect(blocks[1].type).toBe("image");
    expect(blocks[1].media_type).toBe("image/png");
  });

  it("handles multiple files across text, image, binary, and errors", async () => {
    (readGroupFileBytes as jest.Mock<any>).mockImplementation(
      async (_db, _gid, path) => {
        if (path === "file1.txt") return new TextEncoder().encode("Content 1");
        if (path === "file2.bin")
          return new Uint8Array([0x00, 0x01, 0x02, 0x00]);
        throw new Error("Disk error");
      },
    );

    const result = await executeReadFile(
      mockDb,
      { paths: ["file1.txt", "file2.bin", "image.jpg", "error.txt"] },
      groupId,
    );

    expect(typeof result).toBe("string");
    const text = result as string;
    expect(text).toContain("--- file1.txt ---\nContent 1");
    expect(text).toContain(
      "--- file2.bin ---\n[Binary file: cannot display as text]",
    );
    expect(text).toContain(
      "--- image.jpg ---\n[Image file: use read_file with a single path to see this image]",
    );
    expect(text).toContain(
      "--- error.txt ---\nError reading error.txt: Disk error",
    );
  });
});
