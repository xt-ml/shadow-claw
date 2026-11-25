import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

const SRC_ROOT = path.resolve(process.cwd(), "src");
const HOST_DIR = path.join(
  SRC_ROOT,
  "components",
  "shadow-claw-file-viewer",
  "monaco",
  "host",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|js|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }

  return out;
}

describe("monaco lazy-load guard", () => {
  it("only the monaco host entry may reference monaco-editor", () => {
    const offenders = walk(SRC_ROOT)
      .filter((file) => !file.startsWith(HOST_DIR + path.sep))
      .filter((file) => !/\.test\.(ts|js)$/.test(file))
      .filter((file) =>
        /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["']monaco-editor/.test(
          fs.readFileSync(file, "utf8"),
        ),
      )
      .map((file) => path.relative(SRC_ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("the host directory exists and is the sanctioned monaco entry", () => {
    expect(fs.existsSync(HOST_DIR)).toBe(true);
  });
});
