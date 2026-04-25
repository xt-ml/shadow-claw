import { truncateToolOutput } from "./truncateToolOutput.js";

describe("truncateToolOutput", () => {
  it("returns short content unchanged", () => {
    expect(truncateToolOutput("short text", 1000)).toBe("short text");
  });

  it("returns empty string unchanged", () => {
    expect(truncateToolOutput("", 1000)).toBe("");
  });

  it("truncates content exceeding maxChars", () => {
    const long = "a".repeat(2000);
    const result = truncateToolOutput(long, 500);
    expect(result.length).toBeLessThanOrEqual(600); // maxChars + indicator overhead
    expect(result).toContain("[...truncated");
  });

  it("truncates at line boundary when possible", () => {
    const lines = Array.from(
      { length: 100 },
      (_, i) => `Line ${i + 1}: some content here`,
    );
    const content = lines.join("\n");
    const result = truncateToolOutput(content, 200);
    expect(result).toContain("[...truncated");
    // Should end at a line boundary before the indicator
    const beforeIndicator = result.split("\n[...truncated")[0];
    expect(beforeIndicator).not.toMatch(/Line \d+: some content h$/);
  });

  it("includes character count in truncation indicator", () => {
    const long = "x".repeat(5000);
    const result = truncateToolOutput(long, 500);
    expect(result).toMatch(/\[\.\.\.truncated \d+ chars\]/);
  });

  it("handles content exactly at limit", () => {
    const exact = "a".repeat(500);
    expect(truncateToolOutput(exact, 500)).toBe(exact);
  });

  it("handles content one char over limit", () => {
    const over = "a".repeat(501);
    const result = truncateToolOutput(over, 500);
    expect(result).toContain("[...truncated");
  });

  it("preserves the beginning of the content", () => {
    const content = "IMPORTANT START " + "x".repeat(2000);
    const result = truncateToolOutput(content, 200);
    expect(result).toMatch(/^IMPORTANT START/);
  });

  it("handles null/undefined gracefully", () => {
    expect(truncateToolOutput(null, 500)).toBe("");
    expect(truncateToolOutput(undefined, 500)).toBe("");
  });
});
