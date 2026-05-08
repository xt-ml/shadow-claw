/**
 * Strip control tokens that can leak into model output when a provider/model
 * pair is mismatched or a small local model hallucinates its own turn markers.
 *
 * SCOPE: Only unambiguous special-token syntax is stripped — patterns that
 * cannot appear in normal user prose. Plain-text role prefixes ("USER:",
 * "### Instruction:", etc.) are intentionally NOT stripped here because they
 * are legitimate text that users and models generate intentionally.
 *
 * The tokens below are grouped by the model families that define them. Each
 * pattern is exact: a false positive would silently corrupt real content, so
 * we prefer false negatives (leaving a stray token visible) over false
 * positives (deleting real text).
 */

// ── Unambiguous special-token patterns (safe to strip) ──────────────────────

/** Llama 3, Gemma: <|start_header_id|>{role}<|end_header_id|> */
const LLAMA3_GEMMA_HEADER =
  /<\|start_header_id\|>\s*(?:system|user|assistant|tool)\s*<\|end_header_id\|>/gi;

/**
 * ChatML (OpenAI open-source, Qwen, Zephyr, Phi-3, Yi, Nous Hermes, OpenChat,
 * Dolphin, Synthia, Oobabooga, text-gen-webui, SmolLM):
 * <|im_start|>, <|im_end|> and structural BOS/EOS tokens.
 */
const CHATML_TOKENS =
  /<\|(?:begin_of_text|end_of_text|eot_id|im_start|im_end|end_of_message)\|>/gi;

/**
 * Gemma 2 / Gemma 3 turn tokens (used by Google's Gemma and Gemma 2 families,
 * including Gemma multimodal and Gemma 3 vision variants):
 * <|start_of_turn|>, <|end_of_turn|> (and underscore-free variants).
 */
const GEMMA_TURN_TOKENS =
  /<\|(?:startofturn|endofturn|start_of_turn|end_of_turn)\|>/gi;

/**
 * Llama 3.2 Vision, Gemma 3 multimodal and other vision-capable variants that
 * insert image-slot or tool sentinel tokens into the sequence.
 */
const VISION_TOOL_TOKENS =
  /<\|(?:image|audio|video|tool_call|tool_response|tool_result|function_call)\|>|<\|\/function_call\|>/gi;

/**
 * Fullwidth-pipe variants emitted by some CJK-oriented tokenizers
 * (Qwen-VL, Baichuan, some Yi checkpoints).
 */
const FULLWIDTH_PIPE_TOKENS =
  /<｜(?:system|user|assistant|im_start|im_end)｜>/g;

/**
 * Llama 2 Chat, Mistral Instruct, Mixtral Instruct:
 * [INST] … [/INST] and <<SYS>> … <</SYS>>.
 */
const LLAMA2_MISTRAL_TOKENS =
  /\[\s*INST\s*\]|\[\s*\/INST\s*\]|<<\s*SYS\s*>>|<<\s*\/SYS\s*>>/gi;

/**
 * BOS/EOS wrappers used by Llama 2, Mistral, Falcon, Solar, and many
 * HuggingFace-hosted open models. The bare <s> / </s> tokens appear when a
 * model generation accidentally includes sequence-boundary markers.
 */
const BOS_EOS_TOKENS = /<\/?s>|<\/?bos>|<\/?eos>|<\|(?:bos|eos|pad|unk)\|>/gi;

/**
 * Command-R / Command-R+ (Cohere):
 * <|START_OF_TURN_TOKEN|>, <|END_OF_TURN_TOKEN|>,
 * <|CHATBOT_TOKEN|>, <|USER_TOKEN|>, <|SYSTEM_TOKEN|>.
 */
const COMMAND_R_TOKENS =
  /<\|(?:START_OF_TURN_TOKEN|END_OF_TURN_TOKEN|CHATBOT_TOKEN|USER_TOKEN|SYSTEM_TOKEN)\|>/gi;

/**
 * Phi-3 / Phi-3.5 / Phi-3 Vision (Microsoft):
 * <|system|>, <|user|>, <|assistant|>, <|end|>, <|endoftext|>, <|placeholder{n}|>.
 */
const PHI3_TOKENS =
  /<\|(?:system|user|assistant|end|endoftext|placeholder\d*)\|>/gi;

/**
 * DeepSeek Chat (DeepSeek-V2, DeepSeek-Coder, DeepSeek-R1):
 * <｜begin▁of▁sentence｜>, <｜end▁of▁sentence｜>, User:, Assistant:
 * NOTE: only the unambiguous tokeniser-level markers are stripped here.
 */
const DEEPSEEK_TOKENS = /<｜(?:begin▁of▁sentence|end▁of▁sentence)｜>/g;

/**
 * Harmony style role sentinels (internal ShadowClaw / custom Jinja templates
 * that may be exposed via local deployments).
 */
const HARMONY_TOKENS =
  /<\|start\|>\s*(?:system|user|assistant|tool)\s*<\|message\|>/gi;

const ALL_PATTERNS: RegExp[] = [
  LLAMA3_GEMMA_HEADER,
  CHATML_TOKENS,
  GEMMA_TURN_TOKENS,
  VISION_TOOL_TOKENS,
  FULLWIDTH_PIPE_TOKENS,
  LLAMA2_MISTRAL_TOKENS,
  BOS_EOS_TOKENS,
  COMMAND_R_TOKENS,
  PHI3_TOKENS,
  DEEPSEEK_TOKENS,
  HARMONY_TOKENS,
];

export function stripChatTemplateControlTokens(text: string): string {
  let cleaned = String(text || "");

  for (const pattern of ALL_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse whitespace-only lines left behind by stripped tokens,
  // and compress runs of 3+ blank lines to 2.
  cleaned = cleaned.replace(/^[ \t]+$/gm, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned;
}

/**
 * Detect-and-strip wrapper used at every provider response boundary.
 *
 * If the text is clean the function returns it unchanged with no allocation.
 * If control tokens are found they are stripped and a `console.info` message
 * is emitted so developers can see which provider/model is leaking tokens.
 * This is intentionally a fallback: well-configured providers (Ollama,
 * llamafile server/CLI, Transformers.js with `skip_special_tokens`) should
 * never reach this path.
 *
 * @param text   Raw model output text.
 * @param source Human-readable provider/context label for the log message
 *               (e.g. "ollama", "llamafile", "transformers_js", "prompt_api").
 */
export function sanitizeModelOutput(text: string, source: string): string {
  const cleaned = stripChatTemplateControlTokens(text);
  if (cleaned !== text) {
    console.info(
      `[ShadowClaw] Chat-template control token(s) detected and stripped from "${source}" output. ` +
        `The provider or model may not be applying its chat template correctly. ` +
        `Original length: ${text.length}, cleaned length: ${cleaned.length}.`,
    );
  }

  return cleaned;
}
