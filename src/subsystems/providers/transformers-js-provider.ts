import { CONFIG_KEYS } from "../../config/config.js";
import { sanitizeModelOutput } from "../../content/chat-template-sanitizer.js";
import { ShadowClawDatabase } from "../../db/db.js";
import { getConfig } from "../../db/get-config.js";
import { createModuleWorker } from "../../utils/runtime-assets.js";
import { createLogMessage } from "../../worker/utils/create-log-message.js";
import { createToolActivityMessage } from "../../worker/utils/create-tool-activity-message.js";
import { executeTool } from "../../worker/utils/execute-tool.js";
import { setPostHandler } from "../../worker/utils/post.js";
import { ToolDefinition } from "../tools/tools.js";

import type { SubagentInvokeContext } from "../../worker/tools/spawn-subagent/spawn-subagent.js";
import type { ActiveLoadState } from "./types.js";

class TransformersJsManager {
  private activeLoad: ActiveLoadState | null = null;
  private chunkCallbacks = new Map<string, (payload: any) => void>();
  private loadedKey: string | null = null;
  private pendingRejects = new Map<string, (reason: any) => void>();
  private pendingResolves = new Map<string, (value: any) => void>();
  private thinkingCallbacks = new Map<string, (text: string) => void>();
  private worker: Worker | null = null;

  async generate(
    messages: any[],
    maxTokens: number,
    groupId: string,
    onChunk: (text: string) => void,
    onThinking?: (text: string) => void,
    tools?: any[],
  ): Promise<string> {
    const worker = this.getWorker();

    return new Promise((resolve, reject) => {
      this.pendingResolves.set(groupId, resolve);
      this.pendingRejects.set(groupId, reject);
      this.chunkCallbacks.set(groupId, (payload) => onChunk(payload.text));
      if (onThinking) {
        this.thinkingCallbacks.set(groupId, onThinking);
      }

      worker.postMessage({
        type: "generate",
        payload: { messages, maxTokens, groupId, tools },
      });
    });
  }

  cancelActiveLoad(reason: Error) {
    if (!this.activeLoad) {
      return;
    }

    const prev = this.activeLoad;
    this.activeLoad = null;
    this.loadedKey = null;

    for (const waiter of prev.waiters) {
      waiter.reject(reason);
    }

    for (const [id, reject] of this.pendingRejects.entries()) {
      reject(reason);
      this.cleanup(id);
    }

    if (this.worker) {
      this.worker.terminate?.();
      this.worker = null;
    }
  }

  async load(
    modelId: string,
    device: string,
    dtypeStrategy: string,
    groupId: string,
    onProgress: (payload: any) => void,
  ): Promise<void> {
    const key = JSON.stringify([modelId, device, dtypeStrategy]);

    if (!this.activeLoad && this.loadedKey === key) {
      return;
    }

    if (this.activeLoad && this.activeLoad.key === key) {
      return new Promise((resolve, reject) => {
        this.activeLoad!.waiters.push({ resolve, reject, onProgress });
        if (this.activeLoad!.lastProgress) {
          onProgress(this.activeLoad!.lastProgress);
        }
      });
    }

    if (this.activeLoad && this.activeLoad.key !== key) {
      this.cancelActiveLoad(new Error("Model download cancelled"));
    }

    this.loadedKey = null;
    const worker = this.getWorker();

    return new Promise((resolve, reject) => {
      this.activeLoad = {
        key,
        lastProgress: null,
        waiters: [{ resolve, reject, onProgress }],
      };
      worker.postMessage({
        type: "load",
        payload: { modelId, device, dtypeStrategy, groupId },
      });
    });
  }

  private cleanup(groupId: string) {
    this.pendingResolves.delete(groupId);
    this.pendingRejects.delete(groupId);
    this.chunkCallbacks.delete(groupId);
    this.thinkingCallbacks.delete(groupId);
  }

  private getWorker() {
    if (!this.worker) {
      const worker = createModuleWorker(
        new URL("./transformers-js.worker.js", import.meta.url).href,
      );
      this.worker = worker;
      worker.onmessage = (event) => {
        if (this.worker !== worker) {
          return;
        }
        const { type, payload } = event.data;
        const groupId = payload?.groupId;

        switch (type) {
          case "progress": {
            const active = this.activeLoad;
            if (active) {
              active.lastProgress = payload;
              for (const waiter of [...active.waiters]) {
                waiter.onProgress(payload);
              }
              if (payload.status === "done") {
                this.activeLoad = null;
                this.loadedKey = active.key;
                for (const waiter of active.waiters) {
                  waiter.resolve();
                }
              }
            }
            break;
          }
          case "chunk":
            this.chunkCallbacks.get(groupId)?.(payload);

            break;
          case "thinking-chunk":
            this.thinkingCallbacks.get(groupId)?.(payload.text);

            break;
          case "done":
            this.pendingResolves.get(groupId)?.(payload.text);
            this.cleanup(groupId);

            break;
          case "error": {
            this.pendingRejects.get(groupId)?.(payload.error);
            this.cleanup(groupId);
            const active = this.activeLoad;
            if (active) {
              this.activeLoad = null;
              this.loadedKey = null;
              for (const waiter of active.waiters) {
                waiter.reject(payload.error);
              }
            }
            break;
          }
        }
      };
    }

    return this.worker;
  }
}

const manager = new TransformersJsManager();

function formatMessageContent(msg: any): string {
  if (typeof msg?.content === "string") {
    return msg.content;
  }

  if (Array.isArray(msg?.content)) {
    return msg.content
      .map((block: any) => {
        if (block?.type === "text") {
          return block.text || "";
        }
        if (block?.type === "tool_use") {
          return `[TOOL_CALL ${block.name}] ${JSON.stringify(block.input || {})}`;
        }
        if (block?.type === "tool_result") {
          return `[TOOL_RESULT ${block.tool_use_id}] ${String(block.content || "")}`;
        }
        if (block?.type === "attachment") {
          return `[ATTACHMENT ${block.mediaType}] ${block.fileName} (${block.mimeType})`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function parseStructured(raw: string) {
  const text = sanitizeModelOutput(String(raw || ""), "transformers_js").trim();
  if (!text) {
    return null;
  }

  // Check for Qwen/Llama XML-like tool calls: <tool_call>{"name": "...", "arguments": ...}</tool_call>
  const toolCallMatch = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (toolCallMatch) {
    try {
      const parsedTool = JSON.parse(toolCallMatch[1]);
      if (parsedTool.name) {
        return {
          type: "tool_use",
          tool_calls: [
            {
              name: parsedTool.name,
              input: parsedTool.arguments || parsedTool.parameters || {},
            },
          ],
        };
      }
    } catch {
      // fallback to other parsing if invalid JSON
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * Cancel any in-flight Transformers.js model download.
 */
export function cancelTransformersJsDownload(): void {
  manager.cancelActiveLoad(new Error("Model download cancelled"));
}

/**
 * Preload/download a Transformers.js model into the browser cache using configured backend/dtype settings.
 */
export async function prepareTransformersJsModel(
  db: ShadowClawDatabase | null | undefined,
  modelId: string,
  onProgress?: (payload: any) => void,
): Promise<void> {
  const backend =
    (db ? await getConfig(db, CONFIG_KEYS.TRANSFORMERS_JS_BACKEND) : null) ||
    "auto";
  const dtypeStrategy =
    (db
      ? await getConfig(db, CONFIG_KEYS.TRANSFORMERS_JS_DTYPE_STRATEGY)
      : null) || "auto";

  await manager.load(
    modelId,
    backend,
    dtypeStrategy,
    "settings-prepare",
    (payload) => {
      onProgress?.(payload);
    },
  );
}

export async function invokeWithTransformersJs(
  db: ShadowClawDatabase,
  groupId: string,
  systemPrompt: string,
  messages: any[],
  maxTokens: number,
  emit: (message: any) => Promise<void> | void,
  _abortSignal: AbortSignal | undefined,
  tools: ToolDefinition[] | undefined,
  modelId: string,
  invokeContext?: SubagentInvokeContext,
) {
  const activeTools = tools || [];
  const backend =
    (await getConfig(db, CONFIG_KEYS.TRANSFORMERS_JS_BACKEND)) || "auto";
  const dtypeStrategy =
    (await getConfig(db, CONFIG_KEYS.TRANSFORMERS_JS_DTYPE_STRATEGY)) || "auto";

  await emit(
    createLogMessage(
      groupId,
      "info",
      "Starting",
      `Provider: Transformers.js (Local Worker) · Model: ${modelId} · Backend: ${backend} · Dtype: ${dtypeStrategy}`,
    ),
  );

  await manager.load(modelId, backend, dtypeStrategy, groupId, (payload) => {
    void emit({ type: "model-download-progress", payload });
  });

  let currentMessages = [...messages];

  for (let i = 0; i < 10; i++) {
    const systemMessage = {
      role: "system",
      content: systemPrompt,
    };

    const structuredMessages = [
      systemMessage,
      ...currentMessages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: formatMessageContent(m),
      })),
    ];

    await emit({ type: "streaming-start", payload: { groupId } });

    let thinkingBuffer = "";
    let accumulated = "";
    const response = await manager.generate(
      structuredMessages,
      maxTokens,
      groupId,
      (chunk) => {
        accumulated += chunk;
        void emit({
          type: "streaming-chunk",
          payload: { groupId, text: chunk },
        });
      },
      (thinkingChunk) => {
        thinkingBuffer += thinkingChunk;
        void emit(
          createLogMessage(groupId, "text", "Thinking", thinkingBuffer),
        );
      },
      activeTools,
    );

    await emit({ type: "typing", payload: { groupId } });

    const parsed = parseStructured(response);

    if (parsed?.type === "tool_use") {
      await emit({ type: "streaming-end", payload: { groupId } });
    } else {
      const text = parsed?.response
        ? sanitizeModelOutput(parsed.response, "transformers_js")
        : sanitizeModelOutput(response, "transformers_js");
      await emit({
        type: "streaming-done",
        payload: { groupId, text },
      });
    }

    if (!parsed || parsed.type === "response") {
      const text = parsed?.response
        ? sanitizeModelOutput(parsed.response, "transformers_js")
        : sanitizeModelOutput(response, "transformers_js");
      await emit({ type: "response", payload: { groupId, text } });

      return;
    }

    const calls = Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [];
    if (calls.length === 0) {
      await emit({
        type: "response",
        payload: {
          groupId,
          text: sanitizeModelOutput(
            parsed.response || response,
            "transformers_js",
          ),
        },
      });

      return;
    }

    const toolResults: any[] = [];
    for (const call of calls) {
      await emit(createToolActivityMessage(groupId, call.name, "running"));
      setPostHandler((msg) => {
        emit(msg);
      });
      let output: any;
      try {
        output = await executeTool(db, call.name, call.input || {}, groupId, {
          allowedTools: activeTools,
          invokeContext,
        });
      } finally {
        setPostHandler(null);
      }

      await emit(createToolActivityMessage(groupId, call.name, "done"));

      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id || `call_${Date.now()}`,
        content: typeof output === "string" ? output : JSON.stringify(output),
      });
    }

    currentMessages.push({
      role: "assistant",
      content: [
        ...(parsed.response ? [{ type: "text", text: parsed.response }] : []),
        ...calls.map((c) => ({
          type: "tool_use",
          id: c.id || `call_${Date.now()}_${Math.random()}`,
          name: c.name,
          input: c.input || {},
        })),
      ] as any,
    });

    currentMessages.push({ role: "user", content: toolResults as any });
  }
}
