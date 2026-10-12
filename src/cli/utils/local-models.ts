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
    id: "onnx-community/gemma-4-E2B-it-ONNX",
    name: "Gemma 4 E2B (ONNX)",
    description:
      "Google Gemma 4 E2B instruction-tuned ONNX model (Default, 128k context, tools)",
    contextLength: 128000,
    supportsTools: true,
    recommended: true,
  },
  {
    id: "onnx-community/gemma-4-E4B-it-ONNX",
    name: "Gemma 4 E4B (ONNX)",
    description:
      "Google Gemma 4 E4B instruction-tuned ONNX model (128k context, tools)",
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
  {
    id: "onnx-community/gemma-3-1b-it-ONNX-GQA",
    name: "Gemma 3 1B GQA (ONNX)",
    description:
      "Google Gemma 3 1B GQA — chat only (template has no tool support)",
    contextLength: 32000,
    supportsTools: false,
    recommended: false,
  },
];

export const DEFAULT_LOCAL_MODEL = "onnx-community/gemma-4-E2B-it-ONNX";

export const CURATED_LLAMAFILE_MODELS: LlamafileModelDefinition[] = [
  {
    id: "mozilla-ai/gemma-4-E2B-it-Q5_K_M.llamafile",
    name: "Gemma 4 E2B Q5_K_M (Llamafile)",
    description: "Google Gemma 4 E2B instruction-tuned Llamafile (Q5_K_M)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/gemma-4-E2B-it-Q5_K_M.llamafile",
    fileName: "gemma-4-E2B-it-Q5_K_M.llamafile",
    contextLength: 128000,
    supportsTools: true,
  },
  {
    id: "mozilla-ai/gemma-4-E4B-it-Q5_K_M.llamafile",
    name: "Gemma 4 E4B Q5_K_M (Llamafile)",
    description: "Google Gemma 4 E4B instruction-tuned Llamafile (Q5_K_M)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/gemma-4-E4B-it-Q5_K_M.llamafile",
    fileName: "gemma-4-E4B-it-Q5_K_M.llamafile",
    contextLength: 128000,
    supportsTools: true,
  },
  {
    id: "mozilla-ai/Qwen3.5-0.8B-Q8_0.llamafile",
    name: "Qwen 3.5 0.8B Q8_0 (Llamafile)",
    description: "Alibaba Qwen 3.5 0.8B Llamafile (Q8_0)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-0.8B-Q8_0.llamafile",
    fileName: "Qwen3.5-0.8B-Q8_0.llamafile",
    contextLength: 32768,
    supportsTools: true,
  },
  {
    id: "mozilla-ai/Qwen3.5-2B-Q8_0.llamafile",
    name: "Qwen 3.5 2B Q8_0 (Llamafile)",
    description: "Alibaba Qwen 3.5 2B Llamafile (Q8_0)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-2B-Q8_0.llamafile",
    fileName: "Qwen3.5-2B-Q8_0.llamafile",
    contextLength: 32768,
    supportsTools: true,
  },
  {
    id: "mozilla-ai/Qwen3.5-4B-Q5_K_S.llamafile",
    name: "Qwen 3.5 4B Q5_K_S (Llamafile)",
    description: "Alibaba Qwen 3.5 4B Llamafile (Q5_K_S)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-4B-Q5_K_S.llamafile",
    fileName: "Qwen3.5-4B-Q5_K_S.llamafile",
    contextLength: 32768,
    supportsTools: true,
  },
  {
    id: "mozilla-ai/Qwen3.5-9B-Q5_K_S.llamafile",
    name: "Qwen 3.5 9B Q5_K_S (Llamafile)",
    description: "Alibaba Qwen 3.5 9B Llamafile (Q5_K_S)",
    url: "https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/Qwen3.5-9B-Q5_K_S.llamafile",
    fileName: "Qwen3.5-9B-Q5_K_S.llamafile",
    contextLength: 32768,
    supportsTools: true,
  },
];

/**
 * Return whether a model ID is known in our curated definitions to support tool calling.
 * Returns `true` if explicitly supported, `false` if explicitly not supported,
 * or `undefined` if the model is not in the curated list.
 */
export function getCuratedModelToolSupport(
  modelId?: string,
): boolean | undefined {
  if (!modelId) return undefined;
  const onnxMatch = CURATED_LOCAL_MODELS.find(
    (m) => m.id === modelId || m.id.toLowerCase() === modelId.toLowerCase(),
  );
  if (onnxMatch) return onnxMatch.supportsTools;

  const llamafileMatch = CURATED_LLAMAFILE_MODELS.find(
    (m) =>
      m.id === modelId ||
      m.fileName === modelId ||
      m.id.toLowerCase() === modelId.toLowerCase() ||
      m.fileName.toLowerCase() === modelId.toLowerCase(),
  );
  if (llamafileMatch) return llamafileMatch.supportsTools;

  return undefined;
}

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
  if (fs.existsSync(modelId)) {
    try {
      const st = fs.statSync(modelId);
      if (st.size > 0) return true;
    } catch {}
  }
  const cwdPath = path.resolve(process.cwd(), modelId);
  if (fs.existsSync(cwdPath)) {
    try {
      const st = fs.statSync(cwdPath);
      if (st.size > 0) return true;
    } catch {}
  }

  const dir = getLlamafileCacheDir(cacheDir);
  if (!fs.existsSync(dir)) {
    return false;
  }

  const matched = CURATED_LLAMAFILE_MODELS.find(
    (m) =>
      m.id === modelId ||
      m.fileName === modelId ||
      m.fileName === path.basename(modelId) ||
      m.url === modelId,
  );
  const base = matched ? matched.fileName : path.basename(modelId);
  const fileName = base.endsWith(".llamafile") ? base : `${base}.llamafile`;
  const targetPath = path.join(dir, fileName);
  const partPath = path.join(dir, `${fileName}.part`);

  try {
    if (fs.existsSync(partPath)) {
      return false;
    }
    if (fs.existsSync(targetPath)) {
      const st = fs.statSync(targetPath);
      return st.size > 0;
    }
  } catch {}

  return false;
}

export function getAgentfileCacheDir(customCacheDir?: string): string {
  if (customCacheDir) {
    return path.resolve(customCacheDir, "agentfile");
  }
  return path.resolve(process.cwd(), "assets/cache/agentfile");
}

export function isAgentfile(modelId?: string): boolean {
  if (!modelId || typeof modelId !== "string") return false;
  return modelId.endsWith(".agentfile") || modelId.includes("agentfile");
}

export function isAgentfileLocallyCached(
  modelId: string,
  cacheDir?: string,
): boolean {
  if (fs.existsSync(modelId)) {
    try {
      const st = fs.statSync(modelId);
      if (st.size > 0) return true;
    } catch {}
  }
  const cwdPath = path.resolve(process.cwd(), modelId);
  if (fs.existsSync(cwdPath)) {
    try {
      const st = fs.statSync(cwdPath);
      if (st.size > 0) return true;
    } catch {}
  }

  const dirs = [getAgentfileCacheDir(cacheDir), getLlamafileCacheDir(cacheDir)];

  const base = path.basename(modelId);
  const fileName = base.endsWith(".agentfile") ? base : `${base}.agentfile`;

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    const targetPath = path.join(dir, fileName);
    const partPath = path.join(dir, `${fileName}.part`);

    try {
      if (fs.existsSync(partPath)) {
        return false;
      }
      if (fs.existsSync(targetPath)) {
        const st = fs.statSync(targetPath);
        if (st.size > 0) {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

function scanOnnxModelCache(dirPath: string): {
  hasPartFiles: boolean;
  hasOnnxFiles: boolean;
} {
  let hasPartFiles = false;
  let hasOnnxFiles = false;

  function traverse(current: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        traverse(path.join(current, entry.name));
      } else if (entry.isFile()) {
        const name = entry.name;
        if (name.endsWith(".part") || name.includes(".tmp")) {
          hasPartFiles = true;
        }
        if (
          name.endsWith(".onnx") &&
          !name.endsWith(".part") &&
          !name.includes(".tmp")
        ) {
          hasOnnxFiles = true;
        }
      }
    }
  }

  traverse(dirPath);
  return { hasPartFiles, hasOnnxFiles };
}

export function isModelLocallyCached(
  modelId: string,
  cacheDir?: string,
): boolean {
  if (isAgentfile(modelId)) {
    return isAgentfileLocallyCached(modelId, cacheDir);
  }

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
        const { hasPartFiles, hasOnnxFiles } = scanOnnxModelCache(p);
        if (!hasPartFiles && hasOnnxFiles) {
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

export interface FetchRemoteModelsOptions {
  endpoint?: string;
  cacheDir?: string;
  timeoutMs?: number;
  query?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

export async function fetchRemoteModels(
  options: FetchRemoteModelsOptions = {},
): Promise<Array<{ id: string; name: string; cached: boolean }>> {
  const limit = options.limit ?? 100;
  const endpoint =
    options.endpoint ||
    `https://huggingface.co/api/models?author=onnx-community&pipeline_tag=text-generation&limit=${limit}`;
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

    let sortedModels = models.sort().map((id) => ({
      id,
      name: id.replace(/^onnx-community\//, ""),
      cached: isModelLocallyCached(id, options.cacheDir),
    }));

    if (options.page !== undefined || options.pageSize !== undefined) {
      const page = Math.max(1, options.page ?? 1);
      const pageSize = Math.max(1, options.pageSize ?? 25);
      const startIndex = (page - 1) * pageSize;
      sortedModels = sortedModels.slice(startIndex, startIndex + pageSize);
    }

    return sortedModels;
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
    quiet?: boolean;
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
    quiet = false,
    abortSignal,
  } = options;

  const matched = CURATED_LLAMAFILE_MODELS.find(
    (m) =>
      m.id === modelId ||
      m.fileName === modelId ||
      m.fileName === path.basename(modelId) ||
      m.url === modelId,
  );

  const isAgent = isAgentfile(modelId);
  let url: string;
  let fileName: string;
  if (matched) {
    url = matched.url;
    fileName = matched.fileName;
  } else if (modelId.startsWith("http://") || modelId.startsWith("https://")) {
    url = modelId;
    fileName = path.basename(new URL(modelId).pathname);
  } else if (isAgent) {
    fileName = path.basename(modelId).endsWith(".agentfile")
      ? path.basename(modelId)
      : `${path.basename(modelId)}.agentfile`;
    url = `https://huggingface.co/mozilla-ai/agentfile/resolve/main/${fileName}`;
  } else {
    fileName = path.basename(modelId).endsWith(".llamafile")
      ? path.basename(modelId)
      : `${path.basename(modelId)}.llamafile`;
    url = `https://huggingface.co/mozilla-ai/llamafile_0.10/resolve/main/${fileName}`;
  }

  const dir = isAgent
    ? getAgentfileCacheDir(cacheDir)
    : getLlamafileCacheDir(cacheDir);
  fs.mkdirSync(dir, { recursive: true });

  const destPath = path.join(dir, fileName);
  const partPath = path.join(dir, `${fileName}.part`);

  if (fs.existsSync(destPath)) {
    try {
      const st = fs.statSync(destPath);
      if (st.size > 0) {
        return { success: true, modelId, path: destPath };
      }
    } catch {}
  }

  let resumeOffset = 0;
  if (fs.existsSync(partPath)) {
    try {
      const st = fs.statSync(partPath);
      if (st.size > 0) {
        resumeOffset = st.size;
      }
    } catch {
      resumeOffset = 0;
    }
  }

  const showProgress = !quiet && progress !== false && !noProgress;
  const progressBar = createCliProgressBar({
    modelId: fileName,
    stream,
    isTTY,
    enabled: showProgress,
  });

  let fileStream: fs.WriteStream | undefined;
  try {
    if (verbose && stream?.write) {
      stream.write(`[Llamafile] Downloading ${url}...\n`);
    }

    const requestHeaders: Record<string, string> = {
      "User-Agent": "ShadowClaw-CLI",
      "Accept-Encoding": "identity",
    };
    if (resumeOffset > 0) {
      requestHeaders["Range"] = `bytes=${resumeOffset}-`;
    }

    const fetchFn = options.fetch || globalThis.fetch;
    let res = await fetchFn(url, {
      headers: requestHeaders,
      redirect: "follow",
      signal: abortSignal,
    });

    if (res.status === 416 && resumeOffset > 0) {
      try {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
      } catch {}
      resumeOffset = 0;
      delete requestHeaders["Range"];
      res = await fetchFn(url, {
        headers: requestHeaders,
        redirect: "follow",
        signal: abortSignal,
      });
    }

    if (!res.ok && res.status !== 206) {
      throw new Error(
        `Failed to download ${url}: HTTP ${res.status} ${res.statusText}`,
      );
    }

    const is206 = res.status === 206;
    let totalSize = 0;
    let loaded = 0;

    if (is206) {
      const contentRange = res.headers?.get?.("content-range");
      const match = contentRange?.match(/\/\s*(\d+)\s*$/);
      const contentLength = parseInt(
        res.headers?.get?.("content-length") || "0",
        10,
      );
      totalSize = match ? parseInt(match[1], 10) : resumeOffset + contentLength;
      loaded = resumeOffset;
      fileStream = fs.createWriteStream(partPath, { flags: "a" });
    } else {
      resumeOffset = 0;
      totalSize = parseInt(res.headers?.get?.("content-length") || "0", 10);
      loaded = 0;
      fileStream = fs.createWriteStream(partPath, { flags: "w" });
    }

    if (loaded > 0) {
      progressBar.update({
        status: "progress",
        file: fileName,
        loaded,
        total: totalSize,
        progress: totalSize > 0 ? (loaded / totalSize) * 100 : undefined,
      });
    }

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
        loaded += buf.length;
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
            total: totalSize,
            progress: totalSize > 0 ? (loaded / totalSize) * 100 : undefined,
          });
        }
      }
    }

    if (fileStream) {
      const activeStream = fileStream;
      activeStream.end();
      await new Promise<void>((resolve, reject) => {
        activeStream.on("finish", resolve);
        activeStream.on("error", reject);
      });
    }

    fs.renameSync(partPath, destPath);
    try {
      fs.chmodSync(destPath, 0o755);
    } catch {}

    progressBar.finish();
    return { success: true, modelId, path: destPath };
  } catch (err: any) {
    try {
      fileStream?.end();
    } catch {}
    const message = err instanceof Error ? err.message : String(err);
    progressBar.fail(`✖ Error downloading ${fileName}: ${message}`);
    return { success: false, modelId, error: message };
  }
}

export const downloadAgentfile = downloadLlamafile;

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
    quiet?: boolean;
  } = {},
): Promise<{ success: boolean; modelId: string; error?: string }> {
  if (isLlamafile(modelId) || isAgentfile(modelId)) {
    return downloadLlamafile(modelId, options);
  }

  const {
    verbose = false,
    isTTY,
    stream = process.stderr,
    service: injectedService,
    progress,
    noProgress,
    quiet = false,
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

  const showProgress = !quiet && progress !== false && !noProgress;
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
      cacheDir: options.cacheDir,
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
    let providerId = "transformers_js_local";
    let model = DEFAULT_LOCAL_MODEL;
    const sessionCache = new Map<
      string,
      Array<{ id: string; name: string; cached: boolean }>
    >();

    while (!exited) {
      output.write("\nShadowClaw CLI Agent — Model Selection:\n");
      output.write("No default LLM model is configured for the agent.\n\n");
      output.write("Please select a model for local or cloud execution:\n");
      output.write(
        "  1) onnx-community/gemma-4-E2B-it-ONNX (Gemma 4 E2B) [Default, local ONNX: 128k context, tools]\n",
      );
      output.write(
        "  2) onnx-community/gemma-4-E4B-it-ONNX (Gemma 4 E4B) [Local ONNX: 128k context, tools]\n",
      );
      output.write(
        "  3) onnx-community/Qwen3-0.6B-ONNX (Qwen 3 0.6B) [Local ONNX, tools]\n",
      );
      output.write(
        "  4) onnx-community/gemma-3-1b-it-ONNX-GQA (Gemma 3 1B GQA) [Local ONNX, chat only]\n",
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
      if (exited) break;

      if (answer === "1" || answer === "") {
        providerId = "transformers_js_local";
        model = DEFAULT_LOCAL_MODEL;
        break;
      } else if (answer === "2") {
        providerId = "transformers_js_local";
        model = "onnx-community/gemma-4-E4B-it-ONNX";
        break;
      } else if (answer === "3") {
        providerId = "transformers_js_local";
        model = "onnx-community/Qwen3-0.6B-ONNX";
        break;
      } else if (answer === "4") {
        providerId = "transformers_js_local";
        model = "onnx-community/gemma-3-1b-it-ONNX-GQA";
        break;
      } else if (answer === "5") {
        providerId = "llamafile";
        model = "gemma-4-E2B-it-Q5_K_M.llamafile";
        break;
      } else if (answer === "6") {
        providerId = "llamafile";
        model = "gemma-4-E4B-it-Q5_K_M.llamafile";
        break;
      } else if (answer === "7") {
        providerId = "llamafile";
        model = "Qwen3.5-0.8B-Q8_0.llamafile";
        break;
      } else if (answer === "8") {
        providerId = "llamafile";
        model = "Qwen3.5-2B-Q8_0.llamafile";
        break;
      } else if (answer === "9") {
        providerId = "llamafile";
        model = "Qwen3.5-4B-Q5_K_S.llamafile";
        break;
      } else if (answer === "10") {
        providerId = "llamafile";
        model = "Qwen3.5-9B-Q5_K_S.llamafile";
        break;
      } else if (answer === "11") {
        providerId = "openrouter";
        model = "openrouter/free";
        break;
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
          if (exited) break;
        }

        if (
          customModel.toLowerCase() === "b" ||
          customModel.toLowerCase() === "back"
        ) {
          continue;
        }

        if (
          customModel.toLowerCase() === "r" ||
          customModel.toLowerCase() === "remote"
        ) {
          let currentQuery = "";
          let currentPage = 1;
          const pageSize = 25;
          let backToMainMenu = false;

          const loadModels = async (
            query: string,
          ): Promise<Array<{ id: string; name: string; cached: boolean }>> => {
            const cacheKey = query.toLowerCase();
            if (sessionCache.has(cacheKey)) {
              return sessionCache.get(cacheKey)!;
            }
            output.write(
              query
                ? `\nSearching Hugging Face ONNX models for "${query}"...\n`
                : "\nFetching text-generation ONNX models from Hugging Face...\n",
            );
            const fetched = await fetchRemoteModels({ cacheDir, query });
            sessionCache.set(cacheKey, fetched);
            return fetched;
          };

          let remoteModels = await loadModels(currentQuery);

          while (!exited) {
            if (remoteModels.length === 0) {
              if (currentQuery) {
                output.write(`\nNo models found matching "${currentQuery}".\n`);
              } else {
                output.write(
                  "Could not fetch remote models from Hugging Face. Using default model.\n",
                );
                model = DEFAULT_LOCAL_MODEL;
                providerId = "transformers_js_local";
                break;
              }
              const action = (
                await rl.question(
                  "Enter 's <query>' to search, 'b' to go back, or enter model name: ",
                )
              ).trim();
              if (exited) break;
              const actionLower = action.toLowerCase();
              if (actionLower === "b" || actionLower === "back") {
                backToMainMenu = true;
                break;
              }
              if (
                actionLower.startsWith("s ") ||
                actionLower.startsWith("search ") ||
                actionLower.startsWith("s:")
              ) {
                const q = action.replace(/^(search\s+|s\s+|s:)/i, "").trim();
                currentQuery = q;
                currentPage = 1;
                remoteModels = await loadModels(currentQuery);
                continue;
              }
              if (actionLower === "s" || actionLower === "search") {
                const q = (
                  await rl.question(
                    "Enter search query (or leave blank to clear): ",
                  )
                ).trim();
                if (exited) break;
                currentQuery = q;
                currentPage = 1;
                remoteModels = await loadModels(currentQuery);
                continue;
              }
              if (action) {
                if (isAgentfile(action)) {
                  providerId = "agentfile";
                  const base = path.basename(action);
                  model = base.endsWith(".agentfile")
                    ? base
                    : `${base}.agentfile`;
                } else if (isLlamafile(action)) {
                  providerId = "llamafile";
                  const base = path.basename(action);
                  model = base.endsWith(".llamafile")
                    ? base
                    : `${base}.llamafile`;
                } else if (
                  action.includes("/") &&
                  !action.toLowerCase().includes("onnx")
                ) {
                  providerId = "openrouter";
                  model = action;
                } else {
                  providerId = "transformers_js_local";
                  model = action.startsWith("onnx-community/")
                    ? action
                    : `onnx-community/${action}`;
                }
                break;
              }
              model = DEFAULT_LOCAL_MODEL;
              providerId = "transformers_js_local";
              break;
            }

            const totalModels = remoteModels.length;
            const totalPages = Math.ceil(totalModels / pageSize);
            if (currentPage > totalPages) currentPage = totalPages;
            if (currentPage < 1) currentPage = 1;
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = Math.min(startIndex + pageSize, totalModels);
            const displayCount = endIndex - startIndex;

            output.write(
              `\nHugging Face ONNX Models (${totalModels} available) — Page ${currentPage} of ${totalPages}, showing ${startIndex + 1}-${endIndex} of ${totalModels}:\n`,
            );
            for (let i = startIndex; i < endIndex; i++) {
              const m = remoteModels[i];
              const cachedStr = m.cached ? " [Cached]" : "";
              output.write(`  ${i + 1}) ${m.id}${cachedStr}\n`);
            }
            const remainingAfter = totalModels - endIndex;
            if (remainingAfter > 0) {
              const navHint =
                currentPage > 1
                  ? "type 'n' for next page, 'p' for previous page"
                  : "type 'n' for next page";
              output.write(`  ... and ${remainingAfter} more (${navHint})\n`);
            } else if (currentPage > 1) {
              output.write("  (type 'p' for previous page)\n");
            }
            output.write("\n");

            const promptRange = `${startIndex + 1}-${endIndex}`;
            const picked = (
              await rl.question(
                `Select [${promptRange}], [n]ext, [p]rev, [s]earch, [b]ack, or enter model name: `,
              )
            ).trim();
            if (exited) break;

            const lower = picked.toLowerCase();
            if (lower === "b" || lower === "back") {
              backToMainMenu = true;
              break;
            }
            if (lower === "n" || lower === "next") {
              if (currentPage < totalPages) {
                currentPage++;
              } else {
                output.write("Already on the last page.\n");
              }
              continue;
            }
            if (lower === "p" || lower === "prev" || lower === "previous") {
              if (currentPage > 1) {
                currentPage--;
              } else {
                output.write("Already on the first page.\n");
              }
              continue;
            }
            if (
              lower.startsWith("s ") ||
              lower.startsWith("search ") ||
              lower.startsWith("s:")
            ) {
              const q = picked.replace(/^(search\s+|s\s+|s:)/i, "").trim();
              currentQuery = q;
              currentPage = 1;
              remoteModels = await loadModels(currentQuery);
              continue;
            }
            if (lower === "s" || lower === "search") {
              const q = (
                await rl.question(
                  "Enter search query (or leave blank to clear): ",
                )
              ).trim();
              if (exited) break;
              currentQuery = q;
              currentPage = 1;
              remoteModels = await loadModels(currentQuery);
              continue;
            }

            if (/^\d+$/.test(picked)) {
              const pIdx = Number.parseInt(picked, 10);
              if (pIdx >= startIndex + 1 && pIdx <= endIndex) {
                model = remoteModels[pIdx - 1].id;
                providerId = "transformers_js_local";
                break;
              } else if (pIdx >= 1 && pIdx <= displayCount) {
                model = remoteModels[startIndex + pIdx - 1].id;
                providerId = "transformers_js_local";
                break;
              } else {
                output.write(
                  `Invalid selection "${picked}". Please choose a number between ${startIndex + 1} and ${endIndex}.\n`,
                );
                continue;
              }
            } else if (picked) {
              if (isAgentfile(picked)) {
                providerId = "agentfile";
                const base = path.basename(picked);
                model = base.endsWith(".agentfile")
                  ? base
                  : `${base}.agentfile`;
              } else if (isLlamafile(picked)) {
                providerId = "llamafile";
                const base = path.basename(picked);
                model = base.endsWith(".llamafile")
                  ? base
                  : `${base}.llamafile`;
              } else if (
                picked.includes("/") &&
                !picked.toLowerCase().includes("onnx")
              ) {
                providerId = "openrouter";
                model = picked;
              } else {
                providerId = "transformers_js_local";
                model = picked.startsWith("onnx-community/")
                  ? picked
                  : `onnx-community/${picked}`;
              }
              break;
            } else {
              model = remoteModels[startIndex]?.id || DEFAULT_LOCAL_MODEL;
              providerId = "transformers_js_local";
              break;
            }
          }

          if (backToMainMenu) {
            continue;
          }
          break;
        } else if (customModel) {
          if (isAgentfile(customModel)) {
            providerId = "agentfile";
            const base = path.basename(customModel);
            model = base.endsWith(".agentfile") ? base : `${base}.agentfile`;
          } else if (isLlamafile(customModel)) {
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
          break;
        }
      } else if (answer) {
        if (isAgentfile(answer)) {
          providerId = "agentfile";
          const base = path.basename(answer);
          model = base.endsWith(".agentfile") ? base : `${base}.agentfile`;
        } else if (isLlamafile(answer)) {
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
        break;
      }
    }

    if (exited) {
      return { providerId, model };
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
    } else if (providerId === "llamafile" || providerId === "agentfile") {
      const isCached =
        providerId === "agentfile"
          ? isAgentfileLocallyCached(model, cacheDir)
          : isLlamafileLocallyCached(model, cacheDir);
      if (!isCached) {
        const typeLabel =
          providerId === "agentfile" ? "Agentfile" : "Llamafile";
        output.write(
          `\n${typeLabel} "${model}" is not yet downloaded to local disk.\n`,
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
