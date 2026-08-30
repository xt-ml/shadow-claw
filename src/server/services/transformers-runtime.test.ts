/** @jest-environment node */
import { jest } from "@jest/globals";

describe("TransformersRuntimeService", () => {
  let mkdirMock: any;
  let readFileMock: any;
  let writeFileMock: any;
  let statMock: any;
  let unlinkMock: any;
  let readdirMock: any;

  let processorMock: any;
  let modelMock: any;
  let transformersMock: any;

  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers();

    mkdirMock = jest.fn().mockResolvedValue(undefined as never);
    readFileMock = jest.fn();
    writeFileMock = jest.fn().mockResolvedValue(undefined as never);
    statMock = jest.fn();
    unlinkMock = jest.fn().mockResolvedValue(undefined as never);
    readdirMock = jest
      .fn()
      .mockResolvedValue(["model1.onnx", "model2.onnx"] as never);

    processorMock = Object.assign(
      jest.fn().mockImplementation(() => ({
        input_ids: { dims: [1, 5] },
      })),
      {
        apply_chat_template: jest.fn(() => "prompt"),
        tokenizer: {
          apply_chat_template: jest.fn(() => "prompt"),
        },
        batch_decode: jest.fn(() => ["Generated response"]),
        dispose: jest.fn(),
      },
    );

    modelMock = {
      generate: jest.fn(async ({ streamer }: any) => {
        streamer?.callback_function?.("Hello");

        return {
          slice: jest.fn(() => [1, 2, 3]),
        };
      }),
      dispose: jest.fn(),
    };

    transformersMock = {
      env: {},
      AutoProcessor: {
        from_pretrained: jest.fn(async () => processorMock),
      },
      Gemma4Processor: {
        from_pretrained: jest.fn(async () => processorMock),
      },
      Gemma4ForConditionalGeneration: {
        from_pretrained: jest.fn(async () => modelMock),
      },
      AutoModelForCausalLM: {
        from_pretrained: jest.fn(async () => modelMock),
      },
      AutoModelForImageTextToText: {
        from_pretrained: jest.fn(async () => modelMock),
      },
      TextStreamer: class {
        callback_function: any;
        constructor(_tokenizer: any, opts: any) {
          this.callback_function = opts?.callback_function;
        }
      },
    };

    jest.unstable_mockModule("node:fs/promises", () => ({
      mkdir: mkdirMock,
      readFile: readFileMock,
      writeFile: writeFileMock,
      stat: statMock,
      unlink: unlinkMock,
      readdir: readdirMock,
    }));

    jest.unstable_mockModule(
      "@huggingface/transformers",
      () => transformersMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function getService() {
    const mod = await import("./transformers-runtime.js");

    return mod.createTransformersRuntimeService();
  }

  describe("runChatCompletion", () => {
    it("loads Gemma 4 model and generates text", async () => {
      const service = await getService();
      const onToken = jest.fn();

      const promise = service.runChatCompletion({
        modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
        onToken,
      });

      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.text).toBe("Hello");
      expect(onToken).toHaveBeenCalledWith("Hello");
      expect(
        transformersMock.Gemma4ForConditionalGeneration.from_pretrained,
      ).toHaveBeenCalled();
    });

    it("loads standard non-Gemma model (Qwen 3)", async () => {
      const service = await getService();
      const onToken = jest.fn();

      const promise = service.runChatCompletion({
        modelId: "onnx-community/Qwen3-0.6B-ONNX",
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
        onToken,
      });

      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.text).toBe("Hello");
      expect(
        transformersMock.AutoModelForImageTextToText.from_pretrained,
      ).toHaveBeenCalled();
    });

    it("throws error for unsupported model ID", async () => {
      const service = await getService();

      await expect(
        service.runChatCompletion({
          modelId: "unsupported/model",
          messages: [{ role: "user", content: "hi" }],
          maxCompletionTokens: 10,
          verbose: false,
        }),
      ).rejects.toThrow(/not supported by Transformers.js/);
    });

    it("times out if model loading takes too long", async () => {
      process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS = "100";
      transformersMock.Gemma4ForConditionalGeneration.from_pretrained.mockImplementation(
        () => new Promise(() => {}),
      );

      const service = await getService();
      const promise = service.runChatCompletion({
        modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
      });

      const wrappedPromise = expect(promise).rejects.toThrow(
        /timed out after 100ms/,
      );
      await jest.advanceTimersByTimeAsync(150);
      await wrappedPromise;
      delete process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS;
    });

    it("handles batch_decode fallback when streamer produces empty string", async () => {
      modelMock.generate.mockImplementationOnce(async () => ({
        slice: jest.fn(() => [1, 2, 3]),
      }));

      const service = await getService();
      const promise = service.runChatCompletion({
        modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
      });

      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.text).toBe("Generated response");
    });
  });

  describe("fetchDynamicModels", () => {
    it("returns models from cached models.json if present", async () => {
      readFileMock.mockResolvedValueOnce(
        JSON.stringify({
          models: [
            {
              id: "onnx-community/custom-model",
              name: "Custom (ONNX)",
              context_length: 32000,
              max_completion_tokens: 8192,
              supports_tools: true,
            },
          ],
        }),
      );

      const service = await getService();
      const models = await service.fetchDynamicModels();
      expect(models.length).toBe(1);
      expect(models[0].id).toBe("onnx-community/custom-model");
    });

    it("fetches from discovery URL when cache file is missing", async () => {
      readFileMock
        .mockRejectedValueOnce(new Error("ENOENT")) // cache file missing
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: "onnx-community/gemma-4-26B-it-ONNX" },
            { id: "onnx-community/gemma-4-E4B-it-ONNX" },
          ]),
        ); // discovery part file content

      statMock.mockRejectedValue(new Error("ENOENT"));

      (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: (jest.fn() as any)
              .mockResolvedValueOnce({
                done: false,
                value: new Uint8Array([123]),
              })
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: jest.fn(),
          }),
        },
      });

      const service = await getService();
      const models = await service.fetchDynamicModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id.includes("gemma-4"))).toBe(true);
    });
  });

  describe("getDownloadStatus & getDiskCacheStatus & prewarmModel", () => {
    it("returns download status and allows testing status injection", async () => {
      const service = await getService();
      expect(service.getDownloadStatus().status).toBe("idle");

      service.__setDownloadStatusForTests({ status: "running", progress: 0.5 });
      expect(service.getDownloadStatus().status).toBe("running");
      expect(service.getDownloadStatus().progress).toBe(0.5);
    });

    it("returns disk cache status", async () => {
      statMock.mockResolvedValue({ isFile: () => true });
      readdirMock.mockResolvedValue(["entry1", "entry2"]);

      const service = await getService();
      const status = await service.getDiskCacheStatus();
      expect(status.modelsCatalogExists).toBe(true);
      expect(status.runtimeCacheDirExists).toBe(true);
      expect(status.runtimeCacheEntryCount).toBe(2);
    });

    it("prewarms model and returns metadata", async () => {
      const service = await getService();
      const info = await service.prewarmModel({
        modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        verbose: false,
      });

      expect(info.modelId).toBe("onnx-community/gemma-4-E2B-it-ONNX");
      expect(info.loader).toBeTruthy();
    });
  });

  describe("disposeRuntime and reset", () => {
    it("disposes model and processor", async () => {
      const service = await getService();
      const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

      await service.runChatCompletion({
        modelId,
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
      });

      await service.disposeRuntime(modelId);

      expect(modelMock.dispose).toHaveBeenCalled();
      expect(processorMock.dispose).toHaveBeenCalled();
    });

    it("resets runtime for tests", async () => {
      const service = await getService();
      service.__setRuntimeForTests("onnx-community/gemma-4-E2B-it-ONNX", {
        model: modelMock,
        processor: processorMock,
        TextStreamer: class {},
        modelLoaderName: "test",
      });

      await service.__resetRuntimeForTests();
      expect(modelMock.dispose).toHaveBeenCalled();
    });
  });

  describe("idle cleanup", () => {
    it("automatically disposes runtime after idle time", async () => {
      const service = await getService();
      const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

      await service.runChatCompletion({
        modelId,
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
      });

      expect(modelMock.dispose).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(11000);

      expect(modelMock.dispose).toHaveBeenCalled();
    });
  });
});
