/**
 * In-Process Node.js Transformers.js Executor
 *
 * Runs local ONNX model chat completions directly within the Node.js process
 * during headless CLI execution, avoiding the requirement of an external HTTP
 * server running on port 8888.
 */

import {
  createTransformersRuntimeService,
  TransformersRuntimeService,
} from "../../server/services/transformers-runtime.js";
import { ulid } from "../../utils/ulid.js";
import { setNodeTransformersCompletionExecutor } from "../utils/handleInvoke.js";

let defaultService: TransformersRuntimeService | null = null;

function getService(): TransformersRuntimeService {
  if (!defaultService) {
    defaultService = createTransformersRuntimeService();
  }
  return defaultService;
}

export function setTransformersServiceForTests(
  service: TransformersRuntimeService | null,
): void {
  defaultService = service;
}

export interface NodeTransformersCompletionOptions {
  modelId: string;
  messages: any[];
  maxTokens?: number;
  verbose?: boolean;
  onToken?: (text: string) => void;
  onProgress?: (info: any) => void;
  abortSignal?: AbortSignal;
  service?: TransformersRuntimeService;
}

/**
 * Executes a chat completion in-process using the Transformers.js runtime.
 * Returns an OpenAI-compatible completion response object.
 */
export async function executeNodeTransformersCompletion(
  options: NodeTransformersCompletionOptions,
): Promise<any> {
  const {
    modelId,
    messages,
    maxTokens = 8192,
    verbose = false,
    onToken,
    onProgress,
    abortSignal,
    service: injectedService,
  } = options;

  const runtimeService = injectedService || getService();

  const completion = await runtimeService.runChatCompletion({
    modelId,
    messages,
    maxCompletionTokens: maxTokens,
    verbose,
    onToken,
    onProgress,
    abortSignal,
  });

  return {
    id: `chatcmpl-${ulid()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: completion.text,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: completion.promptTokens,
      completion_tokens: completion.completionTokens,
      total_tokens: completion.promptTokens + completion.completionTokens,
    },
  };
}

// Automatically register for headless mode execution
setNodeTransformersCompletionExecutor(executeNodeTransformersCompletion);
