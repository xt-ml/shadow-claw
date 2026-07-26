import { registerBasicFunctions } from "../registries/basicFunctions.js";
import { resolveDynamicBoolean } from "./resolveDynamicBoolean.js";

beforeAll(() => {
  registerBasicFunctions();
});

describe("resolveDynamicBoolean", () => {
  it("returns a literal boolean", () => {
    expect(resolveDynamicBoolean(true, {})).toBe(true);
  });

  it("resolves a path reference", () => {
    expect(resolveDynamicBoolean({ path: "/flag" }, { flag: true })).toBe(true);
  });

  it("returns false for null", () => {
    expect(resolveDynamicBoolean(null, {})).toBe(false);
  });

  it("evaluates 'and' combinator", () => {
    expect(
      resolveDynamicBoolean(
        { call: "and", args: { values: [true, { path: "/t" }] } },
        { t: true },
      ),
    ).toBe(true);
    expect(
      resolveDynamicBoolean(
        { call: "and", args: { values: [true, { path: "/f" }] } },
        { f: false },
      ),
    ).toBe(false);
  });

  it("evaluates 'or' combinator", () => {
    expect(
      resolveDynamicBoolean(
        { call: "or", args: { values: [false, { path: "/t" }] } },
        { t: true },
      ),
    ).toBe(true);
    expect(
      resolveDynamicBoolean(
        { call: "or", args: { values: [false, { path: "/f" }] } },
        { f: false },
      ),
    ).toBe(false);
  });

  it("evaluates 'not' combinator", () => {
    expect(
      resolveDynamicBoolean(
        { call: "not", args: { value: { path: "/t" } } },
        { t: true },
      ),
    ).toBe(false);
    expect(
      resolveDynamicBoolean(
        { call: "not", args: { value: { path: "/f" } } },
        { f: false },
      ),
    ).toBe(true);
  });
});
