import { describe, it, expect } from "@jest/globals";
import { getPackageVersion } from "./packageVersion.js";

describe("packageVersion", () => {
  it("resolves the current package.json version as a valid semver string", () => {
    const version = getPackageVersion();
    expect(typeof version).toBe("string");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
