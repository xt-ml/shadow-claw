import { jest } from "@jest/globals";

describe("Transformers.js Provider", () => {
  let mockWorkerInstance: any;
  let mockGetConfig: jest.Mock<any>;
  let mockExecuteTool: jest.Mock<any>;
  let mockSetPostHandler: jest.Mock<any>;

  beforeEach(() => {
    jest.resetModules();

    mockGetConfig = jest.fn().mockResolvedValue("auto" as never);
    mockExecuteTool = jest
      .fn()
      .mockResolvedValue("tool success result" as never);
    mockSetPostHandler = jest.fn();

    mockWorkerInstance = {
      postMessage: jest.fn((msg: any) => {
        const { type, payload } = msg;
        if (type === "load") {
          setTimeout(() => {
            mockWorkerInstance.onmessage?.({
              data: {
                type: "progress",
                payload: {
                  groupId: payload.groupId,
                  status: "progress",
                  loaded: 50,
                  total: 100,
                },
              },
            });
            mockWorkerInstance.onmessage?.({
              data: {
                type: "progress",
                payload: { groupId: payload.groupId, status: "done" },
              },
            });
          }, 0);
        } else if (type === "generate") {
          setTimeout(() => {
            mockWorkerInstance.onmessage?.({
              data: {
                type: "chunk",
                payload: { groupId: payload.groupId, text: "Hello " },
              },
            });
            mockWorkerInstance.onmessage?.({
              data: {
                type: "thinking-chunk",
                payload: {
                  groupId: payload.groupId,
                  text: "thinking deeply...",
                },
              },
            });
            mockWorkerInstance.onmessage?.({
              data: {
                type: "done",
                payload: {
                  groupId: payload.groupId,
                  text: "Hello world response",
                },
              },
            });
          }, 0);
        }
      }),
      onmessage: null,
    };

    (globalThis as any).Worker = jest
      .fn()
      .mockImplementation(() => mockWorkerInstance);

    jest.unstable_mockModule("../../db/get-config.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../../worker/utils/execute-tool.js", () => ({
      executeTool: mockExecuteTool,
    }));

    jest.unstable_mockModule("../../worker/utils/post.js", () => ({
      post: jest.fn(),
      setPostHandler: mockSetPostHandler,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("loads model, streams chunks and completes simple response", async () => {
    const { invokeWithTransformersJs } =
      await import("./transformers-js-provider.js");

    const emitted: any[] = [];
    const emit = (msg: any) => {
      emitted.push(msg);
    };

    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: "Hello" },
          {
            type: "attachment",
            mediaType: "image",
            fileName: "pic.png",
            mimeType: "image/png",
          },
        ],
      },
    ];

    await invokeWithTransformersJs(
      {} as any,
      "g1",
      "You are a helpful assistant.",
      messages,
      2048,
      emit,
      undefined,
      [],
      "Xenova/Qwen1.5-0.5B-Chat",
    );

    expect(emitted.some((e) => e.type === "model-download-progress")).toBe(
      true,
    );
    expect(emitted.some((e) => e.type === "streaming-start")).toBe(true);
    expect(
      emitted.some(
        (e) => e.type === "streaming-chunk" && e.payload.text === "Hello ",
      ),
    ).toBe(true);
    expect(emitted.some((e) => e.type === "streaming-done")).toBe(true);
    expect(
      emitted.some(
        (e) =>
          e.type === "response" && e.payload.text === "Hello world response",
      ),
    ).toBe(true);
  });

  it("handles XML <tool_call> output, executes tool, and iterates loop", async () => {
    let callCount = 0;
    mockWorkerInstance.postMessage = jest.fn((msg: any) => {
      const { type, payload } = msg;
      if (type === "load") {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: {
              type: "progress",
              payload: { groupId: payload.groupId, status: "done" },
            },
          });
        }, 0);
      } else if (type === "generate") {
        callCount++;
        setTimeout(() => {
          if (callCount === 1) {
            mockWorkerInstance.onmessage?.({
              data: {
                type: "done",
                payload: {
                  groupId: payload.groupId,
                  text: '<tool_call>{"name": "web_search", "arguments": {"query": "weather"}}</tool_call>',
                },
              },
            });
          } else {
            mockWorkerInstance.onmessage?.({
              data: {
                type: "done",
                payload: {
                  groupId: payload.groupId,
                  text: '{"type":"response","response":"The weather is sunny."}',
                },
              },
            });
          }
        }, 0);
      }
    });

    const { invokeWithTransformersJs } =
      await import("./transformers-js-provider.js");

    const emitted: any[] = [];
    const emit = (msg: any) => {
      emitted.push(msg);
    };

    const tools: any[] = [
      {
        name: "web_search",
        description: "Search web",
        input_schema: { type: "object", properties: {} },
      },
    ];

    await invokeWithTransformersJs(
      {} as any,
      "g2",
      "System prompt",
      [{ role: "user", content: "What is the weather?" }],
      1024,
      emit,
      undefined,
      tools,
      "model-id",
    );

    expect(mockExecuteTool).toHaveBeenCalledWith(
      {},
      "web_search",
      { query: "weather" },
      "g2",
      expect.objectContaining({ allowedTools: tools }),
    );
    expect(
      emitted.some(
        (e) =>
          e.type === "response" && e.payload.text === "The weather is sunny.",
      ),
    ).toBe(true);
  });

  it("handles worker error rejection during generation", async () => {
    mockWorkerInstance.postMessage = jest.fn((msg: any) => {
      const { type, payload } = msg;
      if (type === "load") {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: {
              type: "progress",
              payload: { groupId: payload.groupId, status: "done" },
            },
          });
        }, 0);
      } else if (type === "generate") {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: {
              type: "error",
              payload: { groupId: payload.groupId, error: "Out of memory" },
            },
          });
        }, 0);
      }
    });

    const { invokeWithTransformersJs } =
      await import("./transformers-js-provider.js");

    const emitted: any[] = [];
    const emit = (msg: any) => {
      emitted.push(msg);
    };

    await expect(
      invokeWithTransformersJs(
        {} as any,
        "g3",
        "System prompt",
        [{ role: "user", content: "Hi" }],
        512,
        emit,
        undefined,
        [],
        "model-id",
      ),
    ).rejects.toBe("Out of memory");
  });

  it("coalesces concurrent loads for the same model instead of starting a second download", async () => {
    let activeLoadGroupId = "";
    const loadCalls: any[] = [];
    mockWorkerInstance.postMessage = jest.fn((msg: any) => {
      const { type, payload } = msg;
      if (type === "load") {
        loadCalls.push(payload);
        activeLoadGroupId = payload.groupId;
      } else if (type === "generate") {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: {
              type: "done",
              payload: { groupId: payload.groupId, text: "Hi back!" },
            },
          });
        }, 0);
      }
    });

    const { prepareTransformersJsModel, invokeWithTransformersJs } =
      await import("./transformers-js-provider.js");

    const settingsProgress: any[] = [];
    const preparePromise = prepareTransformersJsModel(
      {} as any,
      "onnx-community/Qwen3-0.6B-ONNX",
      (p) => settingsProgress.push(p),
    );

    const chatEmitted: any[] = [];
    const chatPromise = invokeWithTransformersJs(
      {} as any,
      "br:main",
      "System",
      [{ role: "user", content: "Hi" }],
      512,
      (msg) => {
        chatEmitted.push(msg);
      },
      undefined,
      [],
      "onnx-community/Qwen3-0.6B-ONNX",
    );

    await new Promise((r) => setTimeout(r, 0));
    expect(loadCalls).toHaveLength(1);

    mockWorkerInstance.onmessage?.({
      data: {
        type: "progress",
        payload: {
          groupId: activeLoadGroupId,
          status: "running",
          progress: 0.5,
          message: "Downloading model weights... 50%",
        },
      },
    });
    mockWorkerInstance.onmessage?.({
      data: {
        type: "progress",
        payload: { groupId: activeLoadGroupId, status: "done" },
      },
    });

    await expect(preparePromise).resolves.toBeUndefined();
    await expect(chatPromise).resolves.toBeUndefined();

    expect(
      chatEmitted.some(
        (e) => e.type === "response" && e.payload.text === "Hi back!",
      ),
    ).toBe(true);

    expect(settingsProgress.some((p) => p.progress === 0.5)).toBe(true);
    expect(
      chatEmitted.some(
        (e) =>
          e.type === "model-download-progress" && e.payload.progress === 0.5,
      ),
    ).toBe(true);
  });

  it("cancels an in-flight download when a different model is requested", async () => {
    const workers: any[] = [];
    (globalThis as any).Worker = jest.fn().mockImplementation(() => {
      const w: any = {
        terminate: jest.fn(),
        onmessage: null,
        postMessage: jest.fn((msg: any) => {
          if (msg.type === "load" && msg.payload.modelId === "model-b") {
            setTimeout(() => {
              w.onmessage?.({
                data: {
                  type: "progress",
                  payload: { groupId: msg.payload.groupId, status: "done" },
                },
              });
            }, 0);
          }
        }),
      };
      workers.push(w);
      return w;
    });

    const { prepareTransformersJsModel } =
      await import("./transformers-js-provider.js");

    const promiseA = prepareTransformersJsModel({} as any, "model-a");
    await new Promise((r) => setTimeout(r, 0));

    const promiseB = prepareTransformersJsModel({} as any, "model-b");

    await expect(promiseA).rejects.toThrow(/cancel/i);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    await expect(promiseB).resolves.toBeUndefined();
    expect(workers).toHaveLength(2);
  });

  it("does not re-download a model that is already loaded", async () => {
    const loadCalls: any[] = [];
    mockWorkerInstance.postMessage = jest.fn((msg: any) => {
      if (msg.type === "load") {
        loadCalls.push(msg.payload);
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: {
              type: "progress",
              payload: { groupId: msg.payload.groupId, status: "done" },
            },
          });
        }, 0);
      }
    });

    const { prepareTransformersJsModel } =
      await import("./transformers-js-provider.js");

    await prepareTransformersJsModel({} as any, "model-a");
    await prepareTransformersJsModel({} as any, "model-a");

    expect(loadCalls).toHaveLength(1);
  });

  it("cancels an in-flight download via cancelTransformersJsDownload without affecting idle workers", async () => {
    const workers: any[] = [];
    (globalThis as any).Worker = jest.fn().mockImplementation(() => {
      const w: any = {
        terminate: jest.fn(),
        onmessage: null,
        postMessage: jest.fn(),
      };
      workers.push(w);
      return w;
    });

    const { prepareTransformersJsModel, cancelTransformersJsDownload } =
      await import("./transformers-js-provider.js");

    // Calling when nothing is downloading should be a no-op
    cancelTransformersJsDownload();
    expect(workers).toHaveLength(0);

    const promise = prepareTransformersJsModel({} as any, "model-a");
    await new Promise((r) => setTimeout(r, 0));
    expect(workers).toHaveLength(1);

    cancelTransformersJsDownload();
    await expect(promise).rejects.toThrow(/cancel/i);
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
});
