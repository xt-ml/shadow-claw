/** @jest-environment node */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { TransformersRuntimeService } from "../../server/services/transformers-runtime.js";

const mockCreateServiceInstance: TransformersRuntimeService = {
  runChatCompletion: jest.fn(async () => ({
    text: "Created service default output",
    promptTokens: 5,
    completionTokens: 5,
  })),
} as unknown as TransformersRuntimeService;

const mockCreateTransformersRuntimeService = jest.fn(
  () => mockCreateServiceInstance,
);

jest.unstable_mockModule(
  "../../server/services/transformers-runtime.js",
  () => ({
    createTransformersRuntimeService: mockCreateTransformersRuntimeService,
  }),
);

const { executeNodeTransformersCompletion, setTransformersServiceForTests } =
  await import("./node-transformers-executor.js");

describe("executeNodeTransformersCompletion", () => {
  let mockService: TransformersRuntimeService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = {
      runChatCompletion: jest.fn(async () => ({
        text: "Hello from local ONNX!",
        promptTokens: 12,
        completionTokens: 8,
      })),
    } as unknown as TransformersRuntimeService;
    setTransformersServiceForTests(mockService);
  });

  it("executes completion and formats OpenAI-compatible response", async () => {
    const response = await executeNodeTransformersCompletion({
      modelId: "onnx-community/Qwen3-0.6B-ONNX",
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 100,
    });

    expect(mockService.runChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "onnx-community/Qwen3-0.6B-ONNX",
        maxCompletionTokens: 100,
      }),
    );

    expect(response.object).toBe("chat.completion");
    expect(response.model).toBe("onnx-community/Qwen3-0.6B-ONNX");
    expect(response.choices[0].message.content).toBe("Hello from local ONNX!");
    expect(response.usage.prompt_tokens).toBe(12);
    expect(response.usage.completion_tokens).toBe(8);
    expect(response.usage.total_tokens).toBe(20);
  });

  it("passes progress callback to runtime service", async () => {
    const onProgress = jest.fn();
    await executeNodeTransformersCompletion({
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      messages: [{ role: "user", content: "Explain gravity" }],
      onProgress,
    });

    expect(mockService.runChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        onProgress,
      }),
    );
  });

  it("handles tool calls returned by the model output", async () => {
    mockService.runChatCompletion = jest.fn(async () => ({
      text: 'call:read_file{"path":"test.txt"}',
      promptTokens: 20,
      completionTokens: 15,
    })) as typeof mockService.runChatCompletion;

    const tools = [
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: { path: { type: "string" } },
        },
      },
    ];

    const response = await executeNodeTransformersCompletion({
      modelId: "onnx-community/gemma-4-E2B-it-ONNX",
      messages: [{ role: "user", content: "Read test.txt" }],
      tools,
    });

    expect(mockService.runChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: "function",
            function: expect.objectContaining({ name: "read_file" }),
          }),
        ]),
      }),
    );

    expect(response.choices[0].finish_reason).toBe("tool_calls");
    expect(response.choices[0].message.content).toBeNull();
    expect(response.choices[0].message.tool_calls).toHaveLength(1);
    expect(response.choices[0].message.tool_calls[0].function.name).toBe(
      "read_file",
    );
    expect(response.choices[0].message.tool_calls[0].function.arguments).toBe(
      JSON.stringify({ path: "test.txt" }),
    );
  });

  it("creates default service when defaultService is null", async () => {
    setTransformersServiceForTests(null);

    const response = await executeNodeTransformersCompletion({
      modelId: "onnx-community/Qwen3-0.6B-ONNX",
      messages: [{ role: "user", content: "Test default" }],
    });

    expect(mockCreateTransformersRuntimeService).toHaveBeenCalled();
    expect(response.choices[0].message.content).toBe(
      "Created service default output",
    );
  });

  it("uses custom injected service when provided in options", async () => {
    const customService: TransformersRuntimeService = {
      runChatCompletion: jest.fn(async () => ({
        text: "Custom service response",
        promptTokens: 3,
        completionTokens: 4,
      })),
    } as unknown as TransformersRuntimeService;

    const response = await executeNodeTransformersCompletion({
      modelId: "onnx-community/Qwen3-0.6B-ONNX",
      messages: [{ role: "user", content: "Custom" }],
      service: customService,
    });

    expect(customService.runChatCompletion).toHaveBeenCalled();
    expect(response.choices[0].message.content).toBe("Custom service response");
  });
});
