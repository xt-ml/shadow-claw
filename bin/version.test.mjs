import { describe, it, expect } from "@jest/globals";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  DISALLOWED_KEYWORDS,
  USAGE_NOTICE,
  getVersionMap,
  parseSemverString,
  runVersion,
  syncWellKnownVersions,
  validateVersionArg,
} from "./version.mjs";

describe("bin/version.mjs", () => {
  describe("parseSemverString", () => {
    it("parses valid semver versions with or without leading v", () => {
      expect(parseSemverString("1.28.0")).toBe("1.28.0");
      expect(parseSemverString("v1.28.0")).toBe("1.28.0");
      expect(parseSemverString("2.0.0-rc.1")).toBe("2.0.0-rc.1");
      expect(parseSemverString("v0.1.0+build.123")).toBe("0.1.0+build.123");
    });

    it("returns null for non-semver strings", () => {
      expect(parseSemverString("minor")).toBeNull();
      expect(parseSemverString("latest")).toBeNull();
      expect(parseSemverString("1.2")).toBeNull();
      expect(parseSemverString("")).toBeNull();
    });
  });

  describe("validateVersionArg", () => {
    it("returns isHelp for help flags", () => {
      expect(validateVersionArg("--help")).toEqual({ isHelp: true });
      expect(validateVersionArg("-h")).toEqual({ isHelp: true });
    });

    it("rejects all disallowed npm version keyword commands", () => {
      for (const keyword of DISALLOWED_KEYWORDS) {
        const result = validateVersionArg(keyword);
        expect(result.error).toBeDefined();
        expect(result.error).toContain(keyword);
        expect(result.error).toContain(USAGE_NOTICE);
      }
    });

    it("rejects invalid semver strings", () => {
      const result = validateVersionArg("invalid-version");
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Invalid version string");
      expect(result.error).toContain(USAGE_NOTICE);
    });

    it("accepts valid semver string", () => {
      expect(validateVersionArg("1.28.0")).toEqual({ version: "1.28.0" });
      expect(validateVersionArg("v1.28.0")).toEqual({ version: "1.28.0" });
    });
  });

  describe("getVersionMap", () => {
    it("returns version mapping object containing package name and node versions", async () => {
      const map = await getVersionMap();
      expect(map["shadow-claw"]).toBeDefined();
      expect(map.node).toBeDefined();
    });
  });

  describe("syncWellKnownVersions", () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = await mkdtemp(path.join(os.tmpdir(), "sync-well-known-"));
      await mkdir(path.join(tempDir, ".well-known/mcp"), { recursive: true });
      await writeFile(
        path.join(tempDir, ".well-known/mcp.json"),
        JSON.stringify({ name: "shadow-claw", version: "1.27.1" }, null, 2),
        "utf8",
      );
      await writeFile(
        path.join(tempDir, ".well-known/mcp/server-card.json"),
        JSON.stringify({ name: "shadow-claw", version: "1.27.1" }, null, 2),
        "utf8",
      );
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true, force: true });
    });

    it("updates version in .well-known/mcp.json and .well-known/mcp/server-card.json", async () => {
      const updated = await syncWellKnownVersions("1.28.0", tempDir);
      expect(updated).toEqual(
        expect.arrayContaining([
          ".well-known/mcp.json",
          ".well-known/mcp/server-card.json",
        ]),
      );

      const mcpJson = JSON.parse(
        await readFile(path.join(tempDir, ".well-known/mcp.json"), "utf8"),
      );
      const serverCard = JSON.parse(
        await readFile(
          path.join(tempDir, ".well-known/mcp/server-card.json"),
          "utf8",
        ),
      );
      expect(mcpJson.version).toBe("1.28.0");
      expect(serverCard.version).toBe("1.28.0");
    });

    it("skips updating files that already have the matching version", async () => {
      await syncWellKnownVersions("1.28.0", tempDir);
      const secondUpdate = await syncWellKnownVersions("1.28.0", tempDir);
      expect(secondUpdate).toEqual([]);
    });
  });

  describe("runVersion CLI execution", () => {
    it("returns list action when no arguments are provided", async () => {
      const result = await runVersion([], { stdio: "pipe" });
      expect(result.action).toBe("list");
      expect(result.versions["shadow-claw"]).toBeDefined();
    });

    it("returns help action when --help flag is provided", async () => {
      const result = await runVersion(["--help"], { stdio: "pipe" });
      expect(result.action).toBe("help");
      expect(result.message).toContain(USAGE_NOTICE);
    });

    it("throws error when disallowed keyword is provided", async () => {
      await expect(runVersion(["minor"], { stdio: "pipe" })).rejects.toThrow(
        'Keyword command "minor" is not supported',
      );
    });
  });
});
