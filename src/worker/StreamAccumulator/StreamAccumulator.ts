import { sanitizeModelOutput } from "../../content/chat-template-sanitizer.js";

import type { ContentBlockAccumulator, StreamCallbacks, StreamFormat } from "./types.js";

/**
 * Accumulates streamed SSE chunks into a unified response object.
 *
 * Supports both OpenAI-format (choices[].delta) and Anthropic-format
 * (content_block_start / content_block_delta / message_delta) SSE streams.
 *
 * Emits callbacks for incremental text and tool-call progress.
 */
export class StreamAccumulator {
  callbacks: StreamCallbacks;
  contentBlocks: ContentBlockAccumulator[] = [];
  format: StreamFormat;
  stopReason: string = "end_turn";
  usage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 0,
    output_tokens: 0,
  };

  #anthropicBlocks = new Map<number, ContentBlockAccumulator>();

  #openaiReasoningText: string = "";
  #openaiText: string = "";
  #openaiToolCalls = new Map<
    number,
    { id: string; name: string; args: string }
  >();

  constructor(format: StreamFormat, callbacks: StreamCallbacks = {}) {
    this.format = format;
    this.callbacks = callbacks;
  }

  /**
   * Build the final normalized response (same shape as parseResponse).
   */
  finalize(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    if (this.format === "openai" || this.format === "mesh-llm") {
      return this.#finalizeOpenAI();
    }

    return this.#finalizeAnthropic();
  }

  /**
   * Feed a single parsed SSE chunk into the accumulator.
   */
  push(chunk: any): void {
    if (this.format === "openai" || this.format === "mesh-llm") {
      this.#pushOpenAI(chunk);
    } else {
      this.#pushAnthropic(chunk);
    }
  }

  #finalizeAnthropic(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    const content: any[] = [];

    for (const [, block] of [...this.#anthropicBlocks.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      if (block.type === "text") {
        const cleaned = this.#sanitize(block.text || "");
        if (cleaned) {
          content.push({ type: "text", text: cleaned });
        }
      } else if (block.type === "tool_use") {
        let input;
        try {
          input = block.partialJson ? JSON.parse(block.partialJson) : {};
        } catch {
          input = {};
        }

        content.push({
          type: "tool_use",
          id: block.id || `call_${Date.now()}_${Math.random()}`,
          name: block.name,
          input,
        });
      } else if (block.type === "thinking") {
        if (typeof block.text === "string" && block.text.length > 0) {
          content.push({
            type: "thinking",
            thinking: block.text,
            ...(typeof block.id === "string" ? { signature: block.id } : {}),
          });
        }
      } else if (block.type === "redacted_thinking") {
        if (typeof block.text === "string" && block.text.length > 0) {
          content.push({
            type: "redacted_thinking",
            data: block.text,
          });
        }
      }
    }

    return {
      content,
      stop_reason: this.stopReason,
      usage: { ...this.usage },
    };
  }

  #finalizeOpenAI(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    const content: any[] = [];

    if (this.#openaiText) {
      const cleaned = this.#sanitize(this.#openaiText);
      if (cleaned) {
        content.push({ type: "text", text: cleaned });
      }
    }

    if (this.#openaiReasoningText) {
      content.unshift({
        type: "thinking",
        thinking: this.#openaiReasoningText,
      });
    }

    if (this.#openaiToolCalls.size > 0) {
      this.stopReason = "tool_use";

      for (const [, tc] of [...this.#openaiToolCalls.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        let input;
        try {
          input = tc.args ? JSON.parse(tc.args) : {};
        } catch {
          input = {};
        }

        content.push({
          type: "tool_use",
          id: tc.id || `call_${Date.now()}_${Math.random()}`,
          name: tc.name,
          input,
        });
      }
    }

    return {
      content,
      stop_reason: this.stopReason,
      usage: { ...this.usage },
    };
  }

  #pushAnthropic(chunk: any): void {
    switch (chunk.type) {
      case "message_start": {
        if (chunk.message?.usage) {
          this.usage.input_tokens = chunk.message.usage.input_tokens || 0;
        }

        break;
      }

      case "content_block_start": {
        const idx = chunk.index ?? this.#anthropicBlocks.size;
        const block = chunk.content_block || {};

        this.#anthropicBlocks.set(idx, {
          type: block.type || "text",
          id: block.type === "thinking" ? block.signature : block.id,
          name: block.name,
          text: block.text || block.thinking || block.data || "",
          partialJson: block.type === "tool_use" ? "" : undefined,
        });

        if (block.type === "tool_use" && block.name) {
          this.callbacks.onToolStart?.(block.name);
        }

        break;
      }

      case "content_block_delta": {
        const idx = chunk.index ?? 0;
        let block = this.#anthropicBlocks.get(idx);
        if (!block) {
          const inferredType =
            chunk.delta?.type === "input_json_delta" ? "tool_use" : "text";

          block = {
            type: inferredType,
            text: inferredType === "text" ? "" : undefined,
            partialJson: inferredType === "tool_use" ? "" : undefined,
          };

          this.#anthropicBlocks.set(idx, block);
        }

        const delta = chunk.delta;
        if (!delta) {
          break;
        }

        if (delta.type === "text_delta" && typeof delta.text === "string") {
          const cleaned = this.#sanitize(delta.text);
          if (!cleaned) {
            break;
          }

          block.text = (block.text || "") + cleaned;
          this.callbacks.onText?.(cleaned);
        }

        if (
          delta.type === "thinking_delta" &&
          typeof delta.thinking === "string"
        ) {
          block.type = "thinking";
          block.text = (block.text || "") + delta.thinking;
          this.callbacks.onThinking?.(delta.thinking);
        }

        if (
          delta.type === "signature_delta" &&
          typeof delta.signature === "string"
        ) {
          block.type = "thinking";
          block.id = delta.signature;
        }

        if (
          delta.type === "redacted_thinking_delta" &&
          typeof delta.data === "string"
        ) {
          block.type = "redacted_thinking";
          block.text = (block.text || "") + delta.data;
        }

        if (
          delta.type === "input_json_delta" &&
          typeof delta.partial_json === "string"
        ) {
          block.partialJson = (block.partialJson || "") + delta.partial_json;
        }

        break;
      }

      case "content_block_stop":
        // No action needed; block is already accumulated

        break;

      case "message_delta": {
        if (chunk.delta?.stop_reason) {
          this.stopReason = chunk.delta.stop_reason;
        }

        if (chunk.usage) {
          this.usage.output_tokens = chunk.usage.output_tokens || 0;
          this.callbacks.onUsage?.(this.usage);
        }

        break;
      }

      case "message_stop":
        break;

      default:
        // Ignore ping, error events, etc.

        break;
    }
  }

  #pushOpenAI(chunk: any): void {
    // Handle usage in the final chunk (OpenAI includes it when stream_options.include_usage is set,
    // or in the last chunk for some providers)
    if (chunk.usage) {
      this.usage.input_tokens = chunk.usage.prompt_tokens || 0;
      this.usage.output_tokens = chunk.usage.completion_tokens || 0;
      this.callbacks.onUsage?.(this.usage);
    }

    const choice = chunk.choices?.[0];
    if (!choice) {
      return;
    }

    const delta = choice.delta;
    if (!delta) {
      return;
    }

    // Accumulate text content
    if (typeof delta.content === "string") {
      const cleaned = this.#sanitize(delta.content);
      if (cleaned) {
        this.#openaiText += cleaned;
        this.callbacks.onText?.(cleaned);
      }
    }

    // Accumulate reasoning content from OpenAI-compatible providers that expose
    // thought tokens separately from user-visible assistant text.
    if (typeof delta.reasoning === "string") {
      this.#openaiReasoningText += delta.reasoning;
      this.callbacks.onThinking?.(delta.reasoning);
    } else if (delta.reasoning && typeof delta.reasoning === "object") {
      const reasoningObj: any = delta.reasoning;
      if (typeof reasoningObj.content === "string") {
        this.#openaiReasoningText += reasoningObj.content;
        this.callbacks.onThinking?.(reasoningObj.content);
      } else if (typeof reasoningObj.text === "string") {
        this.#openaiReasoningText += reasoningObj.text;
        this.callbacks.onThinking?.(reasoningObj.text);
      }
    }

    // Accumulate tool calls
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;

        if (!this.#openaiToolCalls.has(idx)) {
          this.#openaiToolCalls.set(idx, {
            id: tc.id || "",
            name: tc.function?.name || "",
            args: "",
          });

          if (tc.function?.name) {
            this.callbacks.onToolStart?.(tc.function.name);
          }
        }

        const existing = this.#openaiToolCalls.get(idx);
        if (!existing) {
          continue;
        }

        if (tc.id) {
          existing.id = tc.id;
        }

        if (tc.function?.name) {
          existing.name = tc.function.name;
        }

        if (tc.function?.arguments) {
          existing.args += tc.function.arguments;
        }
      }
    }

    // Capture finish reason
    if (choice.finish_reason) {
      if (choice.finish_reason === "tool_calls") {
        this.stopReason = "tool_use";
      } else if (choice.finish_reason === "stop") {
        this.stopReason = "end_turn";
      } else {
        this.stopReason = choice.finish_reason;
      }
    }
  }

  #sanitize(text: string): string {
    return sanitizeModelOutput(text, this.callbacks.source ?? this.format);
  }
}
