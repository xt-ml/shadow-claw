import type { OpenApiPathItem } from "../types.js";

export const proxyPaths: Record<string, OpenApiPathItem> = {
  "/bedrock-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Bedrock Models",
      description:
        "Lists supported AWS Bedrock foundation models and inference profiles.",
      responses: {
        "200": {
          description: "Model list",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/bedrock-proxy/invoke": {
    post: {
      tags: ["Model Proxies"],
      summary: "Invoke Bedrock Model",
      description:
        "Proxies an inference invocation request to AWS Bedrock Runtime.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Inference response stream or JSON",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/gemini-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Gemini Models",
      description: "Lists Google Gemini generative models.",
      responses: {
        "200": {
          description: "Model catalog",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/gemini-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Gemini Chat Completions",
      description:
        "Translates and proxies OpenAI-compatible chat completion requests to Google Gemini.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Chat completion result",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/vertex-ai-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Vertex AI Models",
      description: "Lists models available through Google Cloud Vertex AI.",
      responses: {
        "200": {
          description: "Model catalog",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/vertex-ai-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Vertex AI Chat Completions",
      description:
        "Proxies OpenAI-compatible chat completions to Google Cloud Vertex AI.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Chat completion result",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/ollama-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Ollama Models",
      description: "Lists local models from the Ollama engine.",
      responses: {
        "200": {
          description: "Model list",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/ollama-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Ollama Chat Completions",
      description: "Proxies chat completions to a local Ollama instance.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Chat completion output",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/llamafile-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Llamafile Models",
      description: "Lists models served by local Llamafile binaries.",
      responses: {
        "200": {
          description: "Model list",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/llamafile-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Llamafile Chat Completions",
      description:
        "Proxies chat completions to a locally managed Llamafile process.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Completion output",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/llamafile-proxy/cancel": {
    post: {
      tags: ["Model Proxies"],
      summary: "Cancel Llamafile Request",
      description: "Aborts an ongoing Llamafile inference generation.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": { description: "Request cancelled" },
      },
    },
  },
  "/transformers-js-proxy/status": {
    get: {
      tags: ["Model Proxies"],
      summary: "Transformers.js Engine Status",
      description:
        "Checks initialization status and downloaded weights for the in-process Transformers.js runtime.",
      responses: {
        "200": {
          description: "Engine status",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/transformers-js-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Transformers.js Models",
      description: "Lists available local ONNX/Transformers.js models.",
      responses: {
        "200": {
          description: "Model list",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/transformers-js-proxy/prewarm": {
    post: {
      tags: ["Model Proxies"],
      summary: "Prewarm Transformers.js Model",
      description:
        "Loads and pre-compiles model weights into memory ahead of inference.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": { description: "Prewarming complete" },
      },
    },
  },
  "/transformers-js-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Transformers.js Chat Completions",
      description: "Executes in-process local inference via Transformers.js.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Completion stream or response",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/mesh-llm-proxy/models": {
    get: {
      tags: ["Model Proxies"],
      summary: "List Mesh LLM Models",
      description:
        "Lists models available across the peer-to-peer WebRTC mesh network.",
      responses: {
        "200": {
          description: "Catalog of mesh peer models",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/mesh-llm-proxy/chat/completions": {
    post: {
      tags: ["Model Proxies"],
      summary: "Mesh LLM Chat Completions",
      description:
        "Dispatches an inference request to an available WebRTC mesh peer worker.",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        "200": {
          description: "Inference response",
          content: {
            "application/json": { schema: { type: "object" } },
            "text/event-stream": { schema: { type: "string" } },
          },
        },
      },
    },
  },
  "/proxy": {
    get: {
      tags: ["HTTP Proxies"],
      summary: "Generic HTTP Proxy (GET)",
      description:
        "Proxies arbitrary external GET requests to bypass CORS limitations.",
      responses: {
        "200": { description: "Proxied HTTP response" },
      },
    },
    post: {
      tags: ["HTTP Proxies"],
      summary: "Generic HTTP Proxy (POST)",
      description:
        "Proxies arbitrary external POST requests to bypass CORS limitations.",
      responses: {
        "200": { description: "Proxied HTTP response" },
      },
    },
  },
  "/git-proxy": {
    post: {
      tags: ["HTTP Proxies"],
      summary: "Git Smart HTTP Proxy",
      description:
        "Proxies git fetch, clone, and push operations for isomorphic-git client operations.",
      responses: {
        "200": { description: "Git pack/info response" },
      },
    },
  },
  "/telegram": {
    post: {
      tags: ["HTTP Proxies"],
      summary: "Telegram Bot API Proxy",
      description: "Proxies requests to the Telegram Bot API.",
      responses: {
        "200": { description: "Telegram Bot API response" },
      },
    },
  },
};
