import { getCompactionSystemPrompt } from "./getCompactionSystemPrompt.mjs";

describe("getCompactionSystemPrompt", () => {
  it("includes the original prompt and compaction instructions", () => {
    const result = getCompactionSystemPrompt("base prompt");

    expect(result).toContain("base prompt");
    expect(result).toContain("## COMPACTION TASK");
    expect(result).toContain("token limits");
  });
});
