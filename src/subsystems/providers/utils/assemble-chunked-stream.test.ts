import { jest } from "@jest/globals";
import { assembleChunkedStream } from "./assemble-chunked-stream.js";
import { DEFAULT_MODEL_CACHE_NAME, type ModelPartialMeta } from "./types.js";

function makeBodyStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

describe("assembleChunkedStream", () => {
  let mockMatch: jest.Mock<any>;
  let mockOpen: jest.Mock<any>;

  beforeEach(() => {
    mockMatch = jest.fn<any>();
    mockOpen = jest.fn<any>().mockResolvedValue({
      match: mockMatch,
    });
    (globalThis as any).caches = {
      open: mockOpen,
    };
  });

  afterEach(() => {
    delete (globalThis as any).caches;
  });

  it("lazily reads and yields chunks in sequence without assembling a large blob", async () => {
    const chunk0 = new Uint8Array([1, 2, 3]);
    const chunk1 = new Uint8Array([4, 5]);
    const chunk2 = new Uint8Array([6, 7, 8, 9]);

    mockMatch.mockImplementation((key: string) => {
      if (key.endsWith("__sc_chunk=0")) {
        return Promise.resolve({ body: makeBodyStream(chunk0) });
      }
      if (key.endsWith("__sc_chunk=1")) {
        return Promise.resolve({ body: makeBodyStream(chunk1) });
      }
      if (key.endsWith("__sc_chunk=2")) {
        return Promise.resolve({ body: makeBodyStream(chunk2) });
      }
      return Promise.resolve(undefined);
    });

    const meta: ModelPartialMeta = {
      chunks: 3,
      received: 9,
      total: 9,
      acceptsRanges: true,
      complete: true,
    };

    const stream = assembleChunkedStream(
      "https://example.com/model.bin",
      meta,
      "custom-cache",
    );
    const reader = stream.getReader();
    const collected: number[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      collected.push(...value);
    }

    expect(mockOpen).toHaveBeenCalledWith("custom-cache");
    expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("uses default cache name when not specified", async () => {
    const chunk0 = new Uint8Array([42]);
    mockMatch.mockResolvedValue({ body: makeBodyStream(chunk0) });

    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 1,
      total: 1,
      acceptsRanges: false,
      complete: true,
    };

    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    const { value } = await reader.read();
    expect(value).toEqual(new Uint8Array([42]));
    expect(mockOpen).toHaveBeenCalledWith(DEFAULT_MODEL_CACHE_NAME);
  });

  it("errors stream if a chunk is missing in cache", async () => {
    mockMatch.mockResolvedValue(undefined);

    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 100,
      total: 100,
      acceptsRanges: true,
      complete: true,
    };

    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();

    await expect(reader.read()).rejects.toThrow("missing cache chunk 0");
  });

  it("supports cancelling the stream during read", async () => {
    const chunk0 = new Uint8Array([1, 2, 3]);
    mockMatch.mockResolvedValue({ body: makeBodyStream(chunk0) });

    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 6,
      total: 6,
      acceptsRanges: true,
      complete: true,
    };

    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    await reader.read();
    await expect(reader.cancel()).resolves.toBeUndefined();
  });

  it("drains multiple frames from the same chunk reader", async () => {
    const multiFrameStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1]));
        c.enqueue(new Uint8Array([2]));
        c.close();
      },
    });
    mockMatch.mockResolvedValueOnce({ body: multiFrameStream });
    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 2,
      total: 2,
      acceptsRanges: true,
      complete: true,
    };
    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    const f1 = await reader.read();
    const f2 = await reader.read();
    const f3 = await reader.read();
    expect(f1.value).toEqual(new Uint8Array([1]));
    expect(f2.value).toEqual(new Uint8Array([2]));
    expect(f3.done).toBe(true);
  });

  it("handles empty chunk and continues to next chunk", async () => {
    const emptyStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.close();
      },
    });
    const normalStream = makeBodyStream(new Uint8Array([99]));
    mockMatch
      .mockResolvedValueOnce({ body: emptyStream })
      .mockResolvedValueOnce({ body: normalStream });

    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 99,
      total: 99,
      acceptsRanges: true,
      complete: true,
    };
    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    const first = await reader.read();
    expect(first.value).toEqual(new Uint8Array([99]));
  });

  it("errors stream when cache operation throws", async () => {
    mockOpen.mockRejectedValueOnce(new Error("Storage corrupted"));
    const meta: ModelPartialMeta = {
      chunks: 1,
      received: 1,
      total: 1,
      acceptsRanges: true,
      complete: true,
    };
    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    await expect(reader.read()).rejects.toThrow("Storage corrupted");
  });

  it("cancels currentReader when stream is cancelled while reading chunk", async () => {
    let cancelCalled = false;
    const cancellableStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2]));
      },
      cancel() {
        cancelCalled = true;
      },
    });
    mockMatch.mockResolvedValueOnce({ body: cancellableStream });
    const meta: ModelPartialMeta = {
      chunks: 2,
      received: 4,
      total: 4,
      acceptsRanges: true,
      complete: true,
    };
    const stream = assembleChunkedStream("https://example.com/model.bin", meta);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    expect(cancelCalled).toBe(true);
  });
});
