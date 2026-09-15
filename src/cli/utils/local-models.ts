import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import tty from "node:tty";

import { createCliProgressBar } from "./progress-bar.js";

export interface LocalModelDefinition {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  supportsTools: boolean;
  recommended: boolean;
}

export interface LlamafileModelDefinition {
  id: string;
  name: string;
  description: string;
  url: string;
  fileName: string;
  contextLength: number;
  supportsTools: boolean;
}

export interface PromptForAgentModelOptions {
  workspaceDir?: string;
  contentRoot?: string;
  cacheDir?: string;
  stdin?: any;
  stdout?: any;
  quiet?: boolean;
  isTTY?: boolean;
  onExit?: (code: number) => void;
  service?: any;
}

export const CURATED_LOCAL_MODELS: LocalModelDefinition[] = [
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

export const CURATED_LLAMAFILE_MODELS: LlamafileModelDefinition[] = [
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

export function getLocalModelCacheDir(customCacheDir?: string): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir);
  }
  return path.resolve(process.cwd(), "assets/cache/transformers.js");
}

export function getLlamafileCacheDir(customCacheDir?: string): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir, "llamafile");
  }
  return path.resolve(process.cwd(), "assets/cache/llamafile");
}

export function isLlamafile(modelId?: string): boolean {
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

export function isLlamafileLocallyCached(
  modelId: string,
  cacheDir?: string,
): boolean {
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

export function isModelLocallyCached(
  modelId: string,
  cacheDir?: string,
): boolean {
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

export function listLocalModels(
  cacheDir?: string,
): Array<LocalModelDefinition & { cached: boolean }> {
  return CURATED_LOCAL_MODELS.map((model) => ({
    ...model,
    cached: isModelLocallyCached(model.id, cacheDir),
  }));
}

export function listLlamafileModels(
  cacheDir?: string,
): Array<LlamafileModelDefinition & { cached: boolean }> {
  return CURATED_LLAMAFILE_MODELS.map((model) => ({
    ...model,
    cached: isLlamafileLocallyCached(model.fileName, cacheDir),
  }));
}

export async function fetchRemoteModels(
  options: {
    endpoint?: string;
    cacheDir?: string;
    timeoutMs?: number;
    query?: string;
  } = {},
): Promise<Array<{ id: string; name: string; cached: boolean }>> {
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

export async function downloadLlamafile(
  modelId: string,
  options: {
    cacheDir?: string;
    verbose?: boolean;
    isTTY?: boolean;
    stream?: any;
    progress?: boolean;
    noProgress?: boolean;
    abortSignal?: AbortSignal;
    fetch?: any;
  } = {},
): Promise<{
  success: boolean;
  modelId: string;
  path?: string;
  error?: string;
}> {
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

  let url: string;
  let fileName: string;
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
    if (verbose && stream?.write) {
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
      let readableStream: any;
      if (
        typeof (Readable as any).fromWeb === "function" &&
        typeof res.body.getReader === "function"
      ) {
        readableStream = (Readable as any).fromWeb(res.body);
      } else if (
        typeof (res.body as any)[Symbol.asyncIterator] === "function"
      ) {
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
    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    fs.renameSync(tempPath, destPath);
    try {
      fs.chmodSync(destPath, 0o755);
    } catch {}

    progressBar.finish();
    return { success: true, modelId, path: destPath };
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    const message = err instanceof Error ? err.message : String(err);
    progressBar.fail(`✖ Error downloading ${fileName}: ${message}`);
    return { success: false, modelId, error: message };
  }
}

export async function downloadLocalModel(
  modelId: string,
  options: {
    cacheDir?: string;
    verbose?: boolean;
    isTTY?: boolean;
    stream?: any;
    service?: any;
    progress?: boolean;
    noProgress?: boolean;
  } = {},
): Promise<{ success: boolean; modelId: string; error?: string }> {
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
    const { getAgentCore } = await import("./agent-core.js");
    const core = await getAgentCore();
    if (typeof core.createTransformersRuntimeService !== "function") {
      throw new Error(
        "createTransformersRuntimeService is not available in agent core",
      );
    }
    service = core.createTransformersRuntimeService();
  }

  const showProgress = progress !== false && !noProgress;
  const progressBar = createCliProgressBar({
    modelId,
    stream,
    isTTY,
    enabled: showProgress,
  });

  try {
    if (verbose && stream?.write) {
      stream.write(`[Transformers.js] Prewarming model ${modelId}...\n`);
    }

    await service.prewarmModel({
      modelId,
      verbose,
      onProgress: (info: any) => {
        progressBar.update(info);
      },
    });

    progressBar.finish();
    return { success: true, modelId };
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err);
    progressBar.fail(`✖ Error downloading ${modelId}: ${message}`);
    return { success: false, modelId, error: message };
  }
}

export async function promptForAgentModel(
  options: PromptForAgentModelOptions = {},
): Promise<{ providerId: string; model: string }> {
  const contentRoot = path.resolve(options.contentRoot || process.cwd());
  const workspaceDir = path.resolve(options.workspaceDir || contentRoot);
  const cacheDir = options.cacheDir;
  const onExit = options.onExit || ((code: number) => process.exit(code));

  let input = options.stdin || process.stdin;
  let output = options.stdout || process.stderr;
  let closeInputOnFinish = false;
  let ttyFd: number | null = null;

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

  const dataListener = (chunk: any) => {
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

    try {
      const configFiles = [
        path.join(contentRoot, "shadow-claw.config.json"),
        path.join(workspaceDir, "shadow-claw.config.json"),
        path.join(contentRoot, "site-config.json"),
      ];
      let targetConfigPath = configFiles[0];
      let existingConfig: any = {};

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
