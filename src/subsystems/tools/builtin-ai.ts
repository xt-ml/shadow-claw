import { ToolDefinition } from "./types.js";

export const summarize_text: ToolDefinition = {
  name: "summarize_text",
  description:
    "Summarize text using Chrome's Built-in AI Summarizer API (or polyfill fallback). Produces key points, TLDR, teaser, or headline.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text content to summarize.",
      },
      type: {
        type: "string",
        enum: ["key-points", "tldr", "teaser", "headline"],
        description: "The summary type (default: key-points).",
      },
      format: {
        type: "string",
        enum: ["plain-text", "markdown"],
        description: "Output format (default: markdown).",
      },
      length: {
        type: "string",
        enum: ["short", "medium", "long"],
        description: "Summary length (default: short).",
      },
      context: {
        type: "string",
        description: "Optional background context for summarization.",
      },
    },
    required: ["text"],
  },
};

export const write_text: ToolDefinition = {
  name: "write_text",
  description:
    "Generate or draft text using Chrome's Built-in AI Writer API (or polyfill fallback).",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The prompt or writing instructions.",
      },
      context: {
        type: "string",
        description: "Optional background context for writing.",
      },
    },
    required: ["prompt"],
  },
};

export const rewrite_text: ToolDefinition = {
  name: "rewrite_text",
  description:
    "Rewrite or rephrase text using Chrome's Built-in AI Rewriter API (or polyfill fallback). Can adjust tone or length.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to rewrite.",
      },
      tone: {
        type: "string",
        enum: ["as-is", "more-formal", "more-casual"],
        description: "Tone adjustment (default: as-is).",
      },
      length: {
        type: "string",
        enum: ["as-is", "shorter", "longer"],
        description: "Length adjustment (default: as-is).",
      },
      context: {
        type: "string",
        description: "Optional background context for rewriting.",
      },
    },
    required: ["text"],
  },
};

export const detect_language: ToolDefinition = {
  name: "detect_language",
  description:
    "Detect the language of input text using Chrome's Built-in AI Language Detector API (or polyfill fallback).",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to analyze for language detection.",
      },
    },
    required: ["text"],
  },
};

export const translate_text: ToolDefinition = {
  name: "translate_text",
  description:
    "Translate text using Chrome's Built-in AI Translator API (or polyfill fallback).",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to translate.",
      },
      sourceLanguage: {
        type: "string",
        description: "Source language BCP 47 code (e.g. 'en', 'es', 'ja').",
      },
      targetLanguage: {
        type: "string",
        description: "Target language BCP 47 code (e.g. 'en', 'es', 'ja').",
      },
    },
    required: ["text", "sourceLanguage", "targetLanguage"],
  },
};
