import { registerBasicFunctions } from "./basic-functions.js";
import { globalFunctionRegistry } from "./function-registry.js";

describe("basic-functions", () => {
  beforeAll(() => {
    registerBasicFunctions();
  });

  const run = (
    name: string,
    args: Record<string, any>,
    dataModel: Record<string, any> = {},
  ) => {
    return globalFunctionRegistry.execute(name, args, { dataModel });
  };

  it("capitalizes strings", () => {
    expect(run("capitalize", { value: "hello" })).toBe("Hello");
  });

  it("formats strings with pointers", () => {
    expect(
      run(
        "formatString",
        { value: "Hello ${/user/name}" },
        { user: { name: "Alice" } },
      ),
    ).toBe("Hello Alice");
    expect(
      run("formatString", { value: "Hello ${/user/missing}" }, { user: {} }),
    ).toBe("Hello ");
  });

  it("formats numbers with grouping and decimals", () => {
    expect(
      run("formatNumber", { value: 1234.56, decimals: 1, grouping: true }),
    ).toBe(
      (1234.56).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        useGrouping: true,
      }),
    );
    expect(run("formatNumber", { value: 1000, grouping: false })).toBe(
      (1000).toLocaleString(undefined, { useGrouping: false }),
    );
  });

  it("formats currency with default and custom currency/decimals", () => {
    expect(run("formatCurrency", { value: 42 })).toContain("42");
    expect(
      run("formatCurrency", { value: 42, currency: "EUR", decimals: 0 }),
    ).toBe(
      (42).toLocaleString(undefined, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    );
  });

  it("formats dates and falls back for invalid dates", () => {
    expect(run("formatDate", { value: "2026-10-15T12:00:00Z" })).toBe(
      new Date("2026-10-15T12:00:00Z").toLocaleDateString(),
    );
    expect(run("formatDate", { value: "not-a-date" })).toBe("not-a-date");
  });

  it("pluralizes based on count === 1", () => {
    expect(run("pluralize", { value: 1, one: "item", other: "items" })).toBe(
      "item",
    );
    expect(run("pluralize", { value: 2, one: "item", other: "items" })).toBe(
      "items",
    );
    expect(run("pluralize", { value: 0, one: "item", other: "items" })).toBe(
      "items",
    );
  });

  it("handles openUrl no-op", () => {
    expect(run("openUrl", {})).toBe("");
  });

  it("evaluates boolean logic (and, or, not)", () => {
    expect(run("and", { values: [true, true] })).toBe(true);
    expect(run("and", { values: [true, false] })).toBe(false);

    expect(run("or", { values: [false, true] })).toBe(true);
    expect(run("or", { values: [false, false] })).toBe(false);

    expect(run("not", { value: true })).toBe(false);
    expect(run("not", { value: false })).toBe(true);
  });

  it("evaluates validation functions (required, email, regex, length, numeric)", () => {
    expect(run("required", { value: "test" })).toBe(true);
    expect(run("required", { value: "   " })).toBe(false);

    expect(run("email", { value: "user@example.com" })).toBe(true);
    expect(run("email", { value: "invalid-email" })).toBe(false);

    expect(run("regex", { value: "abc123", pattern: "^[a-z]+[0-9]+$" })).toBe(
      true,
    );
    expect(run("regex", { value: "123abc", pattern: "^[a-z]+[0-9]+$" })).toBe(
      false,
    );

    // length with default and custom min/max
    expect(run("length", { value: "abc", min: 1, max: 5 })).toBe(true);
    expect(run("length", { value: "toolong", max: 5 })).toBe(false);
    expect(run("length", { value: "short", min: 10 })).toBe(false);
    expect(run("length", { value: "any" })).toBe(true);

    // numeric with default and custom min/max
    expect(run("numeric", { value: 5, min: 1, max: 10 })).toBe(true);
    expect(run("numeric", { value: 0, min: 1 })).toBe(false);
    expect(run("numeric", { value: 20, max: 10 })).toBe(false);
    expect(run("numeric", { value: 999 })).toBe(true);
  });
});
