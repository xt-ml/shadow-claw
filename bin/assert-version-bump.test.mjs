import { describe, it, expect } from "@jest/globals";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "assert-version-bump.mjs");

describe("assert-version-bump", () => {
  it("runs successfully when local version is greater than published version", async () => {
    const { stdout } = await execFileAsync(process.execPath, [scriptPath]);
    expect(stdout).toContain("Checking version bump for package");
  });
});
