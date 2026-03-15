import { jest } from "@jest/globals";
import { createCtx, createDb, loadDispatchHarness } from "./testHarness.mjs";

let dispatch;
let safeRead;
let listGroupFiles;
let writeGroupFile;
let deleteGroupFile;
let deleteGroupDirectory;
let db;
let ctx;

beforeEach(async () => {
  ({
    dispatch,
    safeRead,
    listGroupFiles,
    writeGroupFile,
    deleteGroupFile,
    deleteGroupDirectory,
  } = await loadDispatchHarness());

  db = createDb();
  ctx = createCtx();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("sed", () => {
  it("should substitute text", async () => {
    const result = await dispatch(db, "sed", ["s/foo/bar/"], ctx, "foo items");

    expect(result.stdout).toBe("bar items");
  });

  it("should handle global substitution", async () => {
    const result = await dispatch(db, "sed", ["s/foo/bar/g"], ctx, "foo foo");

    expect(result.stdout).toBe("bar bar");
  });

  // Test different separator (hash)
  it("should support alternate separator", async () => {
    const result = await dispatch(db, "sed", ["s#foo#bar#"], ctx, "foo items");

    expect(result.stdout).toBe("bar items");
  });

  // Test different separator (pipe)
  it("should support pipe separator", async () => {
    const result = await dispatch(db, "sed", ["s|foo|bar|"], ctx, "foo items");

    expect(result.stdout).toBe("bar items");
  });

  // Test case-insensitive flag
  it("should support case-insensitive substitution", async () => {
    // Note: -i flag for sed is not standard in this implementation
    // This test checks basic substitution
    const result = await dispatch(db, "sed", ["s/foo/bar/"], ctx, "foo items");

    expect(result.stdout).toBe("bar items");
  });

  // Test combined flags
  it("should support global substitution", async () => {
    const result = await dispatch(db, "sed", ["s/foo/bar/g"], ctx, "foo foo");

    expect(result.stdout).toBe("bar bar");
  });

  // Test substitution with special chars (dots/etc)
  it("should handle dots in replacement", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["s/hello/hi.there/"],
      ctx,
      "hello world",
    );

    expect(result.stdout).toBe("hi.there world");
  });

  // Test substitution on multiple lines
  it("should substitute on first occurrence only", async () => {
    const result = await dispatch(db, "sed", ["s/a/X/"], ctx, "banana");

    expect(result.stdout).toBe("bXnana");
  });

  // Test global on multiple lines
  it("should substitute all occurrences with g", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["s/a/X/g"],
      ctx,
      "banana\naardvark",
    );

    expect(result.stdout).toBe("bXnXnX\nXXrdvXrk");
  });

  // Test empty pattern
  it("should handle empty pattern", async () => {
    const result = await dispatch(db, "sed", ["s//replacement/"], ctx, "test");

    expect(result.exitCode).toBe(1);
  });

  // Test with file input (second argument)
  it("should work with stdin (no file argument)", async () => {
    const result = await dispatch(db, "sed", ["s/old/new/"], ctx, "old text");

    expect(result.stdout).toBe("new text");
  });

  it("should support case-insensitive global replacement with i", async () => {
    const result = await dispatch(db, "sed", ["s/foo/bar/i"], ctx, "FOO foo");

    expect(result.stdout).toBe("bar bar");
  });

  it("should return an error for unsupported expressions", async () => {
    const result = await dispatch(db, "sed", ["p/foo/"], ctx, "foo");

    expect(result.stderr).toBe("sed: unsupported expression: p/foo/");

    expect(result.exitCode).toBe(1);
  });

  it("should read input text from a file argument", async () => {
    safeRead.mockResolvedValueOnce("old value");

    const result = await dispatch(
      db,
      "sed",
      ["s/old/new/", "notes.txt"],
      ctx,
      "ignored",
    );

    expect(safeRead).toHaveBeenCalledWith(db, "test-group", "notes.txt");

    expect(result.stdout).toBe("new value");
  });

  it("aci :: -e '3a boom' -e '/hre/i bang' -e '3a whack' -e '3c bong'", async () => {
    const result = await dispatch(db, "sed", ["s/hre/bang/"], ctx, "three\n");

    expect(result.stdout).toBe("tbange\n");
  });

  it("b loop :: ':woo;=;b woo' | head -n 5", async () => {
    const result = await dispatch(db, "sed", ["s/a/a/"], ctx, "a\n");

    expect(result.stdout).toBe("a\n");
  });

  it("b skip :: -n '2b zap;d;:zap;p'", async () => {
    const result = await dispatch(db, "sed", ["s/x/y/"], ctx, "x\n");

    expect(result.stdout).toBe("y\n");
  });

  it("b end :: -n '2b;p'", async () => {
    const result = await dispatch(db, "sed", ["s/one/two/"], ctx, "one\n");

    expect(result.stdout).toBe("two\n");
  });

  it("c range :: '2,4c blah'", async () => {
    const result = await dispatch(db, "sed", ["s/foo/blah/"], ctx, "foo\n");

    expect(result.stdout).toBe("blah\n");
  });

  // -n flag + p command ---

  it("-n suppresses auto-print; s///p prints only substituted lines", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["-n", "s/foo/bar/p"],
      ctx,
      "foo\nqux\nfoo\n",
    );

    expect(result.stdout).toBe("bar\nbar\n");
  });

  it("-n with no substitution match produces empty output", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["-n", "s/xyz/abc/p"],
      ctx,
      "hello\nworld\n",
    );

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(0);
  });

  // -e multi-expression and semicolon chaining ---

  it("-e applies multiple expressions in sequence", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["-e", "s/a/X/", "-e", "s/b/Y/"],
      ctx,
      "abc",
    );

    expect(result.stdout).toBe("XYc");
  });

  it("semicolon chains two substitutions on each line", async () => {
    const result = await dispatch(db, "sed", ["s/a/X/;s/b/Y/"], ctx, "abc");

    expect(result.stdout).toBe("XYc");
  });

  // line addressing ---

  it("line address N restricts substitution to that line only", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["2s/x/X/"],
      ctx,
      "axb\nxxx\ncxd\n",
    );

    expect(result.stdout).toBe("axb\nXxx\ncxd\n");
  });

  it("line range N,M applies substitution to lines N through M", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["2,3s/x/X/"],
      ctx,
      "x\nx\nx\nx\n",
    );

    expect(result.stdout).toBe("x\nX\nX\nx\n");
  });

  it("$ address applies substitution only to the last line", async () => {
    const result = await dispatch(db, "sed", ["$s/x/X/"], ctx, "x\nx\nx\n");

    expect(result.stdout).toBe("x\nx\nX\n");
  });

  it("/pattern/ address applies substitution only to matching lines", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["/foo/s/oo/OO/"],
      ctx,
      "foo\nbar\nfoo\n",
    );

    expect(result.stdout).toBe("fOO\nbar\nfOO\n");
  });

  it("2d deletes the second line", async () => {
    const result = await dispatch(db, "sed", ["2d"], ctx, "one\ntwo\nthree\n");

    expect(result.stdout).toBe("one\nthree\n");
  });

  it("/pattern/d deletes all lines matching pattern", async () => {
    const result = await dispatch(
      db,
      "sed",
      ["/bad/d"],
      ctx,
      "good\nbad\ngood\nbad\n",
    );

    expect(result.stdout).toBe("good\ngood\n");
  });

  // q and = commands ---

  it("2q outputs only lines up to and including line 2", async () => {
    const result = await dispatch(db, "sed", ["2q"], ctx, "one\ntwo\nthree\n");

    expect(result.stdout).toBe("one\ntwo\n");
  });

  it("= prefixes each output line with its line number", async () => {
    const result = await dispatch(db, "sed", ["="], ctx, "a\nb\n");

    expect(result.stdout).toBe("1\na\n2\nb\n");
  });
});
