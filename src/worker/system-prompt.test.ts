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

  it("includes spawn_subagent strategy line when the tool is enabled", () => {
    const prompt = buildSystemPrompt(
      "TestBot",
      "",
      [
        {
          name: "spawn_subagent",
          description: "Spawn subagents",
          input_schema: { type: "object", properties: {} },
        },
      ],
      undefined,
    );
    expect(prompt).toContain("spawn_subagent");
    expect(prompt).toContain("parallel");
  });

  it("does not include spawn_subagent strategy when the tool is absent", () => {
    const prompt = buildSystemPrompt(
      "TestBot",
      "",
      [
        {
          name: "read_file",
          description: "Read files.",
          input_schema: { type: "object", properties: {} },
        },
      ],
      undefined,
    );
    // Strategy guidance for spawn_subagent should not appear
    expect(prompt).not.toContain("parallel, independent workstreams");
  });
});
