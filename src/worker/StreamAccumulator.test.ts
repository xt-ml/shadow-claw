import { describe, it, expect, jest } from "@jest/globals";
import { StreamAccumulator } from "./StreamAccumulator.js";

// ── OpenAI format ──────────────────────────────────────────────────

describe("StreamAccumulator — OpenAI format", () => {
  it("accumulates text deltas into a single text block", () => {
    const acc = new StreamAccumulator("openai");

    acc.push({ choices: [{ delta: { content: "Hello" } }] });
    acc.push({ choices: [{ delta: { content: " world" } }] });
    acc.push({ choices: [{ delta: {} }, { finish_reason: "stop" }] });

    const result = acc.finalize();
    expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
    expect(result.stop_reason).toBe("end_turn");
  });

  it("accumulates tool_calls across multiple deltas", () => {
    const acc = new StreamAccumulator("openai");

    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_abc",
                function: { name: "read_file", arguments: '{"pa' },
              },
            ],
          },
        },
      ],
    });

    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, function: { arguments: 'th":"f.txt"}' } }],
          },
        },
      ],
    });

    acc.push({
      choices: [{ finish_reason: "tool_calls" }],
    });

    const result = acc.finalize();
    expect(result.stop_reason).toBe("tool_use");
    expect(result.content).toEqual([
      {
        type: "tool_use",
        id: "call_abc",
        name: "read_file",
        input: { path: "f.txt" },
      },
    ]);
  });

  it("handles text + tool_calls in the same response", () => {
    const acc = new StreamAccumulator("openai");

    acc.push({ choices: [{ delta: { content: "Thinking..." } }] });
    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_1",
                function: { name: "bash", arguments: '{"command":"ls"}' },
              },
            ],
          },
        },
      ],
    });
    acc.push({ choices: [{ finish_reason: "tool_calls" }] });

    const result = acc.finalize();
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Thinking...",
    });
    expect(result.content[1]).toMatchObject({
      type: "tool_use",
      name: "bash",
      input: { command: "ls" },
    });
    expect(result.stop_reason).toBe("tool_use");
  });

  it("captures usage from the final chunk", () => {
    const onUsage = jest.fn();
    const acc = new StreamAccumulator("openai", { onUsage });

    acc.push({ choices: [{ delta: { content: "hi" } }] });
    acc.push({
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const result = acc.finalize();
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    expect(onUsage).toHaveBeenCalledWith({
      input_tokens: 10,
      output_tokens: 5,
    });
  });

  it("fires onText callback for each delta", () => {
    const onText = jest.fn();
    const acc = new StreamAccumulator("openai", { onText });

    acc.push({ choices: [{ delta: { content: "A" } }] });
    acc.push({ choices: [{ delta: { content: "B" } }] });

    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenCalledWith("A");
    expect(onText).toHaveBeenCalledWith("B");
  });

  it("fires onToolStart when a tool call begins", () => {
    const onToolStart = jest.fn();
    const acc = new StreamAccumulator("openai", { onToolStart });

    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_x",
                function: { name: "fetch_url", arguments: "" },
              },
            ],
          },
        },
      ],
    });

    expect(onToolStart).toHaveBeenCalledWith("fetch_url");
  });

  it("handles empty choices gracefully", () => {
    const acc = new StreamAccumulator("openai");

    acc.push({} as any);
    acc.push({ choices: [] });
    acc.push({ choices: [{}] });

    const result = acc.finalize();
    expect(result.content).toEqual([]);
  });

  it("falls back when tool_call arguments are malformed JSON", () => {
    const acc = new StreamAccumulator("openai");

    acc.push({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call_bad",
                function: { name: "test", arguments: "{bad json" },
              },
            ],
          },
        },
      ],
    });

    const result = acc.finalize();
    expect(result.content[0].input).toEqual({} as any);
  });
});

// ── Anthropic format ───────────────────────────────────────────────

describe("StreamAccumulator — Anthropic format", () => {
  it("accumulates text from content_block_delta events", () => {
    const acc = new StreamAccumulator("anthropic");

    acc.push({
      type: "message_start",
      message: { usage: { input_tokens: 15 } },
    });
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello" },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: " world" },
    });
    acc.push({ type: "content_block_stop", index: 0 });
    acc.push({
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 8 },
    });
    acc.push({ type: "message_stop" });

    const result = acc.finalize();
    expect(result.content).toEqual([{ type: "text", text: "Hello world" }]);
    expect(result.stop_reason).toBe("end_turn");
    expect(result.usage).toEqual({ input_tokens: 15, output_tokens: 8 });
  });

  it("accumulates tool_use blocks with streamed JSON input", () => {
    const acc = new StreamAccumulator("anthropic");

    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "toolu_123",
        name: "read_file",
      },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '{"path":' },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: '"hello.txt"}' },
    });
    acc.push({ type: "content_block_stop", index: 0 });
    acc.push({
      type: "message_delta",
      delta: { stop_reason: "tool_use" },
      usage: { output_tokens: 20 },
    });

    const result = acc.finalize();
    expect(result.content).toEqual([
      {
        type: "tool_use",
        id: "toolu_123",
        name: "read_file",
        input: { path: "hello.txt" },
      },
    ]);
    expect(result.stop_reason).toBe("tool_use");
  });

  it("handles text + tool_use mixed content", () => {
    const acc = new StreamAccumulator("anthropic");

    // Block 0: text
    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Let me check." },
    });
    acc.push({ type: "content_block_stop", index: 0 });

    // Block 1: tool_use
    acc.push({
      type: "content_block_start",
      index: 1,
      content_block: {
        type: "tool_use",
        id: "toolu_456",
        name: "bash",
      },
    });
    acc.push({
      type: "content_block_delta",
      index: 1,
      delta: {
        type: "input_json_delta",
        partial_json: '{"command":"pwd"}',
      },
    });
    acc.push({ type: "content_block_stop", index: 1 });

    acc.push({
      type: "message_delta",
      delta: { stop_reason: "tool_use" },
      usage: { output_tokens: 30 },
    });

    const result = acc.finalize();
    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Let me check.",
    });
    expect(result.content[1]).toMatchObject({
      type: "tool_use",
      id: "toolu_456",
      name: "bash",
      input: { command: "pwd" },
    });
  });

  it("fires onText callback for text_delta events", () => {
    const onText = jest.fn();
    const acc = new StreamAccumulator("anthropic", { onText });

    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: { type: "text", text: "" },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hi" },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "!" },
    });

    expect(onText).toHaveBeenCalledTimes(2);
    expect(onText).toHaveBeenCalledWith("Hi");
    expect(onText).toHaveBeenCalledWith("!");
  });

  it("fires onToolStart when a tool_use block starts", () => {
    const onToolStart = jest.fn();
    const acc = new StreamAccumulator("anthropic", { onToolStart });

    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "toolu_abc",
        name: "javascript",
      },
    });

    expect(onToolStart).toHaveBeenCalledWith("javascript");
  });

  it("fires onUsage when message_delta includes usage", () => {
    const onUsage = jest.fn();
    const acc = new StreamAccumulator("anthropic", { onUsage });

    acc.push({
      type: "message_start",
      message: { usage: { input_tokens: 42 } },
    });
    acc.push({
      type: "message_delta",
      delta: { stop_reason: "end_turn" },
      usage: { output_tokens: 7 },
    });

    expect(onUsage).toHaveBeenCalledWith({
      input_tokens: 42,
      output_tokens: 7,
    });

    const result = acc.finalize();
    expect(result.usage).toEqual({ input_tokens: 42, output_tokens: 7 });
  });

  it("falls back when tool_use partial_json is malformed", () => {
    const acc = new StreamAccumulator("anthropic");

    acc.push({
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: "toolu_bad",
        name: "test",
      },
    });
    acc.push({
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: "{broken" },
    });
    acc.push({ type: "content_block_stop", index: 0 });

    const result = acc.finalize();
    expect(result.content[0].input).toEqual({} as any);
  });

  it("ignores unknown event types gracefully", () => {
    const acc = new StreamAccumulator("anthropic");

    acc.push({ type: "ping" });
    acc.push({ type: "unknown_event", data: "whatever" });

    const result = acc.finalize();
    expect(result.content).toEqual([]);
  });
});
