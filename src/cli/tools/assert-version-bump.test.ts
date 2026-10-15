import { describe, it, expect, jest } from "@jest/globals";
import {
  parseSemver,
  compareSemver,
  assertVersionBump,
  main,
} from "./assert-version-bump.js";

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
      expect(compareSemver("1.2.0", "1.3.0")).toBe(-1);
      expect(compareSemver("1.3.0", "1.2.0")).toBe(1);
    });

    it("correctly compares prerelease versions", () => {
      expect(compareSemver("1.0.0-alpha", "1.0.0")).toBe(-1);
      expect(compareSemver("1.0.0", "1.0.0-alpha")).toBe(1);
      expect(compareSemver("1.0.0-alpha", "1.0.0-beta")).toBeLessThan(0);
      expect(compareSemver("1.0.0-beta", "1.0.0-alpha")).toBeGreaterThan(0);
      expect(compareSemver("1.0.0-alpha.1", "1.0.0-alpha.1")).toBe(0);
    });

    it("falls back to localeCompare for unparseable semvers", () => {
      expect(compareSemver("foo", "bar")).toBeGreaterThan(0);
      expect(compareSemver("bar", "foo")).toBeLessThan(0);
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
      ).rejects.toThrow(
        "Version mismatch: package.json (1.23.4) does not match package-lock.json (1.23.3)!",
      );
    });

    it("throws when package.json does not match .well-known/mcp.json", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.4",
          wellKnownMcpVersion: "1.23.3",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.2",
          silent: true,
        }),
      ).rejects.toThrow(
        "Version mismatch: package.json (1.23.4) does not match .well-known/mcp.json (1.23.3)!",
      );
    });

    it("throws when package.json does not match .well-known/mcp/server-card.json", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.4",
          wellKnownMcpVersion: "1.23.4",
          wellKnownServerCardVersion: "1.23.3",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.2",
          silent: true,
        }),
      ).rejects.toThrow(
        "Version mismatch: package.json (1.23.4) does not match .well-known/mcp/server-card.json (1.23.3)!",
      );
    });

    it("passes when package.json, lockfile, and .well-known versions all match", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.4",
          wellKnownMcpVersion: "1.23.4",
          wellKnownServerCardVersion: "1.23.4",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.3",
          silent: true,
        }),
      ).resolves.toBeUndefined();
    });

    it("passes when optional fields are omitted", async () => {
      await expect(
        assertVersionBump({
          localPkgVersion: "1.23.4",
          pkgName: "shadow-claw",
          silent: true,
        }),
      ).resolves.toBeUndefined();
    });

    it("logs message when silent is false and versions pass", async () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await assertVersionBump({
          localPkgVersion: "1.23.4",
          localLockVersion: "1.23.4",
          wellKnownMcpVersion: "1.23.4",
          wellKnownServerCardVersion: "1.23.4",
          pkgName: "shadow-claw",
          publishedVersion: "1.23.3",
          silent: false,
        });
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining("Version assertion passed"),
        );
      } finally {
        logSpy.mockRestore();
      }
    });

    it("runs main() and validates repository version against npm", async () => {
      try {
        await main();
      } catch (err: any) {
        expect(err.message).toMatch(/Version assertion failed/);
      }
    });
  });

  describe("repository live version parity", () => {
    it("verifies package.json, package-lock.json, and .well-known discovery files are strictly in sync", async () => {
      const { readFile } = await import("node:fs/promises");
      const { fileURLToPath } = await import("node:url");
      const path = await import("node:path");
      const rootDir = fileURLToPath(new URL("../../..", import.meta.url));

      const pkg = JSON.parse(
        await readFile(path.join(rootDir, "package.json"), "utf8"),
      );
      const lock = JSON.parse(
        await readFile(path.join(rootDir, "package-lock.json"), "utf8"),
      );
      const mcpJson = JSON.parse(
        await readFile(path.join(rootDir, ".well-known/mcp.json"), "utf8"),
      );
      const serverCard = JSON.parse(
        await readFile(
          path.join(rootDir, ".well-known/mcp/server-card.json"),
          "utf8",
        ),
      );

      expect(lock.version).toBe(pkg.version);
      expect(mcpJson.version).toBe(pkg.version);
      expect(serverCard.version).toBe(pkg.version);
    });
  });
});
