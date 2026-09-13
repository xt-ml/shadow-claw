/**
 * In-Process Node.js Llamafile Executor
 *
 * Runs local Llamafile binary chat completions directly within the Node.js process
 * during headless CLI execution, avoiding the requirement of an external HTTP
 * proxy server running on port 8888.
 */

import { EventEmitter } from "node:events";
import type { Request, Response as ExpressResponse } from "express";

import {
  createLlamafileManagerService,
  LlamafileManagerService,
} from "../../server/services/llamafile-manager.js";
import { ulid } from "../../utils/ulid.js";
import { setNodeLlamafileCompletionExecutor } from "../utils/handleInvoke.js";

let defaultService: LlamafileManagerService | null = null;

function getService(): LlamafileManagerService {
  if (!defaultService) {
    defaultService = createLlamafileManagerService();
  }
  return defaultService;
}

export function setLlamafileServiceForTests(
  service: LlamafileManagerService | null,
): void {
  defaultService = service;
}

export interface NodeLlamafileCompletionOptions {
  model: string;
  messages: any[];
  maxTokens?: number;
  verbose?: boolean;
  onToken?: (text: string) => void;
  abortSignal?: AbortSignal;
  service?: LlamafileManagerService;
}

/**
 * Executes a chat completion in-process using the Llamafile manager service.
 * Returns an OpenAI-compatible completion response object.
 */
export async function executeNodeLlamafileCompletion(
  options: NodeLlamafileCompletionOptions,
): Promise<any> {
  const {
    model,
    messages,
    maxTokens = 8192,
    verbose = false,
    onToken,
    abortSignal,
    service: injectedService,
  } = options;

  const service = injectedService || getService();

  const mockReqEmitter = new EventEmitter();
  const mockSocketEmitter = new EventEmitter();
  let isAborted = abortSignal?.aborted ?? false;

  const mockReq = Object.assign(mockReqEmitter, {
    headers: {},
    socket: mockSocketEmitter,
    destroyed: isAborted,
    aborted: isAborted,
    body: {
      model,
      messages,
      max_tokens: maxTokens,
      stream: true,
    },
  }) as unknown as Request;

  const handleAbort = () => {
    isAborted = true;
    (mockReq as any).destroyed = true;
    (mockReq as any).aborted = true;
    (mockSocketEmitter as any).destroyed = true;
    mockReqEmitter.emit("close");
    mockReqEmitter.emit("aborted");
    mockSocketEmitter.emit("close");
  };

  if (abortSignal) {
    if (abortSignal.aborted) {
      handleAbort();
    } else {
      abortSignal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  let fullText = "";
  let errorReceived: string | null = null;
  const capturedToolCalls: any[] = [];
  let capturedFinishReason = "stop";

  const mockResEmitter = new EventEmitter();
  let finished = false;

  const promise = new Promise<any>((resolve, reject) => {
    const mockRes = Object.assign(mockResEmitter, {
      headersSent: false,
      writableEnded: false,
      status(_code: number) {
        return this;
      },
      setHeader(_name: string, _value: any) {
        return this;
      },
      flushHeaders() {},
      write(chunk: any) {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error?.message) {
              errorReceived = parsed.error.message;
            }
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              onToken?.(delta.content);
            }
            if (Array.isArray(delta?.tool_calls)) {
              capturedToolCalls.push(...delta.tool_calls);
            }
            const finishReason = parsed.choices?.[0]?.finish_reason;
            if (finishReason) {
              capturedFinishReason = finishReason;
            }
          } catch {}
        }
        return true;
      },
      end() {
        if (finished) return;
        finished = true;
        this.writableEnded = true;

        if (errorReceived) {
          reject(new Error(errorReceived));
          return;
        }

        const message: Record<string, any> = {
          role: "assistant",
          content: fullText,
        };
        if (capturedToolCalls.length > 0) {
          message.tool_calls = capturedToolCalls;
        }

        resolve({
          id: `chatcmpl-${ulid()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message,
              finish_reason: capturedFinishReason,
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        });
      },
    }) as unknown as ExpressResponse;

    service
      .invokeCli(
        mockReq,
        mockRes,
        mockReq.body,
        { model, offline: false },
        verbose,
      )
      .catch((err) => {
        if (!finished) {
          finished = true;
          reject(err);
        }
      });
  });

  return promise;
}

// Automatically register for headless mode execution
setNodeLlamafileCompletionExecutor(executeNodeLlamafileCompletion);
