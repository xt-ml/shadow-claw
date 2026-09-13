/** @jest-environment node */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  executeNodeTransformersCompletion,
  setTransformersServiceForTests,
} from "./node-transformers-executor.js";

describe("executeNodeTransformersCompletion", () => {
  let mockService: any;

  beforeEach(() => {
    mockService = {
      runChatCompletion: jest.fn(async () => ({
        text: "Hello from local ONNX!",
        promptTokens: 12,
        completionTokens: 8,
      })),
    };
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
});
