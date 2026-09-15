import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("agent model command and declarative agent config", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-model-test-"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } =
      await import("../../db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    closeSqliteDatabase?.();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("agent init creates agent config block with default local ONNX model", async () => {
    const { runAgentInit } = await import("./agent.js");
    await runAgentInit({ workspace: tmpDir });
    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    const content = JSON.parse(await readFile(configPath, "utf8"));

    expect(content.agent).toBeDefined();
    expect(content.agent.defaultProvider).toBe("transformers_js_local");
    expect(content.agent.defaultModel).toBe(
      "onnx-community/gemma-3-1b-it-ONNX-GQA",
    );
  });

  it("agent init allows specifying custom provider and model", async () => {
    const { runAgentInit } = await import("./agent.js");
    await runAgentInit({
      workspace: tmpDir,
      provider: "transformers_js_local",
      model: "onnx-community/gemma-4-E2B-it-ONNX",
    });
    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    const content = JSON.parse(await readFile(configPath, "utf8"));

    expect(content.agent.defaultModel).toBe(
      "onnx-community/gemma-4-E2B-it-ONNX",
    );
  });

  it("resolveAgentProvider prioritizes workspace config agent block", async () => {
    const { resolveAgentProvider } = await import("./agent.js");
    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    const customConfig = {
      agent: {
        defaultProvider: "transformers_js_local",
        defaultModel: "onnx-community/gemma-4-E4B-it-ONNX",
      },
      settings: {
        defaultProvider: "openrouter",
        defaultModel: "openrouter/free",
      },
    };
    await writeFile(configPath, JSON.stringify(customConfig), "utf8");

    const mockDb = {};
    const mockCore = {
      getConfig: jest.fn<any>().mockResolvedValue(null),
      getProvider: jest.fn((id: any) => ({ id, defaultModel: "default" })),
    };

    const resolved = await resolveAgentProvider(mockDb, mockCore, tmpDir, {});
    expect(resolved.providerId).toBe("transformers_js_local");
    expect(resolved.model).toBe("onnx-community/gemma-4-E4B-it-ONNX");
  });

  describe("runAgentModel", () => {
    it("lists curated local models with default indicator", async () => {
      const { runAgentModel } = await import("./agent.js");
      const result: any = await runAgentModel("list", undefined, {
        workspace: tmpDir,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(result.models.length).toBe(4);
      expect(result.models.map((m) => m.id)).toContain(
        "onnx-community/Qwen3-0.6B-ONNX",
      );
      expect(result.models.map((m) => m.id)).toContain(
        "onnx-community/gemma-3-1b-it-ONNX-GQA",
      );
      expect(result.models.map((m) => m.id)).toContain(
        "onnx-community/gemma-4-E2B-it-ONNX",
      );
      expect(result.models.map((m) => m.id)).toContain(
        "onnx-community/gemma-4-E4B-it-ONNX",
      );

      expect(result.llamafileModels.length).toBe(6);
      expect(result.llamafileModels[0].fileName).toBe(
        "gemma-4-E2B-it-Q5_K_M.llamafile",
      );
    });

    it("sets default model in shadow-claw.config.json", async () => {
      const { runAgentModel } = await import("./agent.js");
      const result: any = await runAgentModel(
        "set",
        "onnx-community/gemma-4-E4B-it-ONNX",
        {
          workspace: tmpDir,
          quiet: true,
        },
      );

      expect(result.success).toBe(true);
      expect(result.model).toBe("onnx-community/gemma-4-E4B-it-ONNX");

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const content = JSON.parse(await readFile(configPath, "utf8"));
      expect(content.agent.defaultModel).toBe(
        "onnx-community/gemma-4-E4B-it-ONNX",
      );
    });

    it("requires model id when setting default model", async () => {
      const { runAgentModel } = await import("./agent.js");
      const result: any = await runAgentModel("set", undefined, {
        workspace: tmpDir,
        quiet: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/specify a model ID/i);
    });

    it("dispatches through runAgentCommand with model and models alias", async () => {
      const { runAgentCommand } = await import("./agent.js");
      const res1 = await runAgentCommand("model", ["list"], {
        workspace: tmpDir,
        quiet: true,
      });
      expect(res1.success).toBe(true);

      const res2 = await runAgentCommand("models", ["list"], {
        workspace: tmpDir,
        quiet: true,
      });
      expect(res2.success).toBe(true);
    });

    it("lists remote models from Hugging Face when remote flag or action is passed", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: "onnx-community/Qwen3-0.6B-ONNX" },
          { id: "onnx-community/SmolLM2-135M-ONNX" },
        ],
      });

      try {
        const { runAgentModel } = await import("./agent.js");
        const result: any = await runAgentModel("remote", undefined, {
          workspace: tmpDir,
          quiet: true,
        });

        expect(result.success).toBe(true);
        expect(result.models.length).toBe(2);
        expect(result.models.map((m) => m.id)).toContain(
          "onnx-community/SmolLM2-135M-ONNX",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
