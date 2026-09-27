import { describe, expect, it } from "@jest/globals";
import { extractConflictPaths } from "./extractConflictPaths.js";

describe("extractConflictPaths", () => {
  it("extracts multiple file paths from conflict message", () => {
    const message =
      "Automatic merge failed; conflicts in the following files: fileA.ts, fileB.ts, fileC.ts";
    expect(extractConflictPaths(message)).toEqual([
      "fileA.ts",
      "fileB.ts",
      "fileC.ts",
    ]);
  });

  it("extracts single file path from singular conflict message", () => {
    const message = "conflict in the following file: readme.md";
    expect(extractConflictPaths(message)).toEqual(["readme.md"]);
  });

  it("returns empty array when message does not match conflict format", () => {
    const message = "Merge successful with fast-forward";
    expect(extractConflictPaths(message)).toEqual([]);
  });
});
