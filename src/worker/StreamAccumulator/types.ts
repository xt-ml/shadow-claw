export type StreamFormat = "openai" | "anthropic" | "mesh-llm";

export interface ContentBlockAccumulator {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  partialJson?: string;
}

export interface StreamCallbacks {
  /** Called with each new text fragment. */
  onText?: (text: string) => void;
  /** Called with each new reasoning/thinking fragment. */
  onThinking?: (text: string) => void;
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
