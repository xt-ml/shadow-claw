import { jest } from "@jest/globals";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { findFirstExistingPath } from "./find-first-existing-path.mjs";

describe("findFirstExistingPath", () => {
  it("returns first candidate that exists", async () => {
    const statImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({});

    const found = await findFirstExistingPath(["a", "b", "c"], { statImpl });
    expect(found).toBe("b");
  });

  it("returns null when none exists", async () => {
    const statImpl = jest.fn().mockRejectedValue(new Error("missing"));
    const found = await findFirstExistingPath(["a", "b"], { statImpl });
    expect(found).toBeNull();
  });

  it("works with default stat dependency", async () => {
    const tmpDir = path.join(
      os.tmpdir(),
      `find-first-existing-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    const existing = path.join(tmpDir, "exists.txt");
    await mkdir(tmpDir, { recursive: true });
    try {
      await writeFile(existing, "ok", "utf8");
      const found = await findFirstExistingPath([
        path.join(tmpDir, "missing.txt"),
        existing,
      ]);
      expect(found).toBe(existing);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
