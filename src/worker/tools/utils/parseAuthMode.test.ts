import { parseAuthMode } from "./parseAuthMode.js";

describe("parseAuthMode", () => {
  it("returns 'token' when input is 'token'", () => {
    expect(parseAuthMode("token")).toBe("token");
  });

  it("returns 'oauth' when input is 'oauth'", () => {
    expect(parseAuthMode("oauth")).toBe("oauth");
  });

  it("returns undefined for any other input", () => {
    expect(parseAuthMode("password")).toBeUndefined();
    expect(parseAuthMode("basic")).toBeUndefined();
    expect(parseAuthMode(null)).toBeUndefined();
    expect(parseAuthMode(undefined)).toBeUndefined();
    expect(parseAuthMode(123)).toBeUndefined();
    expect(parseAuthMode({})).toBeUndefined();
  });
});
