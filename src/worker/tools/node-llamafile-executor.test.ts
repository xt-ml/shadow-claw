/** @jest-environment node */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  executeNodeLlamafileCompletion,
  setLlamafileServiceForTests,
} from "./node-llamafile-executor.js";

describe("executeNodeLlamafileCompletion", () => {
  let mockService: any;

  beforeEach(() => {
    mockService = {
      invokeCli: jest.fn(async (_req: any, res: any) => {
        res.write(
          'data: {"choices":[{"delta":{"content":"Hello from "}}]}\n\n',
        );
        res.write(
          'data: {"choices":[{"delta":{"content":"local Llamafile!"}}]}\n\n',
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }),
    };
    setLlamafileServiceForTests(mockService);
  });

  it("executes completion and formats OpenAI-compatible response with streaming callback", async () => {
    const tokens: string[] = [];
    const response = await executeNodeLlamafileCompletion({
      model: "gemma-4-E2B-it-Q5_K_M.llamafile",
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 100,
      onToken: (tok) => tokens.push(tok),
    });

    expect(mockService.invokeCli).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        model: "gemma-4-E2B-it-Q5_K_M.llamafile",
        max_tokens: 100,
      }),
      expect.objectContaining({
        model: "gemma-4-E2B-it-Q5_K_M.llamafile",
      }),
      false,
    );

    expect(tokens).toEqual(["Hello from ", "local Llamafile!"]);
    expect(response.object).toBe("chat.completion");
    expect(response.model).toBe("gemma-4-E2B-it-Q5_K_M.llamafile");
    expect(response.choices[0].message.content).toBe(
      "Hello from local Llamafile!",
    );
  });

  it("handles error emitted during execution", async () => {
    mockService.invokeCli = jest.fn(async (_req: any, res: any) => {
      res.write(
        'data: {"error":{"type":"server_error","message":"Llamafile crash"}}\n\n',
      );
      res.end();
    });

    await expect(
      executeNodeLlamafileCompletion({
        model: "gemma-4-E2B-it-Q5_K_M.llamafile",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).rejects.toThrow("Llamafile crash");
  });

  it("captures tool calls and sets finish_reason to tool_calls", async () => {
    mockService.invokeCli = jest.fn(async (_req: any, res: any) => {
      res.write(
        'data: {"choices":[{"delta":{"tool_calls":[{"id":"call_123","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\"test.txt\\"}"}}]},"finish_reason":null}]}\n\n',
      );
      res.write(
        'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}\n\n',
      );
      res.write("data: [DONE]\n\n");
      res.end();
    });

    const response = await executeNodeLlamafileCompletion({
      model: "gemma-4-E2B-it-Q5_K_M.llamafile",
      messages: [{ role: "user", content: "Read test.txt" }],
    });

    expect(response.choices[0].finish_reason).toBe("tool_calls");
    expect(response.choices[0].message.tool_calls).toHaveLength(1);
    expect(response.choices[0].message.tool_calls[0].function.name).toBe(
      "read_file",
    );
  });

  it("propagates abortSignal to mock request by marking it destroyed and emitting close", async () => {
    let capturedReq: any = null;
    mockService.invokeCli = jest.fn(async (req: any, _res: any) => {
      capturedReq = req;
      return new Promise<void>(() => {}); // intentionally pending
    });

    const abortController = new AbortController();
    void executeNodeLlamafileCompletion({
      model: "gemma-4-E2B-it-Q5_K_M.llamafile",
      messages: [{ role: "user", content: "Hi" }],
      abortSignal: abortController.signal,
    });

    expect(capturedReq).not.toBeNull();
    expect(capturedReq.destroyed).toBe(false);

    let closeEmitted = false;
    capturedReq.on("close", () => {
      closeEmitted = true;
    });

    abortController.abort();
    expect(capturedReq.destroyed).toBe(true);
    expect(closeEmitted).toBe(true);
  });
});
