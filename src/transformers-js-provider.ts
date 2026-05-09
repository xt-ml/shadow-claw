import { ShadowClawDatabase } from "./db/db.js";
import { ToolDefinition } from "./tools.js";
import { createLogMessage } from "./worker/createLogMessage.js";
import { createToolActivityMessage } from "./worker/createToolActivityMessage.js";
import { executeTool } from "./worker/executeTool.js";
import { getConfig } from "./db/getConfig.js";
import { CONFIG_KEYS } from "./config.js";
import { sanitizeModelOutput } from "./chat-template-sanitizer.js";

class TransformersJsManager {
  private worker: Worker | null = null;
  private pendingResolves = new Map<string, (value: any) => void>();
  private pendingRejects = new Map<string, (reason: any) => void>();
  private progressCallbacks = new Map<string, (payload: any) => void>();
  private chunkCallbacks = new Map<string, (payload: any) => void>();
  private thinkingCallbacks = new Map<string, (text: string) => void>();
  private loadResolves = new Map<string, () => void>();
  private loadRejects = new Map<string, (reason: any) => void>();

  private getWorker() {
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./transformers-js.worker.js", import.meta.url),
        {
          type: "module",
        },
      );
      this.worker.onmessage = (event) => {
        const { type, payload } = event.data;
        const groupId = payload?.groupId;

        switch (type) {
          case "progress":
            this.progressCallbacks.get(groupId)?.(payload);
            if (payload.status === "done") {
              this.loadResolves.get(groupId)?.();
              this.loadResolves.delete(groupId);
              this.loadRejects.delete(groupId);
            }

            break;
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
          case "error":
            this.pendingRejects.get(groupId)?.(payload.error);
            this.loadRejects.get(groupId)?.(payload.error);
            this.cleanup(groupId);
            this.loadResolves.delete(groupId);
            this.loadRejects.delete(groupId);

            break;
        }
      };
    }

    return this.worker;
  }

  private cleanup(groupId: string) {
    this.pendingResolves.delete(groupId);
    this.pendingRejects.delete(groupId);
    this.progressCallbacks.delete(groupId);
    this.chunkCallbacks.delete(groupId);
    this.thinkingCallbacks.delete(groupId);
  }

  async load(
    modelId: string,
    device: string,
    dtypeStrategy: string,
    groupId: string,
    onProgress: (payload: any) => void,
  ): Promise<void> {
    const worker = this.getWorker();

    return new Promise((resolve, reject) => {
      this.loadResolves.set(groupId, resolve);
      this.loadRejects.set(groupId, reject);
      this.progressCallbacks.set(groupId, onProgress);
      worker.postMessage({
        type: "load",
        payload: { modelId, device, dtypeStrategy, groupId },
      });
    });
  }

  async generate(
    messages: any[],
    maxTokens: number,
    groupId: string,
    onChunk: (text: string) => void,
    onThinking?: (text: string) => void,
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
        payload: { messages, maxTokens, groupId },
      });
    });
  }
}

const manager = new TransformersJsManager();

function buildPromptTranscript(systemPrompt: string, messages: any[]): string {
  const lines = ["SYSTEM INSTRUCTIONS:", systemPrompt, "", "CONVERSATION:"];
  for (const msg of messages) {
    const role = msg?.role === "assistant" ? "ASSISTANT" : "USER";
    if (typeof msg?.content === "string") {
      lines.push(`${role}: ${msg.content}`);
    } else if (Array.isArray(msg?.content)) {
      const blocks = msg.content
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

          return "";
        })
        .filter(Boolean)
        .join("\n");
      lines.push(`${role}: ${blocks}`);
    }
  }

  return lines.join("\n");
}

function parseStructured(raw: string) {
  const text = sanitizeModelOutput(String(raw || ""), "transformers_js").trim();
  if (!text) {
    return null;
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
) {
  const activeTools = tools || [];
  const backend =
    (await getConfig(db, CONFIG_KEYS.TRANSFORMERS_JS_BACKEND)) || "cpu";
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

  const jsonInstructions = [
    "Return ONLY valid JSON (no markdown fences).",
    'To call tools: {"type":"tool_use","tool_calls":[{"name":"<tool>","input":{...}}]}',
    'To respond:    {"type":"response","response":"<your answer>"}',
  ].join("\n");

  const toolHints = activeTools
    .map((t) => {
      const params = Object.keys(t.input_schema.properties || {}).join(", ");
      const brief = t.description.split(". ")[0];

      return `${t.name}(${params}): ${brief}`;
    })
    .join("\n");

  let currentMessages = [...messages];

  for (let i = 0; i < 10; i++) {
    const transcript = buildPromptTranscript(systemPrompt, currentMessages);
    const fullPrompt = [
      jsonInstructions,
      "",
      "Available tools:",
      toolHints,
      "",
      transcript,
      "",
      "ASSISTANT:",
    ].join("\n");

    await emit({ type: "streaming-start", payload: { groupId } });

    let thinkingBuffer = "";
    let accumulated = "";
    const response = await manager.generate(
      [fullPrompt],
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
      const output = await executeTool(
        db,
        call.name,
        call.input || {},
        groupId,
        {},
      );
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
