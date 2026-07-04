import {
  AutoModelForCausalLM,
  AutoProcessor,
  AutoTokenizer,
  TextStreamer,
  env,
} from "@huggingface/transformers";

import {
  getPreferredDtypes,
  normalizeDtypeStrategy,
} from "./transformers-js-load-options.js";

import {
  getHuggingFaceDomain,
  isRemoteEnvironment,
} from "./transformers-js-utils.js";

// Configure Transformers.js
if (isRemoteEnvironment()) {
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  env.useWasmCache = true;

  // Prevent Range-request cache poisoning: the library's get_file_metadata
  // does GET with Range:bytes=0-0 (returns 1 byte, e.g. "{"). Without
  // cache:'no-store', the browser may cache that partial 206 response and
  // serve it for the subsequent full GET, causing JSON.parse("{") to fail.
  const nativeFetch = self.fetch.bind(self);
  (env as any).fetch = (url: string, options: any = {}) => {
    const hdrs = options.headers;
    const hasRange =
      hdrs instanceof Headers
        ? hdrs.has("Range")
        : hdrs && typeof hdrs === "object"
          ? "Range" in hdrs
          : false;

    if (hasRange) {
      return nativeFetch(url, { ...options, cache: "no-store" });
    }

    return nativeFetch(url, options);
  };
} else {
  // In local dev, we might serve models from a local directory
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.useBrowserCache = true;
  env.useWasmCache = true;
}

// Initialize domain mirroring
(async () => {
  try {
    const huggingFaceDomain = await getHuggingFaceDomain();
    if (huggingFaceDomain === "hf-mirror.com") {
      env.remoteHost = "https://hf-mirror.com";
      console.log(
        "Transformers.js: Using Hugging Face mirror:",
        env.remoteHost,
      );
    }
  } catch (err) {
    console.error(
      "Transformers.js: Failed to initialize domain mirroring:",
      err,
    );
  }
})();

let currentDevice: string | null = null;
let currentModelId: string | null = null;
let model: any = null;
let processor: any = null;

async function loadModel(
  modelId: string,
  device: string,
  groupId: string,
  dtypeStrategy: string | undefined,
) {
  if (model && currentModelId === modelId && currentDevice === device) {
    return;
  }

  // Dispose old model if needed
  if (model) {
    try {
      await model.dispose?.();
    } catch (e) {
      console.warn("Failed to dispose old model:", e);
    }
  }

  currentModelId = modelId;
  currentDevice = device;

  self.postMessage({
    payload: {
      groupId,
      message: `Loading ${modelId}...`,
      progress: 0,
      status: "running",
    },
    type: "progress",
  });

  try {
    try {
      processor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: (info: any) => {
          if (info.status === "progress") {
            self.postMessage({
              payload: {
                groupId,
                message: `Downloading processor... ${Math.round(info.progress)}%`,
                progress: info.progress / 100,
                status: "running",
              },
              type: "progress",
            });
          }
        },
      });
    } catch (err) {
      console.warn("AutoProcessor failed, falling back to AutoTokenizer:", err);
      processor = await AutoTokenizer.from_pretrained(modelId, {
        progress_callback: (info: any) => {
          if (info.status === "progress") {
            self.postMessage({
              payload: {
                groupId,
                message: `Downloading tokenizer... ${Math.round(info.progress)}%`,
                progress: info.progress / 100,
                status: "running",
              },
              type: "progress",
            });
          }
        },
      });
    }

    const isWebGPU = device === "webgpu";
    const isWebNN = device.startsWith("webnn");
    const navigatorWithMemory = navigator as Navigator & {
      deviceMemory?: number;
    };

    const deviceMemoryGb =
      typeof navigatorWithMemory.deviceMemory === "number"
        ? navigatorWithMemory.deviceMemory
        : null;

    // Map device to Transformers.js format
    let targetDevice: any = device;
    if (isWebNN) {
      targetDevice = "webnn";
    } else if (isWebGPU) {
      targetDevice = "webgpu";
    } else {
      targetDevice = "wasm";
    }

    const strategy = normalizeDtypeStrategy(dtypeStrategy);
    const dtypeCandidates = getPreferredDtypes(
      device,
      modelId,
      deviceMemoryGb,
      strategy,
    );

    let lastModelLoadError: unknown = null;
    for (const dtype of dtypeCandidates) {
      try {
        model = await AutoModelForCausalLM.from_pretrained(modelId, {
          device: targetDevice,
          dtype,
          progress_callback: (info: any) => {
            if (info.status === "progress") {
              self.postMessage({
                type: "progress",
                payload: {
                  groupId,
                  status: "running",
                  progress: info.progress / 100,
                  message: `Downloading model weights (${dtype})... ${Math.round(info.progress)}%`,
                },
              });
            }
          },
          session_options: {
            logSeverityLevel: 0,
          },
        });

        break;
      } catch (error) {
        lastModelLoadError = error;

        console.warn(
          `Model load failed for dtype '${dtype}', trying next candidate...`,
          error,
        );
      }
    }

    if (!model) {
      const detail =
        lastModelLoadError instanceof Error
          ? lastModelLoadError.message
          : String(lastModelLoadError || "unknown error");

      throw new Error(
        `Failed to load model '${modelId}' with supported browser dtypes (${dtypeCandidates.join(", ")}). Last error: ${detail}`,
      );
    }

    self.postMessage({
      type: "progress",
      payload: {
        groupId,
        message: "Model ready.",
        progress: 1,
        status: "done",
      },
    });
  } catch (err: any) {
    console.error("Failed to load model:", err);
    let errorMessage = err.message || String(err);

    if (errorMessage.includes("401")) {
      errorMessage =
        "HuggingFace returned 401 Unauthorized. This model might be gated (requires login) or the service worker proxy rules are interfering. Please ensure you are not using a gated model or hard-reload to update proxy rules.";
    }

    throw new Error(errorMessage);
  }
}

async function generate(
  messages: any[],
  maxTokens: number,
  groupId: string,
  abortSignal?: AbortSignal,
) {
  if (!model || !processor) {
    throw new Error("Model not loaded");
  }

  const tokenizer = processor.tokenizer || processor;

  // Map ShadowClaw messages to Transformers.js format
  const chatMessages = messages.map((m: any) => {
    let content = m.content;
    if (Array.isArray(content)) {
      content = content
        .map((block: any) => {
          if (block.type === "text") {
            return block.text;
          }

          if (block.type === "tool_use") {
            return `[TOOL_CALL ${block.name}] ${JSON.stringify(block.input)}`;
          }

          if (block.type === "tool_result") {
            if (typeof block.content === "string") {
              return `[TOOL_RESULT] ${block.content}`;
            }

            if (Array.isArray(block.content)) {
              const textParts = block.content
                .filter((b: any) => b.type === "text")
                .map((b: any) => b.text)
                .join("\n");

              return `[TOOL_RESULT] ${textParts || "[image content]"}`;
            }

            return `[TOOL_RESULT] ${JSON.stringify(block.content)}`;
          }

          return "";
        })
        .join("\n");
    }

    return {
      role: m.role === "assistant" ? "assistant" : "user",
      content: content,
    };
  });

  const inputs = tokenizer.apply_chat_template(chatMessages, {
    add_generation_prompt: true,
    return_dict: true,
  });

  let START_THINKING_TOKEN_ID: number | undefined;
  let END_THINKING_TOKEN_ID: number | undefined;

  // Try to encode <think></think> to find token IDs
  try {
    const thinkTokens = tokenizer.encode("<think></think>", {
      add_special_tokens: false,
    });

    if (thinkTokens && thinkTokens.length === 2) {
      START_THINKING_TOKEN_ID = Number(thinkTokens[0]);
      END_THINKING_TOKEN_ID = Number(thinkTokens[1]);
    }
  } catch (e) {
    // Ignore, model might not support it
  }

  // Track whether we are inside a <think>...</think> reasoning trace.
  // Flipped by token_callback_function when the model emits the special
  // thinking boundary tokens (if the model supports them).
  let phase: "thinking" | "answering" = "answering";

  const token_callback_function = (tokens: any) => {
    if (START_THINKING_TOKEN_ID === undefined || !tokens?.length) {
      return;
    }

    switch (Number(tokens[0])) {
      case START_THINKING_TOKEN_ID:
        phase = "thinking";

        break;
      case END_THINKING_TOKEN_ID:
        phase = "answering";

        break;
    }
  };

  let streamedText = "";
  const trackingStreamer = new TextStreamer(tokenizer, {
    callback_function: (text: string) => {
      if (phase === "thinking") {
        // Route reasoning trace to a separate channel so the provider
        // can surface it in the activity log instead of the chat stream.
        self.postMessage({
          payload: { groupId, text },
          type: "thinking-chunk",
        });
      } else {
        streamedText += text;
        self.postMessage({
          payload: { groupId, text },
          type: "chunk",
        });
      }
    },
    skip_prompt: true,
    skip_special_tokens: true,
    token_callback_function,
  });

  await model.generate({
    ...inputs,
    max_new_tokens: maxTokens,
    signal: abortSignal,
    streamer: trackingStreamer,
  });

  self.postMessage({
    payload: { groupId, text: streamedText },
    type: "done",
  });
}

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case "load":
        await loadModel(
          payload.modelId,
          payload.device,
          payload.groupId,
          payload.dtypeStrategy,
        );

        break;
      case "generate":
        await generate(payload.messages, payload.maxTokens, payload.groupId);

        break;
      case "dispose":
        if (model) {
          await model.dispose?.();
          model = null;
          processor = null;
          currentModelId = null;
          currentDevice = null;
        }

        break;
    }
  } catch (error: any) {
    self.postMessage({
      type: "error",
      payload: {
        error: error.message || String(error),
        groupId: payload?.groupId,
      },
    });
  }
};
