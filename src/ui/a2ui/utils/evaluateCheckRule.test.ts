import { registerBasicFunctions } from "../registries/basicFunctions.js";
import { evaluateCheckRule } from "./evaluateCheckRule.js";

import type { CheckRule } from "../types.js";

beforeAll(() => {
  registerBasicFunctions();
});

describe("evaluateCheckRule", () => {
  it("required — returns null for non-empty value", () => {
    const rule: CheckRule = {
      rule: { call: "required", args: { value: { path: "/name" } } },
      errorMessage: "Name is required",
    };
    expect(evaluateCheckRule(rule, { name: "Alice" })).toBeNull();
  });

  it("required — returns error message for empty value", () => {
    const rule: CheckRule = {
      rule: { call: "required", args: { value: { path: "/name" } } },
      errorMessage: "Name is required",
    };
    expect(evaluateCheckRule(rule, { name: "" })).toBe("Name is required");
  });

  it("email — returns null for valid email", () => {
    const rule: CheckRule = {
      rule: { call: "email", args: { value: { path: "/email" } } },
      errorMessage: "Invalid email",
    };
    expect(evaluateCheckRule(rule, { email: "user@example.com" })).toBeNull();
  });

  it("email — returns error message for invalid email", () => {
    const rule: CheckRule = {
      rule: { call: "email", args: { value: { path: "/email" } } },
      errorMessage: "Invalid email",
    };
    expect(evaluateCheckRule(rule, { email: "not-an-email" })).toBe(
      "Invalid email",
    );
  });

  it("regex — returns null for matching value", () => {
    const rule: CheckRule = {
      rule: {
        call: "regex",
        args: { value: { path: "/code" }, pattern: "^[A-Z]{3}$" },
      },
      errorMessage: "Invalid code",
    };
    expect(evaluateCheckRule(rule, { code: "ABC" })).toBeNull();
  });

  it("regex — returns error for non-matching value", () => {
    const rule: CheckRule = {
      rule: {
        call: "regex",
        args: { value: { path: "/code" }, pattern: "^[A-Z]{3}$" },
      },
      errorMessage: "Invalid code",
    };
    expect(evaluateCheckRule(rule, { code: "abc" })).toBe("Invalid code");
  });

  it("length — validates min length", () => {
    const rule: CheckRule = {
      rule: { call: "length", args: { value: { path: "/pw" }, min: 8 } },
      errorMessage: "Too short",
    };
    expect(evaluateCheckRule(rule, { pw: "short" })).toBe("Too short");
    expect(evaluateCheckRule(rule, { pw: "longenough" })).toBeNull();
  });

  it("numeric — validates range", () => {
    const rule: CheckRule = {
      rule: {
        call: "numeric",
        args: { value: { path: "/age" }, min: 18, max: 120 },
      },
      errorMessage: "Age out of range",
    };
    expect(evaluateCheckRule(rule, { age: 17 })).toBe("Age out of range");
    expect(evaluateCheckRule(rule, { age: 25 })).toBeNull();
  });
});
