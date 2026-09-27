import { describe, expect, it } from "@jest/globals";
import { parseConflictRegions } from "./parseConflictRegions.js";

describe("parseConflictRegions", () => {
  it("parses single standard conflict region", () => {
    const content = [
      "before",
      "<<<<<<< HEAD",
      "our content line 1",
      "our content line 2",
      "=======",
      "their content",
      ">>>>>>> branch-feat",
      "after",
    ].join("\n");

    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      ours: "our content line 1\nour content line 2",
      oursLabel: "HEAD",
      startLine: 2,
      theirs: "their content",
      theirsLabel: "branch-feat",
    });
  });

  it("handles unclosed conflict regions that reach end-of-file without closing marker", () => {
    const content = [
      "<<<<<<< HEAD",
      "our changes",
      "=======",
      "their unclosed changes",
    ].join("\n");

    const regions = parseConflictRegions(content);
    expect(regions).toHaveLength(1);
    expect(regions[0].theirsLabel).toBe("");
    expect(regions[0].theirs).toBe("their unclosed changes");
  });

  it("returns empty array when no conflict markers are present", () => {
    const content = "regular file content\nwithout conflicts";
    expect(parseConflictRegions(content)).toEqual([]);
  });
});
