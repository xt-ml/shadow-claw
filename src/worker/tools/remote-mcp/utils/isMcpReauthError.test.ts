import { describe, expect, it } from "@jest/globals";
import { isMcpReauthError } from "./isMcpReauthError.js";

class CustomReauthError extends Error {
  constructor(message = "reauth required") {
    super(message);
    this.name = "McpReauthRequiredError";
  }
}

describe("isMcpReauthError", () => {
  it("returns true when err is an instance of the provided constructor", () => {
    const err = new CustomReauthError();
    expect(isMcpReauthError(err, CustomReauthError)).toBe(true);
  });

  it("returns true when err is a duck-typed object with name McpReauthRequiredError", () => {
    const duckTyped = {
      name: "McpReauthRequiredError",
      message: "token expired",
    };
    expect(isMcpReauthError(duckTyped, CustomReauthError)).toBe(true);
  });

  it("returns false for null or undefined", () => {
    expect(isMcpReauthError(null, CustomReauthError)).toBe(false);
    expect(isMcpReauthError(undefined, CustomReauthError)).toBe(false);
  });

  it("returns false for primitive values", () => {
    expect(isMcpReauthError("some error string", CustomReauthError)).toBe(
      false,
    );
    expect(isMcpReauthError(12345, CustomReauthError)).toBe(false);
  });

  it("returns false for objects or Errors with other names", () => {
    expect(
      isMcpReauthError(new Error("regular error"), CustomReauthError),
    ).toBe(false);
    expect(isMcpReauthError({ name: "NetworkError" }, CustomReauthError)).toBe(
      false,
    );
  });
});
