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

    mkdirMock = jest.fn();
    readFileMock = jest.fn();
    writeFileMock = jest.fn();
    statMock = jest.fn();
    unlinkMock = jest.fn();
    readdirMock = jest.fn();

    processorMock = Object.assign(jest.fn(), {
      apply_chat_template: jest.fn(() => "prompt"),
      tokenizer: {},
      dispose: jest.fn(),
    });

    modelMock = {
      generate: jest.fn(async ({ streamer }: any) => {
        streamer?.callback_function?.("Hello");

        return {
          input_ids: { dims: [1, 5] },
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
      TextStreamer: class {
        callback_function: any;
        constructor(_tokenizer: any, opts: any) {
          this.callback_function = opts.callback_function;
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
    it("loads model and generates text", async () => {
      const service = await getService();
      const onToken = jest.fn();

      const promise = service.runChatCompletion({
        modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        messages: [{ role: "user", content: "hi" }],
        maxCompletionTokens: 10,
        verbose: false,
        onToken,
      });

      // Advance timers to handle internal awaitOperation timeout poll
      await jest.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result.text).toBe("Hello");
      expect(onToken).toHaveBeenCalledWith("Hello");
      expect(
        transformersMock.Gemma4ForConditionalGeneration.from_pretrained,
      ).toHaveBeenCalled();
    });

    it("times out if model loading takes too long", async () => {
      process.env.TRANSFORMERS_JS_REQUEST_TIMEOUT_MS = "100";
      transformersMock.Gemma4ForConditionalGeneration.from_pretrained.mockImplementation(
        () => new Promise(() => {}), // Never resolve
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
  });

  describe("disposeRuntime", () => {
    it("disposes model and processor", async () => {
      const service = await getService();
      const modelId = "onnx-community/gemma-4-E2B-it-ONNX";

      // Load it first
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

      // Should still be alive
      expect(modelMock.dispose).not.toHaveBeenCalled();

      // Wait for idle timeout (10s)
      await jest.advanceTimersByTimeAsync(11000);

      expect(modelMock.dispose).toHaveBeenCalled();
    });
  });
});
