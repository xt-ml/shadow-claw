import { describe, expect, it } from "@jest/globals";
import { stripChatTemplateControlTokens } from "./chat-template-sanitizer.js";

describe("chat-template-sanitizer", () => {
  it("removes common control tokens from chat templates", () => {
    const raw =
      "<|begin_of_text|><|start_header_id|>assistant<|end_header_id|>Hello<|eot_id|>";

    expect(stripChatTemplateControlTokens(raw)).toBe("Hello");
  });

  it("removes mistral-style instruction wrappers", () => {
    const raw = "<s>[INST] Tell me a joke [/INST]Sure</s>";

    expect(stripChatTemplateControlTokens(raw)).toBe(" Tell me a joke Sure");
  });

  it("preserves normal text", () => {
    const raw = "No special token leakage here.";

    expect(stripChatTemplateControlTokens(raw)).toBe(raw);
  });

  // ── Unambiguous special-token patterns ──────────────────────────────────

  it.each([
    // ChatML family (Qwen, Zephyr, Phi-3, Yi, Nous Hermes, OpenChat, Dolphin,
    // Synthia, Oobabooga, SmolLM)
    [
      "ChatML im_start/im_end",
      "<|im_start|>assistant\nHello<|im_end|>",
      "assistant\nHello",
    ],
    [
      "ChatML Qwen",
      "<|im_start|>user\nHi<|im_end|><|im_start|>assistant\nHello<|im_end|>",
      "user\nHiassistant\nHello",
    ],
    ["Zephyr im_end+</s>", "<|assistant|>Answer</s>", "Answer"],

    // Llama 3 / Gemma header-ID format (Llama 3, Llama 3.2, Gemma 2, Gemma 3)
    [
      "Llama-3 header IDs",
      "<|begin_of_text|><|start_header_id|>assistant<|end_header_id|>Hi<|eot_id|>",
      "Hi",
    ],
    [
      "Gemma-style header IDs",
      "<|start_header_id|>assistant<|end_header_id|>Hello",
      "Hello",
    ],
    [
      "Llama-3 tool header",
      "<|start_header_id|>tool<|end_header_id|>result",
      "result",
    ],

    // Gemma 2 / Gemma 3 turn tokens
    [
      "Gemma start/end_of_turn",
      "<|start_of_turn|>model\nHi<|end_of_turn|>",
      "model\nHi",
    ],
    [
      "Gemma startofturn (no underscore)",
      "<|startofturn|>model\nHi<|endofturn|>",
      "model\nHi",
    ],

    // Llama 2 Chat / Mistral Instruct / Mixtral Instruct
    ["Llama-2 [INST]/[/INST]", "<s>[INST] Hi [/INST]Hello</s>", " Hi Hello"],
    ["Mistral [INST]", "[INST] Explain this [/INST]Sure", " Explain this Sure"],
    [
      "Mixtral BOS+[INST]",
      "<s>[INST] Summarize [/INST]Done</s>",
      " Summarize Done",
    ],
    ["Llama-2 <<SYS>>", "<<SYS>>Be helpful<</SYS>>", "Be helpful"],

    // BOS/EOS markers (Llama 2, Mistral, Falcon, Solar, open-weight models)
    ["bare BOS </s>", "<s>text</s>", "text"],
    ["<|bos|> / <|eos|>", "<|bos|>text<|eos|>", "text"],
    ["<|eot_id|>", "text<|eot_id|>", "text"],
    ["<|end_of_message|>", "text<|end_of_message|>", "text"],

    // Phi-3 / Phi-3.5 / Phi-3 Vision (Microsoft)
    [
      "Phi-3 role tokens",
      "<|system|>instructions<|end|><|user|>hi<|end|><|assistant|>hello<|end|>",
      "instructionshihello",
    ],
    ["Phi-3 endoftext", "done<|endoftext|>", "done"],

    // Command-R / Command-R+ (Cohere)
    [
      "Command-R turn tokens",
      "<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>Hi<|END_OF_TURN_TOKEN|>",
      "Hi",
    ],
    ["Command-R user token", "<|USER_TOKEN|>hi<|END_OF_TURN_TOKEN|>", "hi"],
    [
      "Command-R system token",
      "<|SYSTEM_TOKEN|>sys<|END_OF_TURN_TOKEN|>",
      "sys",
    ],

    // DeepSeek Chat (DeepSeek-V2, DeepSeek-Coder, DeepSeek-R1)
    [
      "DeepSeek sentence markers",
      "<｜begin▁of▁sentence｜>hi<｜end▁of▁sentence｜>",
      "hi",
    ],

    // Vision/tool slot tokens (Llama 3.2 Vision, Gemma 3 multimodal, Qwen-VL)
    ["image slot token", "<|image|>describe this", "describe this"],
    ["tool_call token", "<|tool_call|>{}", "{}"],
    [
      "function_call wrapper",
      '<|function_call|>{"name":"read_file"}<|/function_call|>',
      '{"name":"read_file"}',
    ],

    // Fullwidth-pipe variants (Qwen-VL, Baichuan, Yi CJK tokenisers)
    [
      "fullwidth pipe im_start",
      "<｜im_start｜>assistant\nHi<｜im_end｜>",
      "assistant\nHi",
    ],

    // Harmony (custom/ShadowClaw local templates)
    [
      "Harmony role sentinel",
      "<|start|>assistant<|message|>Hi there",
      "Hi there",
    ],
  ])("%s", (_name, raw, expected) => {
    expect(stripChatTemplateControlTokens(raw)).toBe(expected);
  });

  // ── Patterns that must NOT be stripped (false-positive guard) ────────────

  it.each([
    // Alpaca / instruction-format role headings are plain text — do not strip
    ["Alpaca ### Instruction:", "### Instruction: Do X\n### Response: Did X"],
    // Vicuna / ShareGPT-style role prefixes are plain text — do not strip
    ["Vicuna USER:/ASSISTANT:", "USER: hi\nASSISTANT: hello"],
    // Users can write things like "<user>" in conversation naturally
    ["generic XML user tag in content", "The <user> typed something."],
    // Normal prose must never be touched
    ["plain prose unchanged", "No special token leakage here."],
    ["code with angle brackets", "if (a < b && c > d) return;"],
    ["markdown headers", "## Summary\n### Details"],
  ])("%s — not stripped", (_name, text) => {
    expect(stripChatTemplateControlTokens(text)).toBe(text);
  });
});
