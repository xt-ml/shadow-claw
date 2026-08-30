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

    jest.unstable_mockModule("../../db/getConfig.js", () => ({
      getConfig: mockGetConfig,
    }));

    jest.unstable_mockModule("../../worker/utils/executeTool.js", () => ({
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
});
