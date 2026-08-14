import { jest } from "@jest/globals";

// --- Mocks ---

const mockListGroupFiles =
  jest.fn<(db: any, groupId: string, dir: string) => Promise<string[]>>();
const mockReadGroupFileBytes =
  jest.fn<(db: any, groupId: string, path: string) => Promise<Uint8Array>>();
const mockIsBinaryContent = jest.fn<(b: Uint8Array) => boolean>();

jest.unstable_mockModule("../../../storage/listGroupFiles.js", () => ({
  listGroupFiles: mockListGroupFiles,
}));

jest.unstable_mockModule("../../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: mockReadGroupFileBytes,
}));

jest.unstable_mockModule("./utils/isBinaryContent.js", () => ({
  isBinaryContent: mockIsBinaryContent,
}));

const { executeSearchFiles } = await import("./search-files.js");

// Helper: encode a string into Uint8Array
function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

const db = {} as any;
const groupId = "g1";

describe("executeSearchFiles", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // By default files are text
    mockIsBinaryContent.mockReturnValue(false);
  });

  // ── Basic functionality ──────────────────────────────────────────────────

  it("returns error when pattern is missing", async () => {
    const result = await executeSearchFiles(db, {}, groupId);
    expect(result).toContain("Error");
    expect(result.toLowerCase()).toContain("pattern");
  });

  it("returns 'No matches found.' when no file matches", async () => {
    mockListGroupFiles.mockResolvedValue(["readme.md"]);
    mockReadGroupFileBytes.mockResolvedValue(encode("hello world\n"));

    const result = await executeSearchFiles(
      db,
      { pattern: "xyz_not_here" },
      groupId,
    );
    expect(result).toBe("No matches found.");
  });

  it("finds a plain-text pattern match", async () => {
    mockListGroupFiles.mockResolvedValue(["readme.md"]);
    mockReadGroupFileBytes.mockResolvedValue(encode("foo\nbar baz\nqux\n"));

    const result = await executeSearchFiles(db, { pattern: "bar" }, groupId);
    expect(result).toContain("readme.md:2: bar baz");
  });

  it("finds a regex match when is_regex is true", async () => {
    mockListGroupFiles.mockResolvedValue(["src.ts"]);
    mockReadGroupFileBytes.mockResolvedValue(encode("const x = 42;\nlet y;\n"));

    const result = await executeSearchFiles(
      db,
      { pattern: "\\bconst\\b", is_regex: true },
      groupId,
    );
    expect(result).toContain("src.ts:1:");
  });

  it("returns a user-friendly error for an invalid regex", async () => {
    const result = await executeSearchFiles(
      db,
      { pattern: "(unclosed", is_regex: true },
      groupId,
    );
    expect(result).toMatch(/error.*invalid.*regex|invalid.*regex.*error/i);
  });

  // ── file_glob filter ─────────────────────────────────────────────────────

  it("applies file_glob filter and skips non-matching files", async () => {
    mockListGroupFiles.mockResolvedValue(["index.ts", "style.css"]);
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    const result = await executeSearchFiles(
      db,
      { pattern: "needle", file_glob: "*.ts" },
      groupId,
    );
    expect(result).toContain("index.ts");
    expect(result).not.toContain("style.css");
  });

  // ── Binary-file skip (crash prevention) ─────────────────────────────────

  it("skips binary files and does not crash", async () => {
    mockListGroupFiles.mockResolvedValue(["image.png", "text.txt"]);
    mockReadGroupFileBytes.mockImplementation(async (_db, _gid, path) => {
      if (path === "image.png") return new Uint8Array([0, 1, 2, 3]);
      return encode("needle\n");
    });
    mockIsBinaryContent.mockImplementation((b) => b[0] === 0);

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    expect(result).not.toContain("image.png");
    expect(result).toContain("text.txt");
  });

  // ── File-size cap (OOM prevention) ───────────────────────────────────────

  it("skips files that exceed the size cap", async () => {
    // 513 KB of data — above the 512 KB threshold
    const bigFile = new Uint8Array(513 * 1024).fill(97); // 'a'
    const smallFile = encode("needle\n");

    mockListGroupFiles.mockResolvedValue(["huge.txt", "small.txt"]);
    mockReadGroupFileBytes.mockImplementation(async (_db, _gid, path) =>
      path === "huge.txt" ? bigFile : smallFile,
    );

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    expect(result).not.toContain("huge.txt");
    expect(result).toContain("small.txt");
  });

  // ── Skip known-heavy directories ─────────────────────────────────────────

  it("does not recurse into node_modules", async () => {
    // Top-level returns a dir entry and a normal file
    mockListGroupFiles.mockImplementation(async (_db, _gid, dir) => {
      if (dir === "." || dir === "") return ["node_modules/", "index.ts"];
      return ["package.json"]; // inside node_modules — should never be called
    });
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    expect(result).toContain("index.ts");
    // listGroupFiles should only have been called for the root, not for node_modules
    const calledDirs = (mockListGroupFiles.mock.calls as any[]).map(
      (c) => c[2],
    );
    expect(calledDirs).not.toContain("node_modules");
  });

  it("does not recurse into .git", async () => {
    mockListGroupFiles.mockImplementation(async (_db, _gid, dir) => {
      if (dir === "." || dir === "") return [".git/", "main.ts"];
      return ["HEAD"]; // inside .git — should never be called
    });
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    await executeSearchFiles(db, { pattern: "needle" }, groupId);

    const calledDirs = (mockListGroupFiles.mock.calls as any[]).map(
      (c) => c[2],
    );
    expect(calledDirs).not.toContain(".git");
  });

  // ── Files-visited cap ────────────────────────────────────────────────────

  it("stops visiting files after the files-visited cap", async () => {
    // Return 1500 files from the root — walk should bail before reading all of them
    const files = Array.from({ length: 1500 }, (_, i) => `file${i}.txt`);
    mockListGroupFiles.mockResolvedValue(files);
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);

    // readGroupFileBytes must not have been called 1500 times
    expect(mockReadGroupFileBytes.mock.calls.length).toBeLessThan(1500);
    // Output should contain a truncation notice
    expect(result).toMatch(/truncated|limit/i);
  });

  // ── Results cap ──────────────────────────────────────────────────────────

  it("truncates results at 500 matches", async () => {
    // Single file with 600 matching lines
    const lines = Array.from({ length: 600 }, (_, i) => `needle line ${i}`);
    mockListGroupFiles.mockResolvedValue(["big.txt"]);
    mockReadGroupFileBytes.mockResolvedValue(encode(lines.join("\n") + "\n"));

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    const matchLines = result
      .split("\n")
      .filter((l) => l.startsWith("big.txt:"));
    expect(matchLines.length).toBeLessThanOrEqual(500);
    expect(result).toMatch(/truncated/i);
  });

  // ── Long-line truncation ─────────────────────────────────────────────────

  it("truncates very long matched lines in output", async () => {
    const longLine = "needle" + "x".repeat(2000);
    mockListGroupFiles.mockResolvedValue(["long.ts"]);
    mockReadGroupFileBytes.mockResolvedValue(encode(longLine + "\n"));

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    const matchLine = result.split("\n").find((l) => l.startsWith("long.ts:"));
    // The matched line in the output must be shorter than the original
    expect(matchLine!.length).toBeLessThan(longLine.length);
  });

  // ── ReDoS guard ──────────────────────────────────────────────────────────

  it("does not hang on a pathological regex against a long line", async () => {
    // Classic ReDoS pattern. The guard clamps lines to MAX_REGEX_INPUT_LENGTH (2000)
    // before calling .test(), so a line longer than 2000 chars will be truncated
    // before the engine sees the catastrophic suffix.
    const evilPattern = "(a+)+$";
    // Line is 3000 'a's followed by '!' — without clamping this would trigger
    // exponential backtracking. With clamping to 2000 chars the '!' is never
    // seen so the regex returns false quickly.
    const evilLine = "a".repeat(3000) + "!";
    mockListGroupFiles.mockResolvedValue(["src.ts"]);
    mockReadGroupFileBytes.mockResolvedValue(encode(evilLine + "\n"));

    const startMs = Date.now();
    await executeSearchFiles(
      db,
      { pattern: evilPattern, is_regex: true },
      groupId,
    );
    const elapsed = Date.now() - startMs;

    // Should complete well within 2 s — without the clamp this would timeout
    expect(elapsed).toBeLessThan(2000);
  }, 5000);

  // ── Recursive walk ───────────────────────────────────────────────────────

  it("recurses into subdirectories", async () => {
    mockListGroupFiles.mockImplementation(async (_db, _gid, dir) => {
      if (dir === "." || dir === "") return ["src/"];
      if (dir === "src") return ["index.ts"];
      return [];
    });
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    const result = await executeSearchFiles(db, { pattern: "needle" }, groupId);
    expect(result).toContain("src/index.ts");
  });

  // ── path scoping ─────────────────────────────────────────────────────────

  it("starts walk from the given path parameter", async () => {
    mockListGroupFiles.mockResolvedValue(["helper.ts"]);
    mockReadGroupFileBytes.mockResolvedValue(encode("needle\n"));

    await executeSearchFiles(db, { pattern: "needle", path: "lib" }, groupId);

    expect(mockListGroupFiles).toHaveBeenCalledWith(db, groupId, "lib");
  });
});
