import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
} from "./version.js";

describe("src/cli/tools/version.ts", () => {
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
        expect(result).not.toBeNull();
        expect(result!.error).toBeDefined();
        expect(result!.error).toContain(keyword);
        expect(result!.error).toContain(USAGE_NOTICE);
      }
    });

    it("rejects invalid semver strings", () => {
      const result = validateVersionArg("invalid-version");
      expect(result).not.toBeNull();
      expect(result!.error).toBeDefined();
      expect(result!.error).toContain("Invalid version string");
      expect(result!.error).toContain(USAGE_NOTICE);
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
    let tempDir: string;

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

    it("logs version map when stdio is inherit and no arguments provided", async () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        const result = await runVersion([], { stdio: "inherit" });
        expect(result.action).toBe("list");
        expect(logSpy).toHaveBeenCalled();
      } finally {
        logSpy.mockRestore();
      }
    });

    it("returns help action and logs USAGE_NOTICE when stdio is inherit", async () => {
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        const result = await runVersion(["--help"], { stdio: "inherit" });
        expect(result.action).toBe("help");
        expect(result.message).toContain(USAGE_NOTICE);
        expect(logSpy).toHaveBeenCalledWith(USAGE_NOTICE);
      } finally {
        logSpy.mockRestore();
      }
    });

    it("throws error when disallowed keyword is provided", async () => {
      await expect(runVersion(["minor"], { stdio: "pipe" })).rejects.toThrow(
        'Keyword command "minor" is not supported',
      );
    });

    it("handles isLifecycle mode with git directory", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "lifecycle-test-"));
      try {
        await writeFile(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "test-pkg", version: "2.0.0" }),
          "utf8",
        );
        await mkdir(path.join(tempDir, ".well-known/mcp"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".well-known/mcp.json"),
          JSON.stringify({ version: "1.0.0" }),
          "utf8",
        );
        await mkdir(path.join(tempDir, ".git"), { recursive: true });

        const result = await runVersion([], {
          isLifecycle: true,
          rootDir: tempDir,
        });

        expect(result.version).toBe("2.0.0");
        expect(result.updated).toContain(".well-known/mcp.json");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("handles syncWellKnownVersions JSON parse error gracefully", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "corrupt-test-"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      try {
        await mkdir(path.join(tempDir, ".well-known"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".well-known/mcp.json"),
          "invalid-json",
          "utf8",
        );

        const updated = await syncWellKnownVersions("1.2.3", tempDir);
        expect(updated).toEqual([]);
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("executes npm version and syncs well-known when valid semver given", async () => {
      const tempDir = await mkdtemp(
        path.join(os.tmpdir(), "npm-version-test-"),
      );
      const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
      try {
        await writeFile(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "version-bump-test", version: "1.0.0" }),
          "utf8",
        );
        await mkdir(path.join(tempDir, ".well-known/mcp"), { recursive: true });
        await writeFile(
          path.join(tempDir, ".well-known/mcp.json"),
          JSON.stringify({ version: "1.0.0" }),
          "utf8",
        );

        const result = await runVersion(["1.0.1"], {
          rootDir: tempDir,
          stdio: "inherit",
          execOptions: { cwd: tempDir, stdio: "pipe" },
        });

        expect(result.version).toBe("1.0.1");
        expect(result.updated).toContain(".well-known/mcp.json");
      } finally {
        logSpy.mockRestore();
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("detects lifecycle event from process.env", async () => {
      const prevCmd = process.env.npm_command;
      const prevEvent = process.env.npm_lifecycle_event;
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "env-lifecycle-"));
      try {
        process.env.npm_command = "version";
        process.env.npm_lifecycle_event = "version";
        await writeFile(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "env-lifecycle-pkg", version: "3.0.0" }),
          "utf8",
        );
        const result = await runVersion([], { rootDir: tempDir });
        expect(result.version).toBe("3.0.0");
      } finally {
        process.env.npm_command = prevCmd;
        process.env.npm_lifecycle_event = prevEvent;
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("filters out leading flags to find targetArg", async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "leading-flags-"));
      try {
        await writeFile(
          path.join(tempDir, "package.json"),
          JSON.stringify({ name: "flag-test", version: "1.0.0" }),
          "utf8",
        );
        const result = await runVersion(["--silent", "1.0.1"], {
          rootDir: tempDir,
          execOptions: { cwd: tempDir, stdio: "pipe" },
        });
        expect(result.version).toBe("1.0.1");
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("throws error for unrecognized invalid semver string", async () => {
      await expect(
        runVersion(["bad-semver"], { stdio: "pipe" }),
      ).rejects.toThrow("Invalid version string");
    });
  });
});
