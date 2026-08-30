import { describe, it, expect } from "@jest/globals";
import {
  parseSemver,
  compareSemver,
  assertVersionBump,
} from "./assert-version-bump.mjs";

describe("assert-version-bump", () => {
  describe("parseSemver", () => {
    it("parses valid semver strings correctly", () => {
      expect(parseSemver("1.23.4")).toEqual({
        major: 1,
        minor: 23,
        patch: 4,
        prerelease: null,
        raw: "1.23.4",
      });
      expect(parseSemver("v2.0.0-beta.1")).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: "beta.1",
        raw: "2.0.0-beta.1",
      });
    });

    it("returns null for invalid semver strings", () => {
      expect(parseSemver("invalid")).toBeNull();
      expect(parseSemver("")).toBeNull();
    });
  });

  describe("compareSemver", () => {
    it("correctly compares semver versions", () => {
      expect(compareSemver("1.23.4", "1.23.3")).toBe(1);
      expect(compareSemver("2.0.0", "1.99.99")).toBe(1);
      expect(compareSemver("1.23.3", "1.23.3")).toBe(0);
      expect(compareSemver("1.23.2", "1.23.3")).toBe(-1);
    });
  });

  describe("assertVersionBump", () => {
    it("passes when local version is greater than published version", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.4",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.3",
          silent: true,
        }),
      ).resolves.toBeUndefined();
    });

    it("throws when local version is equal to published version", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.3",
          localLockVersion: "1.23.3",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.3",
          silent: true,
        }),
      ).rejects.toThrow("Version assertion failed");
    });

    it("throws when package.json does not match package-lock.json", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.3",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.2",
          silent: true,
        }),
      ).rejects.toThrow("Version mismatch");
    });
  });
});
