import { splitOnOperators } from "./splitOnOperators.mjs";

describe("splitOnOperators", () => {
  it("should split by semicolon", () => {
    const result = splitOnOperators("echo hello; echo world");

    expect(result).toEqual([
      { cmd: "echo hello", op: ";" },
      { cmd: " echo world", op: "" },
    ]);
  });

  it("should split by &&", () => {
    const result = splitOnOperators("true && echo success");

    expect(result).toEqual([
      { cmd: "true ", op: "&&" },
      { cmd: " echo success", op: "" },
    ]);
  });

  it("should split by ||", () => {
    const result = splitOnOperators("false || echo fallback");

    expect(result).toEqual([
      { cmd: "false ", op: "||" },
      { cmd: " echo fallback", op: "" },
    ]);
  });

  it("should handle multiple operators", () => {
    const result = splitOnOperators("cmd1; cmd2 && cmd3 || cmd4");

    expect(result).toEqual([
      { cmd: "cmd1", op: ";" },
      { cmd: " cmd2 ", op: "&&" },
      { cmd: " cmd3 ", op: "||" },
      { cmd: " cmd4", op: "" },
    ]);
  });

  it("should respect single quotes", () => {
    const result = splitOnOperators("echo 'hello; world' && echo done");

    expect(result).toEqual([
      { cmd: "echo 'hello; world' ", op: "&&" },
      { cmd: " echo done", op: "" },
    ]);
  });

  it("should respect double quotes", () => {
    const result = splitOnOperators('echo "hello; world" && echo done');

    expect(result).toEqual([
      { cmd: 'echo "hello; world" ', op: "&&" },
      { cmd: " echo done", op: "" },
    ]);
  });

  it("should handle mixed quotes", () => {
    const result = splitOnOperators('echo "it\'s fine" && echo \'say "hi"\'');

    expect(result).toEqual([
      { cmd: 'echo "it\'s fine" ', op: "&&" },
      { cmd: " echo 'say \"hi\"'", op: "" },
    ]);
  });

  it("should respect subshells with $(...)", () => {
    const result = splitOnOperators("echo $(ls; pwd) && echo done");

    expect(result).toEqual([
      { cmd: "echo $(ls; pwd) ", op: "&&" },
      { cmd: " echo done", op: "" },
    ]);
  });

  it("should respect subshells with (...)", () => {
    const result = splitOnOperators("(cd /tmp; ls) || echo failed");

    expect(result).toEqual([
      { cmd: "(cd /tmp; ls) ", op: "||" },
      { cmd: " echo failed", op: "" },
    ]);
  });

  it("should handle nested subshells", () => {
    const result = splitOnOperators("echo $(echo $(ls)) && echo done");

    expect(result).toEqual([
      { cmd: "echo $(echo $(ls)) ", op: "&&" },
      { cmd: " echo done", op: "" },
    ]);
  });

  it("should handle operators within quotes and subshells", () => {
    const result = splitOnOperators(
      'echo "&&" && (echo "||"; echo ";") || echo done',
    );

    expect(result).toEqual([
      { cmd: 'echo "&&" ', op: "&&" },
      { cmd: ' (echo "||"; echo ";") ', op: "||" },
      { cmd: " echo done", op: "" },
    ]);
  });

  it("should return empty array for empty input", () => {
    const result = splitOnOperators("");

    expect(result).toEqual([]);
  });

  it("should return empty array for whitespace-only input", () => {
    const result = splitOnOperators("   ");

    expect(result).toEqual([]);
  });
});
