import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ShadowClawDatabase } from "../../../db/types.js";

interface SandboxedEvalResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const mockSandboxedEval =
  jest.fn<
    (
      code?: string,
      context?: unknown,
      allowInternet?: boolean,
      data?: unknown,
    ) => Promise<SandboxedEvalResult | null>
  >();
const mockGetAllowFullInternetAccess = jest
  .fn<() => Promise<boolean>>()
  .mockResolvedValue(false);

jest.unstable_mockModule("../../utils/sandboxedEval.js", () => ({
  sandboxedEval: mockSandboxedEval,
}));

jest.unstable_mockModule("../utils/getAllowFullInternetAccess.js", () => ({
  getAllowFullInternetAccess: mockGetAllowFullInternetAccess,
}));

const { executeJavascript } = await import("./javascript.js");

describe("executeJavascript", () => {
  const mockDb = {} as ShadowClawDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("evaluates simple expression returning number", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: 42,
    });

    const result = await executeJavascript(mockDb, { code: "1 + 41" });
    expect(result).toBe("42");
    expect(mockSandboxedEval).toHaveBeenCalledWith(
      "return (1 + 41);",
      undefined,
      false,
      undefined,
    );
  });

  it("handles explicit return statements", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: "hello",
    });

    const result = await executeJavascript(mockDb, {
      code: "const x = 'hello'; return x;",
    });
    expect(result).toBe("hello");
    expect(mockSandboxedEval).toHaveBeenCalledWith(
      "const x = 'hello'; return x;",
      undefined,
      false,
      undefined,
    );
  });

  it("handles object return values by formatting as JSON", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: { name: "Alice", age: 30 },
    });

    const result = await executeJavascript(mockDb, {
      code: "({ name: 'Alice', age: 30 })",
    });
    expect(JSON.parse(result)).toEqual({ name: "Alice", age: 30 });
  });

  it("falls back to String representation when object serialization throws", async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: circular,
    });

    const result = await executeJavascript(mockDb, { code: "circular" });
    expect(result).toBe("[object Object]");
  });

  it("returns null representation for null values", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: null,
    });

    const result = await executeJavascript(mockDb, { code: "null" });
    expect(result).toBe("null");
  });

  it("provides hint when evaluation returns undefined or __UNDEFINED__", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: undefined,
    });

    const result = await executeJavascript(mockDb, { code: "const a = 1;" });
    expect(result).toContain("(no return value)");
    expect(result).toContain("Hint: Your code did not return a value");

    mockSandboxedEval.mockResolvedValue({
      ok: true,
      value: "__UNDEFINED__",
    });

    const resultUndefStr = await executeJavascript(mockDb, {
      code: "undefined",
    });
    expect(resultUndefStr).toContain("(no return value)");
  });

  it("reports JavaScript errors and falls back to Unknown error when error is missing", async () => {
    mockSandboxedEval.mockResolvedValue({
      ok: false,
      error: "ReferenceError: foo is not defined",
    });

    const result = await executeJavascript(mockDb, { code: "foo" });
    expect(result).toBe("JavaScript error: ReferenceError: foo is not defined");

    mockSandboxedEval.mockResolvedValue({
      ok: false,
    });

    const resultUnknown = await executeJavascript(mockDb, { code: "fail" });
    expect(resultUnknown).toBe("JavaScript error: Unknown error");

    mockSandboxedEval.mockResolvedValue(null);
    const resultNull = await executeJavascript(mockDb, { code: "fail" });
    expect(resultNull).toBe("JavaScript error: Unknown error");
  });

  it("falls back to raw code when wrapping in return produces syntax error", async () => {
    mockSandboxedEval
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

    expect(mockSandboxedEval).toHaveBeenCalledTimes(2);
    expect(result).toContain("(no return value)");
  });
});
