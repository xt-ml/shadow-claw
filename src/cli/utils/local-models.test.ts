import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import fs from "node:fs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable, PassThrough } from "node:stream";
import {
  CURATED_LOCAL_MODELS,
  DEFAULT_LOCAL_MODEL,
  CURATED_LLAMAFILE_MODELS,
  getLocalModelCacheDir,
  getLlamafileCacheDir,
  isModelLocallyCached,
  isLlamafileLocallyCached,
  listLocalModels,
  listLlamafileModels,
  downloadLocalModel,
  downloadLlamafile,
  fetchRemoteModels,
  promptForAgentModel,
  getCuratedModelToolSupport,
} from "./local-models.js";

describe("local-models", () => {
  describe("getCuratedModelToolSupport", () => {
    it("returns true for models that support tools", () => {
      expect(
        getCuratedModelToolSupport("onnx-community/gemma-4-E2B-it-ONNX"),
      ).toBe(true);
      expect(getCuratedModelToolSupport("onnx-community/Qwen3-0.6B-ONNX")).toBe(
        true,
      );
    });

    it("returns false for models that do not support tools", () => {
      expect(
        getCuratedModelToolSupport("onnx-community/gemma-3-1b-it-ONNX-GQA"),
      ).toBe(false);
      expect(
        getCuratedModelToolSupport("gemma-4-E2B-it-Q5_K_M.llamafile"),
      ).toBe(false);
    });

    it("returns undefined for unknown or undefined models", () => {
      expect(
        getCuratedModelToolSupport("custom/unknown-model"),
      ).toBeUndefined();
      expect(getCuratedModelToolSupport(undefined)).toBeUndefined();
    });
  });
  it("exports the 4 curated ONNX models with Gemma 4 E2B first and Gemma 3 chat-only", () => {
    const ids = CURATED_LOCAL_MODELS.map((m) => m.id);
    expect(ids).toEqual([
      "onnx-community/gemma-4-E2B-it-ONNX",
      "onnx-community/gemma-4-E4B-it-ONNX",
      "onnx-community/Qwen3-0.6B-ONNX",
      "onnx-community/gemma-3-1b-it-ONNX-GQA",
    ]);

    expect(DEFAULT_LOCAL_MODEL).toBe("onnx-community/gemma-4-E2B-it-ONNX");

    const e2b = CURATED_LOCAL_MODELS.find(
      (m) => m.id === "onnx-community/gemma-4-E2B-it-ONNX",
    );
    expect(e2b?.recommended).toBe(true);
    expect(e2b?.supportsTools).toBe(true);

    const gemma3 = CURATED_LOCAL_MODELS.find(
      (m) => m.id === "onnx-community/gemma-3-1b-it-ONNX-GQA",
    );
    expect(gemma3?.recommended).toBe(false);
    expect(gemma3?.supportsTools).toBe(false);
  });

  it("exports the 6 curated Llamafile models with Gemma first and Qwen next", () => {
    const ids = CURATED_LLAMAFILE_MODELS.map((m) => m.fileName);
    expect(ids).toEqual([
      "gemma-4-E2B-it-Q5_K_M.llamafile",
      "gemma-4-E4B-it-Q5_K_M.llamafile",
      "Qwen3.5-0.8B-Q8_0.llamafile",
      "Qwen3.5-2B-Q8_0.llamafile",
      "Qwen3.5-4B-Q5_K_S.llamafile",
      "Qwen3.5-9B-Q5_K_S.llamafile",
    ]);

    for (const m of CURATED_LLAMAFILE_MODELS) {
      expect(m.url).toMatch(
        /^https:\/\/huggingface\.co\/mozilla-ai\/llamafile_0\.10\/resolve\/main\//,
      );
    }
  });

  describe("getLocalModelCacheDir and isModelLocallyCached", () => {
    it("returns correct default cache dir", () => {
      const dir = getLocalModelCacheDir();
      expect(dir).toContain("assets/cache/transformers.js");
    });

    it("returns false for nonexistent cache dir", () => {
      expect(
        isModelLocallyCached("fake/model", "/tmp/nonexistent-cache-dir-12345"),
      ).toBe(false);
    });

    it("returns false when directory only contains .part or .tmp files", async () => {
      const testDir = await mkdtemp(path.join(tmpdir(), "sc-cached-test-"));
      try {
        const modelDir = path.join(testDir, "test-org/test-model");
        fs.mkdirSync(modelDir, { recursive: true });
        fs.writeFileSync(path.join(modelDir, "tokenizer.json.part"), "partial");
        fs.writeFileSync(path.join(modelDir, "model.onnx.tmp.1234.abc"), "tmp");

        expect(isModelLocallyCached("test-org/test-model", testDir)).toBe(
          false,
        );
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("returns false when download was interrupted leaving a .part file in subdirectories", async () => {
      const testDir = await mkdtemp(path.join(tmpdir(), "sc-cached-test-"));
      try {
        const modelDir = path.join(testDir, "test-org/test-model");
        const onnxDir = path.join(modelDir, "onnx");
        fs.mkdirSync(onnxDir, { recursive: true });
        fs.writeFileSync(path.join(modelDir, "config.json"), "{}");
        fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "{}");
        fs.writeFileSync(path.join(onnxDir, "model_q4.onnx"), "onnx-graph");
        fs.writeFileSync(
          path.join(onnxDir, "model_q4.onnx_data.part"),
          "partial-data",
        );

        // Even though config, tokenizer, and model_q4.onnx exist, the .part file means it is incomplete!
        expect(isModelLocallyCached("test-org/test-model", testDir)).toBe(
          false,
        );
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("returns false when only metadata exists without onnx weight files", async () => {
      const testDir = await mkdtemp(path.join(tmpdir(), "sc-cached-test-"));
      try {
        const modelDir = path.join(testDir, "test-org/test-model");
        fs.mkdirSync(modelDir, { recursive: true });
        fs.writeFileSync(path.join(modelDir, "config.json"), "{}");
        fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "{}");
        fs.writeFileSync(path.join(modelDir, "tokenizer_config.json"), "{}");

        // No .onnx files exist — weights are not downloaded
        expect(isModelLocallyCached("test-org/test-model", testDir)).toBe(
          false,
        );
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("returns true when model weights (.onnx) exist and no .part or .tmp files remain", async () => {
      const testDir = await mkdtemp(path.join(tmpdir(), "sc-cached-test-"));
      try {
        const modelDir = path.join(testDir, "test-org/test-model");
        const onnxDir = path.join(modelDir, "onnx");
        fs.mkdirSync(onnxDir, { recursive: true });
        fs.writeFileSync(path.join(modelDir, "config.json"), "{}");
        fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "{}");
        fs.writeFileSync(path.join(onnxDir, "model_q4.onnx"), "onnx-graph");
        fs.writeFileSync(path.join(onnxDir, "model_q4.onnx_data"), "weights");

        expect(isModelLocallyCached("test-org/test-model", testDir)).toBe(true);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("checks llamafile cache correctly", () => {
      const dir = getLlamafileCacheDir();
      expect(dir).toContain("assets/cache/llamafile");
      expect(
        isLlamafileLocallyCached(
          "gemma-4-E2B-it-Q5_K_M.llamafile",
          "/tmp/nonexistent-cache-dir-12345",
        ),
      ).toBe(false);
    });

    it("returns false for llamafile cache if .part file is present even if target file exists", async () => {
      const testDir = await mkdtemp(
        path.join(tmpdir(), "sc-llama-cache-test-"),
      );
      try {
        const llamaDir = path.join(testDir, "llamafile");
        fs.mkdirSync(llamaDir, { recursive: true });
        const target = path.join(llamaDir, "gemma-4-E2B-it-Q5_K_M.llamafile");
        const part = path.join(
          llamaDir,
          "gemma-4-E2B-it-Q5_K_M.llamafile.part",
        );
        fs.writeFileSync(target, "old-partial");
        fs.writeFileSync(part, "in-progress-download");

        expect(
          isLlamafileLocallyCached("gemma-4-E2B-it-Q5_K_M.llamafile", testDir),
        ).toBe(false);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("returns false for llamafile cache if only .part file exists", async () => {
      const testDir = await mkdtemp(
        path.join(tmpdir(), "sc-llama-cache-test-"),
      );
      try {
        const llamaDir = path.join(testDir, "llamafile");
        fs.mkdirSync(llamaDir, { recursive: true });
        const part = path.join(
          llamaDir,
          "gemma-4-E2B-it-Q5_K_M.llamafile.part",
        );
        fs.writeFileSync(part, "in-progress-download");

        expect(
          isLlamafileLocallyCached("gemma-4-E2B-it-Q5_K_M.llamafile", testDir),
        ).toBe(false);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("returns true for llamafile cache when target exists and no .part file is present", async () => {
      const testDir = await mkdtemp(
        path.join(tmpdir(), "sc-llama-cache-test-"),
      );
      try {
        const llamaDir = path.join(testDir, "llamafile");
        fs.mkdirSync(llamaDir, { recursive: true });
        const target = path.join(llamaDir, "gemma-4-E2B-it-Q5_K_M.llamafile");
        fs.writeFileSync(target, "complete-binary");

        expect(
          isLlamafileLocallyCached("gemma-4-E2B-it-Q5_K_M.llamafile", testDir),
        ).toBe(true);
        expect(
          isLlamafileLocallyCached(
            "mozilla-ai/gemma-4-E2B-it-Q5_K_M.llamafile",
            testDir,
          ),
        ).toBe(true);
      } finally {
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("listLocalModels and listLlamafileModels", () => {
    it("lists ONNX models with cached status boolean", () => {
      const list = listLocalModels("/tmp/nonexistent-dir");
      expect(list.length).toBe(4);
      expect(list[0].id).toBe("onnx-community/gemma-4-E2B-it-ONNX");
      expect(typeof list[0].cached).toBe("boolean");
    });

    it("lists Llamafile models with cached status boolean", () => {
      const list = listLlamafileModels("/tmp/nonexistent-dir");
      expect(list.length).toBe(6);
      expect(list[0].fileName).toBe("gemma-4-E2B-it-Q5_K_M.llamafile");
      expect(typeof list[0].cached).toBe("boolean");
    });
  });

  describe("fetchRemoteModels", () => {
    it("fetches ONNX models from remote endpoint and returns metadata", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "onnx-community/Qwen3-0.6B-ONNX" },
          { id: "onnx-community/gemma-3-1b-it-ONNX-GQA" },
          { id: "some-other/regular-model" },
        ],
      });

      try {
        const models = await fetchRemoteModels();
        expect(models.length).toBe(2);
        expect(models[0].id).toBe("onnx-community/Qwen3-0.6B-ONNX");
        expect(models[0]).toHaveProperty("cached");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("filters remote models by query", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (jest.fn() as any).mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "onnx-community/Qwen3-0.6B-ONNX" },
          { id: "onnx-community/gemma-3-1b-it-ONNX-GQA" },
        ],
      });

      try {
        const models = await fetchRemoteModels({ query: "qwen" });
        expect(models.length).toBe(1);
        expect(models[0].id).toBe("onnx-community/Qwen3-0.6B-ONNX");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("downloadLocalModel", () => {
    it("calls service.prewarmModel and handles success with progress", async () => {
      let output = "";
      const mockStream = {
        isTTY: false,
        write: (str: string) => {
          output += str;
        },
      };

      const mockService = {
        prewarmModel: jest.fn(async ({ onProgress }: any) => {
          onProgress?.({ status: "initiate", file: "model.onnx" });
          onProgress?.({
            status: "progress",
            file: "model.onnx",
            progress: 50,
            loaded: 500,
            total: 1000,
          });
          onProgress?.({ status: "done", file: "model.onnx" });
          return { modelId: "onnx-community/Qwen3-0.6B-ONNX" };
        }),
      };

      const res = await downloadLocalModel("onnx-community/Qwen3-0.6B-ONNX", {
        service: mockService,
        stream: mockStream as any,
        isTTY: false,
      });

      expect(res.success).toBe(true);
      expect(mockService.prewarmModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "onnx-community/Qwen3-0.6B-ONNX",
        }),
      );
      expect(output).toContain("Starting onnx-community/Qwen3-0.6B-ONNX");
    });

    it("handles download failures gracefully", async () => {
      let output = "";
      const mockStream = {
        isTTY: false,
        write: (str: string) => {
          output += str;
        },
      };

      const mockService = {
        prewarmModel: jest.fn(async () => {
          throw new Error("Network offline");
        }),
      };

      const res = await downloadLocalModel("onnx-community/Qwen3-0.6B-ONNX", {
        service: mockService,
        stream: mockStream as any,
        isTTY: false,
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network offline");
      expect(output).toContain(
        "✖ Error downloading onnx-community/Qwen3-0.6B-ONNX: Network offline",
      );
    });

    it("respects progress: false (or noProgress: true) to suppress progress bar", async () => {
      let output = "";
      const mockStream = {
        isTTY: true,
        write: (str: string) => {
          output += str;
        },
      };

      const mockService = {
        prewarmModel: jest.fn(async (opts: any) => {
          opts.onProgress?.({
            status: "progress",
            progress: 50,
            file: "model.onnx",
          });
          return { modelId: "onnx-community/Qwen3-0.6B-ONNX" };
        }),
      };

      const res = await downloadLocalModel("onnx-community/Qwen3-0.6B-ONNX", {
        service: mockService,
        stream: mockStream as any,
        isTTY: true,
        progress: false,
      });

      expect(res.success).toBe(true);
      expect(output).toBe("");
    });

    it("downloads llamafile model, saves with chmod 0o755", async () => {
      const originalFetch = globalThis.fetch;
      const testCacheDir = await mkdtemp(
        path.join(tmpdir(), "sc-llamafile-dl-"),
      );
      try {
        const fakeData = Buffer.from("MZ-fake-llamafile-binary-content");
        globalThis.fetch = (jest.fn() as any).mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Headers({ "content-length": String(fakeData.length) }),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(fakeData);
              controller.close();
            },
          }),
        });

        const res = await downloadLlamafile("gemma-4-E2B-it-Q5_K_M.llamafile", {
          cacheDir: testCacheDir,
          isTTY: false,
          progress: false,
        });

        expect(res.success).toBe(true);
        expect(res.path).toContain("gemma-4-E2B-it-Q5_K_M.llamafile");
        expect(fs.existsSync(res.path!)).toBe(true);
        const st = fs.statSync(res.path!);
        expect(st.size).toBe(fakeData.length);
        // Verify executable permission
        expect((st.mode & 0o111) !== 0).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(testCacheDir, { recursive: true, force: true });
      }
    });

    it("resumes partial llamafile download from .part file using Range header", async () => {
      const originalFetch = globalThis.fetch;
      const testCacheDir = await mkdtemp(
        path.join(tmpdir(), "sc-llamafile-resume-"),
      );
      try {
        const llamaDir = path.join(testCacheDir, "llamafile");
        fs.mkdirSync(llamaDir, { recursive: true });
        const partPath = path.join(
          llamaDir,
          "gemma-4-E2B-it-Q5_K_M.llamafile.part",
        );
        fs.writeFileSync(partPath, Buffer.from("part1-"));

        let passedHeaders: any = null;
        globalThis.fetch = (jest.fn() as any).mockImplementation(
          async (_url: any, init: any) => {
            passedHeaders = init?.headers;
            const remaining = Buffer.from("part2-done");
            return {
              ok: true,
              status: 206,
              headers: new Headers({
                "content-range": "bytes 6-15/16",
                "content-length": String(remaining.length),
              }),
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(remaining);
                  controller.close();
                },
              }),
            };
          },
        );

        const res = await downloadLlamafile("gemma-4-E2B-it-Q5_K_M.llamafile", {
          cacheDir: testCacheDir,
          isTTY: false,
          progress: false,
        });

        expect(res.success).toBe(true);
        expect(passedHeaders["Range"]).toBe("bytes=6-");
        expect(fs.existsSync(partPath)).toBe(false);
        expect(fs.existsSync(res.path!)).toBe(true);
        expect(fs.readFileSync(res.path!, "utf8")).toBe("part1-part2-done");
      } finally {
        globalThis.fetch = originalFetch;
        await rm(testCacheDir, { recursive: true, force: true });
      }
    });

    it("skips download if llamafile already exists and has content", async () => {
      const originalFetch = globalThis.fetch;
      const testCacheDir = await mkdtemp(
        path.join(tmpdir(), "sc-llamafile-skip-"),
      );
      try {
        const llamaDir = path.join(testCacheDir, "llamafile");
        fs.mkdirSync(llamaDir, { recursive: true });
        const destPath = path.join(llamaDir, "gemma-4-E2B-it-Q5_K_M.llamafile");
        fs.writeFileSync(destPath, Buffer.from("already-here"));

        const fetchMock = jest.fn();
        globalThis.fetch = fetchMock as any;

        const res = await downloadLlamafile("gemma-4-E2B-it-Q5_K_M.llamafile", {
          cacheDir: testCacheDir,
          isTTY: false,
          progress: false,
        });

        expect(res.success).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(res.path).toBe(destPath);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(testCacheDir, { recursive: true, force: true });
      }
    });
  });

  describe("promptForAgentModel", () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), "sc-prompt-model-test-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("defaults to gemma-4-E2B-it-ONNX (#1) and triggers download when user accepts", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("\n"));
          } else if (str.includes("Download model weights now?")) {
            setImmediate(() => mockStdin.write("y\n"));
          }
          callback();
        },
      });

      const mockService = {
        prewarmModel: jest.fn(async (_opts?: any) => ({
          modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        })),
      };

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        cacheDir: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        service: mockService,
      });

      expect(result.providerId).toBe("transformers_js_local");
      expect(result.model).toBe("onnx-community/gemma-4-E2B-it-ONNX");
      expect(mockService.prewarmModel).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          modelId: "onnx-community/gemma-4-E2B-it-ONNX",
        }),
      );

      // Verify saved shadow-claw.config.json
      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("transformers_js_local");
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/gemma-4-E2B-it-ONNX",
      );
      expect(capturedOutput).toContain(
        "ShadowClaw CLI Agent — Model Selection:",
      );
      expect(capturedOutput).toContain(
        "Saved default agent model (onnx-community/gemma-4-E2B-it-ONNX)",
      );
    });

    it("allows selecting Gemma 3 1B GQA at option 4", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("4\n"));
          } else if (str.includes("Download model weights now?")) {
            setImmediate(() => mockStdin.write("n\n"));
          }
          callback();
        },
      });

      const mockService = {
        prewarmModel: jest.fn(),
      };

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        service: mockService,
      });

      expect(result.providerId).toBe("transformers_js_local");
      expect(result.model).toBe("onnx-community/gemma-3-1b-it-ONNX-GQA");
      expect(mockService.prewarmModel).not.toHaveBeenCalled();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/gemma-3-1b-it-ONNX-GQA",
      );
    });

    it("allows selecting Llamafile model at option 5 and sets llamafile provider", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("5\n"));
          } else if (str.includes("Download model weights now?")) {
            setImmediate(() => mockStdin.write("n\n"));
          }
          callback();
        },
      });

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
      });

      expect(result.providerId).toBe("llamafile");
      expect(result.model).toBe("gemma-4-E2B-it-Q5_K_M.llamafile");

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("llamafile");
      expect(savedConfig.agent.defaultModel).toBe(
        "gemma-4-E2B-it-Q5_K_M.llamafile",
      );
    });

    it("allows selecting OpenRouter cloud provider at option 11", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("11\n"));
          }
          callback();
        },
      });

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
      });

      expect(result.providerId).toBe("openrouter");
      expect(result.model).toBe("openrouter/free");

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("openrouter");
      expect(savedConfig.agent.defaultModel).toBe("openrouter/free");
    });

    it("allows selecting Gemma 4 E4B ONNX at option 2 and skips download if declined", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("2\n"));
          } else if (str.includes("Download model weights now?")) {
            setImmediate(() => mockStdin.write("n\n"));
          }
          callback();
        },
      });

      const mockService = {
        prewarmModel: jest.fn(),
      };

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        service: mockService,
      });

      expect(result.providerId).toBe("transformers_js_local");
      expect(result.model).toBe("onnx-community/gemma-4-E4B-it-ONNX");
      expect(mockService.prewarmModel).not.toHaveBeenCalled();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("transformers_js_local");
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/gemma-4-E4B-it-ONNX",
      );
    });

    it("allows selecting Qwen3-0.6B-ONNX at option 3 and skips download if declined", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          const str = chunk.toString();
          capturedOutput += str;
          if (str.includes("Enter choice [1-12]")) {
            setImmediate(() => mockStdin.write("3\n"));
          } else if (str.includes("Download model weights now?")) {
            setImmediate(() => mockStdin.write("n\n"));
          }
          callback();
        },
      });

      const mockService = {
        prewarmModel: jest.fn(),
      };

      const result = await promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        service: mockService,
      });

      expect(result.providerId).toBe("transformers_js_local");
      expect(result.model).toBe("onnx-community/Qwen3-0.6B-ONNX");
      expect(mockService.prewarmModel).not.toHaveBeenCalled();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("transformers_js_local");
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
    });

    it("handles Ctrl+C (\\x03) character on input stream gracefully", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          capturedOutput += chunk.toString();
          callback();
        },
      });

      let exitCode: number | null = null;
      const onExit = (code: number) => {
        exitCode = code;
      };

      void promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        onExit,
      });

      // User presses Ctrl+C sending \x03
      mockStdin.write("\x03");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(exitCode).toBe(130);
      expect(capturedOutput).toContain("Operation cancelled.");
    });

    it("handles SIGINT signal gracefully during prompt", async () => {
      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          capturedOutput += chunk.toString();
          callback();
        },
      });

      let exitCode: number | null = null;
      const onExit = (code: number) => {
        exitCode = code;
      };

      void promptForAgentModel({
        workspaceDir: tmpDir,
        contentRoot: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        onExit,
      });

      mockStdin.emit("SIGINT");

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(exitCode).toBe(130);
      expect(capturedOutput).toContain("Operation cancelled.");
    });
  });
});
