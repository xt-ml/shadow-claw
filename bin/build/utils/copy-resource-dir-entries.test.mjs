import { jest } from "@jest/globals";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { copyResourceDirEntries } from "./copy-resource-dir-entries.mjs";

function dirEntry(name) {
  return {
    name,
    isDirectory: () => true,
    isFile: () => false,
  };
}

function fileEntry(name) {
  return {
    name,
    isDirectory: () => false,
    isFile: () => true,
  };
}

function neitherEntry(name) {
  return {
    name,
    isDirectory: () => false,
    isFile: () => false,
  };
}

describe("copyResourceDirEntries", () => {
  it("copies directories and files from each resource dir", async () => {
    const readdirImpl = jest.fn().mockImplementation(async (dir) => {
      if (dir === "resources") {
        return [dirEntry("assets"), fileEntry("README.md")];
      }
      return [];
    });
    const cpImpl = jest.fn().mockResolvedValue(undefined);

    await copyResourceDirEntries(["resources"], "dist/public", {
      readdirImpl,
      cpImpl,
    });

    expect(cpImpl).toHaveBeenCalledWith(
      "resources/assets",
      "dist/public/assets",
      {
        recursive: true,
        force: true,
      },
    );
    expect(cpImpl).toHaveBeenCalledWith(
      "resources/README.md",
      "dist/public/README.md",
      { force: true },
    );
  });

  it("ignores unreadable resource directories", async () => {
    const readdirImpl = jest.fn().mockRejectedValue(new Error("missing"));
    const cpImpl = jest.fn();

    await copyResourceDirEntries(["missing-dir"], "dist/public", {
      readdirImpl,
      cpImpl,
    });

    expect(cpImpl).not.toHaveBeenCalled();
  });

  it("skips non-file, non-directory entries", async () => {
    const readdirImpl = jest.fn().mockResolvedValue([neitherEntry("ignored")]);
    const cpImpl = jest.fn();

    await copyResourceDirEntries(["resources"], "dist/public", {
      readdirImpl,
      cpImpl,
    });

    expect(cpImpl).not.toHaveBeenCalled();
  });

  it("resolves resource directories relative to baseDir when provided", async () => {
    const readdirImpl = jest.fn().mockImplementation(async (dir) => {
      if (dir === "/custom/root/resources") {
        return [fileEntry("custom.txt")];
      }
      return [];
    });
    const cpImpl = jest.fn().mockResolvedValue(undefined);

    await copyResourceDirEntries(["resources"], "/custom/root/dist/public", {
      baseDir: "/custom/root",
      readdirImpl,
      cpImpl,
    });

    expect(readdirImpl).toHaveBeenCalledWith("/custom/root/resources", {
      withFileTypes: true,
    });
    expect(cpImpl).toHaveBeenCalledWith(
      "/custom/root/resources/custom.txt",
      "/custom/root/dist/public/custom.txt",
      { force: true },
    );
  });

  it("works with default fs dependencies", async () => {
    const tmpDir = path.join(
      os.tmpdir(),
      `copy-resource-defaults-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const resourceDir = path.join(tmpDir, "resources");
    const distPublicDir = path.join(tmpDir, "dist", "public");
    await mkdir(resourceDir, { recursive: true });
    await mkdir(distPublicDir, { recursive: true });

    try {
      await writeFile(
        path.join(resourceDir, "robots.txt"),
        "User-agent: *",
        "utf8",
      );
      await copyResourceDirEntries([resourceDir], distPublicDir);
      const copied = await readFile(
        path.join(distPublicDir, "robots.txt"),
        "utf8",
      );
      expect(copied).toBe("User-agent: *");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
