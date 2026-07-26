import { registerBasicFunctions } from "../registries/basicFunctions.js";
import { resolveDynamicString } from "./resolveDynamicString.js";

beforeAll(() => {
  registerBasicFunctions();
});

describe("resolveDynamicString", () => {
  const model = { name: "Alice", nested: { age: 30 } };

  it("returns literal string unchanged", () => {
    expect(resolveDynamicString("hello", model)).toBe("hello");
  });

  it("resolves spec-canonical {path: '/name'} binding", () => {
    expect(resolveDynamicString({ path: "/name" }, model)).toBe("Alice");
  });

  it("resolves nested {path: '/nested/age'}", () => {
    expect(resolveDynamicString({ path: "/nested/age" }, model)).toBe("30");
  });

  it("resolves deprecated {$dataModel: '/name'} for backward compat", () => {
    expect(resolveDynamicString({ $dataModel: "/name" }, model)).toBe("Alice");
  });

  it("resolves capitalize function call with {path}", () => {
    expect(
      resolveDynamicString(
        { call: "capitalize", args: { value: { path: "/name" } } },
        { name: "bob" },
      ),
    ).toBe("Bob");
  });

  it("returns empty string for null/undefined", () => {
    expect(resolveDynamicString(null, model)).toBe("");
    expect(resolveDynamicString(undefined, model)).toBe("");
  });

  it("returns empty string for unknown object shape", () => {
    expect(resolveDynamicString({} as any, model)).toBe("");
  });
});

describe("resolveDynamicString — formatString", () => {
  it("interpolates ${/pointer} placeholders", () => {
    const model = { name: "Alice", city: "NYC" };
    expect(
      resolveDynamicString(
        {
          call: "formatString",
          args: { value: "Hello ${/name} from ${/city}" },
        },
        model,
      ),
    ).toBe("Hello Alice from NYC");
  });

  it("leaves unresolved pointers as empty string", () => {
    expect(
      resolveDynamicString(
        { call: "formatString", args: { value: "Hi ${/missing}" } },
        {},
      ),
    ).toBe("Hi ");
  });
});

describe("resolveDynamicString — formatNumber", () => {
  it("formats a number with fixed decimals", () => {
    const result = resolveDynamicString(
      { call: "formatNumber", args: { value: { path: "/n" }, decimals: 2 } },
      { n: 1234.5 },
    );
    expect(result).toContain("1,234.50");
  });

  it("resolves a static number", () => {
    const result = resolveDynamicString(
      { call: "formatNumber", args: { value: 42 } },
      {},
    );
    expect(result).toBe("42");
  });
});

describe("resolveDynamicString — pluralize", () => {
  it("returns singular form when count is 1", () => {
    expect(
      resolveDynamicString(
        { call: "pluralize", args: { value: 1, one: "item", other: "items" } },
        {},
      ),
    ).toBe("item");
  });

  it("returns plural form when count is not 1", () => {
    expect(
      resolveDynamicString(
        {
          call: "pluralize",
          args: { value: { path: "/count" }, one: "item", other: "items" },
        },
        { count: 5 },
      ),
    ).toBe("items");
  });
});
