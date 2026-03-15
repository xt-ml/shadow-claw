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

describe("jq", () => {
  it("should filter json with .", async () => {
    const result = await dispatch(db, "jq", ["."], ctx, '{"a":1}');

    expect(JSON.parse(result.stdout)).toEqual({ a: 1 });
  });

  it("should filter json field", async () => {
    const result = await dispatch(db, "jq", [".a"], ctx, '{"a":1}');

    expect(JSON.parse(result.stdout)).toBe(1);
  });

  it("should handle keys", async () => {
    const result = await dispatch(db, "jq", [".keys"], ctx, '{"a":1, "b":2}');

    expect(JSON.parse(result.stdout)).toEqual(["a", "b"]);
  });

  it("should handle array length", async () => {
    const result = await dispatch(
      db,
      "jq",
      [".items.length"],
      ctx,
      '{"items":[1,2,3]}',
    );

    expect(JSON.parse(result.stdout)).toBe(3);
  });

  it("should read input from a file path", async () => {
    safeRead.mockResolvedValueOnce(
      '{"items":[{"name":"first"},{"name":"second"}]}',
    );

    const result = await dispatch(
      db,
      "jq",
      [".items[1].name", "data.json"],
      ctx,
      "",
    );

    expect(JSON.parse(result.stdout)).toBe("second");

    expect(safeRead).toHaveBeenCalledWith(db, "test-group", "data.json");
  });

  it("should report parse errors", async () => {
    const result = await dispatch(db, "jq", ["."], ctx, "not json");

    expect(result.stderr).toContain("jq:");

    expect(result.exitCode).toBe(1);
  });

  // --- CP1: Core path expressions ---

  it("array index .[0] returns first element", async () => {
    const result = await dispatch(db, "jq", [".[0]"], ctx, "[10,20,30]");

    expect(JSON.parse(result.stdout)).toBe(10);
  });

  it("negative array index .[-1] returns last element", async () => {
    const result = await dispatch(db, "jq", [".[-1]"], ctx, "[10,20,30]");

    expect(JSON.parse(result.stdout)).toBe(30);
  });

  it(".[] iterator outputs each array element on its own line", async () => {
    const result = await dispatch(db, "jq", [".[]"], ctx, "[1,2,3]");

    expect(result.stdout).toBe("1\n2\n3\n");

    expect(result.exitCode).toBe(0);
  });

  it(".[] iterator on object outputs each value", async () => {
    const result = await dispatch(db, "jq", [".[]"], ctx, '{"a":1,"b":2}');
    const lines = result.stdout.trim().split("\n");

    expect(lines.sort()).toEqual(["1", "2"]);
  });

  it(".[start:end] slice returns sub-array", async () => {
    const result = await dispatch(db, "jq", [".[1:3]"], ctx, "[0,1,2,3,4]");

    expect(JSON.parse(result.stdout)).toEqual([1, 2]);
  });

  it(".[start:end] slice works on strings", async () => {
    const result = await dispatch(db, "jq", [".[2:5]"], ctx, '"abcdefg"');

    expect(JSON.parse(result.stdout)).toBe("cde");
  });

  it("pipe operator passes left output to right expression", async () => {
    const result = await dispatch(
      db,
      "jq",
      [".foo | .bar"],
      ctx,
      '{"foo":{"bar":42},"bar":"bad"}',
    );

    expect(JSON.parse(result.stdout)).toBe(42);
  });

  it("pipe with .[] spreads then maps", async () => {
    const result = await dispatch(
      db,
      "jq",
      [".[] | .name"],
      ctx,
      '[{"name":"alice"},{"name":"bob"}]',
    );

    expect(result.stdout).toBe('"alice"\n"bob"\n');
  });

  // --- CP2: Builtins ---

  it("keys returns sorted array of object keys", async () => {
    const result = await dispatch(db, "jq", ["keys"], ctx, '{"b":2,"a":1}');

    expect(JSON.parse(result.stdout)).toEqual(["a", "b"]);
  });

  it("values returns array of object values", async () => {
    const result = await dispatch(db, "jq", ["values"], ctx, '{"a":1,"b":2}');

    expect(JSON.parse(result.stdout)).toEqual([1, 2]);
  });

  it("length on array returns element count", async () => {
    const result = await dispatch(db, "jq", ["length"], ctx, "[1,2,3,4]");

    expect(JSON.parse(result.stdout)).toBe(4);
  });

  it("length on string returns character count", async () => {
    const result = await dispatch(db, "jq", ["length"], ctx, '"hello"');

    expect(JSON.parse(result.stdout)).toBe(5);
  });

  it("length on object returns key count", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["length"],
      ctx,
      '{"a":1,"b":2,"c":3}',
    );

    expect(JSON.parse(result.stdout)).toBe(3);
  });

  it("type returns the JSON type string", async () => {
    const cases = [
      ['{"a":1}', "object"],
      ["[1,2]", "array"],
      ['"hi"', "string"],
      ["42", "number"],
      ["true", "boolean"],
      ["null", "null"],
    ];
    for (const [input, expected] of cases) {
      const result = await dispatch(db, "jq", ["type"], ctx, input);
      expect(JSON.parse(result.stdout)).toBe(expected);
    }
  });

  it("has checks for key presence in object", async () => {
    const yes = await dispatch(db, "jq", ['has("a")'], ctx, '{"a":1}');

    expect(JSON.parse(yes.stdout)).toBe(true);
    const no = await dispatch(db, "jq", ['has("z")'], ctx, '{"a":1}');

    expect(JSON.parse(no.stdout)).toBe(false);
  });

  it("has checks for index presence in array", async () => {
    const yes = await dispatch(db, "jq", ["has(1)"], ctx, "[10,20]");

    expect(JSON.parse(yes.stdout)).toBe(true);
    const no = await dispatch(db, "jq", ["has(5)"], ctx, "[10,20]");

    expect(JSON.parse(no.stdout)).toBe(false);
  });

  it("map applies expression to each element", async () => {
    const result = await dispatch(db, "jq", ["map(. * 2)"], ctx, "[1,2,3]");

    expect(JSON.parse(result.stdout)).toEqual([2, 4, 6]);
  });

  it("map extracts a field from each object in an array", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["map(.name)"],
      ctx,
      '[{"name":"alice"},{"name":"bob"}]',
    );

    expect(JSON.parse(result.stdout)).toEqual(["alice", "bob"]);
  });

  it("select filters elements matching predicate", async () => {
    const result = await dispatch(
      db,
      "jq",
      [".[] | select(. > 2)"],
      ctx,
      "[1,2,3,4]",
    );

    expect(result.stdout).toBe("3\n4\n");
  });

  it("select inside map removes non-matching elements", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["[.[] | select(.active)]"],
      ctx,
      '[{"active":true,"v":1},{"active":false,"v":2},{"active":true,"v":3}]',
    );

    expect(JSON.parse(result.stdout)).toEqual([
      { active: true, v: 1 },
      { active: true, v: 3 },
    ]);
  });

  it("add sums an array of numbers", async () => {
    const result = await dispatch(db, "jq", ["add"], ctx, "[1,2,3,4]");

    expect(JSON.parse(result.stdout)).toBe(10);
  });

  it("add concatenates an array of strings", async () => {
    const result = await dispatch(db, "jq", ["add"], ctx, '["a","b","c"]');

    expect(JSON.parse(result.stdout)).toBe("abc");
  });

  it("sort returns sorted array", async () => {
    const result = await dispatch(db, "jq", ["sort"], ctx, "[3,1,2]");

    expect(JSON.parse(result.stdout)).toEqual([1, 2, 3]);
  });

  it("sort_by sorts objects by field", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["sort_by(.age)"],
      ctx,
      '[{"age":30},{"age":20},{"age":25}]',
    );

    expect(JSON.parse(result.stdout)).toEqual([
      { age: 20 },
      { age: 25 },
      { age: 30 },
    ]);
  });

  it("unique removes duplicate values", async () => {
    const result = await dispatch(db, "jq", ["unique"], ctx, "[1,2,1,3,2]");

    expect(JSON.parse(result.stdout)).toEqual([1, 2, 3]);
  });

  it("reverse reverses an array", async () => {
    const result = await dispatch(db, "jq", ["reverse"], ctx, "[1,2,3]");

    expect(JSON.parse(result.stdout)).toEqual([3, 2, 1]);
  });

  it("flatten flattens nested arrays", async () => {
    const result = await dispatch(db, "jq", ["flatten"], ctx, "[1,[2,[3]],4]");

    expect(JSON.parse(result.stdout)).toEqual([1, 2, 3, 4]);
  });

  it("to_entries converts object to key-value pairs", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["to_entries"],
      ctx,
      '{"a":1,"b":2}',
    );

    expect(JSON.parse(result.stdout)).toEqual([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
  });

  it("from_entries converts key-value pairs to object", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["from_entries"],
      ctx,
      '[{"key":"a","value":1},{"key":"b","value":2}]',
    );

    expect(JSON.parse(result.stdout)).toEqual({ a: 1, b: 2 });
  });

  it("with_entries transforms each entry", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["with_entries(.value += 10)"],
      ctx,
      '{"a":1,"b":2}',
    );

    expect(JSON.parse(result.stdout)).toEqual({ a: 11, b: 12 });
  });

  it("del removes a key from an object", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["del(.b)"],
      ctx,
      '{"a":1,"b":2,"c":3}',
    );

    expect(JSON.parse(result.stdout)).toEqual({ a: 1, c: 3 });
  });

  it("del removes an element from an array", async () => {
    const result = await dispatch(db, "jq", ["del(.[1])"], ctx, "[1,2,3]");

    expect(JSON.parse(result.stdout)).toEqual([1, 3]);
  });

  it("group_by groups array elements by field", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["group_by(.x)"],
      ctx,
      '[{"x":1,"y":2},{"x":1,"y":3},{"x":2,"y":4}]',
    );

    expect(JSON.parse(result.stdout)).toEqual([
      [
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ],
      [{ x: 2, y: 4 }],
    ]);
  });

  it("min and max return extremes of array", async () => {
    const min = await dispatch(db, "jq", ["min"], ctx, "[3,1,2]");

    expect(JSON.parse(min.stdout)).toBe(1);
    const max = await dispatch(db, "jq", ["max"], ctx, "[3,1,2]");

    expect(JSON.parse(max.stdout)).toBe(3);
  });

  it("any returns true if any element matches", async () => {
    const yes = await dispatch(db, "jq", ["any(. > 3)"], ctx, "[1,2,3,4]");

    expect(JSON.parse(yes.stdout)).toBe(true);
    const no = await dispatch(db, "jq", ["any(. > 10)"], ctx, "[1,2,3,4]");

    expect(JSON.parse(no.stdout)).toBe(false);
  });

  it("all returns true only if all elements match", async () => {
    const yes = await dispatch(db, "jq", ["all(. > 0)"], ctx, "[1,2,3]");

    expect(JSON.parse(yes.stdout)).toBe(true);
    const no = await dispatch(db, "jq", ["all(. > 1)"], ctx, "[1,2,3]");

    expect(JSON.parse(no.stdout)).toBe(false);
  });

  // --- CP3: Conditionals & logic ---

  it("if/then/else/end conditional", async () => {
    const result = await dispatch(
      db,
      "jq",
      ['if . > 2 then "big" else "small" end'],
      ctx,
      "5",
    );

    expect(JSON.parse(result.stdout)).toBe("big");
  });

  it("if/then/else on false branch", async () => {
    const result = await dispatch(
      db,
      "jq",
      ['if . > 2 then "big" else "small" end'],
      ctx,
      "1",
    );

    expect(JSON.parse(result.stdout)).toBe("small");
  });

  it("not negates a boolean", async () => {
    const t = await dispatch(db, "jq", ["true | not"], ctx, "null");

    expect(JSON.parse(t.stdout)).toBe(false);
    const f = await dispatch(db, "jq", ["false | not"], ctx, "null");

    expect(JSON.parse(f.stdout)).toBe(true);
  });

  it("== and != comparisons", async () => {
    const eq = await dispatch(db, "jq", [". == 42"], ctx, "42");

    expect(JSON.parse(eq.stdout)).toBe(true);
    const neq = await dispatch(db, "jq", [". != 42"], ctx, "99");

    expect(JSON.parse(neq.stdout)).toBe(true);
  });

  it("< > <= >= comparisons", async () => {
    const lt = await dispatch(db, "jq", [". < 5"], ctx, "3");

    expect(JSON.parse(lt.stdout)).toBe(true);
    const gt = await dispatch(db, "jq", [". > 5"], ctx, "7");

    expect(JSON.parse(gt.stdout)).toBe(true);
    const lte = await dispatch(db, "jq", [". <= 5"], ctx, "5");

    expect(JSON.parse(lte.stdout)).toBe(true);
    const gte = await dispatch(db, "jq", [". >= 5"], ctx, "5");

    expect(JSON.parse(gte.stdout)).toBe(true);
  });

  it("and / or logical operators", async () => {
    const a = await dispatch(db, "jq", ["true and false"], ctx, "null");

    expect(JSON.parse(a.stdout)).toBe(false);
    const o = await dispatch(db, "jq", ["false or true"], ctx, "null");

    expect(JSON.parse(o.stdout)).toBe(true);
  });

  it("// alternative operator returns right side when left is null", async () => {
    const result = await dispatch(db, "jq", ['.x // "default"'], ctx, "{}");

    expect(JSON.parse(result.stdout)).toBe("default");
  });

  it("// alternative operator returns left side when not null/false", async () => {
    const result = await dispatch(
      db,
      "jq",
      ['.x // "default"'],
      ctx,
      '{"x":42}',
    );

    expect(JSON.parse(result.stdout)).toBe(42);
  });

  it("arithmetic: + - * / %", async () => {
    const add = await dispatch(db, "jq", [". + 3"], ctx, "7");

    expect(JSON.parse(add.stdout)).toBe(10);
    const sub = await dispatch(db, "jq", [". - 3"], ctx, "7");

    expect(JSON.parse(sub.stdout)).toBe(4);
    const mul = await dispatch(db, "jq", [". * 3"], ctx, "7");

    expect(JSON.parse(mul.stdout)).toBe(21);
    const div = await dispatch(db, "jq", [". / 2"], ctx, "10");

    expect(JSON.parse(div.stdout)).toBe(5);
    const mod = await dispatch(db, "jq", [". % 3"], ctx, "10");

    expect(JSON.parse(mod.stdout)).toBe(1);
  });

  it("-r outputs strings without JSON quotes", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["-r", ".name"],
      ctx,
      '{"name":"alice"}',
    );

    expect(result.stdout).toBe("alice\n");
  });

  it("-c outputs compact JSON without indentation", async () => {
    const result = await dispatch(db, "jq", ["-c", "."], ctx, '{"a":1,"b":2}');

    expect(result.stdout).toBe('{"a":1,"b":2}\n');
  });

  it("-n runs with null input, ignores stdin", async () => {
    const result = await dispatch(db, "jq", ["-n", "1+1"], ctx, "garbage");

    expect(JSON.parse(result.stdout)).toBe(2);
  });

  it("map_values transforms object values", async () => {
    const result = await dispatch(
      db,
      "jq",
      ["map_values(. * 2)"],
      ctx,
      '{"a":1,"b":2}',
    );

    expect(JSON.parse(result.stdout)).toEqual({ a: 2, b: 4 });
  });
});
