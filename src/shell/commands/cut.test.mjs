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

describe("cut", () => {
  it("should cut fields with default delimiter (tab)", async () => {
    const input = "a\tb\tc\n1\t2\t3";
    const result = await dispatch(db, "cut", ["-f", "2"], ctx, input);

    expect(result.stdout).toBe("b\n2");
  });

  it("should respect delimiter flag -d", async () => {
    const input = "a,b,c\n1,2,3";
    const result = await dispatch(
      db,
      "cut",
      ["-d", ",", "-f", "1,3"],
      ctx,
      input,
    );

    expect(result.stdout).toBe("a,c\n1,3");
  });

  // Test single field
  it("should extract single field", async () => {
    const input = "a\tb\tc";
    const result = await dispatch(db, "cut", ["-f", "1"], ctx, input);

    expect(result.stdout).toBe("a");
  });

  // Test first field with comma delimiter
  it("should cut first field with comma", async () => {
    const input = "x,y,z";
    const result = await dispatch(
      db,
      "cut",
      ["-d", ",", "-f", "1"],
      ctx,
      input,
    );

    expect(result.stdout).toBe("x");
  });

  // Test multiple fields
  it("should cut multiple fields in order", async () => {
    const input = "a\tb\tc\td";
    const result = await dispatch(db, "cut", ["-f", "1,3"], ctx, input);

    expect(result.stdout).toBe("a\tc");
  });

  // Test out-of-bounds field
  it("should handle out-of-bounds field", async () => {
    const input = "a\tb\tc";
    const result = await dispatch(db, "cut", ["-f", "5"], ctx, input);

    expect(result.stdout).toBe("");
  });

  // Test last field
  it("should extract last field", async () => {
    const input = "a\tb\tc";
    const result = await dispatch(db, "cut", ["-f", "3"], ctx, input);

    expect(result.stdout).toBe("c");
  });

  // Test with space delimiter
  it("should cut with space delimiter", async () => {
    const input = "a b c\n1 2 3";
    const result = await dispatch(
      db,
      "cut",
      ["-d", " ", "-f", "2"],
      ctx,
      input,
    );

    expect(result.stdout).toBe("b\n2");
  });

  // Test trailing delimiter
  it("should handle line with trailing delimiter", async () => {
    const input = "a,b,";
    const result = await dispatch(
      db,
      "cut",
      ["-d", ",", "-f", "3"],
      ctx,
      input,
    );

    expect(result.stdout).toBe("");
  });

  // Test empty input
  it("should handle empty input", async () => {
    const result = await dispatch(db, "cut", ["-f", "1"], ctx, "");

    expect(result.stdout).toBe("");
  });

  it("should read input from a file operand", async () => {
    safeRead.mockResolvedValueOnce("alpha,beta,gamma\n1,2,3");

    const result = await dispatch(
      db,
      "cut",
      ["-d", ",", "-f", "2", "data.csv"],
      ctx,
      "",
    );

    expect(safeRead).toHaveBeenCalledWith(db, "test-group", "data.csv");

    expect(result.stdout).toBe("beta\n2");
  });

  it("should handle missing file content as empty input", async () => {
    safeRead.mockResolvedValueOnce(null);

    const result = await dispatch(
      db,
      "cut",
      ["-f", "1", "missing.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("");
  });

  it("-b a,a,a", async () => {
    safeRead.mockResolvedValueOnce(
      "one:two:three:four:five:six:seven\n" +
        "alpha:beta:gamma:delta:epsilon:zeta:eta:theta:iota:kappa:lambda:mu\n" +
        "the quick brown fox jumps over the lazy dog\n",
    );

    const result = await dispatch(
      db,
      "cut",
      ["-b", "3,3,3", "abc.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("e\np\ne\n");
  });

  it("-b overlaps", async () => {
    safeRead.mockResolvedValueOnce(
      "one:two:three:four:five:six:seven\n" +
        "alpha:beta:gamma:delta:epsilon:zeta:eta:theta:iota:kappa:lambda:mu\n" +
        "the quick brown fox jumps over the lazy dog\n",
    );

    const result = await dispatch(
      db,
      "cut",
      ["-b", "1-3,2-5,7-9,9-10", "abc.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("one:to:th\nalphabeta\nthe qick \n");
  });

  it("-b encapsulated", async () => {
    safeRead.mockResolvedValueOnce(
      "one:two:three:four:five:six:seven\n" +
        "alpha:beta:gamma:delta:epsilon:zeta:eta:theta:iota:kappa:lambda:mu\n" +
        "the quick brown fox jumps over the lazy dog\n",
    );

    const result = await dispatch(
      db,
      "cut",
      ["-b", "3-8,4-6", "abc.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe("e:two:\npha:be\ne quic\n");
  });

  it("high-low error", async () => {
    safeRead.mockResolvedValueOnce("one:two:three\n");

    const result = await dispatch(db, "cut", ["-b", "8-3", "abc.txt"], ctx, "");

    expect(result.exitCode).toBe(1);
  });

  it("-c a-b", async () => {
    safeRead.mockResolvedValueOnce(
      "one:two:three:four:five:six:seven\n" +
        "alpha:beta:gamma:delta:epsilon:zeta:eta:theta:iota:kappa:lambda:mu\n" +
        "the quick brown fox jumps over the lazy dog\n",
    );

    const result = await dispatch(
      db,
      "cut",
      ["-c", "4-10", "abc.txt"],
      ctx,
      "",
    );

    expect(result.stdout).toBe(":two:th\nha:beta\n quick \n");
  });
});
