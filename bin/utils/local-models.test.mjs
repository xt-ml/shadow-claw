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
import { Readable, Writable, PassThrough } from "node:stream";
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
} from "./local-models.mjs";

describe("local-models", () => {
  it("exports the 4 curated ONNX models with Gemma first and Qwen #4", () => {
    const ids = CURATED_LOCAL_MODELS.map((m) => m.id);
    expect(ids).toEqual([
      "onnx-community/gemma-3-1b-it-ONNX-GQA",
      "onnx-community/gemma-4-E2B-it-ONNX",
      "onnx-community/gemma-4-E4B-it-ONNX",
      "onnx-community/Qwen3-0.6B-ONNX",
    ]);

    expect(DEFAULT_LOCAL_MODEL).toBe("onnx-community/gemma-3-1b-it-ONNX-GQA");
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
  });

  describe("listLocalModels and listLlamafileModels", () => {
    it("lists ONNX models with cached status boolean", () => {
      const list = listLocalModels("/tmp/nonexistent-dir");
      expect(list.length).toBe(4);
      expect(list[0].id).toBe("onnx-community/gemma-3-1b-it-ONNX-GQA");
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
      globalThis.fetch = jest.fn().mockResolvedValue({
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
      globalThis.fetch = jest.fn().mockResolvedValue({
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
        write: (str) => {
          output += str;
        },
      };

      const mockService = {
        prewarmModel: jest.fn(async ({ onProgress }) => {
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
        stream: mockStream,
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
        write: (str) => {
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
        stream: mockStream,
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
        write: (str) => {
          output += str;
        },
      };

      const mockService = {
        prewarmModel: jest.fn(async (opts) => {
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
        stream: mockStream,
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
        globalThis.fetch = jest.fn().mockResolvedValue({
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
        expect(fs.existsSync(res.path)).toBe(true);
        const st = fs.statSync(res.path);
        expect(st.size).toBe(fakeData.length);
        // Verify executable permission
        expect((st.mode & 0o111) !== 0).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
        await rm(testCacheDir, { recursive: true, force: true });
      }
    });
  });

  describe("promptForAgentModel", () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), "sc-prompt-model-test-"));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("defaults to gemma-3-1b-it-ONNX-GQA (#1) and triggers download when user accepts", async () => {
      const { promptForAgentModel } = await import("./local-models.mjs");

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
        prewarmModel: jest.fn(async () => ({
          modelId: "onnx-community/gemma-3-1b-it-ONNX-GQA",
        })),
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
      expect(mockService.prewarmModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "onnx-community/gemma-3-1b-it-ONNX-GQA",
        }),
      );

      // Verify saved shadow-claw.config.json
      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("transformers_js_local");
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/gemma-3-1b-it-ONNX-GQA",
      );
      expect(capturedOutput).toContain(
        "ShadowClaw CLI Agent — Model Selection:",
      );
      expect(capturedOutput).toContain(
        "Saved default agent model (onnx-community/gemma-3-1b-it-ONNX-GQA)",
      );
    });

    it("allows selecting Qwen3-0.6B-ONNX at option 4", async () => {
      const { promptForAgentModel } = await import("./local-models.mjs");

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
      expect(result.model).toBe("onnx-community/Qwen3-0.6B-ONNX");
      expect(mockService.prewarmModel).not.toHaveBeenCalled();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
    });

    it("allows selecting Llamafile model at option 5 and sets llamafile provider", async () => {
      const { promptForAgentModel } = await import("./local-models.mjs");

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
      const { promptForAgentModel } = await import("./local-models.mjs");

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

    it("allows selecting Gemma 4 E2B ONNX at option 2 and skips download if declined", async () => {
      const { promptForAgentModel } = await import("./local-models.mjs");

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
      expect(result.model).toBe("onnx-community/gemma-4-E2B-it-ONNX");
      expect(mockService.prewarmModel).not.toHaveBeenCalled();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const savedConfig = JSON.parse(await readFile(configPath, "utf8"));
      expect(savedConfig.agent.defaultProvider).toBe("transformers_js_local");
      expect(savedConfig.agent.defaultModel).toBe(
        "onnx-community/gemma-4-E2B-it-ONNX",
      );
    });

    it("handles Ctrl+C (\\x03) character on input stream gracefully", async () => {
      const { promptForAgentModel } = await import("./local-models.mjs");

      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          capturedOutput += chunk.toString();
          callback();
        },
      });

      let exitCode = null;
      const onExit = (code) => {
        exitCode = code;
      };

      const promise = promptForAgentModel({
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
      const { promptForAgentModel } = await import("./local-models.mjs");

      const mockStdin = new PassThrough();
      let capturedOutput = "";
      const mockStdout = new Writable({
        write(chunk, _encoding, callback) {
          capturedOutput += chunk.toString();
          callback();
        },
      });

      let exitCode = null;
      const onExit = (code) => {
        exitCode = code;
      };

      const promise = promptForAgentModel({
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
