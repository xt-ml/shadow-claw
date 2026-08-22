import { jest } from "@jest/globals";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { copyWithFallback } from "./copy-with-fallback.mjs";

describe("copyWithFallback", () => {
  it("copies first existing candidate", async () => {
    const statImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({});
    const cpImpl = jest.fn().mockResolvedValue(undefined);

    const copied = await copyWithFallback(
      ["missing.txt", "exists.txt"],
      "dist/public/file.txt",
      {},
      { statImpl, cpImpl },
    );

    expect(copied).toBe(true);
    expect(cpImpl).toHaveBeenCalledWith(
      "exists.txt",
      "dist/public/file.txt",
      {},
    );
  });

  it("accepts a single source string", async () => {
    const statImpl = jest.fn().mockResolvedValue({});
    const cpImpl = jest.fn().mockResolvedValue(undefined);

    const copied = await copyWithFallback(
      "one.txt",
      "dist/public/one.txt",
      {},
      {
        statImpl,
        cpImpl,
      },
    );

    expect(copied).toBe(true);
    expect(statImpl).toHaveBeenCalledWith("one.txt");
  });

  it("keeps trying candidates when copy fails", async () => {
    const statImpl = jest.fn().mockResolvedValue({});
    const cpImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error("copy failed"))
      .mockResolvedValueOnce(undefined);

    const copied = await copyWithFallback(
      ["first.txt", "second.txt"],
      "dist/public/file.txt",
      { force: true },
      { statImpl, cpImpl },
    );

    expect(copied).toBe(true);
    expect(cpImpl).toHaveBeenNthCalledWith(
      1,
      "first.txt",
      "dist/public/file.txt",
      { force: true },
    );
    expect(cpImpl).toHaveBeenNthCalledWith(
      2,
      "second.txt",
      "dist/public/file.txt",
      { force: true },
    );
  });

  it("returns false when no candidate exists", async () => {
    const statImpl = jest.fn().mockRejectedValue(new Error("missing"));
    const cpImpl = jest.fn();

    const copied = await copyWithFallback(
      ["missing-a", "missing-b"],
      "dist/public/file.txt",
      {},
      { statImpl, cpImpl },
    );

    expect(copied).toBe(false);
    expect(cpImpl).not.toHaveBeenCalled();
  });

  it("works with default filesystem dependencies", async () => {
    const tmpDir = path.join(
      os.tmpdir(),
      `copy-with-fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const srcPath = path.join(tmpDir, "in.txt");
    const destPath = path.join(tmpDir, "out.txt");

    await mkdir(tmpDir, { recursive: true });
    try {
      await writeFile(srcPath, "ok", "utf8");
      const copied = await copyWithFallback(srcPath, destPath);
      expect(copied).toBe(true);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
