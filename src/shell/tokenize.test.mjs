import { tokenize } from "./tokenize.mjs";

describe("tokenize", () => {
  it("should split simple commands", () => {
    expect(tokenize("ls -l /tmp")).toEqual(["ls", "-l", "/tmp"]);
  });

  it("should respect single quotes", () => {
    expect(tokenize("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  it("should respect double quotes", () => {
    expect(tokenize('echo "hello world"')).toEqual(["echo", "hello world"]);
  });

  it("should handle escaped characters", () => {
    expect(tokenize("echo hello\\ world")).toEqual(["echo", "hello world"]);
    expect(tokenize('echo "quoted \\" quote"')).toEqual([
      "echo",
      'quoted " quote',
    ]);
  });

  it("should handle nested quotes", () => {
    expect(tokenize('echo "it\'s a test"')).toEqual(["echo", "it's a test"]);
    expect(tokenize("echo '\"double\" in single'")).toEqual([
      "echo",
      '"double" in single',
    ]);
  });

  it("should handle multiple spaces", () => {
    expect(tokenize("ls    -l")).toEqual(["ls", "-l"]);
  });

  it("should handle trailing spaces", () => {
    expect(tokenize("ls -l ")).toEqual(["ls", "-l"]);
  });
});
