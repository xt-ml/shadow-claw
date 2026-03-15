import { parseFlags } from "./parseFlags.mjs";

describe("parseFlags.mjs", () => {
  it("should parse simple flags", () => {
    const args = ["-a", "-b", "file.txt"];
    const { flags, operands } = parseFlags(args);

    expect(flags).toEqual({ a: "", b: "" });

    expect(operands).toEqual(["file.txt"]);
  });

  it("should parse flags with values", () => {
    const args = ["-n", "10", "file.txt"];
    const { flags, operands } = parseFlags(args, ["n"]);

    expect(flags).toEqual({ n: "10" });

    expect(operands).toEqual(["file.txt"]);
  });

  it("should handle combined flags", () => {
    const args = ["-ab", "file.txt"];
    const { flags, operands } = parseFlags(args);

    expect(flags).toEqual({ a: "", b: "" });

    expect(operands).toEqual(["file.txt"]);
  });

  it("should handle combined flags with value at end", () => {
    const args = ["-an", "10", "file.txt"];
    const { flags, operands } = parseFlags(args, ["n"]);

    expect(flags).toEqual({ a: "", n: "10" });

    expect(operands).toEqual(["file.txt"]);
  });

  it("should handle -- to stop parsing flags", () => {
    const args = ["-a", "--", "-b", "file"];
    const { flags, operands } = parseFlags(args);

    expect(flags).toEqual({ a: "" });

    expect(operands).toEqual(["-b", "file"]);
  });

  it("should handle long flags with --", () => {
    const args = ["--output", "out.txt"];
    const { flags, operands } = parseFlags(args);

    expect(flags).toEqual({ output: "" });

    expect(operands).toEqual(["out.txt"]);
  });

  it("should handle long flags with inline value --flag=value", () => {
    const args = ["--output=out.txt"];
    const { flags, operands } = parseFlags(args);

    expect(flags).toEqual({ output: "out.txt" });

    expect(operands).toEqual([]);
  });
});
