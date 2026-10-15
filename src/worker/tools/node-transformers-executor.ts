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
import {
  convertToolSchemasToOpenAI,
  createToolCallStreamFilter,
  parseLocalModelToolCalls,
} from "../../subsystems/providers/utils/parse-local-model-tool-call.js";
import { ulid } from "../../utils/ulid.js";
import { setNodeTransformersCompletionExecutor } from "../utils/handle-invoke.js";
import { setNodeTransformersTaskExecutor } from "../../subsystems/providers/execute-native-ai-task.js";

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
  tools?: any[];
  maxTokens?: number;
  verbose?: boolean;
  onToken?: (text: string) => void;
  onProgress?: (info: any) => void;
  abortSignal?: AbortSignal;
  service?: TransformersRuntimeService;
}

export { createToolCallStreamFilter } from "../../subsystems/providers/utils/parse-local-model-tool-call.js";

/**
 * Executes a chat completion in-process using the Transformers.js runtime.
 * Returns an OpenAI-compatible completion response object.
 *
 * When tool schemas are provided they are forwarded to `apply_chat_template`
 * so the model's Jinja template can declare the available tools in the prompt.
 * The model's raw text output is then parsed for known tool-call grammars
 * (Gemma `call:<name>{...}`, `<execute_tool>`, Qwen `[tool_code]`).  If a
 * tool call is detected the response is returned in the standard OpenAI
 * `tool_calls` format so that `OpenAIAdapter.parseResponse` handles it
 * identically to any cloud provider response.
 */
export async function executeNodeTransformersCompletion(
  options: NodeTransformersCompletionOptions,
): Promise<any> {
  const {
    modelId,
    messages,
    tools,
    maxTokens = 8192,
    verbose = false,
    onToken,
    onProgress,
    abortSignal,
    service: injectedService,
  } = options;

  const runtimeService = injectedService || getService();

  // Convert internal tool schemas → OpenAI function-calling format expected by
  // chat templates (Gemma 4, Qwen 3, …).
  const openAITools = convertToolSchemasToOpenAI(tools ?? []);
  const filter =
    onToken && openAITools.length > 0
      ? createToolCallStreamFilter(onToken)
      : null;

  const completion = await runtimeService.runChatCompletion({
    modelId,
    messages,
    tools: openAITools.length > 0 ? openAITools : undefined,
    maxCompletionTokens: maxTokens,
    verbose,
    onToken: filter ? filter.onToken : onToken,
    onProgress,
    abortSignal,
  });

  // Attempt to parse tool calls from the raw text output
  const toolCalls = parseLocalModelToolCalls(completion.text);
  filter?.finalize(toolCalls.length > 0);

  if (toolCalls.length > 0) {
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
            content: null,
            tool_calls: toolCalls.map((tc) => ({
              id: `call_${ulid()}`,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input || {}),
              },
            })),
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: {
        prompt_tokens: completion.promptTokens,
        completion_tokens: completion.completionTokens,
        total_tokens: completion.promptTokens + completion.completionTokens,
      },
    };
  }

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
setNodeTransformersTaskExecutor(executeNodeTransformersCompletion);
