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

describe("grep", () => {
  it("should filter lines", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["hello"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("hello\nhello again\n");
  });

  it("should exit 1 if no matches", async () => {
    const result = await dispatch(db, "grep", ["missing"], ctx, "hello\nworld");

    expect(result.exitCode).toBe(1);
  });

  // Test case-insensitive flag -i
  it("should match case-insensitive with -i", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-i", "hello"],
      ctx,
      "HELLO\nHeLLo\nworld",
    );

    expect(result.stdout).toBe("HELLO\nHeLLo\n");

    expect(result.exitCode).toBe(0);
  });

  // Test invert flag -v
  it("should invert match with -v", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-v", "world"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("hello\nhello again\n");

    expect(result.exitCode).toBe(0);
  });

  // Test count flag -c
  it("should count matches with -c", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-c", "hello"],
      ctx,
      "hello\nworld\nhello again\nhello world",
    );

    expect(result.stdout).toBe("3\n");

    expect(result.exitCode).toBe(0);
  });

  // Test line numbers flag -n
  it("should show line numbers with -n", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-n", "hello"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("1:hello\n3:hello again\n");

    expect(result.exitCode).toBe(0);
  });

  // Test max count flag -m
  it("should limit matches with -m", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-m", "2", "hello"],
      ctx,
      "hello\nworld\nhello again\nhello world",
    );

    expect(result.stdout).toBe("hello\nhello again\n");

    expect(result.exitCode).toBe(0);
  });

  // Test explicit pattern flag -e
  it("should use explicit pattern with -e", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-e", "hello"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("hello\nhello again\n");

    expect(result.exitCode).toBe(0);
  });

  // Test combined flags -in (case-insensitive + line numbers)
  it("should combine -i and -n flags", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-i", "-n", "hello"],
      ctx,
      "HELLO\nworld\nHeLLo\nagain",
    );

    expect(result.stdout).toBe("1:HELLO\n3:HeLLo\n");

    expect(result.exitCode).toBe(0);
  });

  // Test combined flags -vc (invert + count)
  it("should combine -v and -c flags", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-v", "-c", "world"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("2\n");

    expect(result.exitCode).toBe(0);
  });

  // Test combined flags -cn (count + line numbers) - c should take precedence
  it("should prioritize -c over -n", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-c", "-n", "hello"],
      ctx,
      "hello\nworld\nhello again",
    );

    expect(result.stdout).toBe("2\n");

    expect(result.exitCode).toBe(0);
  });

  // Test empty pattern
  it("should handle empty pattern", async () => {
    const result = await dispatch(db, "grep", [""], ctx, "hello\nworld");

    // Empty pattern matches all non-empty lines
    expect(result.exitCode).toBe(0);
  });

  // Test regex metacharacters
  it("should match literal dots in pattern", async () => {
    const result = await dispatch(db, "grep", ["a.b"], ctx, "a.b\naXb\naxb");

    // Dot should be treated as literal or regex depending on implementation
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  // Test with empty stdin
  it("should handle empty stdin", async () => {
    const result = await dispatch(db, "grep", ["hello"], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  // Test with empty lines in input
  it("should preserve empty lines in output", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-v", "world"],
      ctx,
      "hello\n\nhello again",
    );

    expect(result.stdout).toBe("hello\n\nhello again\n");
  });

  // Test case-insensitive with count
  it("should count case-insensitive matches", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-i", "-c", "HELLO"],
      ctx,
      "hello\nHELLO\nHeLLo\nworld",
    );

    expect(result.stdout).toBe("3\n");
  });

  // Test inverted count (should count non-matches)
  it("should count non-matches with -v and -c", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-v", "-c", "world"],
      ctx,
      "hello\nworld\nhello again\nworld again",
    );

    expect(result.stdout).toBe("2\n");
  });

  // Test max count with case-insensitive
  it("should limit matches with -m and -i", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-i", "-m", "2", "hello"],
      ctx,
      "HELLO\nworld\nhello again\nHeLLo world",
    );

    expect(result.stdout).toBe("HELLO\nhello again\n");
  });

  it("supports -E extended regex flag", async () => {
    safeRead.mockResolvedValueOnce("abc\n1\nxyz");

    const result = await dispatch(
      db,
      "grep",
      ["-E", "[0-9]", "input"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("1\n");

    expect(result.exitCode).toBe(0);
  });

  it("-E", async () => {
    safeRead.mockResolvedValueOnce("1234123asdfas123123\nabc\n1\nabcde");

    const result = await dispatch(
      db,
      "grep",
      ["-E", "[0-9]", "input"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("1234123asdfas123123\n1\n");

    expect(result.exitCode).toBe(0);
  });

  it("supports -l across multiple files", async () => {
    safeRead
      .mockResolvedValueOnce("this is test")
      .mockResolvedValueOnce("this is test2")
      .mockResolvedValueOnce("this is number3");

    const result = await dispatch(
      db,
      "grep",
      ["-l", "test", "file", "file2", "file3"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("file\nfile2\n");

    expect(result.exitCode).toBe(0);
  });

  it("-l", async () => {
    safeRead
      .mockResolvedValueOnce("this is test")
      .mockResolvedValueOnce("this is test2")
      .mockResolvedValueOnce("this is number3");

    const result = await dispatch(
      db,
      "grep",
      ["-l", "test", "file", "file2", "file3"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("file\nfile2\n");

    expect(result.exitCode).toBe(0);
  });

  it("supports -L across multiple files", async () => {
    safeRead
      .mockResolvedValueOnce("this is test")
      .mockResolvedValueOnce("this is test2")
      .mockResolvedValueOnce("this is number3");

    const result = await dispatch(
      db,
      "grep",
      ["-L", "test", "file", "file2", "file3"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("file3\n");

    expect(result.exitCode).toBe(0);
  });

  it("-L", async () => {
    safeRead
      .mockResolvedValueOnce("this is test")
      .mockResolvedValueOnce("this is test2")
      .mockResolvedValueOnce("this is number3");

    const result = await dispatch(
      db,
      "grep",
      ["-L", "test", "file", "file2", "file3"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("file3\n");

    expect(result.exitCode).toBe(0);
  });

  it("supports -q with success exit and no output", async () => {
    safeRead.mockResolvedValueOnce("this is a test\n");

    const result = await dispatch(db, "grep", ["-q", "test", "input"], ctx, "");

    expect(result.stdout).toBe("");

    expect(result.stderr).toBe("");

    expect(result.exitCode).toBe(0);
  });

  it("-q", async () => {
    safeRead.mockResolvedValueOnce("this is a test\n");

    const result = await dispatch(db, "grep", ["-q", "test", "input"], ctx, "");

    expect(result.exitCode).toBe(0);

    expect(result.stdout).toBe("");
  });

  it("-q returns 1 when no match", async () => {
    safeRead.mockResolvedValueOnce("no matches\n");

    const result = await dispatch(db, "grep", ["-q", "test", "input"], ctx, "");

    expect(result.stdout).toBe("");

    expect(result.exitCode).toBe(1);
  });

  it("-c", async () => {
    safeRead.mockResolvedValueOnce("123\ncount 123\n123\nfasdfasdf");

    const result = await dispatch(db, "grep", ["-c", "123", "input"], ctx, "");

    expect(result.stdout).toBe("3\n");

    expect(result.exitCode).toBe(0);
  });

  // -o (only-matching) — print only the matching portion of each line
  it("-o prints only matching text", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-o", "hel+o"],
      ctx,
      "hello world\ngoodbye\nhello again",
    );

    expect(result.stdout).toBe("hello\nhello\n");

    expect(result.exitCode).toBe(0);
  });

  it("-o returns 1 when no match", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-o", "xyz"],
      ctx,
      "hello\nworld",
    );

    expect(result.exitCode).toBe(1);

    expect(result.stdout).toBe("");
  });

  it("-o with -i is case-insensitive", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-o", "-i", "word"],
      ctx,
      "WordA\nwordB\nWORDC\nno match",
    );

    expect(result.stdout).toBe("Word\nword\nWORD\n");

    expect(result.exitCode).toBe(0);
  });

  it("-o with -n shows line numbers", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-o", "-n", "w."],
      ctx,
      "wA wB\nwC",
    );

    expect(result.stdout).toBe("1:wA\n1:wB\n2:wC\n");

    expect(result.exitCode).toBe(0);
  });

  it("-o outputs each match on its own line when multiple matches per line", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-o", "[0-9]+"],
      ctx,
      "a1b2c3\nno digits\n42",
    );

    expect(result.stdout).toBe("1\n2\n3\n42\n");

    expect(result.exitCode).toBe(0);
  });

  // -w (word-regexp) — match only whole words
  it("-w matches whole words only", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-w", "foo"],
      ctx,
      "foo\nfoobar\nbarfoo\nbar foo baz\n",
    );

    expect(result.stdout).toBe("foo\nbar foo baz\n");

    expect(result.exitCode).toBe(0);
  });

  it("-w does not match substrings", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-w", "5327"],
      ctx,
      "LIN7C 55327\n",
    );

    expect(result.exitCode).toBe(1);
  });

  it("-w with -i is case-insensitive", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-w", "-i", "foo"],
      ctx,
      "FOO\nfoobar\nbar FOO baz\n",
    );

    expect(result.stdout).toBe("FOO\nbar FOO baz\n");

    expect(result.exitCode).toBe(0);
  });

  // -x (line-regexp) — match only whole lines
  it("-x matches whole lines only", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-x", "hello"],
      ctx,
      "hello\nhello world\nworld\n",
    );

    expect(result.stdout).toBe("hello\n");

    expect(result.exitCode).toBe(0);
  });

  it("-x exits 1 when no full-line match", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-x", "he"],
      ctx,
      "hello\nworld\n",
    );

    expect(result.exitCode).toBe(1);
  });

  it("-x with -i is case-insensitive", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-x", "-i", "HELLO"],
      ctx,
      "hello\nHELLO\nhello world\n",
    );

    expect(result.stdout).toBe("hello\nHELLO\n");

    expect(result.exitCode).toBe(0);
  });

  // -F (fixed-strings) — treat pattern as literal, no regex interpretation
  it("-F treats pattern as literal string", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-F", "a.b"],
      ctx,
      "a.b\naXb\naxb\n",
    );

    expect(result.stdout).toBe("a.b\n");

    expect(result.exitCode).toBe(0);
  });

  it("-F treats braces literally", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-F", "c\\{3\\}"],
      ctx,
      "abababccccccd\nc\\{3\\}\n",
    );

    expect(result.stdout).toBe("c\\{3\\}\n");

    expect(result.exitCode).toBe(0);
  });

  it("-F with -w matches whole words literally", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-F", "-w", "foo"],
      ctx,
      "foo\nfoobar\nbarfoo\nbar foo end\n",
    );

    expect(result.stdout).toBe("foo\nbar foo end\n");

    expect(result.exitCode).toBe(0);
  });

  // Multiple -e patterns
  it("multiple -e patterns OR together", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-e", "foo", "-e", "bar"],
      ctx,
      "foo\nbar\nbaz\nfoobar\n",
    );

    expect(result.stdout).toBe("foo\nbar\nfoobar\n");

    expect(result.exitCode).toBe(0);
  });

  it("multiple -e anchors do not cross-match (Bug#21670)", async () => {
    // 'abchelloabc' does NOT start with 'hello' and does NOT end with 'hello'
    const result = await dispatch(
      db,
      "grep",
      ["-e", "^hello", "-e", "hello$"],
      ctx,
      "abchelloabc\n",
    );

    expect(result.exitCode).toBe(1);
  });

  it("multiple -e with -F matches any literal pattern", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-F", "-e", "foo", "-e", "bar"],
      ctx,
      "foo line\nbar line\nbaz line\n",
    );

    expect(result.stdout).toBe("foo line\nbar line\n");

    expect(result.exitCode).toBe(0);
  });

  // -A n (after-context)
  it("-A prints N lines after match", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-A", "2", "needle"],
      ctx,
      "before\nneedle\nafter1\nafter2\nafter3\n",
    );

    expect(result.stdout).toBe("needle\nafter1\nafter2\n");

    expect(result.exitCode).toBe(0);
  });

  it("-A separates match groups with --", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-A", "1", "needle"],
      ctx,
      "needle\nctx1\nmore\nneedle2\nctx2\n",
    );

    expect(result.stdout).toBe("needle\nctx1\n--\nneedle2\nctx2\n");

    expect(result.exitCode).toBe(0);
  });

  // -B n (before-context)
  it("-B prints N lines before match", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-B", "2", "needle"],
      ctx,
      "before2\nbefore1\nneedle\nafter\n",
    );

    expect(result.stdout).toBe("before2\nbefore1\nneedle\n");

    expect(result.exitCode).toBe(0);
  });

  it("-B separates match groups with --", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-B", "1", "needle"],
      ctx,
      "ctx1\nneedle\nmore\nctx2\nneedle2\n",
    );

    expect(result.stdout).toBe("ctx1\nneedle\n--\nctx2\nneedle2\n");

    expect(result.exitCode).toBe(0);
  });

  // -C n (context) — both before and after
  it("-C prints N lines before and after match", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-C", "1", "needle"],
      ctx,
      "before\nneedle\nafter\n",
    );

    expect(result.stdout).toBe("before\nneedle\nafter\n");

    expect(result.exitCode).toBe(0);
  });

  it("-C 0 shows only matched lines with separator", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-C", "0", "needle"],
      ctx,
      "needle\n1st\n2nd\n3rd\nanother needle\n5th\n6th\n",
    );

    expect(result.stdout).toBe("needle\n--\nanother needle\n");

    expect(result.exitCode).toBe(0);
  });

  it("-C with overlapping context does not duplicate lines", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-C", "2", "needle"],
      ctx,
      "a\nneedle\nb\nc\nneedle\nd\n",
    );

    expect(result.stdout).toBe("a\nneedle\nb\nc\nneedle\nd\n");

    expect(result.exitCode).toBe(0);
  });

  // -m with -A: context after last match is still output
  it("-m 1 with -A 5 includes trailing context", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-m", "1", "-A", "5", "needle"],
      ctx,
      "needle\n1st\n2nd\n3rd\nanother needle\n5th\n6th\n",
    );

    // Should include the match and 5 lines after (up to end of input)
    expect(result.stdout).toBe("needle\n1st\n2nd\n3rd\nanother needle\n5th\n");

    expect(result.exitCode).toBe(0);
  });

  // -H (with-filename) — print filename prefix
  it("-H prints filename prefix for file sources", async () => {
    safeRead.mockResolvedValueOnce("hello world\n");

    const result = await dispatch(
      db,
      "grep",
      ["-H", "hello", "myfile"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("myfile:hello world\n");

    expect(result.exitCode).toBe(0);
  });

  it("-H prints filename prefix for multiple files", async () => {
    safeRead
      .mockResolvedValueOnce("hello\n")
      .mockResolvedValueOnce("no match\n")
      .mockResolvedValueOnce("hello again\n");

    const result = await dispatch(
      db,
      "grep",
      ["-H", "hello", "f1", "f2", "f3"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("f1:hello\nf3:hello again\n");

    expect(result.exitCode).toBe(0);
  });

  it("multiple files add filename prefix automatically", async () => {
    safeRead
      .mockResolvedValueOnce("hello\n")
      .mockResolvedValueOnce("hello world\n");

    const result = await dispatch(db, "grep", ["hello", "f1", "f2"], ctx, "");

    expect(result.stdout).toBe("f1:hello\nf2:hello world\n");

    expect(result.exitCode).toBe(0);
  });

  it("-h suppresses filename prefix even with multiple files", async () => {
    safeRead
      .mockResolvedValueOnce("hello\n")
      .mockResolvedValueOnce("hello world\n");

    const result = await dispatch(
      db,
      "grep",
      ["-h", "hello", "f1", "f2"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("hello\nhello world\n");

    expect(result.exitCode).toBe(0);
  });

  it("-H with -n shows filename and line number", async () => {
    safeRead.mockResolvedValueOnce("no\nhello\nworld\n");

    const result = await dispatch(
      db,
      "grep",
      ["-H", "-n", "hello", "myfile"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("myfile:2:hello\n");

    expect(result.exitCode).toBe(0);
  });

  // -E (extended regex) — already tested above but confirm ERE constructs
  it("-E supports quantifiers like c{3}", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-E", "c{3}"],
      ctx,
      "abababccccccd\nab\n",
    );

    expect(result.stdout).toBe("abababccccccd\n");

    expect(result.exitCode).toBe(0);
  });

  it("-E supports alternation with |", async () => {
    const result = await dispatch(
      db,
      "grep",
      ["-E", "foo|bar"],
      ctx,
      "foo\nbar\nbaz\n",
    );

    expect(result.stdout).toBe("foo\nbar\n");

    expect(result.exitCode).toBe(0);
  });
});
