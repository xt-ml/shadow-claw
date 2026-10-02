import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import {
  loadCliAttachments,
  normalizeFileOption,
} from "./load-cli-attachments.js";

describe("normalizeFileOption", () => {
  it("returns an empty list for undefined", () => {
    expect(normalizeFileOption(undefined)).toEqual([]);
  });

  it("wraps a single string", () => {
    expect(normalizeFileOption("a.png")).toEqual(["a.png"]);
  });

  it("keeps arrays and drops empty entries", () => {
    expect(normalizeFileOption(["a.png", "", "b.pdf"])).toEqual([
      "a.png",
      "b.pdf",
    ]);
  });
});

describe("loadCliAttachments", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "sc-attach-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("loads multiple files as local-file attachments", async () => {
    const a = path.join(dir, "a.png");
    const b = path.join(dir, "notes.pdf");
    await writeFile(a, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(b, Buffer.from("%PDF-1.4"));

    const result = await loadCliAttachments([a, b]);

    expect(result).toHaveLength(2);
    expect(result[0].fileName).toBe("a.png");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].size).toBe(4);
    expect(result[0].source?.kind).toBe("local-file");
    expect(result[1].fileName).toBe("notes.pdf");
    expect(result[1].mimeType).toBe("application/pdf");
  });

  it("throws a clear error for a missing file", async () => {
    await expect(
      loadCliAttachments([path.join(dir, "missing.png")]),
    ).rejects.toThrow(/missing\.png/);
  });
});
