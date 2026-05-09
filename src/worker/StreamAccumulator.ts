import { sanitizeModelOutput } from "../chat-template-sanitizer.js";

/**
 * Accumulates streamed SSE chunks into a unified response object.
 *
 * Supports both OpenAI-format (choices[].delta) and Anthropic-format
 * (content_block_start / content_block_delta / message_delta) SSE streams.
 *
 * Emits callbacks for incremental text and tool-call progress.
 */

export interface StreamCallbacks {
  /** Called with each new text fragment. */
  onText?: (text: string) => void;
  /** Called when a tool_use block begins. */
  onToolStart?: (name: string) => void;
  /** Called when final usage data is available. */
  onUsage?: (usage: { input_tokens?: number; output_tokens?: number }) => void;
  /**
   * Provider/context label passed to the sanitizer log message so developers
   * can identify which model is leaking chat-template control tokens.
   * Defaults to the stream format ("openai" or "anthropic") when not provided.
   */
  source?: string;
}

export type StreamFormat = "openai" | "anthropic";

export interface ContentBlockAccumulator {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  partialJson?: string;
}

export class StreamAccumulator {
  public format: StreamFormat;
  public callbacks: StreamCallbacks;
  public contentBlocks: ContentBlockAccumulator[] = [];
  public stopReason: string = "end_turn";
  public usage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 0,
    output_tokens: 0,
  };

  // -- OpenAI accumulators --
  private _openaiToolCalls = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  private _openaiText: string = "";

  // -- Anthropic accumulators --
  private _anthropicBlocks = new Map<number, ContentBlockAccumulator>();

  constructor(format: StreamFormat, callbacks: StreamCallbacks = {}) {
    this.format = format;
    this.callbacks = callbacks;
  }

  private _sanitize(text: string): string {
    return sanitizeModelOutput(text, this.callbacks.source ?? this.format);
  }

  /**
   * Feed a single parsed SSE chunk into the accumulator.
   */
  push(chunk: any): void {
    if (this.format === "openai") {
      this._pushOpenAI(chunk);
    } else {
      this._pushAnthropic(chunk);
    }
  }

  /**
   * Build the final normalized response (same shape as parseResponse).
   */
  finalize(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    if (this.format === "openai") {
      return this._finalizeOpenAI();
    }

    return this._finalizeAnthropic();
  }

  // ── OpenAI streaming ─────────────────────────────────────────────

  private _pushOpenAI(chunk: any): void {
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
      const cleaned = this._sanitize(delta.content);
      if (cleaned) {
        this._openaiText += cleaned;
        this.callbacks.onText?.(cleaned);
      }
    }

    // Accumulate tool calls
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;

        if (!this._openaiToolCalls.has(idx)) {
          this._openaiToolCalls.set(idx, {
            id: tc.id || "",
            name: tc.function?.name || "",
            args: "",
          });

          if (tc.function?.name) {
            this.callbacks.onToolStart?.(tc.function.name);
          }
        }

        const existing = this._openaiToolCalls.get(idx);
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

  private _finalizeOpenAI(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    const content: any[] = [];

    if (this._openaiText) {
      const cleaned = this._sanitize(this._openaiText);
      if (cleaned) {
        content.push({ type: "text", text: cleaned });
      }
    }

    if (this._openaiToolCalls.size > 0) {
      this.stopReason = "tool_use";

      for (const [, tc] of [...this._openaiToolCalls.entries()].sort(
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

  // ── Anthropic streaming ──────────────────────────────────────────

  private _pushAnthropic(chunk: any): void {
    switch (chunk.type) {
      case "message_start": {
        if (chunk.message?.usage) {
          this.usage.input_tokens = chunk.message.usage.input_tokens || 0;
        }

        break;
      }

      case "content_block_start": {
        const idx = chunk.index ?? this._anthropicBlocks.size;
        const block = chunk.content_block || {};

        this._anthropicBlocks.set(idx, {
          type: block.type || "text",
          id: block.id,
          name: block.name,
          text: block.text || "",
          partialJson: block.type === "tool_use" ? "" : undefined,
        });

        if (block.type === "tool_use" && block.name) {
          this.callbacks.onToolStart?.(block.name);
        }

        break;
      }

      case "content_block_delta": {
        const idx = chunk.index ?? 0;
        const block = this._anthropicBlocks.get(idx);
        if (!block) {
          break;
        }

        const delta = chunk.delta;
        if (!delta) {
          break;
        }

        if (delta.type === "text_delta" && typeof delta.text === "string") {
          const cleaned = this._sanitize(delta.text);
          if (!cleaned) {
            break;
          }

          block.text = (block.text || "") + cleaned;
          this.callbacks.onText?.(cleaned);
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

  private _finalizeAnthropic(): {
    content: any[];
    stop_reason: string;
    usage: { input_tokens: number; output_tokens: number };
  } {
    const content: any[] = [];

    for (const [, block] of [...this._anthropicBlocks.entries()].sort(
      (a, b) => a[0] - b[0],
    )) {
      if (block.type === "text") {
        const cleaned = this._sanitize(block.text || "");
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
      }
    }

    return {
      content,
      stop_reason: this.stopReason,
      usage: { ...this.usage },
    };
  }
}
