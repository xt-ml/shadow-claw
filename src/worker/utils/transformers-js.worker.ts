import {
  AutoModelForCausalLM,
  AutoProcessor,
  AutoTokenizer,
  TextStreamer,
  env,
} from "@huggingface/transformers";

import {
  createModelCacheFetch,
  normalizeMessagesForChatTemplate,
  mapToolsForChatTemplate,
} from "../../subsystems/providers/utils/index.js";

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
  // Disable Transformers.js's own browser cache: createModelCacheFetch handles
  // all caching via shadow-claw-browser-models (chunked, resumable). Leaving
  // useBrowserCache=true would write a second copy of every model file into
  // Transformers.js's own `transformers-cache`, doubling quota usage.
  env.useBrowserCache = false;
  env.useWasmCache = true;

  // Intercept fetch to use chunked disk-backed CacheStorage and prevent Range-request cache poisoning
  (env as any).fetch = createModelCacheFetch(self.fetch.bind(self));
} else {
  // In local dev, we might serve models from a local directory
  env.allowLocalModels = true;
  env.allowRemoteModels = true;
  env.useBrowserCache = false; // same rationale as above
  env.useWasmCache = true;
  (env as any).fetch = createModelCacheFetch(self.fetch.bind(self));
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

    let targetDevice: any = device;
    if (device === "auto") {
      let hasGpu = false;
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter({
            powerPreference: "high-performance",
          });
          if (
            adapter &&
            adapter.isFallbackAdapter !== true &&
            (!adapter.features || adapter.features.has("shader-f16"))
          ) {
            const info =
              adapter.info ||
              (typeof adapter.requestAdapterInfo === "function"
                ? await adapter.requestAdapterInfo()
                : null);
            const vendor = (info?.vendor || "").toLowerCase();
            const arch = (info?.architecture || "").toLowerCase();
            const desc = (info?.description || "").toLowerCase();
            const dev = (info?.device || "").toLowerCase();
            const adapterType = (
              (info as any)?.adapterType ||
              (info as any)?.deviceType ||
              (info as any)?.type ||
              ""
            ).toLowerCase();

            if (
              adapterType !== "cpu" &&
              adapterType !== "software" &&
              arch !== "swiftshader" &&
              arch !== "llvmpipe" &&
              arch !== "softpipe" &&
              arch !== "lavapipe" &&
              arch !== "cpu" &&
              !vendor.includes("swiftshader") &&
              !desc.includes("llvmpipe") &&
              !desc.includes("softpipe") &&
              !desc.includes("lavapipe") &&
              !desc.includes("software") &&
              !desc.includes("basic render") &&
              !dev.includes("llvmpipe") &&
              !dev.includes("softpipe") &&
              !dev.includes("lavapipe") &&
              !dev.includes("swiftshader") &&
              !dev.includes("basic render")
            ) {
              hasGpu = true;
            }
          }
        } catch {
          hasGpu = false;
        }
      }
      targetDevice = hasGpu ? "webgpu" : "wasm";
    } else if (isWebNN) {
      targetDevice = "webnn";
    } else if (isWebGPU) {
      targetDevice = "webgpu";
    } else {
      targetDevice = "wasm";
    }

    const strategy = normalizeDtypeStrategy(dtypeStrategy);
    const dtypeCandidates = getPreferredDtypes(
      targetDevice,
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

    if (!model && (targetDevice === "webgpu" || targetDevice === "webnn")) {
      console.warn(
        `Hardware accelerated backend (${targetDevice}) failed. Retrying with CPU/WASM fallback (q4)...`,
      );
      targetDevice = "wasm";
      const wasmCandidates = getPreferredDtypes(
        "wasm",
        modelId,
        deviceMemoryGb,
        strategy,
      );
      for (const dtype of wasmCandidates) {
        try {
          model = await AutoModelForCausalLM.from_pretrained(modelId, {
            device: "wasm",
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
            `WASM fallback load failed for dtype '${dtype}', trying next candidate...`,
            error,
          );
        }
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
  tools?: any[],
  abortSignal?: AbortSignal,
) {
  if (!model || !processor) {
    throw new Error("Model not loaded");
  }

  const tokenizer = processor.tokenizer || processor;

  const chatMessages = normalizeMessagesForChatTemplate(messages);
  const mappedTools = mapToolsForChatTemplate(tools);

  const inputs = tokenizer.apply_chat_template(chatMessages, {
    add_generation_prompt: true,
    return_dict: true,
    ...(mappedTools ? { tools: mappedTools } : {}),
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
        await generate(
          payload.messages,
          payload.maxTokens,
          payload.groupId,
          payload.tools,
        );

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
