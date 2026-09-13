/**
 * Tests for bin/utils/stdin.mjs
 */

import { describe, it, expect } from "@jest/globals";
import { Readable } from "node:stream";

/**
 * Create a mock Readable stream that emits given chunks then ends.
 * @param {{ isTTY?: boolean, chunks?: string[], error?: Error }} opts
 */
function makeStream({ isTTY = false, chunks = [], error } = {}) {
  let called = false;
  const stream = new Readable({
    read() {
      if (called) return;
      called = true;
      if (error) {
        process.nextTick(() => this.destroy(error));
        return;
      }
      for (const chunk of chunks) {
        this.push(chunk);
      }
      this.push(null);
    },
  });
  stream.isTTY = isTTY;
  return stream;
}

describe("readStdin", () => {
  it("returns null when isTTY is true and force is not set", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({ isTTY: true, chunks: ["some text"] });
    const result = await readStdin({ stdin });
    expect(result).toBeNull();
  });

  it("reads content from stream when isTTY is false", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({
      isTTY: false,
      chunks: ["piped text content\n"],
    });
    const result = await readStdin({ stdin });
    expect(result).toBe("piped text content");
  });

  it("reads content from TTY stream when force=true", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({
      isTTY: true,
      chunks: ["forced stream content"],
    });
    const result = await readStdin({ stdin, force: true });
    expect(result).toBe("forced stream content");
  });

  it("returns null when stream ends with no data", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({ isTTY: false, chunks: [] });
    const result = await readStdin({ stdin });
    expect(result).toBeNull();
  });

  it("returns null when stream contains only whitespace", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({ isTTY: false, chunks: ["   \n\t\n  "] });
    const result = await readStdin({ stdin });
    expect(result).toBeNull();
  });

  it("concatenates multiple data chunks", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({
      isTTY: false,
      chunks: ["line1\n", "line2\n", "line3"],
    });
    const result = await readStdin({ stdin });
    expect(result).toBe("line1\nline2\nline3");
  });

  it("trims leading and trailing whitespace from piped data", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({ isTTY: false, chunks: ["\n  hello world  \n"] });
    const result = await readStdin({ stdin });
    expect(result).toBe("hello world");
  });

  it("rejects when stream emits an error", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const stdin = makeStream({ isTTY: false, error: new Error("stdin error") });
    await expect(readStdin({ stdin })).rejects.toThrow("stdin error");
  });

  it("reads JSON content from stdin intact", async () => {
    const { readStdin } = await import("./stdin.mjs");
    const json = JSON.stringify({ text: "hello", tone: "happy" });
    const stdin = makeStream({ isTTY: false, chunks: [json] });
    const result = await readStdin({ stdin });
    expect(result).toBe(json);
    expect(JSON.parse(result)).toEqual({ text: "hello", tone: "happy" });
  });
});

describe("mapTextToToolInput", () => {
  it("maps to `text` when schema has text property", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { text: { type: "string" }, tone: { type: "string" } },
    };
    expect(mapTextToToolInput("hello", schema)).toEqual({ text: "hello" });
  });

  it("maps to `prompt` when schema has prompt but not text", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { prompt: { type: "string" }, language: { type: "string" } },
    };
    expect(mapTextToToolInput("say something", schema)).toEqual({
      prompt: "say something",
    });
  });

  it("maps to `content` when schema has content but not text/prompt", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { content: { type: "string" }, format: { type: "string" } },
    };
    expect(mapTextToToolInput("some content", schema)).toEqual({
      content: "some content",
    });
  });

  it("falls back to `input` when no priority fields match", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { url: { type: "string" }, method: { type: "string" } },
    };
    expect(mapTextToToolInput("http://example.com", schema)).toEqual({
      input: "http://example.com",
    });
  });

  it("falls back to `input` when schema is undefined", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    expect(mapTextToToolInput("hello", undefined)).toEqual({ input: "hello" });
  });

  it("falls back to `input` when schema has no properties field", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    expect(mapTextToToolInput("hello", { type: "object" })).toEqual({
      input: "hello",
    });
  });

  it("prefers `text` over `prompt` when both are present", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { prompt: { type: "string" }, text: { type: "string" } },
    };
    expect(mapTextToToolInput("priority test", schema)).toEqual({
      text: "priority test",
    });
  });

  it("prefers `prompt` over `content` when both are present", async () => {
    const { mapTextToToolInput } = await import("./stdin.mjs");
    const schema = {
      properties: { content: { type: "string" }, prompt: { type: "string" } },
    };
    expect(mapTextToToolInput("priority test", schema)).toEqual({
      prompt: "priority test",
    });
  });
});
