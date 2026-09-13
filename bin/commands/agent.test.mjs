import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Pre-warm getAgentCore() once before any test so that the initial ESM
 * import chain (20+ instrumented source modules) does not consume the
 * per-test timeout budget.  Without this, the first test in the file pays
 * an 8 s+ cold-start cost under --coverage, reliably exceeding the
 * default 5 000 ms Jest timeout on GitHub Actions runners.
 */
beforeAll(async () => {
  const { getAgentCore } = await import("../utils/agent-core.mjs");
  await getAgentCore();
}, 60_000);

// Heavy ESM module loading with coverage instrumentation can exceed the
// default 5 000 ms timeout on CI.  Use a generous file-level timeout that
// still catches genuine hangs.
jest.setTimeout(30_000);

/**
 * TDD tests for the `agent init` subcommand.
 */
describe("agent init", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-init-test-"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    closeSqliteDatabase?.();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .agents/skills/ directory", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    await runAgentInit({ workspace: tmpDir });
    await expect(
      access(path.join(tmpDir, ".agents", "skills"), constants.F_OK),
    ).resolves.toBeUndefined();
  });

  it("creates .agents/tools/ directory", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    await runAgentInit({ workspace: tmpDir });
    await expect(
      access(path.join(tmpDir, ".agents", "tools"), constants.F_OK),
    ).resolves.toBeUndefined();
  });

  it("creates database/ directory", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    await runAgentInit({ workspace: tmpDir });
    await expect(
      access(path.join(tmpDir, "database"), constants.F_OK),
    ).resolves.toBeUndefined();
  });

  it("creates a shadow-claw.config.json if missing with OpenRouter defaults", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    await runAgentInit({ workspace: tmpDir });
    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    const content = JSON.parse(await readFile(configPath, "utf8"));
    expect(content).toHaveProperty("site");
    expect(content.settings).toBeDefined();
    expect(content.settings.defaultProvider).toBe("openrouter");
    expect(content.settings.defaultModel).toBe("openrouter/free");
  });

  it("does not overwrite an existing shadow-claw.config.json", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    const existing = {
      custom: "my config",
      settings: { defaultProvider: "ollama" },
    };
    await rm(configPath, { force: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(configPath, JSON.stringify(existing), "utf8");
    await runAgentInit({ workspace: tmpDir });
    const content = JSON.parse(await readFile(configPath, "utf8"));
    expect(content).toEqual(existing);
  });

  it("defaults workspace to .cache dir when options.workspace is not provided", async () => {
    const { runAgentInit } = await import("./agent.mjs");
    const customCache = path.join(tmpDir, ".custom-cache");
    const result = await runAgentInit({ cacheDir: customCache });
    expect(result.workspace).toBe(path.resolve(customCache));
    await expect(
      access(path.join(customCache, ".agents", "skills"), constants.F_OK),
    ).resolves.toBeUndefined();
    await expect(
      access(path.join(customCache, "database", "agent.db"), constants.F_OK),
    ).resolves.toBeUndefined();
  });

  it("bootstrapHeadlessAgent defaults workspace to .cache unless --workspace is explicitly passed", async () => {
    const { bootstrapHeadlessAgent } = await import("./agent-bootstrap.mjs");
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));

    // 1. Without workspace option, defaults to path.resolve(process.cwd(), ".cache")
    const resDefault = await bootstrapHeadlessAgent({ quiet: true });
    expect(resDefault.workspaceDir).toBe(path.resolve(process.cwd(), ".cache"));
    closeSqliteDatabase?.();

    // 2. With cacheDir, defaults to cacheDir
    const customCache = path.join(tmpDir, "custom-cache");
    const resCache = await bootstrapHeadlessAgent({
      cacheDir: customCache,
      quiet: true,
    });
    expect(resCache.workspaceDir).toBe(path.resolve(customCache));
    closeSqliteDatabase?.();

    // 3. With explicit workspace, uses explicit workspace even if cacheDir is provided
    const explicitWorkspace = path.join(tmpDir, "my-explicit-workspace");
    const resExplicit = await bootstrapHeadlessAgent({
      workspace: explicitWorkspace,
      cacheDir: customCache,
      quiet: true,
    });
    expect(resExplicit.workspaceDir).toBe(path.resolve(explicitWorkspace));
    closeSqliteDatabase?.();
  });

  it("runs interactive cache wizard via resolveCacheDir when no existing cache exists", async () => {
    const { bootstrapHeadlessAgent } = await import("./agent-bootstrap.mjs");
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    const { mkdir } = await import("node:fs/promises");
    const { Readable, Writable } = await import("node:stream");

    const emptyDir = path.join(tmpDir, "brand-new-dir");
    await mkdir(emptyDir, { recursive: true });

    const mockStdin = Readable.from(["1\n"]);
    let capturedOutput = "";
    const mockStdout = new Writable({
      write(chunk, _encoding, callback) {
        capturedOutput += chunk.toString();
        callback();
      },
    });

    const prevCwd = process.cwd();
    process.chdir(emptyDir);
    try {
      const result = await bootstrapHeadlessAgent({
        isTTY: true,
        stdin: mockStdin,
        stdout: mockStdout,
      });
      expect(capturedOutput).toContain(
        "ShadowClaw needs a directory to store cache and database files:",
      );
      expect(capturedOutput).toContain(
        "No existing .cache directory was detected in:",
      );
      expect(capturedOutput).toContain("Using current directory cache");
      expect(result.workspaceDir).toBe(path.join(emptyDir, ".cache"));
      closeSqliteDatabase?.();
    } finally {
      process.chdir(prevCwd);
    }
  });

  it("allows selecting temporary directory in cache wizard for agent", async () => {
    const { bootstrapHeadlessAgent } = await import("./agent-bootstrap.mjs");
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    const { mkdir } = await import("node:fs/promises");
    const { Readable, Writable } = await import("node:stream");

    const emptyDir = path.join(tmpDir, "brand-new-dir-2");
    await mkdir(emptyDir, { recursive: true });

    const mockStdin = Readable.from(["2\n"]);
    let capturedOutput = "";
    const mockStdout = new Writable({
      write(chunk, _encoding, callback) {
        capturedOutput += chunk.toString();
        callback();
      },
    });

    const prevCwd = process.cwd();
    process.chdir(emptyDir);
    try {
      const result = await bootstrapHeadlessAgent({
        isTTY: true,
        stdin: mockStdin,
        stdout: mockStdout,
      });
      expect(capturedOutput).toContain("Using temporary directory");
      expect(result.workspaceDir).toBe(path.join(tmpdir(), "shadow-claw"));
      closeSqliteDatabase?.();
    } finally {
      process.chdir(prevCwd);
    }
  });
});

/**
 * TDD tests for `agent skills` and `agent tools` list commands.
 */
describe("agent skills listing", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-skills-test-"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    closeSqliteDatabase?.();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("runAgentSkills returns empty skills array when workspace has no .agents/skills/", async () => {
    const { runAgentSkills } = await import("./agent.mjs");
    const result = await runAgentSkills({ workspace: tmpDir });
    expect(Array.isArray(result.skills)).toBe(true);
    expect(result.skills).toHaveLength(0);
  });

  it("runAgentTools returns built-in tool definitions", async () => {
    const { runAgentTools } = await import("./agent.mjs");
    const result = await runAgentTools({ workspace: tmpDir });
    expect(Array.isArray(result.tools)).toBe(true);
    // Core tools like bash, read_file, write_file must always be present
    const names = result.tools.map((t) => t.name);
    expect(names).toContain("bash");
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
  });

  it("runAgentTools tags render_component as browser-only", async () => {
    const { runAgentTools } = await import("./agent.mjs");
    const result = await runAgentTools({ workspace: tmpDir });
    const rc = result.tools.find((t) => t.name === "render_component");
    expect(rc).toBeDefined();
    expect(rc.headlessSafe).toBe(false);
  });

  it("runAgentTools tags room and UI tools as browser-only", async () => {
    const { runAgentTools } = await import("./agent.mjs");
    const result = await runAgentTools({ workspace: tmpDir });
    const browserTools = [
      "render_component",
      "clear_chat",
      "show_toast",
      "send_notification",
      "ask_user",
      "open_file",
      "create_room",
      "invite_to_room",
      "leave_room",
      "list_room_members",
    ];
    for (const name of browserTools) {
      const tool = result.tools.find((t) => t.name === name);
      expect(tool).toBeDefined();
      expect(tool.headlessSafe).toBe(false);
    }
  });

  it("runAgentSkills discovers skills created in .agents/skills/<name>/SKILL.md", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const skillDir = path.join(tmpDir, ".agents", "skills", "greeter");
    await mkdir(skillDir, { recursive: true });
    const skillContent = `---
name: greeter
description: Greets the user
user-invocable: true
---
Hello from greeter skill!
`;
    await writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf8");

    const { runAgentSkills } = await import("./agent.mjs");
    const result = await runAgentSkills({ workspace: tmpDir });
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe("greeter");
    expect(result.skills[0].description).toBe("Greets the user");
  });

  it("runAgentSkill executes a declarative tool chain skill", async () => {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const skillDir = path.join(tmpDir, ".agents", "skills", "make-file");
    await mkdir(skillDir, { recursive: true });
    const skillContent = `---
name: make-file
description: Creates a file
user-invocable: true
metadata:
  execution:
    type: tools
    tools:
      - name: write_file
        input:
          path: "created-by-skill.txt"
          content: "Skill content"
---
Instructions for make-file
`;
    await writeFile(path.join(skillDir, "SKILL.md"), skillContent, "utf8");

    const { runAgentSkill } = await import("./agent.mjs");
    const result = await runAgentSkill("make-file", { workspace: tmpDir });
    expect(result.success).toBe(true);

    const createdPath = path.join(tmpDir, "created-by-skill.txt");
    const content = await readFile(createdPath, "utf8");
    expect(content).toBe("Skill content");
  });

  it("runAgentCommand dispatches init, skills, tools subcommands", async () => {
    const { runAgentCommand } = await import("./agent.mjs");
    // Test that runAgentCommand handles "init"
    await runAgentCommand("init", [], { workspace: tmpDir });
    await expect(
      access(path.join(tmpDir, ".agents", "skills"), constants.F_OK),
    ).resolves.toBeUndefined();
  });

  describe("agent run", () => {
    let originalExitCode;

    beforeEach(() => {
      originalExitCode = process.exitCode;
      process.exitCode = undefined;
    });

    afterEach(() => {
      process.exitCode = originalExitCode;
    });

    it("fails with exitCode 1 when no LLM provider or credentials are configured", async () => {
      const { runAgentRun } = await import("./agent.mjs");

      // Temporarily clear LLM API keys from environment
      const envKeys = [
        "OPENROUTER_API_KEY",
        "HUGGINGFACE_API_KEY",
        "HF_TOKEN",
        "GEMINI_API_KEY",
        "SHADOW_CLAW_API_KEY",
        "SHADOW_CLAW_PROVIDER",
        "OLLAMA_HOST",
      ];
      const savedEnv = {};
      for (const k of envKeys) {
        savedEnv[k] = process.env[k];
        delete process.env[k];
      }

      try {
        const result = await runAgentRun("what time is it", {
          workspace: tmpDir,
          quiet: true,
        });

        expect(result.success).toBe(false);
        expect(process.exitCode).toBe(1);
        expect(result.error).toMatch(/requires an API key/i);
      } finally {
        for (const k of envKeys) {
          if (savedEnv[k] !== undefined) {
            process.env[k] = savedEnv[k];
          }
        }
      }
    });

    it("fails with exitCode 1 when specified provider requires an API key but none is provided", async () => {
      const { runAgentRun } = await import("./agent.mjs");

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        provider: "openrouter",
        apiKey: "",
        quiet: true,
      });

      expect(result.success).toBe(false);
      expect(process.exitCode).toBe(1);
      expect(result.error).toMatch(/requires an API key/i);
    });

    it("fails with exitCode 1 when an unknown provider is specified", async () => {
      const { runAgentRun } = await import("./agent.mjs");

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        provider: "non-existent-provider",
        apiKey: "fake-key",
        quiet: true,
      });

      expect(result.success).toBe(false);
      expect(process.exitCode).toBe(1);
      expect(result.error).toMatch(/Unknown provider/i);
    });

    it("executes handleInvoke when provider credentials are valid", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const mockInvokeHandler = async (_db, payload) => {
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "The current time is 9:55 PM.",
          },
        });
      };

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(result.response).toBe("The current time is 9:55 PM.");
      expect(process.exitCode).toBeFalsy();
    });

    it("defaults to OpenRouter and openrouter/free model when no provider or model is configured", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Response from default OpenRouter.",
          },
        });
      };

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        apiKey: "sk-or-v1-test",
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.groupId).toBe("server:main");
      expect(capturedPayload.model).toBe("openrouter/free");
    });

    it("interactively prompts for model selection and downloads when unconfigured", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const { PassThrough, Writable } = await import("node:stream");
      const core = await getAgentCore();

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

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Response from selected local model.",
          },
        });
      };

      const originalStdoutWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk, enc, cb) =>
        mockStdout.write(chunk, enc, cb);
      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        stdin: mockStdin,
        stdout: mockStdout,
        isTTY: true,
        invokeHandler: mockInvokeHandler,
        _transformersService: mockService,
      });
      process.stdout.write = originalStdoutWrite;

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.provider).toBe("transformers_js_local");
      expect(capturedPayload.model).toBe(
        "onnx-community/gemma-3-1b-it-ONNX-GQA",
      );
      expect(mockService.prewarmModel).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "onnx-community/gemma-3-1b-it-ONNX-GQA",
        }),
      );
      expect(capturedOutput).toContain(
        "ShadowClaw CLI Agent — Model Selection:",
      );
    });

    it("reads defaultProvider and defaultModel from workspace shadow-claw.config.json", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const config = {
        settings: {
          defaultProvider: "huggingface",
          defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
        },
      };
      await writeFile(configPath, JSON.stringify(config), "utf8");

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Response from configured HuggingFace.",
          },
        });
      };

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        apiKey: "hf_test_token",
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.model).toBe("meta-llama/Llama-3.1-8B-Instruct");
    });

    it("allows CLI options --provider and --model to override shadow-claw.config.json defaults", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const config = {
        settings: {
          defaultProvider: "huggingface",
          defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
        },
      };
      await writeFile(configPath, JSON.stringify(config), "utf8");

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Overridden model response.",
          },
        });
      };

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        provider: "openrouter",
        model: "anthropic/claude-3.7-sonnet",
        apiKey: "sk-or-test",
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload.model).toBe("anthropic/claude-3.7-sonnet");
    });

    it("allows environment variables to override shadow-claw.config.json defaultModel", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const configPath = path.join(tmpDir, "shadow-claw.config.json");
      const config = {
        settings: {
          defaultProvider: "openrouter",
          defaultModel: "openrouter/free",
        },
      };
      await writeFile(configPath, JSON.stringify(config), "utf8");

      process.env.SHADOW_CLAW_MODEL = "openai/gpt-4o-mini";

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Env model response.",
          },
        });
      };

      try {
        const result = await runAgentRun("what time is it", {
          workspace: tmpDir,
          apiKey: "sk-or-test",
          invokeHandler: mockInvokeHandler,
          quiet: true,
        });

        expect(result.success).toBe(true);
        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload.model).toBe("openai/gpt-4o-mini");
      } finally {
        delete process.env.SHADOW_CLAW_MODEL;
      }
    });

    it("passes enabledTools in invokePayload omitting all browser-only and room tools", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Mock response.",
          },
        });
      };

      const result = await runAgentRun("what tools do you have?", {
        workspace: tmpDir,
        apiKey: "sk-or-test",
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(Array.isArray(capturedPayload.enabledTools)).toBe(true);
      const toolNames = capturedPayload.enabledTools.map((t) => t.name);

      // Must include headless-safe tools
      expect(toolNames).toContain("read_file");
      expect(toolNames).toContain("write_file");
      expect(toolNames).toContain("bash");
      expect(toolNames).toContain("web_search");

      // Must NEVER include browser-only tools
      expect(toolNames).not.toContain("clear_chat");
      expect(toolNames).not.toContain("render_component");
      expect(toolNames).not.toContain("show_toast");
      expect(toolNames).not.toContain("send_notification");
      expect(toolNames).not.toContain("ask_user");
      expect(toolNames).not.toContain("open_file");
      expect(toolNames).not.toContain("create_room");
      expect(toolNames).not.toContain("invite_to_room");
      expect(toolNames).not.toContain("leave_room");
      expect(toolNames).not.toContain("list_room_members");
      expect(toolNames).not.toContain("send_file");
      expect(toolNames).not.toContain("spawn_subagent");
    });

    it("enables streaming by default for streaming-capable providers and writes chunks to stdout", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      let capturedPayload = null;
      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "streaming-start",
          payload: { groupId: payload.groupId },
        });
        core.post({
          type: "streaming-chunk",
          payload: { groupId: payload.groupId, text: "It is " },
        });
        core.post({
          type: "streaming-chunk",
          payload: { groupId: payload.groupId, text: "currently 3:00 PM." },
        });
        core.post({
          type: "streaming-done",
          payload: {
            groupId: payload.groupId,
            text: "It is currently 3:00 PM.",
          },
        });
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "It is currently 3:00 PM.",
          },
        });
      };

      try {
        const result = await runAgentRun("what time is it", {
          workspace: tmpDir,
          provider: "openrouter",
          apiKey: "sk-or-v1-test",
          invokeHandler: mockInvokeHandler,
        });

        expect(result.success).toBe(true);
        expect(capturedPayload.streaming).toBe(true);
        expect(stdoutSpy).toHaveBeenCalledWith("It is ");
        expect(stdoutSpy).toHaveBeenCalledWith("currently 3:00 PM.");
        expect(result.response).toBe("It is currently 3:00 PM.");
      } finally {
        stdoutSpy.mockRestore();
      }
    });

    it("disables streaming when noStream: true is passed", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      let capturedPayload = null;
      const mockInvokeHandler = async (_db, payload) => {
        capturedPayload = payload;
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Non-streamed response.",
          },
        });
      };

      const result = await runAgentRun("what time is it", {
        workspace: tmpDir,
        provider: "openrouter",
        apiKey: "sk-or-v1-test",
        noStream: true,
        invokeHandler: mockInvokeHandler,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(capturedPayload.streaming).toBe(false);
      expect(result.response).toBe("Non-streamed response.");
    });

    it("writes progress and tool-activity to stderr", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const stderrSpy = jest
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      const mockInvokeHandler = async (_db, payload) => {
        core.post({
          type: "tool-activity",
          payload: { tool: "get_current_time", status: "running" },
        });
        core.post({
          type: "tool-activity",
          payload: { tool: "get_current_time", status: "completed" },
        });
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "Done.",
          },
        });
      };

      try {
        const result = await runAgentRun("what time is it", {
          workspace: tmpDir,
          provider: "openrouter",
          apiKey: "sk-or-v1-test",
          verbose: true,
          invokeHandler: mockInvokeHandler,
        });

        expect(result.success).toBe(true);
        expect(stderrSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[Agent] Connecting to OpenRouter (openrouter/free) [streaming]...",
          ),
        );
        expect(stderrSpy).toHaveBeenCalledWith(
          "[Tool] get_current_time (running)\n",
        );
        expect(stderrSpy).toHaveBeenCalledWith(
          "[Tool] get_current_time (completed)\n",
        );
      } finally {
        stderrSpy.mockRestore();
        stdoutSpy.mockRestore();
      }
    });

    it("writes streamed response to output file when options.output is specified without writing tokens to stdout", async () => {
      const { runAgentRun } = await import("./agent.mjs");
      const { getAgentCore } = await import("../utils/agent-core.mjs");
      const core = await getAgentCore();

      const stdoutSpy = jest
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const outputFile = path.join(tmpDir, "streamed-output.txt");

      const mockInvokeHandler = async (_db, payload) => {
        core.post({
          type: "streaming-start",
          payload: { groupId: payload.groupId },
        });
        core.post({
          type: "streaming-chunk",
          payload: { groupId: payload.groupId, text: "File streamed content." },
        });
        core.post({
          type: "response",
          payload: {
            groupId: payload.groupId,
            text: "File streamed content.",
          },
        });
      };

      try {
        const result = await runAgentRun("what time is it", {
          workspace: tmpDir,
          provider: "openrouter",
          apiKey: "sk-or-v1-test",
          output: outputFile,
          invokeHandler: mockInvokeHandler,
          quiet: true,
        });

        expect(result.success).toBe(true);
        expect(stdoutSpy).not.toHaveBeenCalledWith("File streamed content.");
        const content = await readFile(outputFile, "utf8");
        expect(content).toBe("File streamed content.");
      } finally {
        stdoutSpy.mockRestore();
      }
    });
  });

  describe("agent tool and tools <name> inspection & execution", () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-tool-test-"));
    });

    afterEach(async () => {
      const { closeSqliteDatabase } =
        await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
          closeSqliteDatabase: () => {},
        }));
      closeSqliteDatabase?.();
      await rm(tmpDir, { recursive: true, force: true });
    });

    it("runAgentTool inspects tool definition schema when no input is given", async () => {
      const { runAgentTool } = await import("./agent.mjs");
      const result = await runAgentTool("write_file", undefined, {
        workspace: tmpDir,
        quiet: true,
      });

      expect(result.success).toBe(true);
      expect(result.tool).toBeDefined();
      expect(result.tool.name).toBe("write_file");
      expect(result.headlessSafe).toBe(true);
      expect(result.tool.input_schema.properties.path).toBeDefined();
      expect(result.tool.input_schema.properties.content).toBeDefined();
    });

    it("runAgentTool directly executes write_file and writes file to workspace", async () => {
      const { runAgentTool } = await import("./agent.mjs");
      const result = await runAgentTool(
        "write_file",
        { path: "test.txt", content: "Hello from direct tool execution!" },
        { workspace: tmpDir, quiet: true },
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("Written");

      const diskContent = await readFile(path.join(tmpDir, "test.txt"), "utf8");
      expect(diskContent).toBe("Hello from direct tool execution!");
    });

    it("runAgentTool directly executes read_file and returns content", async () => {
      const { runAgentTool } = await import("./agent.mjs");
      await writeFile(
        path.join(tmpDir, "sample.txt"),
        "Content to be read",
        "utf8",
      );

      const result = await runAgentTool(
        "read_file",
        { path: "sample.txt" },
        { workspace: tmpDir, quiet: true },
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe("Content to be read");
    });

    it("runAgentCommand routes tools <name> to runAgentTool inspection", async () => {
      const { runAgentCommand } = await import("./agent.mjs");
      const result = await runAgentCommand("tools", ["write_file"], {
        workspace: tmpDir,
        quiet: true,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.tool.name).toBe("write_file");
    });

    it("runAgentCommand routes tool <name> <json> to direct execution", async () => {
      const { runAgentCommand } = await import("./agent.mjs");
      const result = await runAgentCommand(
        "tool",
        [
          "write_file",
          '{"path": "from_cli.txt", "content": "Created via CLI"}',
        ],
        { workspace: tmpDir, quiet: true },
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);

      const diskContent = await readFile(
        path.join(tmpDir, "from_cli.txt"),
        "utf8",
      );
      expect(diskContent).toBe("Created via CLI");
    });

    it("runAgentTool directly executes rewrite_text and returns rewritten text", async () => {
      const { runAgentTool } = await import("./agent.mjs");
      const core = await (
        await import("../utils/agent-core.mjs")
      ).getAgentCore();

      core.setNativeAiTaskHandler(async (_taskType, input) => {
        return `Happier tone: ${input.text}!`;
      });

      const result = await runAgentTool(
        "rewrite_text",
        '{"text": "how are you doing this very fine day", "tone": "happier"}',
        { workspace: tmpDir, quiet: true },
      );

      expect(result.success).toBe(true);
      expect(result.output).toBe(
        "Happier tone: how are you doing this very fine day!",
      );

      core.setNativeAiTaskHandler(null);
    });
  });
});

// ---------------------------------------------------------------------------
// Stdin piping & --output tests
// ---------------------------------------------------------------------------

describe("runAgentTool — stdin piping", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-stdin-tool-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("reads JSON from _stdinData when no inputArg is given", async () => {
    const { runAgentTool } = await import("./agent.mjs");
    const result = await runAgentTool("write_file", undefined, {
      workspace: tmpDir,
      quiet: true,
      // Pre-read stdin data (as produced by runAgentCommand before dispatch)
      _stdinData: JSON.stringify({
        path: "from-stdin.txt",
        content: "stdin json",
      }),
    });

    expect(result.success).toBe(true);
    const content = await readFile(path.join(tmpDir, "from-stdin.txt"), "utf8");
    expect(content).toBe("stdin json");
  });

  it("maps plain-text _stdinData to the `text` field for rewrite_text", async () => {
    const { runAgentTool } = await import("./agent.mjs");
    const core = await (await import("../utils/agent-core.mjs")).getAgentCore();

    core.setNativeAiTaskHandler(async (_taskType, input) => {
      return `Mapped: ${input.text}`;
    });

    const result = await runAgentTool("rewrite_text", undefined, {
      workspace: tmpDir,
      quiet: true,
      _stdinData: "how are you doing today",
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("Mapped: how are you doing today");
    core.setNativeAiTaskHandler(null);
  });

  it('uses "-" as inputArg to trigger _stdinData read', async () => {
    const { runAgentTool } = await import("./agent.mjs");
    const result = await runAgentTool("write_file", "-", {
      workspace: tmpDir,
      quiet: true,
      _stdinData: JSON.stringify({
        path: "dash-arg.txt",
        content: "from dash",
      }),
    });

    expect(result.success).toBe(true);
    const content = await readFile(path.join(tmpDir, "dash-arg.txt"), "utf8");
    expect(content).toBe("from dash");
  });

  it("falls back to inspect mode when _stdinData is null and no inputArg given", async () => {
    const { runAgentTool } = await import("./agent.mjs");
    const result = await runAgentTool("write_file", undefined, {
      workspace: tmpDir,
      quiet: true,
      _stdinData: null, // simulate no piped data
    });

    // Should inspect (not execute) — no output key but headlessSafe present
    expect(result.success).toBe(true);
    expect(result.output).toBeUndefined();
    expect(result.headlessSafe).toBe(true);
  });
});

describe("runAgentTool — --output file", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-output-tool-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes tool output to --output file instead of stdout", async () => {
    const { runAgentTool } = await import("./agent.mjs");
    await writeFile(path.join(tmpDir, "src.txt"), "file content", "utf8");

    const outFile = path.join(tmpDir, "result.txt");
    const result = await runAgentTool(
      "read_file",
      { path: "src.txt" },
      {
        workspace: tmpDir,
        quiet: true,
        output: outFile,
        _stdinData: null,
      },
    );

    expect(result.success).toBe(true);
    const written = await readFile(outFile, "utf8");
    expect(written).toBe("file content");
  });

  it("writes non-string tool output to --output file", async () => {
    const { runAgentTool } = await import("./agent.mjs");
    // write_file returns a string success message — just test it's written
    const outFile = path.join(tmpDir, "wf-result.txt");
    const result = await runAgentTool(
      "write_file",
      { path: "dummy.txt", content: "hello" },
      {
        workspace: tmpDir,
        quiet: true,
        output: outFile,
        _stdinData: null,
      },
    );

    expect(result.success).toBe(true);
    const written = await readFile(outFile, "utf8");
    expect(written.length).toBeGreaterThan(0);
  });
});

describe("runAgentRun — stdin piping", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-stdin-run-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("uses _stdinData as the prompt when no prompt arg is given", async () => {
    const { runAgentRun } = await import("./agent.mjs");

    // Expect failure due to missing API key, NOT because prompt is missing
    const result = await runAgentRun("", {
      workspace: tmpDir,
      quiet: true,
      _stdinData: "What is 2+2?",
    });

    expect(result.error).not.toMatch(/prompt required/i);
  });

  it("combines CLI prompt and _stdinData", async () => {
    const { runAgentRun } = await import("./agent.mjs");

    const result = await runAgentRun("Summarize this", {
      workspace: tmpDir,
      quiet: true,
      _stdinData: "Some document content here.",
    });

    // Fails on missing API key — not on missing prompt
    expect(result.error).not.toMatch(/prompt required/i);
  });

  it("returns error when both prompt and _stdinData are empty/null", async () => {
    const { runAgentRun } = await import("./agent.mjs");

    const result = await runAgentRun("", {
      workspace: tmpDir,
      quiet: true,
      _stdinData: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/prompt required/i);
  });

  it('accepts "-" as prompt to use _stdinData as the full prompt', async () => {
    const { runAgentRun } = await import("./agent.mjs");

    const result = await runAgentRun("-", {
      workspace: tmpDir,
      quiet: true,
      _stdinData: "Tell me a joke",
    });

    // Fails on API key — NOT on prompt required
    expect(result.error).not.toMatch(/prompt required/i);
  });
});

describe("runAgentRun — --output file", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-output-run-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes captured response to --output file", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();
    const outFile = path.join(tmpDir, "answer.txt");

    const mockInvokeHandler = async (_db, payload) => {
      // Simulate the agent responding via core.post (same as other passing tests)
      core.post({
        type: "response",
        payload: {
          groupId: payload.groupId,
          text: "The answer is 42.",
        },
      });
    };

    const result = await runAgentRun("What is the answer?", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-or-v1-test",
      quiet: true,
      output: outFile,
      invokeHandler: mockInvokeHandler,
      _stdinData: null,
    });

    expect(result.success).toBe(true);
    const written = await readFile(outFile, "utf8");
    expect(written).toBe("The answer is 42.");
  });
});

describe("runAgentRun — verbose logging of prompting steps", () => {
  let tmpDir;
  let originalStderrWrite;
  let originalStdoutWrite;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-verbose-test-"));
    originalStderrWrite = process.stderr.write;
    originalStdoutWrite = process.stdout.write;
  });

  afterEach(async () => {
    process.stderr.write = originalStderrWrite;
    process.stdout.write = originalStdoutWrite;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("does not log connecting, tool-activity, or status steps by default (non-verbose)", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let stderrOutput = "";
    process.stderr.write = (chunk) => {
      stderrOutput += chunk.toString();
      return true;
    };
    process.stdout.write = () => true;

    const mockInvokeHandler = async (_db, payload) => {
      core.post({
        type: "tool-activity",
        payload: { tool: "bash", status: "executing" },
      });
      core.post({
        type: "status",
        payload: { label: "Model Progress", message: "tokenizer.json: 100%" },
      });
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Result here" },
      });
    };

    const result = await runAgentRun("Test non-verbose", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      verbose: false,
      invokeHandler: mockInvokeHandler,
    });

    expect(result.success).toBe(true);
    expect(stderrOutput).not.toContain("[Agent] Connecting to");
    expect(stderrOutput).not.toContain("[Tool] bash");
    expect(stderrOutput).not.toContain("[Model Progress]");
  });

  it("logs connecting, tool-activity, and status steps when verbose is true", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let stderrOutput = "";
    process.stderr.write = (chunk) => {
      stderrOutput += chunk.toString();
      return true;
    };
    process.stdout.write = () => true;

    const mockInvokeHandler = async (_db, payload) => {
      core.post({
        type: "tool-activity",
        payload: { tool: "bash", status: "executing" },
      });
      core.post({
        type: "status",
        payload: { label: "Model Progress", message: "tokenizer.json: 100%" },
      });
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Result here" },
      });
    };

    const result = await runAgentRun("Test verbose", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      verbose: true,
      invokeHandler: mockInvokeHandler,
    });

    expect(result.success).toBe(true);
    expect(stderrOutput).toContain("[Agent] Connecting to");
    expect(stderrOutput).toContain("[Tool] bash");
    expect(stderrOutput).toContain("[Model Progress] tokenizer.json: 100%");
  });
});

describe("runAgentRun — custom system prompt options", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-prompt-test-"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    closeSqliteDatabase?.();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("overrides system prompt with --system-prompt inline text", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Ahoy matey!" },
      });
    };

    const result = await runAgentRun("Who are you?", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      systemPrompt: "You are a friendly pirate assistant.",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.systemPrompt).toBe(
      "You are a friendly pirate assistant.",
    );
  });

  it("loads system prompt from a file with --system-prompt-file", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    const promptFile = path.join(tmpDir, "custom-prompt.md");
    await writeFile(
      promptFile,
      "You are an expert TypeScript architect.\nFollow clean code principles.",
      "utf8",
    );

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Understood." },
      });
    };

    const result = await runAgentRun("Check code", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      systemPromptFile: promptFile,
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.systemPrompt).toBe(
      "You are an expert TypeScript architect.\nFollow clean code principles.",
    );
  });

  it("returns error when --system-prompt-file does not exist", async () => {
    const { runAgentRun } = await import("./agent.mjs");

    const nonExistent = path.join(tmpDir, "missing-prompt.txt");
    const result = await runAgentRun("Hello", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      systemPromptFile: nonExistent,
      quiet: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("missing-prompt.txt");
  });

  it("reads agent.systemPrompt from shadow-claw.config.json if CLI option omitted", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        agent: {
          systemPrompt: "Configured prompt from shadow-claw.config.json.",
        },
      }),
      "utf8",
    );

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Ready." },
      });
    };

    const result = await runAgentRun("Status check", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.systemPrompt).toBe(
      "Configured prompt from shadow-claw.config.json.",
    );
  });

  it("resolves agent.systemPromptFile from shadow-claw.config.json relative to config file", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    const promptRelFile = path.join(tmpDir, "prompt.txt");
    await writeFile(
      promptRelFile,
      "Prompt loaded from config file path.",
      "utf8",
    );

    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        agent: {
          systemPromptFile: "./prompt.txt",
        },
      }),
      "utf8",
    );

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Ready." },
      });
    };

    const result = await runAgentRun("Status check", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.systemPrompt).toBe(
      "Prompt loaded from config file path.",
    );
  });
});

describe("runAgentRun — custom tools options", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-tools-test-"));
  });

  afterEach(async () => {
    const { closeSqliteDatabase } =
      await import("../../src/db/sqlite/openSqliteDatabase.js").catch(() => ({
        closeSqliteDatabase: () => {},
      }));
    closeSqliteDatabase?.();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("disables all tools when noTools is true or tools is false", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Answer with no tools." },
      });
    };

    const result = await runAgentRun("What is 2+2?", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      noTools: true,
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload.enabledTools).toEqual([]);
  });

  it("restricts enabled tools to comma-separated list via tools option", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Files read." },
      });
    };

    const result = await runAgentRun("Read a file", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      tools: "read_file, write_file",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    const names = capturedPayload.enabledTools.map((t) => t.name);
    expect(names).toEqual(["read_file", "write_file"]);
  });

  it("filters out unknown and browser-only tools from tools option", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Done." },
      });
    };

    const result = await runAgentRun("Mixed tools", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      tools: "read_file,ask_user,unknown_fake_tool",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    const names = capturedPayload.enabledTools.map((t) => t.name);
    expect(names).toEqual(["read_file"]);
    expect(names).not.toContain("ask_user");
    expect(names).not.toContain("unknown_fake_tool");
  });

  it("activates tools profile with --tools-profile __builtin_default and inherits prompt override", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Profile active." },
      });
    };

    const result = await runAgentRun("Check profile", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      toolsProfile: "__builtin_default",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    const names = capturedPayload.enabledTools.map((t) => t.name);
    // __builtin_default has: javascript, list_files, open_file, read_file, write_file
    // open_file is browser-only, so filtered out in headless
    expect(names).toContain("javascript");
    expect(names).toContain("list_files");
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).not.toContain("open_file");
    expect(names).not.toContain("bash");

    // Inherited system prompt from profile
    expect(capturedPayload.systemPrompt).toContain(
      "You are a helpful coding assistant.",
    );
  });

  it("returns error when toolsProfile cannot be found", async () => {
    const { runAgentRun } = await import("./agent.mjs");

    const result = await runAgentRun("Check missing profile", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      toolsProfile: "non_existent_profile_xyz",
      quiet: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("non_existent_profile_xyz");
  });

  it("restricts tools from shadow-claw.config.json agent.tools if CLI option omitted", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    const configPath = path.join(tmpDir, "shadow-claw.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        agent: {
          tools: ["read_file", "list_files"],
        },
      }),
      "utf8",
    );

    let capturedPayload = null;
    const mockInvokeHandler = async (_db, payload) => {
      capturedPayload = payload;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "Config tools." },
      });
    };

    const result = await runAgentRun("Check config tools", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    expect(result.success).toBe(true);
    expect(capturedPayload).not.toBeNull();
    const names = capturedPayload.enabledTools.map((t) => t.name);
    expect(names).toEqual(["read_file", "list_files"]);
  });
});

describe("runAgentRun — SIGINT cancellation and process cleanup", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "shadow-claw-sigint-test-"));
  });

  afterEach(async () => {
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("handles SIGINT during runAgentRun by aborting invoker and returning cancelled status", async () => {
    const { runAgentRun } = await import("./agent.mjs");
    const { getAgentCore } = await import("../utils/agent-core.mjs");
    const core = await getAgentCore();

    let capturedAbortSignal = null;
    let cleanupCalled = false;
    core.cleanupAllLlamafileProcesses = () => {
      cleanupCalled = true;
    };

    // Resolved the moment mockInvokeHandler is actually entered, so we can
    // safely emit SIGINT only after bootstrapping is complete.  The old
    // approach (setTimeout 20 ms) was a race: on slow CI runners the
    // bootstrapping takes longer than 20 ms, SIGINT fires before the
    // AbortSignal is passed to the handler, and the "abort" event listener
    // is never triggered on an already-aborted signal → the promise hangs.
    let signalInvokerCalled;
    const invokerCalledPromise = new Promise(
      (resolve) => (signalInvokerCalled = resolve),
    );

    const mockInvokeHandler = async (_db, _payload, abortSignal) => {
      capturedAbortSignal = abortSignal;
      signalInvokerCalled(); // unblock the SIGINT emitter
      return new Promise((resolve) => {
        if (!abortSignal) {
          resolve();
          return;
        }
        // Guard: if SIGINT somehow already fired before we got here, resolve
        // immediately — addEventListener won't re-fire for past events.
        if (abortSignal.aborted) {
          resolve();
          return;
        }
        abortSignal.addEventListener("abort", () => resolve());
      });
    };

    const runPromise = runAgentRun("Test interruption", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-test",
      invokeHandler: mockInvokeHandler,
      quiet: true,
    });

    // Wait until bootstrapping is done and the invoker is actually running
    // before emitting SIGINT — this eliminates the timing-dependent race.
    await invokerCalledPromise;

    // Emit SIGINT
    process.emit("SIGINT");

    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.error).toBe("Operation cancelled.");
    expect(capturedAbortSignal?.aborted).toBe(true);
    expect(cleanupCalled).toBe(true);
  });
});
