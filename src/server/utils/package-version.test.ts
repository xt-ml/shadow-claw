import { describe, it, expect } from "@jest/globals";
import { getPackageVersion } from "./package-version.js";

describe("packageVersion", () => {
  it("resolves the current package.json version as a valid semver string", () => {
    const version = getPackageVersion();
    expect(typeof version).toBe("string");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("returns cachedVersion on subsequent calls", () => {
    const v1 = getPackageVersion();
    const v2 = getPackageVersion();
    expect(v1).toBe(v2);
  });

  it("returns fallback version when package.json is not found", async () => {
    const fsModule = await import("node:fs");
    const origExists = fsModule.default.existsSync;
    (fsModule.default as any).existsSync = () => false;

    try {
      const { getPackageVersion: getFreshVersion } = await import(
        `./package-version.js?cacheBust=${Date.now()}`
      );
      expect(getFreshVersion()).toBe("1.27.1");
    } finally {
      (fsModule.default as any).existsSync = origExists;
    }
  });
});
