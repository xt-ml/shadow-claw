import { buildSystemPrompt } from "./system-prompt.js";

describe("buildSystemPrompt", () => {
  it("includes shared state when provided", () => {
    const prompt = buildSystemPrompt(
      "TestBot",
      "Memory here",
      [],
      "Override here",
      { activeUsers: 3, flag: true },
    );
    expect(prompt).toContain("## Shared Session State (Ground Truth)");
    expect(prompt).toContain('"activeUsers": 3');
    expect(prompt).toContain('"flag": true');
  });

  it("omits shared state section if empty", () => {
    const prompt = buildSystemPrompt(
      "TestBot",
      "Memory here",
      [],
      "Override here",
      {},
    );
    expect(prompt).not.toContain("## Shared Session State (Ground Truth)");
  });

  it("omits shared state section if undefined", () => {
    const prompt = buildSystemPrompt(
      "TestBot",
      "Memory here",
      [],
      "Override here",
    );
    expect(prompt).not.toContain("## Shared Session State (Ground Truth)");
  });
});
