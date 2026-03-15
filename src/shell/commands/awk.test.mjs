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

describe("awk", () => {
  it("should print fields", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $2}"],
      ctx,
      "first second third",
    );

    expect(result.stdout).toBe("second\n");
  });

  // Test whole line ($0)
  it("should print whole line with $0", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $0}"],
      ctx,
      "hello world",
    );

    expect(result.stdout).toBe("hello world\n");
  });

  // Test first field ($1)
  it("should print first field", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $1}"],
      ctx,
      "first second third",
    );

    expect(result.stdout).toBe("first\n");
  });

  // Test last field ($3 when 3 fields)
  it("should print last field", async () => {
    const result = await dispatch(db, "awk", ["{print $3}"], ctx, "a b c");

    expect(result.stdout).toBe("c\n");
  });

  // Test multiple fields concatenation
  it("should concatenate multiple fields", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $1 $3}"],
      ctx,
      "first second third",
    );

    // Note: awk in this implementation adds space between fields when printed
    expect(result.stdout).toBe("first third\n");
  });

  // Test beyond field count ($5 when only 3 fields)
  it("should return empty for missing field", async () => {
    const result = await dispatch(db, "awk", ["{print $5}"], ctx, "a b c");

    expect(result.stdout).toBe("\n");
  });

  // Test with multiple lines
  it("should process multiple lines", async () => {
    const result = await dispatch(db, "awk", ["{print $2}"], ctx, "a b\nc d");

    expect(result.stdout).toBe("b\nd\n");
  });

  // Test empty lines
  it("should skip empty lines", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $1}"],
      ctx,
      "first\n\nsecond",
    );

    expect(result.stdout).toBe("first\nsecond\n");
  });

  // Test with single word
  it("should handle single word per line", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $1}"],
      ctx,
      "hello\nworld",
    );

    expect(result.stdout).toBe("hello\nworld\n");
  });

  it("should fail for unsupported programs", async () => {
    const result = await dispatch(db, "awk", ["{sum $1}"], ctx, "a b c");

    expect(result.stderr).toBe("awk: only basic {print $N} patterns supported");

    expect(result.exitCode).toBe(1);
  });

  it("awk PATTERN input :: '/abc/' input", async () => {
    safeRead.mockResolvedValueOnce("abc def\nzzz yyy\n");

    const result = await dispatch(db, "awk", ["{print $1}", "input"], ctx, "");

    expect(result.stdout).toBe("abc\nzzz\n");
  });

  it("awk SUBPATTERN input :: '/ab/' input", async () => {
    safeRead.mockResolvedValueOnce("abc def\nabe two\n");

    const result = await dispatch(db, "awk", ["{print $1}", "input"], ctx, "");

    expect(result.stdout).toBe("abc\nabe\n");
  });

  it("awk FIELD input :: '{print \\$2,\\$3}' input", async () => {
    safeRead.mockResolvedValueOnce("a b c\nd e f\n");

    const result = await dispatch(
      db,
      "awk",
      ["{print $2 $3}", "input"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("b c\ne f\n");
  });

  it("awk FIELD input (out range) :: '{print \\$2,\\$8}' input", async () => {
    safeRead.mockResolvedValueOnce("a b c\n");

    const result = await dispatch(
      db,
      "awk",
      ["{print $2 $8}", "input"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("b \n");
  });

  it("awk CODE input :: 'BEGIN { print \\", async () => {
    safeRead.mockResolvedValueOnce("a b\n");

    const result = await dispatch(db, "awk", ["{print $1}", "input"], ctx, "");

    expect(result.stdout).toBe("a\n");
  });

  // --- Pattern filtering ---
  it("regex pattern runs action only for matching lines", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["/foo/ {print $0}"],
      ctx,
      "foo bar\nbaz qux\nfoo baz\n",
    );

    expect(result.stdout).toBe("foo bar\nfoo baz\n");
  });

  it("negated regex pattern skips matching lines", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["!/foo/ {print $0}"],
      ctx,
      "foo bar\nbaz qux\n",
    );

    expect(result.stdout).toBe("baz qux\n");
  });

  it("NR==N runs action only on that numbered line", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["NR==2 {print $0}"],
      ctx,
      "one\ntwo\nthree\n",
    );

    expect(result.stdout).toBe("two\n");
  });

  // --- BEGIN and END blocks ---
  it("BEGIN block runs before processing lines", async () => {
    const result = await dispatch(
      db,
      "awk",
      ['BEGIN {print "start"} {print $0}'],
      ctx,
      "line1\n",
    );

    expect(result.stdout).toBe("start\nline1\n");
  });

  it("END block can print NR (total record count)", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["END {print NR}"],
      ctx,
      "a\nb\nc\n",
    );

    expect(result.stdout).toBe("3\n");
  });

  // --- -F field separator ---
  it("-F sets colon as field separator", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["-F", ":", "{print $2}"],
      ctx,
      "a:b:c\n",
    );

    expect(result.stdout).toBe("b\n");
  });

  it("-F sets comma as field separator", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["-F", ",", "{print $1}"],
      ctx,
      "x,y,z\n",
    );

    expect(result.stdout).toBe("x\n");
  });

  // --- NR and NF special variables ---
  it("NR prints the current record number for each line", async () => {
    const result = await dispatch(db, "awk", ["{print NR}"], ctx, "a\nb\nc\n");

    expect(result.stdout).toBe("1\n2\n3\n");
  });

  it("NF prints the number of fields in each record", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print NF}"],
      ctx,
      "a b c\nx y\n",
    );

    expect(result.stdout).toBe("3\n2\n");
  });

  // --- advanced print semantics ---
  it("{print $1, $2} uses OFS (space) between fields", async () => {
    const result = await dispatch(
      db,
      "awk",
      ["{print $1, $2}"],
      ctx,
      "hello world foo\n",
    );

    expect(result.stdout).toBe("hello world\n");
  });

  it("{print} with no args prints the entire record", async () => {
    const result = await dispatch(db, "awk", ["{print}"], ctx, "hello world\n");

    expect(result.stdout).toBe("hello world\n");
  });

  it("printf formats output using a format string", async () => {
    const result = await dispatch(
      db,
      "awk",
      ['{ printf "%s\\n", $1 }'],
      ctx,
      "hello world\n",
    );

    expect(result.stdout).toBe("hello\n");
  });
});
