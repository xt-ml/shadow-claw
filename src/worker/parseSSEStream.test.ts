import { jest } from "@jest/globals";
import { TextEncoder, TextDecoder } from "node:util";

// jsdom doesn't expose TextDecoder globally — polyfill before importing the
// module under test so its `new TextDecoder()` call succeeds.
globalThis.TextDecoder ??= TextDecoder;

import { parseSSEStream } from "./parseSSEStream.js";

/**
 * Helper: create a ReadableStream from an array of string chunks.
 */
function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;

  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe("parseSSEStream", () => {
  it("parses simple data lines", async () => {
    const stream = createStream([
      'data: {"text":"hello"}\n\ndata: {"text":"world"}\n\n',
    ]);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }

    expect(results).toEqual([{ text: "hello" }, { text: "world" }]);
  });

  it("skips [DONE] sentinel", async () => {
    const stream = createStream(['data: {"v":1}\n\ndata: [DONE]\n\n']);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }

    expect(results).toEqual([{ v: 1 }]);
  });

  it("skips comment lines", async () => {
    const stream = createStream([': this is a comment\ndata: {"ok":true}\n\n']);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }

    expect(results).toEqual([{ ok: true }]);
  });

  it("handles chunks split across boundaries", async () => {
    const stream = createStream([
      'data: {"part',
      '":"one"}\n\ndata: {"part":"two"}\n\n',
    ]);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }

    expect(results).toEqual([{ part: "one" }, { part: "two" }]);
  });

  it("skips malformed JSON", async () => {
    const stream = createStream(['data: not json\n\ndata: {"ok":true}\n\n']);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }

    expect(results).toEqual([{ ok: true }]);
  });

  it("respects AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const stream = createStream(['data: {"v":1}\n\n']);

    const results: any = [];
    for await (const chunk of parseSSEStream(stream, controller.signal)) {
      results.push(chunk);
    }

    expect(results).toEqual([]);
  });
});
