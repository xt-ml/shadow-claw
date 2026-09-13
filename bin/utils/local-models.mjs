/**
 * ShadowClaw CLI — Local Model Management
 *
 * Provides curated ONNX models for Transformers.js local Node.js execution,
 * local disk cache verification, and download execution with progress bar feedback.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import tty from "node:tty";

import { createCliProgressBar } from "./progress-bar.mjs";

export const CURATED_LOCAL_MODELS = [
  {
    id: "onnx-community/gemma-3-1b-it-ONNX-GQA",
    name: "Gemma 3 1B GQA (ONNX)",
    description: "Google Gemma 3 1B with Grouped Query Attention (Default)",
    contextLength: 32000,
    supportsTools: true,
    recommended: true,
  },
  {
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    name: "Gemma 4 E2B (ONNX)",
    description: "Google Gemma 4 E2B instruction-tuned ONNX model",
    contextLength: 128000,
    supportsTools: true,
    recommended: false,
  },
  {
    id: "onnx-community/gemma-4-E4B-it-ONNX",
    name: "Gemma 4 E4B (ONNX)",
    description: "Google Gemma 4 E4B instruction-tuned ONNX model",
    contextLength: 128000,
    supportsTools: true,
    recommended: false,
  },
  {
    id: "onnx-community/Qwen3-0.6B-ONNX",
    name: "Qwen 3 0.6B (ONNX)",
    description: "Fast, compact, tool-calling supported 0.6B model",
    contextLength: 32768,
    supportsTools: true,
    recommended: false,
  },
];

export const DEFAULT_LOCAL_MODEL = "onnx-community/gemma-3-1b-it-ONNX-GQA";

export const CURATED_LLAMAFILE_MODELS = [
  {
    id: "mozilla-ai/gemma-4-E2B-it-Q5_K_M.llamafile",
    name: "Gemma 4 E2B Q5_K_M (Llamafile)",
    description: "Google Gemma 4 E2B instruction-tuned Llamafile (Q5_K_M)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/gemma-4-E2B-it-Q5_K_M.llamafile",
    fileName: "gemma-4-E2B-it-Q5_K_M.llamafile",
    contextLength: 128000,
    supportsTools: false,
  },
  {
    id: "mozilla-ai/gemma-4-E4B-it-Q5_K_M.llamafile",
    name: "Gemma 4 E4B Q5_K_M (Llamafile)",
    description: "Google Gemma 4 E4B instruction-tuned Llamafile (Q5_K_M)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/gemma-4-E4B-it-Q5_K_M.llamafile",
    fileName: "gemma-4-E4B-it-Q5_K_M.llamafile",
    contextLength: 128000,
    supportsTools: false,
  },
  {
    id: "mozilla-ai/Qwen3.5-0.8B-Q8_0.llamafile",
    name: "Qwen 3.5 0.8B Q8_0 (Llamafile)",
    description: "Alibaba Qwen 3.5 0.8B Llamafile (Q8_0)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-0.8B-Q8_0.llamafile",
    fileName: "Qwen3.5-0.8B-Q8_0.llamafile",
    contextLength: 32768,
    supportsTools: false,
  },
  {
    id: "mozilla-ai/Qwen3.5-2B-Q8_0.llamafile",
    name: "Qwen 3.5 2B Q8_0 (Llamafile)",
    description: "Alibaba Qwen 3.5 2B Llamafile (Q8_0)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-2B-Q8_0.llamafile",
    fileName: "Qwen3.5-2B-Q8_0.llamafile",
    contextLength: 32768,
    supportsTools: false,
  },
  {
    id: "mozilla-ai/Qwen3.5-4B-Q5_K_S.llamafile",
    name: "Qwen 3.5 4B Q5_K_S (Llamafile)",
    description: "Alibaba Qwen 3.5 4B Llamafile (Q5_K_S)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-4B-Q5_K_S.llamafile",
    fileName: "Qwen3.5-4B-Q5_K_S.llamafile",
    contextLength: 32768,
    supportsTools: false,
  },
  {
    id: "mozilla-ai/Qwen3.5-9B-Q5_K_S.llamafile",
    name: "Qwen 3.5 9B Q5_K_S (Llamafile)",
    description: "Alibaba Qwen 3.5 9B Llamafile (Q5_K_S)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-9B-Q5_K_S.llamafile",
    fileName: "Qwen3.5-9B-Q5_K_S.llamafile",
    contextLength: 32768,
    supportsTools: false,
  },
];

/**
 * Resolves the cache directory used by Transformers.js.
 * @param {string} [customCacheDir]
 * @returns {string}
 */
export function getLocalModelCacheDir(customCacheDir) {
  if (customCacheDir) {
    return path.resolve(customCacheDir);
  }
  return path.resolve(process.cwd(), "assets/cache/transformers.js");
}

/**
 * Resolves the cache directory used by Llamafiles.
 * @param {string} [customCacheDir]
 * @returns {string}
 */
export function getLlamafileCacheDir(customCacheDir) {
  if (customCacheDir) {
    return path.resolve(customCacheDir, "llamafile");
  }
  return path.resolve(process.cwd(), "assets/cache/llamafile");
}

/**
 * Checks if a model ID refers to a Llamafile model.
 * @param {string} modelId
 * @returns {boolean}
 */
export function isLlamafile(modelId) {
  if (!modelId || typeof modelId !== "string") return false;
  return (
    modelId.endsWith(".llamafile") ||
    modelId.includes("llamafile") ||
    CURATED_LLAMAFILE_MODELS.some(
      (m) =>
        m.id === modelId ||
        m.fileName === modelId ||
        m.url === modelId ||
        m.fileName === path.basename(modelId),
    )
  );
}

/**
 * Checks if a Llamafile is already downloaded to disk.
 * @param {string} modelId
 * @param {string} [cacheDir]
 * @returns {boolean}
 */
export function isLlamafileLocallyCached(modelId, cacheDir) {
  const dir = getLlamafileCacheDir(cacheDir);
  if (!fs.existsSync(dir)) {
    return false;
  }

  const base = path.basename(modelId);
  const fileName = base.endsWith(".llamafile") ? base : `${base}.llamafile`;
  const targetPath = path.join(dir, fileName);

  try {
    if (fs.existsSync(targetPath)) {
      const st = fs.statSync(targetPath);
      return st.size > 0;
    }
  } catch {}

  return false;
}

/**
 * Checks if a model is already downloaded and present in the disk cache.
 * @param {string} modelId
 * @param {string} [cacheDir]
 * @returns {boolean}
 */
export function isModelLocallyCached(modelId, cacheDir) {
  if (isLlamafile(modelId)) {
    return isLlamafileLocallyCached(modelId, cacheDir);
  }

  const dir = getLocalModelCacheDir(cacheDir);
  if (!fs.existsSync(dir)) {
    return false;
  }

  const candidatePaths = [
    path.join(dir, modelId),
    path.join(dir, `models--${modelId.replace(/\//g, "--")}`),
    path.join(dir, modelId.split("/")[1] || modelId),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const entries = fs.readdirSync(p);
        if (entries.length > 0) {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Lists all curated models with their cached status.
 * @param {string} [cacheDir]
 * @returns {Array<typeof CURATED_LOCAL_MODELS[0] & { cached: boolean }>}
 */
export function listLocalModels(cacheDir) {
  return CURATED_LOCAL_MODELS.map((model) => ({
    ...model,
    cached: isModelLocallyCached(model.id, cacheDir),
  }));
}

/**
 * Lists all curated Llamafile models with their cached status.
 * @param {string} [cacheDir]
 * @returns {Array<typeof CURATED_LLAMAFILE_MODELS[0] & { cached: boolean }>}
 */
export function listLlamafileModels(cacheDir) {
  return CURATED_LLAMAFILE_MODELS.map((model) => ({
    ...model,
    cached: isLlamafileLocallyCached(model.fileName, cacheDir),
  }));
}

/**
 * Fetches available text-generation ONNX models from Hugging Face.
 * @param {object} [options]
 * @param {string} [options.cacheDir]
 * @param {string} [options.endpoint]
 * @param {number} [options.timeoutMs=8000]
 * @param {string} [options.query]
 * @returns {Promise<Array<{ id: string, name: string, cached: boolean }>>}
 */
export async function fetchRemoteModels(options = {}) {
  const endpoint =
    options.endpoint ||
    "https://huggingface.co/api/models?author=onnx-community&pipeline_tag=text-generation&limit=100";
  try {
    const res = await fetch(endpoint, {
      headers: { "User-Agent": "ShadowClaw-CLI" },
      signal: AbortSignal.timeout(options.timeoutMs || 8000),
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return [];
    }
    let models = data
      .map((item) => (typeof item?.id === "string" ? item.id : ""))
      .filter((id) => id && id.toLowerCase().includes("onnx"));

    if (options.query) {
      const q = options.query.toLowerCase();
      models = models.filter((id) => id.toLowerCase().includes(q));
    }

    return models.sort().map((id) => ({
      id,
      name: id.replace(/^onnx-community\//, ""),
      cached: isModelLocallyCached(id, options.cacheDir),
    }));
  } catch {
    return [];
  }
}

/**
 * Downloads a Llamafile model binary from Hugging Face and marks it executable.
 *
 * @param {string} modelId
 * @param {object} [options]
 * @param {string} [options.cacheDir] Custom cache directory
 * @param {boolean} [options.verbose=false] Verbose logging
 * @param {boolean} [options.isTTY] Override TTY detection
 * @param {NodeJS.WritableStream} [options.stream] Progress stream
 * @param {boolean} [options.progress]
 * @param {boolean} [options.noProgress]
 * @param {any} [options.fetch] Custom fetch for testing
 * @returns {Promise<{ success: boolean, modelId: string, path?: string, error?: string }>}
 */
export async function downloadLlamafile(modelId, options = {}) {
  const {
    cacheDir,
    verbose = false,
    isTTY,
    stream = process.stderr,
    progress,
    noProgress,
    abortSignal,
  } = options;

  const matched = CURATED_LLAMAFILE_MODELS.find(
    (m) =>
      m.id === modelId ||
      m.fileName === modelId ||
      m.fileName === path.basename(modelId) ||
      m.url === modelId,
  );

  let url;
  let fileName;
  if (matched) {
    url = matched.url;
    fileName = matched.fileName;
  } else if (modelId.startsWith("http://") || modelId.startsWith("https://")) {
    url = modelId;
    fileName = path.basename(new URL(modelId).pathname);
  } else {
    fileName = path.basename(modelId).endsWith(".llamafile")
      ? path.basename(modelId)
      : `${path.basename(modelId)}.llamafile`;
    url = `https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/${fileName}`;
  }

  const dir = getLlamafileCacheDir(cacheDir);
  fs.mkdirSync(dir, { recursive: true });

  const destPath = path.join(dir, fileName);
  const tempPath = path.join(dir, `${fileName}.downloading.${Date.now()}`);

  const showProgress = progress !== false && !noProgress;
  const progressBar = createCliProgressBar({
    modelId: fileName,
    stream,
    isTTY,
    enabled: showProgress,
  });

  try {
    if (verbose) {
      stream.write(`[Llamafile] Downloading ${url}...\n`);
    }

    const fetchFn = options.fetch || globalThis.fetch;
    const res = await fetchFn(url, {
      headers: { "User-Agent": "ShadowClaw-CLI" },
      redirect: "follow",
      signal: abortSignal,
    });

    if (!res.ok) {
      throw new Error(
        `Failed to download ${url}: HTTP ${res.status} ${res.statusText}`,
      );
    }

    const contentLength = parseInt(
      res.headers?.get?.("content-length") || "0",
      10,
    );
    const fileStream = fs.createWriteStream(tempPath);
    let loaded = 0;

    if (res.body) {
      const { Readable } = await import("node:stream");
      let readableStream;
      if (
        typeof Readable.fromWeb === "function" &&
        typeof res.body.getReader === "function"
      ) {
        readableStream = Readable.fromWeb(res.body);
      } else if (typeof res.body[Symbol.asyncIterator] === "function") {
        readableStream = res.body;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        fileStream.write(buf);
        loaded = buf.length;
      }

      if (readableStream) {
        for await (const chunk of readableStream) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          fileStream.write(buf);
          loaded += buf.length;
          progressBar.update({
            status: "progress",
            file: fileName,
            loaded,
            total: contentLength,
            progress:
              contentLength > 0 ? (loaded / contentLength) * 100 : undefined,
          });
        }
      }
    }

    fileStream.end();
    await new Promise((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    fs.renameSync(tempPath, destPath);
    try {
      fs.chmodSync(destPath, 0o755);
    } catch {}

    progressBar.finish();
    return { success: true, modelId, path: destPath };
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    const message = err instanceof Error ? err.message : String(err);
    progressBar.fail(`✖ Error downloading ${fileName}: ${message}`);
    return { success: false, modelId, error: message };
  }
}

/**
 * Downloads a model using Transformers.js runtime and displays a progress bar.
 *
 * @param {string} modelId
 * @param {object} [options]
 * @param {string} [options.cacheDir] Custom cache directory
 * @param {boolean} [options.verbose=false] Verbose logging
 * @param {boolean} [options.isTTY] Override TTY detection
 * @param {NodeJS.WritableStream} [options.stream] Progress stream
 * @param {any} [options.service] Injected TransformersRuntimeService for testing
 * @returns {Promise<{ success: boolean, modelId: string, error?: string }>}
 */
export async function downloadLocalModel(modelId, options = {}) {
  if (isLlamafile(modelId)) {
    return downloadLlamafile(modelId, options);
  }

  const {
    verbose = false,
    isTTY,
    stream = process.stderr,
    service: injectedService,
    progress,
    noProgress,
  } = options;

  let service = injectedService;
  if (!service) {
    const { createTransformersRuntimeService } =
      await import("../../src/server/services/transformers-runtime.js");
    service = createTransformersRuntimeService();
  }

  const showProgress = progress !== false && !noProgress;
  const progressBar = createCliProgressBar({
    modelId,
    stream,
    isTTY,
    enabled: showProgress,
  });

  try {
    if (verbose) {
      stream.write(`[Transformers.js] Prewarming model ${modelId}...\n`);
    }

    await service.prewarmModel({
      modelId,
      verbose,
      onProgress: (info) => {
        progressBar.update(info);
      },
    });

    progressBar.finish();
    return { success: true, modelId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progressBar.fail(`✖ Error downloading ${modelId}: ${message}`);
    return { success: false, modelId, error: message };
  }
}

/**
 * Interactively prompts the user to select an LLM model and provider
 * when no model is configured in the workspace.
 *
 * @param {object} [options]
 * @param {string} [options.workspaceDir] Resolved workspace directory (.cache or similar)
 * @param {string} [options.contentRoot] Project content root (default: process.cwd())
 * @param {string} [options.cacheDir] Custom cache directory for transformers.js
 * @param {NodeJS.ReadableStream} [options.stdin]
 * @param {NodeJS.WritableStream} [options.stdout]
 * @param {boolean} [options.quiet]
 * @param {boolean} [options.isTTY]
 * @param {(code: number) => void} [options.onExit]
 * @returns {Promise<{ providerId: string, model: string }>}
 */
export async function promptForAgentModel(options = {}) {
  const contentRoot = path.resolve(options.contentRoot || process.cwd());
  const workspaceDir = path.resolve(options.workspaceDir || contentRoot);
  const cacheDir = options.cacheDir;
  const onExit = options.onExit || ((code) => process.exit(code));

  let input = options.stdin || process.stdin;
  let output = options.stdout || process.stderr;
  let closeInputOnFinish = false;
  let ttyFd = null;

  if (input === process.stdin && !process.stdin.isTTY) {
    if (!process.env.CI && (process.stderr.isTTY || process.stdout.isTTY)) {
      try {
        const ttyDevice = process.platform === "win32" ? "CONIN$" : "/dev/tty";
        ttyFd = fs.openSync(ttyDevice, "r");
        input = new tty.ReadStream(ttyFd);
        output = process.stderr.isTTY ? process.stderr : process.stdout;
        closeInputOnFinish = true;
      } catch (_) {
        try {
          const ttyDevice =
            process.platform === "win32" ? "CONIN$" : "/dev/tty";
          input = fs.createReadStream(ttyDevice);
          output = process.stderr.isTTY ? process.stderr : process.stdout;
          closeInputOnFinish = true;
        } catch (_) {}
      }
    }
  }

  const rl = readline.createInterface({
    input,
    output,
  });

  let exited = false;
  const handleSigint = () => {
    if (exited) return;
    exited = true;
    output.write("\nOperation cancelled.\n");
    try {
      rl.close();
    } catch (_) {}
    onExit(130);
  };

  rl.on("SIGINT", handleSigint);
  if (input && typeof input.on === "function" && input !== process.stdin) {
    input.on("SIGINT", handleSigint);
  }
  const processSigintListener = () => handleSigint();
  process.on("SIGINT", processSigintListener);

  const dataListener = (chunk) => {
    const str = typeof chunk === "string" ? chunk : chunk.toString("binary");
    if (str.includes("\x03") || str.includes("\x04")) {
      handleSigint();
    }
  };
  if (input && typeof input.on === "function") {
    input.on("data", dataListener);
  }

  try {
    output.write("\nShadowClaw CLI Agent — Model Selection:\n");
    output.write("No default LLM model is configured for the agent.\n\n");
    output.write("Please select a model for local or cloud execution:\n");
    output.write(
      "  1) onnx-community/gemma-3-1b-it-ONNX-GQA (Gemma 3 1B GQA) [Default, local ONNX, tools]\n",
    );
    output.write(
      "  2) onnx-community/gemma-4-E2B-it-ONNX (Gemma 4 E2B) [Local ONNX: 128k context, tools]\n",
    );
    output.write(
      "  3) onnx-community/gemma-4-E4B-it-ONNX (Gemma 4 E4B) [Local ONNX: 128k context, tools]\n",
    );
    output.write(
      "  4) onnx-community/Qwen3-0.6B-ONNX (Qwen 3 0.6B) [Local ONNX, tools]\n",
    );
    output.write(
      "  5) mozilla-ai/gemma-4-E2B-it-Q5_K_M.llamafile (Gemma 4 E2B) [Local Llamafile]\n",
    );
    output.write(
      "  6) mozilla-ai/gemma-4-E4B-it-Q5_K_M.llamafile (Gemma 4 E4B) [Local Llamafile]\n",
    );
    output.write(
      "  7) mozilla-ai/Qwen3.5-0.8B-Q8_0.llamafile (Qwen 3.5 0.8B) [Local Llamafile]\n",
    );
    output.write(
      "  8) mozilla-ai/Qwen3.5-2B-Q8_0.llamafile (Qwen 3.5 2B) [Local Llamafile]\n",
    );
    output.write(
      "  9) mozilla-ai/Qwen3.5-4B-Q5_K_S.llamafile (Qwen 3.5 4B) [Local Llamafile]\n",
    );
    output.write(
      "  10) mozilla-ai/Qwen3.5-9B-Q5_K_S.llamafile (Qwen 3.5 9B) [Local Llamafile]\n",
    );
    output.write(
      "  11) OpenRouter Cloud (openrouter/free) [Cloud API: requires OPENROUTER_API_KEY]\n",
    );
    output.write(
      "  12) Custom model ID (or 'r' to browse Hugging Face models)\n\n",
    );

    const answer = (
      await rl.question("Enter choice [1-12] (default: 1): ")
    ).trim();

    let providerId = "transformers_js_local";
    let model = DEFAULT_LOCAL_MODEL;

    if (answer === "1" || answer === "") {
      providerId = "transformers_js_local";
      model = "onnx-community/gemma-3-1b-it-ONNX-GQA";
    } else if (answer === "2") {
      providerId = "transformers_js_local";
      model = "onnx-community/gemma-4-E2B-it-ONNX";
    } else if (answer === "3") {
      providerId = "transformers_js_local";
      model = "onnx-community/gemma-4-E4B-it-ONNX";
    } else if (answer === "4") {
      providerId = "transformers_js_local";
      model = "onnx-community/Qwen3-0.6B-ONNX";
    } else if (answer === "5") {
      providerId = "llamafile";
      model = "gemma-4-E2B-it-Q5_K_M.llamafile";
    } else if (answer === "6") {
      providerId = "llamafile";
      model = "gemma-4-E4B-it-Q5_K_M.llamafile";
    } else if (answer === "7") {
      providerId = "llamafile";
      model = "Qwen3.5-0.8B-Q8_0.llamafile";
    } else if (answer === "8") {
      providerId = "llamafile";
      model = "Qwen3.5-2B-Q8_0.llamafile";
    } else if (answer === "9") {
      providerId = "llamafile";
      model = "Qwen3.5-4B-Q5_K_S.llamafile";
    } else if (answer === "10") {
      providerId = "llamafile";
      model = "Qwen3.5-9B-Q5_K_S.llamafile";
    } else if (answer === "11") {
      providerId = "openrouter";
      model = "openrouter/free";
    } else if (
      answer === "12" ||
      answer.toLowerCase() === "r" ||
      answer.toLowerCase() === "remote"
    ) {
      let customModel = "";
      if (answer.toLowerCase() === "r" || answer.toLowerCase() === "remote") {
        customModel = "r";
      } else {
        customModel = (
          await rl.question(
            "Enter custom model ID (or 'r' to browse Hugging Face): ",
          )
        ).trim();
      }

      if (
        customModel.toLowerCase() === "r" ||
        customModel.toLowerCase() === "remote"
      ) {
        output.write(
          "\nFetching text-generation ONNX models from Hugging Face...\n",
        );
        const remote = await fetchRemoteModels({ cacheDir });
        if (remote.length === 0) {
          output.write(
            "Could not fetch remote models from Hugging Face. Using default model.\n",
          );
        } else {
          output.write(
            `\nHugging Face ONNX Models (${remote.length} available):\n`,
          );
          const displayLimit = Math.min(25, remote.length);
          for (let i = 0; i < displayLimit; i++) {
            const m = remote[i];
            const cachedStr = m.cached ? " [Cached]" : "";
            output.write(`  ${i + 1}) ${m.id}${cachedStr}\n`);
          }
          if (remote.length > displayLimit) {
            output.write(`  ... and ${remote.length - displayLimit} more\n`);
          }
          output.write("\n");
          const picked = (
            await rl.question(
              `Select [1-${displayLimit}] or enter model name: `,
            )
          ).trim();
          const pIdx = Number.parseInt(picked, 10);
          if (!Number.isNaN(pIdx) && pIdx >= 1 && pIdx <= displayLimit) {
            model = remote[pIdx - 1].id;
          } else if (picked) {
            model = picked.startsWith("onnx-community/")
              ? picked
              : `onnx-community/${picked}`;
          }
        }
      } else if (customModel) {
        if (isLlamafile(customModel)) {
          providerId = "llamafile";
          const base = path.basename(customModel);
          model = base.endsWith(".llamafile") ? base : `${base}.llamafile`;
        } else if (
          customModel.includes("/") &&
          !customModel.toLowerCase().includes("onnx")
        ) {
          providerId = "openrouter";
          model = customModel;
        } else {
          model = customModel;
        }
      }
    } else if (answer) {
      if (isLlamafile(answer)) {
        providerId = "llamafile";
        const base = path.basename(answer);
        model = base.endsWith(".llamafile") ? base : `${base}.llamafile`;
      } else if (answer.toLowerCase().includes("onnx")) {
        providerId = "transformers_js_local";
        model = answer;
      } else {
        providerId = "openrouter";
        model = answer;
      }
    }

    if (providerId === "transformers_js_local") {
      const isCached = isModelLocallyCached(model, cacheDir);
      if (!isCached) {
        output.write(
          `\nModel "${model}" is not yet downloaded to local disk.\n`,
        );
        const dlChoice = (
          await rl.question("Download model weights now? (Y/n) [default: Y]: ")
        )
          .trim()
          .toLowerCase();

        if (dlChoice === "" || dlChoice === "y" || dlChoice === "yes") {
          output.write(`\nDownloading ${model} from Hugging Face...\n`);
          await downloadLocalModel(model, {
            cacheDir,
            stream: output,
            isTTY:
              options.isTTY !== undefined
                ? options.isTTY
                : Boolean(output.isTTY),
            service: options.service,
          });
        }
      }
    } else if (providerId === "llamafile") {
      const isCached = isLlamafileLocallyCached(model, cacheDir);
      if (!isCached) {
        output.write(
          `\nModel "${model}" is not yet downloaded to local disk.\n`,
        );
        const dlChoice = (
          await rl.question("Download model weights now? (Y/n) [default: Y]: ")
        )
          .trim()
          .toLowerCase();

        if (dlChoice === "" || dlChoice === "y" || dlChoice === "yes") {
          output.write(`\nDownloading ${model} from Hugging Face...\n`);
          await downloadLlamafile(model, {
            cacheDir,
            stream: output,
            isTTY:
              options.isTTY !== undefined
                ? options.isTTY
                : Boolean(output.isTTY),
          });
        }
      }
    }

    // Save declarative config
    try {
      const configFiles = [
        path.join(contentRoot, "shadow-claw.config.json"),
        path.join(workspaceDir, "shadow-claw.config.json"),
        path.join(contentRoot, "site-config.json"),
      ];
      let targetConfigPath = configFiles[0];
      let existingConfig = {};

      for (const cf of configFiles) {
        if (fs.existsSync(cf)) {
          try {
            existingConfig = JSON.parse(fs.readFileSync(cf, "utf8"));
            targetConfigPath = cf;
            break;
          } catch {}
        }
      }

      const updated = {
        $schema:
          existingConfig.$schema ||
          "https://json-schema.org/draft/2020-12/schema",
        ...existingConfig,
        agent: {
          ...(existingConfig.agent || {}),
          defaultProvider: providerId,
          defaultModel: model,
        },
      };

      fs.writeFileSync(
        targetConfigPath,
        JSON.stringify(updated, null, 2) + "\n",
        "utf8",
      );
      output.write(
        `✔ Saved default agent model (${model}) to ${path.relative(process.cwd(), targetConfigPath) || path.basename(targetConfigPath)}\n\n`,
      );
    } catch (_) {}

    return { providerId, model };
  } finally {
    process.removeListener("SIGINT", processSigintListener);
    if (input && typeof input.removeListener === "function") {
      if (input !== process.stdin) {
        input.removeListener("SIGINT", handleSigint);
      }
      input.removeListener("data", dataListener);
    }
    try {
      rl.close();
    } catch (_) {}
    if (closeInputOnFinish) {
      if (input && typeof input.destroy === "function") {
        try {
          input.destroy();
        } catch (_) {}
      }
      if (ttyFd != null) {
        try {
          fs.closeSync(ttyFd);
        } catch (_) {}
      }
    }
  }
}
