import { buildDynamicContext } from "./buildDynamicContext.js";

describe("buildDynamicContext", () => {
  const makeMsg = (role, content) => ({ role, content });

  it("returns all messages when they fit within budget", () => {
    const messages = [
      makeMsg("user", "Hello"),
      makeMsg("assistant", "Hi!"),
      makeMsg("user", "How are you?"),
    ];
    const result = buildDynamicContext(messages, {
      contextLimit: 200000,
      systemPromptTokens: 500,
      maxOutputTokens: 8192,
    });
    expect(result.messages).toHaveLength(3);
    expect(result.messages).toEqual(messages);
    expect(result.estimatedTokens).toBeGreaterThan(0);
    expect(result.truncatedCount).toBe(0);
  });

  it("drops oldest messages when exceeding budget", () => {
    // Each message is ~200 chars → ~50 tokens + 4 overhead = ~54 tokens
    const messages = Array.from({ length: 50 }, (_, i) =>
      makeMsg(i % 2 === 0 ? "user" : "assistant", "x".repeat(200)),
    );

    const result = buildDynamicContext(messages, {
      contextLimit: 500, // very small limit
      systemPromptTokens: 100,
      maxOutputTokens: 100,
    });

    // Should keep only messages that fit in 500 - 100 - 100 = 300 budget
    expect(result.messages.length).toBeLessThan(50);
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.truncatedCount).toBe(50 - result.messages.length);
    // Should keep the MOST RECENT messages
    expect(result.messages[result.messages.length - 1]).toEqual(
      messages[messages.length - 1],
    );
  });

  it("always keeps at least the most recent message", () => {
    const messages = [
      makeMsg("user", "x".repeat(100000)), // huge message
    ];
    const result = buildDynamicContext(messages, {
      contextLimit: 100, // tiny limit
      systemPromptTokens: 50,
      maxOutputTokens: 50,
    });
    expect(result.messages).toHaveLength(1);
  });

  it("truncates large tool outputs in kept messages", () => {
    const messages = [
      makeMsg("user", "read this file"),
      makeMsg("assistant", [
        { type: "text", text: "Reading the file." },
        {
          type: "tool_use",
          id: "t1",
          name: "read_file",
          input: { path: "big.txt" },
        },
      ]),
      makeMsg("user", [
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: "A".repeat(200000), // huge tool output
        },
      ]),
      makeMsg("assistant", "Here is the summary."),
    ];

    const result = buildDynamicContext(messages, {
      contextLimit: 10000,
      systemPromptTokens: 500,
      maxOutputTokens: 4096,
    });

    // The tool result should be truncated
    const toolResultMsg = result.messages.find(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((b) => b.type === "tool_result"),
    );
    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
      const toolResult = toolResultMsg.content.find(
        (b) => b.type === "tool_result",
      );

      expect(toolResult!.content.length).toBeLessThan(200000);

      expect(toolResult!.content).toContain("[...truncated");
    }
  });

  it("returns correct context usage info", () => {
    const messages = [makeMsg("user", "Hello"), makeMsg("assistant", "Hi!")];
    const result = buildDynamicContext(messages, {
      contextLimit: 200000,
      systemPromptTokens: 500,
      maxOutputTokens: 8192,
    });

    expect(result.contextLimit).toBe(200000);
    expect(result.estimatedTokens).toBeGreaterThan(0);
    expect(result.estimatedTokens).toBeLessThan(200000);
    expect(typeof result.usagePercent).toBe("number");
    expect(result.usagePercent).toBeGreaterThan(0);
    expect(result.usagePercent).toBeLessThan(100);
  });

  it("handles empty messages array", () => {
    const result = buildDynamicContext([], {
      contextLimit: 200000,
      systemPromptTokens: 500,
      maxOutputTokens: 8192,
    });
    expect(result.messages).toHaveLength(0);
    expect(result.estimatedTokens).toBe(0);
    expect(result.truncatedCount).toBe(0);
  });

  it("reports high usage percent with tight budget", () => {
    const messages = [makeMsg("user", "x".repeat(4000))];
    const result = buildDynamicContext(messages, {
      contextLimit: 2000,
      systemPromptTokens: 100,
      maxOutputTokens: 100,
    });
    // The message alone is ~1000 tokens, budget is 1800 → ~55%
    expect(result.usagePercent).toBeGreaterThan(40);
  });
});
