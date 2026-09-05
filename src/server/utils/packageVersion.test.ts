import { describe, it, expect } from "@jest/globals";
import { getPackageVersion } from "./packageVersion.js";

describe("packageVersion", () => {
  it("resolves the current package.json version", () => {
    const version = getPackageVersion();
    expect(version).toBe("1.27.1");
  });
});
