import { ToolDefinition } from "./types.js";

export const summarize_text: ToolDefinition = {
  name: "summarize_text",
  description:
    "Summarize text using Web Platform's Summarizer API (or polyfill fallback). Produces key points, TLDR, teaser, or headline.",
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
      preference: {
        type: "string",
        enum: ["capability", "speed", "auto"],
        description: "Summarizer performance preference (default: auto).",
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
    "Generate or draft text using Web Platform's Writer API (or polyfill fallback).",
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
    "Rewrite or rephrase text using Web Platform's Rewriter API (or polyfill fallback). Can adjust tone or length.",
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

export const proofread_text: ToolDefinition = {
  name: "proofread_text",
  description:
    "Proofread and correct grammar, spelling, and phrasing errors using Web Platform's Proofreader API (or polyfill fallback).",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to proofread.",
      },
      context: {
        type: "string",
        description: "Optional background context for proofreading.",
      },
    },
    required: ["text"],
  },
};

export const detect_language: ToolDefinition = {
  name: "detect_language",
  description:
    "Detect the language of input text using Web Platform's Language Detector API (or polyfill fallback).",
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
    "Translate text using Web Platform's Translator API (or polyfill fallback).",
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

export const embed_text: ToolDefinition = {
  name: "embed_text",
  description:
    "Generate semantic vector embeddings for input text using Web Platform's Semantic Embedder API.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        description: "The text string or array of text strings to embed.",
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
      },
      taskType: {
        type: "string",
        enum: [
          "semantic-similarity",
          "retrieval-query",
          "retrieval-document",
          "classification",
          "clustering",
        ],
        description: "Optional task type optimization hint.",
      },
    },
    required: ["text"],
  },
};
