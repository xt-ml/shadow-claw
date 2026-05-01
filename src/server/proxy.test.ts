import { jest } from "@jest/globals";

describe("Transformers.js proxy runtime safety", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS = "25";
  });

  afterEach(async () => {
    try {
      const mod = await import("./proxy.js");
      await mod.__resetTransformersJsRuntimeForTests();
    } catch {
      // Ignore cleanup errors when the module never loaded.
    }

    delete process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS;
    jest.useRealTimers();
  });

  it("times out stalled local generation and evicts the runtime", async () => {
    const mod = await import("./proxy.js");

    const disposeModel = (jest.fn() as any).mockResolvedValue(undefined);
    const disposeProcessor = (jest.fn() as any).mockResolvedValue(undefined);

    const processor: any = Object.assign(
      jest.fn(async () => ({
        input_ids: {
          dims: [1, 4],
        },
      })),
      {
        apply_chat_template: jest.fn(() => "user: What is the weather?"),
        tokenizer: {},
        batch_decode: jest.fn(() => ["decoded fallback"]),
        dispose: disposeProcessor,
      },
    );

    const generate = jest.fn(({ signal }: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    });

    class MockTextStreamer {
      constructor(_tokenizer: unknown, _opts: unknown) {}
    }

    mod.__setTransformersJsRuntimeForTests("test-model", {
      processor,
      model: {
        generate,
        dispose: disposeModel,
      },
      TextStreamer: MockTextStreamer,
      modelLoaderName: "mock-loader",
    });

    const pending = mod.runTransformersJsChatCompletion({
      modelId: "test-model",
      messages: [{ role: "user", content: "What is the weather?" }],
      maxCompletionTokens: 32,
      verbose: false,
    });

    const timeoutExpectation = expect(pending).rejects.toThrow(
      "Transformers.js generation timed out after 25ms for model 'test-model'.",
    );

    await jest.advanceTimersByTimeAsync(30);

    await timeoutExpectation;

    expect(generate).toHaveBeenCalledTimes(1);
    expect(disposeModel).toHaveBeenCalledTimes(1);
    expect(disposeProcessor).toHaveBeenCalledTimes(1);
  });

  it("writes an SSE error instead of json after streaming headers were sent", async () => {
    const mod = await import("./proxy.js");

    const res = {
      headersSent: true,
      writableEnded: false,
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;

    mod.sendStreamingProxyError(res, {
      status: 500,
      publicMessage: "Transformers.js invocation failed: network error",
      streamMessage: "network error",
    });

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(
      expect.stringContaining('"message":"network error"'),
    );
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
