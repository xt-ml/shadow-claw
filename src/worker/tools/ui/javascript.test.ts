import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/sandboxedEval.js", () => ({
  sandboxedEval: jest.fn(),
}));

jest.unstable_mockModule("./utils/getAllowFullInternetAccess.js", () => ({
  getAllowFullInternetAccess: jest.fn<any>().mockResolvedValue(false),
}));

const { executeJavascript } = await import("./javascript.js");
const { sandboxedEval } = await import("../../utils/sandboxedEval.js");

describe("executeJavascript", () => {
  const mockDb: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("evaluates simple expression returning number", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: true,
      value: 42,
    });

    const result = await executeJavascript(mockDb, { code: "1 + 41" });
    expect(result).toBe("42");
    expect(sandboxedEval).toHaveBeenCalledWith(
      "return (1 + 41);",
      undefined,
      false,
      undefined,
    );
  });

  it("handles explicit return statements", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: true,
      value: "hello",
    });

    const result = await executeJavascript(mockDb, {
      code: "const x = 'hello'; return x;",
    });
    expect(result).toBe("hello");
    expect(sandboxedEval).toHaveBeenCalledWith(
      "const x = 'hello'; return x;",
      undefined,
      false,
      undefined,
    );
  });

  it("handles object return values by formatting as JSON", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: true,
      value: { name: "Alice", age: 30 },
    });

    const result = await executeJavascript(mockDb, {
      code: "({ name: 'Alice', age: 30 })",
    });
    expect(JSON.parse(result)).toEqual({ name: "Alice", age: 30 });
  });

  it("returns null representation for null values", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: true,
      value: null,
    });

    const result = await executeJavascript(mockDb, { code: "null" });
    expect(result).toBe("null");
  });

  it("provides hint when evaluation returns undefined", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: true,
      value: undefined,
    });

    const result = await executeJavascript(mockDb, { code: "const a = 1;" });
    expect(result).toContain("(no return value)");
    expect(result).toContain("Hint: Your code did not return a value");
  });

  it("reports JavaScript errors", async () => {
    (sandboxedEval as jest.Mock<any>).mockResolvedValue({
      ok: false,
      error: "ReferenceError: foo is not defined",
    });

    const result = await executeJavascript(mockDb, { code: "foo" });
    expect(result).toBe("JavaScript error: ReferenceError: foo is not defined");
  });

  it("falls back to raw code when wrapping in return produces syntax error", async () => {
    (sandboxedEval as jest.Mock<any>)
      .mockResolvedValueOnce({
        ok: false,
        error: "SyntaxError: Unexpected token 'for'",
      })
      .mockResolvedValueOnce({
        ok: true,
        value: undefined,
      });

    const result = await executeJavascript(mockDb, {
      code: "for (let i = 0; i < 5; i++) { /* do work */ }",
    });

    expect(sandboxedEval).toHaveBeenCalledTimes(2);
    expect(result).toContain("(no return value)");
  });
});
