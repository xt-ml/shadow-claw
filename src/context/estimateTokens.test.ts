import {
  estimateTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
} from "./estimateTokens.js";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns 0 for null/undefined", () => {
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  it("estimates ~1 token per 4 English characters", () => {
    // 100 chars → ~25 tokens
    const text = "a".repeat(100);
    expect(estimateTokens(text)).toBe(25);
  });

  it("rounds up for partial tokens", () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokens("hello")).toBe(2);
  });

  it("handles short strings", () => {
    expect(estimateTokens("hi")).toBe(1);
    expect(estimateTokens("a")).toBe(1);
  });

  it("handles multi-line text", () => {
    const text = "line one\nline two\nline three";
    expect(estimateTokens(text)).toBe(Math.ceil(text.length / 4));
  });

  it("handles JSON content (typically larger token ratio)", () => {
    const json = JSON.stringify({ key: "value", num: 42, arr: [1, 2, 3] });
    expect(estimateTokens(json)).toBe(Math.ceil(json.length / 4));
  });
});

describe("estimateMessageTokens", () => {
  it("estimates tokens for a simple user message", () => {
    const msg: any = { role: "user" as const, content: "Hello world" };
    // "Hello world" = 11 chars → ceil(11/4) = 3  + 4 overhead

    expect(estimateMessageTokens(msg)).toBe(7);
  });

  it("estimates tokens for an assistant message", () => {
    const msg: any = {
      role: "assistant" as const,
      content: "I can help with that.",
    };
    // 21 chars → ceil(21/4) = 6  + 4 overhead

    expect(estimateMessageTokens(msg)).toBe(10);
  });

  it("handles message with array content (tool results)", () => {
    const msg: any = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "123",
          content: "file contents here",
        },
        { type: "tool_result", tool_use_id: "456", content: "more output" },
      ],
    };

    const result = estimateMessageTokens(msg);
    expect(result).toBeGreaterThan(0);
  });

  it("handles message with array content including tool_use", () => {
    const msg: any = {
      role: "assistant",
      content: [
        { type: "text", text: "Let me check that." },
        {
          type: "tool_use",
          id: "call_1",
          name: "read_file",
          input: { path: "/test.txt" },
        },
      ],
    };

    const result = estimateMessageTokens(msg);
    expect(result).toBeGreaterThan(0);
  });

  it("handles empty content", () => {
    expect(estimateMessageTokens({ role: "user" as const, content: "" })).toBe(
      4,
    );
  });
});

describe("estimateMessagesTokens", () => {
  it("returns 0 for empty array", () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it("sums tokens across messages", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there!" },
    ];

    const total = estimateMessagesTokens(messages);
    const individual =
      estimateMessageTokens(messages[0]) + estimateMessageTokens(messages[1]);
    expect(total).toBe(individual);
  });

  it("handles large message arrays", () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `Message number ${i} with some content`,
    }));

    const total = estimateMessagesTokens(messages);
    expect(total).toBeGreaterThan(100);
  });
});
