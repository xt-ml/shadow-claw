/**
 * ShadowClaw CLI — `agent` command
 * Headless CLI agent participant supporting init, skills, tools, skill, and run.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

import { bootstrapHeadlessAgent } from "./agent-bootstrap.mjs";
import { getAgentCore } from "../utils/agent-core.mjs";
import { readStdin, mapTextToToolInput } from "../utils/stdin.mjs";

const BROWSER_ONLY_TOOLS = new Set([
  "ask_user",
  "attach_file_to_chat",
  "clear_chat",
  "create_room",
  "invite_to_room",
  "leave_room",
  "list_components",
  "list_room_members",
  "open_file",
  "render_component",
  "send_file",
  "show_toast",
  "send_notification",
  "spawn_subagent",
]);

const DEFAULT_SERVER_GROUP_ID = "server:main";

const CONFIG_CANDIDATES = [
  "shadow-claw.config.json",
  "shadow-claw-config.json",
  "shadowclaw.config.json",
  "site-config.json",
];

async function fileExists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load and parse workspace configuration if present.
 * @param {string} workspace
 * @returns {Promise<{ configPath: string, config: import("../../src/worker/headless-types.js").ShadowClawWorkspaceConfig } | null>}
 */
export async function loadWorkspaceConfig(workspace, contentRoot) {
  const dirs = [];
  if (workspace) dirs.push(path.resolve(workspace));
  if (contentRoot) {
    const resolvedRoot = path.resolve(contentRoot);
    if (!dirs.includes(resolvedRoot)) dirs.push(resolvedRoot);
  }
  if (workspace && path.basename(path.resolve(workspace)) === ".cache") {
    const parent = path.dirname(path.resolve(workspace));
    if (!dirs.includes(parent)) dirs.push(parent);
  }

  for (const dir of dirs) {
    for (const candidate of CONFIG_CANDIDATES) {
      const p = path.join(dir, candidate);
      if (await fileExists(p)) {
        try {
          const raw = await readFile(p, "utf8");
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            return { configPath: p, config: parsed };
          }
        } catch {}
      }
    }
  }
  return null;
}

/**
 * Initialize a headless agent workspace directory.
 * @param {import("../../src/worker/headless-types.js").AgentInitOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentInitResult>}
 */
export async function runAgentInit(options = {}) {
  let workspace;
  if (options.workspace) {
    workspace = path.resolve(options.workspace);
  } else {
    const { resolveCacheDir } = await import("../utils/resolve-cache-dir.mjs");
    const resolved = await resolveCacheDir({
      contentRoot: process.cwd(),
      cacheDir: options.cacheDir,
      databaseDir: options.databaseDir,
      tmp: options.tmp || options.temp,
      yes: options.yes || options.y,
      quiet: options.quiet,
      isTTY: options.isTTY,
      stdin: options.stdin,
      stdout: options.stdout,
    });
    workspace = resolved.cacheDir;
  }

  const skillsDir = path.join(workspace, ".agents", "skills");
  const toolsDir = path.join(workspace, ".agents", "tools");
  const dbDir = path.join(workspace, "database");

  await mkdir(workspace, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(toolsDir, { recursive: true });
  await mkdir(dbDir, { recursive: true });

  let defaultProvider = options.provider;
  let defaultModel = options.model;

  const isDirectTTY = options.stdin
    ? Boolean(options.stdin.isTTY)
    : Boolean(process.stdin.isTTY);
  const hasAlternateTTY =
    !options.stdin &&
    !process.stdin.isTTY &&
    Boolean(process.stderr.isTTY || process.stdout.isTTY);
  const isTTY =
    options.isTTY !== undefined
      ? Boolean(options.isTTY)
      : isDirectTTY || hasAlternateTTY;
  const isCI =
    options.isCI !== undefined
      ? Boolean(options.isCI)
      : options.isTTY !== undefined
        ? false
        : Boolean(
            process.env.CI &&
            !["0", "false"].includes(process.env.CI.toLowerCase()),
          );
  const isInteractive =
    isTTY && !isCI && !options.quiet && !options.yes && !options.y;

  if (!defaultProvider && !defaultModel && isInteractive) {
    const { promptForAgentModel } = await import("../utils/local-models.mjs");
    const chosen = await promptForAgentModel({
      workspaceDir: workspace,
      contentRoot: process.cwd(),
      cacheDir: options.cacheDir,
      stdin: options.stdin,
      stdout: options.stdout,
      quiet: options.quiet,
      isTTY,
    });
    defaultProvider = chosen.providerId;
    defaultModel = chosen.model;
  }

  if (!defaultProvider) defaultProvider = "transformers_js_local";
  if (!defaultModel) {
    const { DEFAULT_LOCAL_MODEL } = await import("../utils/local-models.mjs");
    defaultModel =
      defaultProvider === "transformers_js_local"
        ? DEFAULT_LOCAL_MODEL
        : "openrouter/free";
  }

  const existingConfig = await loadWorkspaceConfig(workspace);
  if (!existingConfig) {
    const canonicalConfigPath = path.join(workspace, "shadow-claw.config.json");
    const defaultConfig = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      site: {
        title: "ShadowClaw Agent Workspace",
        description: "Headless CLI agent workspace",
      },
      settings: {
        defaultProvider: "openrouter",
        defaultModel: "openrouter/free",
      },
      agent: {
        defaultProvider,
        defaultModel,
      },
    };
    await writeFile(
      canonicalConfigPath,
      JSON.stringify(defaultConfig, null, 2) + "\n",
      "utf8",
    );
  }

  if (
    options.download &&
    (defaultProvider === "transformers_js_local" ||
      defaultProvider === "llamafile")
  ) {
    const { downloadLocalModel } = await import("../utils/local-models.mjs");
    await downloadLocalModel(defaultModel, {
      cacheDir: options.cacheDir,
      verbose: options.verbose,
      isTTY: options.isTTY,
    });
  }

  // Initialize SQLite database
  await bootstrapHeadlessAgent({ workspace, quiet: true });

  return { success: true, workspace };
}

/**
 * List available skills in the workspace.
 * @param {import("../../src/worker/headless-types.js").AgentSkillsOptions} [options]
 */
export async function runAgentSkills(options = {}) {
  const { db, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;
  const discovery = await core.discoverSkills(db, groupId);

  return {
    skills: discovery.skills,
    diagnostics: discovery.diagnostics,
  };
}

/**
 * List available tools and their headless capability status.
 * @param {import("../../src/worker/headless-types.js").AgentToolsOptions} [options]
 */
export async function runAgentTools(options = {}) {
  const { db, core } = await bootstrapHeadlessAgent(options);

  let profileToolNames = null;
  if (options.toolsProfile || options.profile) {
    const target = String(options.toolsProfile || options.profile)
      .trim()
      .toLowerCase();
    const defaultBuiltinProfile = core.DEFAULT_BUILTIN_PROFILE || null;
    let dbProfiles = [];
    if (typeof core.getConfig === "function") {
      try {
        const raw = await core.getConfig(
          db,
          core.CONFIG_KEYS?.TOOL_PROFILES || "tool_profiles",
        );
        if (typeof raw === "string") dbProfiles = JSON.parse(raw);
        else if (Array.isArray(raw)) dbProfiles = raw;
      } catch {}
    }
    const allProfiles = [defaultBuiltinProfile, ...dbProfiles].filter(Boolean);
    const matched = allProfiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );
    if (matched) {
      profileToolNames = new Set(matched.enabledToolNames || []);
    }
  }

  const tools = (core.TOOL_DEFINITIONS || []).map((def) => ({
    name: def.name,
    description: def.description,
    headlessSafe: !BROWSER_ONLY_TOOLS.has(def.name),
    ...(profileToolNames ? { enabled: profileToolNames.has(def.name) } : {}),
  }));

  return { tools };
}

/**
 * Inspect a tool definition or directly execute a tool in the workspace.
 * @param {string} toolName
 * @param {Record<string, any> | string} [inputArg]
 * @param {import("../../src/worker/headless-types.js").AgentToolOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentToolResult>}
 */
export async function runAgentTool(toolName, inputArg, options = {}) {
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  // Find tool in built-in TOOL_DEFINITIONS or declarative tools
  let toolDef = (core.TOOL_DEFINITIONS || []).find((t) => t.name === toolName);
  if (!toolDef && typeof core.loadDeclarativeTools === "function") {
    try {
      const decl = await core.loadDeclarativeTools(db, groupId);
      toolDef = decl.tools.find((t) => t.name === toolName);
    } catch {}
  }

  if (!toolDef) {
    const errorMsg = `Error: Tool "${toolName}" not found.`;
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  const headlessSafe = !BROWSER_ONLY_TOOLS.has(toolDef.name);

  // Resolve raw input: CLI arg → options.input → pre-read stdin → undefined (inspect mode)
  let rawInput = inputArg ?? options.input;

  // If the arg is "-" treat it as "read from stdin"
  if (rawInput === "-") rawInput = undefined;

  // If no input yet, check for pre-read stdin data (_stdinData is set by runAgentCommand)
  if (
    (rawInput === undefined || rawInput === null) &&
    options._stdinData != null
  ) {
    const piped = options._stdinData;
    // Try to parse as JSON; if not valid JSON, map as plain text
    let parsed;
    try {
      parsed = JSON.parse(piped);
    } catch {
      parsed = mapTextToToolInput(piped, toolDef.input_schema);
    }
    rawInput = parsed;
  }

  if (rawInput !== undefined && rawInput !== null) {
    let parsedInput = {};
    if (typeof rawInput === "string") {
      try {
        parsedInput = JSON.parse(rawInput);
      } catch (err) {
        const errorMsg = `Error: Failed to parse input JSON: ${err.message}`;
        if (!options.quiet) {
          console.error(errorMsg);
        }
        process.exitCode = 1;
        return { success: false, error: errorMsg };
      }
    } else if (typeof rawInput === "object") {
      parsedInput = rawInput;
    }

    let invokeContext = undefined;
    try {
      const resolved = await resolveAgentProvider(
        db,
        core,
        workspaceDir,
        options,
      );
      invokeContext = {
        db,
        provider: resolved.providerId,
        model: resolved.model,
        apiKey: resolved.apiKey,
      };
    } catch {}

    try {
      const output = await core.executeTool(
        db,
        toolName,
        parsedInput,
        groupId,
        {
          invokeContext,
        },
      );
      const outputText =
        typeof output === "string" ? output : JSON.stringify(output, null, 2);

      if (options.output) {
        await writeFile(path.resolve(options.output), outputText, "utf8");
        if (!options.quiet) {
          process.stderr.write(`Output written to ${options.output}\n`);
        }
      } else if (!options.quiet) {
        process.stdout.write(outputText + "\n");
      }
      return {
        success: true,
        tool: toolDef,
        headlessSafe,
        output,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!options.quiet) {
        console.error(`Error executing tool "${toolName}": ${errorMsg}`);
      }
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }
  }

  // Otherwise, inspect and display the tool definition and schema
  if (!options.quiet) {
    const tag = headlessSafe ? "[headless-safe]" : "[browser-only]";
    console.log(`Tool: ${toolDef.name} ${tag}\n`);
    console.log(`Description:\n  ${toolDef.description}\n`);
    if (toolDef.input_schema) {
      console.log(`Parameters (JSON Schema):`);
      console.log(JSON.stringify(toolDef.input_schema, null, 2));
      console.log();
    }
    console.log(`Usage:`);
    console.log(
      `  Direct CLI:   npx shadow-claw agent tool ${toolDef.name} '<json-input>'`,
    );
    console.log(
      `  Pipe input:   echo '<text>' | npx shadow-claw agent tool ${toolDef.name}`,
    );
    console.log(`  Agent Prompt: npx shadow-claw agent run "<instruction>"\n`);
  }

  return {
    success: true,
    tool: toolDef,
    headlessSafe,
  };
}

/**
 * Execute a skill by name directly via its declarative tool chain.
 * @param {string} skillName
 * @param {import("../../src/worker/headless-types.js").AgentSkillOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentSkillResult>}
 */
export async function runAgentSkill(skillName, options = {}) {
  const { db, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  const skill = await core.loadSkill(db, groupId, skillName);
  if (!skill) {
    throw new Error(`Skill "${skillName}" not found in workspace.`);
  }

  if (
    skill.execution?.type === "tools" &&
    Array.isArray(skill.execution.tools)
  ) {
    const normalizedTools = skill.execution.tools.map((t) => ({
      name: t.name || t.tool,
      input: t.input || t.arguments || {},
      suppressOutput: t.suppressOutput,
    }));

    const chainResult = await core.executeToolChain(
      db,
      groupId,
      normalizedTools,
      {
        isManual: true,
      },
    );

    return {
      success: true,
      skill,
      results: chainResult.results,
      rawOutputs: chainResult.rawOutputs,
    };
  }

  return {
    success: true,
    skill,
    message: `Skill "${skillName}" loaded (no declarative tools defined).`,
  };
}

/**
 * Resolve active LLM provider, configuration, API key, and model for headless agent.
 * @param {any} db
 * @param {any} core
 * @param {string} workspaceDir
 * @param {Record<string, any>} [options]
 */
export async function resolveAgentProvider(
  db,
  core,
  workspaceDir,
  options = {},
) {
  const contentRoot = options.contentRoot;
  const workspaceConfigData = await loadWorkspaceConfig(
    workspaceDir,
    contentRoot,
  );
  const workspaceConfig = workspaceConfigData?.config || {};
  const workspaceSettings = workspaceConfig.settings || {};
  const workspaceAgent = workspaceConfig.agent || workspaceSettings.agent || {};

  // 1. Resolve Provider
  let providerId =
    options.provider ||
    process.env.SHADOW_CLAW_PROVIDER ||
    process.env.SHADOW_CLAW_DEFAULT_PROVIDER;

  if (!providerId && typeof core.getConfig === "function") {
    providerId = await core.getConfig(
      db,
      core.CONFIG_KEYS?.PROVIDER || "provider",
    );
  }

  if (!providerId) {
    providerId =
      workspaceAgent.defaultProvider ||
      workspaceAgent.provider ||
      workspaceSettings.defaultProvider ||
      workspaceSettings.provider ||
      workspaceConfig.defaultProvider;
  }

  const isDirectTTY = options.stdin
    ? Boolean(options.stdin.isTTY)
    : Boolean(process.stdin.isTTY);
  const hasAlternateTTY =
    !options.stdin &&
    !process.stdin.isTTY &&
    Boolean(process.stderr.isTTY || process.stdout.isTTY);
  const isTTY =
    options.isTTY !== undefined
      ? Boolean(options.isTTY)
      : isDirectTTY || hasAlternateTTY;
  const isCI =
    options.isCI !== undefined
      ? Boolean(options.isCI)
      : options.isTTY !== undefined
        ? false
        : Boolean(
            process.env.CI &&
            !["0", "false"].includes(process.env.CI.toLowerCase()),
          );
  const isInteractive = isTTY && !isCI && !options.quiet;

  if (!providerId) {
    if (isInteractive) {
      const { promptForAgentModel } = await import("../utils/local-models.mjs");
      const chosen = await promptForAgentModel({
        workspaceDir,
        contentRoot,
        cacheDir: options.cacheDir,
        stdin: options.stdin,
        stdout: options.stdout,
        quiet: options.quiet,
        isTTY,
        service: options._transformersService,
      });
      providerId = chosen.providerId;
      options.model = chosen.model;
    } else {
      providerId = "openrouter";
    }
  }

  const providerConfig =
    typeof core.getProvider === "function"
      ? core.getProvider(providerId)
      : null;

  if (!providerConfig) {
    const errorMsg = `Error: Unknown provider "${providerId}".`;
    throw new Error(errorMsg);
  }

  // 2. Resolve API Key
  let apiKey = options.apiKey || process.env.SHADOW_CLAW_API_KEY;
  if (!apiKey) {
    switch (providerId) {
      case "openrouter":
        apiKey = process.env.OPENROUTER_API_KEY;
        break;
      case "huggingface":
        apiKey = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
        break;
      case "gemini_proxy":
        apiKey = process.env.GEMINI_API_KEY;
        break;
    }
  }

  if (!apiKey && typeof core.getConfig === "function") {
    apiKey =
      (await core.getConfig(db, `api_key:${providerId}`)) ||
      (await core.getConfig(db, "apiKey"));
  }

  // 3. Resolve Model
  const model =
    options.model ||
    process.env.SHADOW_CLAW_MODEL ||
    process.env.SHADOW_CLAW_DEFAULT_MODEL ||
    (typeof core.getConfig === "function"
      ? await core.getConfig(db, core.CONFIG_KEYS?.MODEL || "model")
      : null) ||
    workspaceAgent.defaultModel ||
    workspaceAgent.model ||
    workspaceSettings.defaultModel ||
    workspaceSettings.model ||
    workspaceConfig.defaultModel ||
    providerConfig?.defaultModel ||
    (providerId === "transformers_js_local" ? DEFAULT_LOCAL_MODEL : "default");

  // 4. Ensure model is downloaded if transformers_js_local or llamafile
  if (providerId === "transformers_js_local" || providerId === "llamafile") {
    const { isModelLocallyCached, downloadLocalModel } =
      await import("../utils/local-models.mjs");
    const isCached = isModelLocallyCached(model, options.cacheDir);
    if (!isCached) {
      const outStream = options.stdout || process.stderr;
      if (options.download) {
        if (!options.quiet) {
          outStream.write(`\nDownloading ${model} from Hugging Face...\n`);
        }
        await downloadLocalModel(model, {
          cacheDir: options.cacheDir,
          stream: outStream,
          isTTY,
          service: options._transformersService,
          progress: options.progress !== false && !options.noProgress,
          verbose: options.verbose,
        });
      } else if (isInteractive) {
        const readline = await import("node:readline/promises");
        const tty = await import("node:tty");
        const fs = await import("node:fs");

        let input = options.stdin || process.stdin;
        let output = outStream;
        let closeInputOnFinish = false;
        let ttyFd = null;

        if (input === process.stdin && !process.stdin.isTTY) {
          if (
            !process.env.CI &&
            (process.stderr.isTTY || process.stdout.isTTY)
          ) {
            try {
              const ttyDevice =
                process.platform === "win32" ? "CONIN$" : "/dev/tty";
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
          if (typeof options.onExit === "function") {
            options.onExit(130);
          } else {
            process.exit(130);
          }
        };

        rl.on("SIGINT", handleSigint);
        if (
          input &&
          typeof input.on === "function" &&
          input !== process.stdin
        ) {
          input.on("SIGINT", handleSigint);
        }
        const processSigintListener = () => handleSigint();
        process.on("SIGINT", processSigintListener);

        const dataListener = (chunk) => {
          const str =
            typeof chunk === "string" ? chunk : chunk.toString("binary");
          if (str.includes("\x03") || str.includes("\x04")) {
            handleSigint();
          }
        };
        if (input && typeof input.on === "function") {
          input.on("data", dataListener);
        }

        let answer = "";
        try {
          answer = (
            await rl.question(
              `\nModel "${model}" is not yet downloaded to local disk.\nDownload model weights now? (Y/n) [default: Y]: `,
            )
          )
            .trim()
            .toLowerCase();
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

        if (answer === "" || answer === "y" || answer === "yes") {
          outStream.write(`\nDownloading ${model} from Hugging Face...\n`);
          await downloadLocalModel(model, {
            cacheDir: options.cacheDir,
            stream: outStream,
            isTTY,
            service: options._transformersService,
            progress: options.progress !== false && !options.noProgress,
            verbose: options.verbose,
          });
        }
      }
    }
  }

  return {
    providerId,
    providerConfig,
    apiKey: apiKey || "",
    model,
    workspaceConfigData,
    workspaceConfig,
    workspaceSettings,
    workspaceAgent,
  };
}

/**
 * Helper to resolve available tools and profiles for headless agent execution.
 */
async function resolveToolsAndProfile(
  db,
  core,
  groupId,
  workspaceConfig,
  workspaceSettings,
  workspaceAgent,
  options,
) {
  // 1. Gather all available tools (built-in + declarative)
  const allTools = [...(core.TOOL_DEFINITIONS || [])];
  if (typeof core.loadDeclarativeTools === "function") {
    try {
      const decl = await core.loadDeclarativeTools(db, groupId);
      if (decl && Array.isArray(decl.tools)) {
        for (const dt of decl.tools) {
          if (!allTools.some((t) => t.name === dt.name)) {
            allTools.push(dt);
          }
        }
      }
    } catch {}
  }

  const allAvailableTools = allTools.filter(
    (t) => !BROWSER_ONLY_TOOLS.has(t.name),
  );

  let enabledTools = allAvailableTools;
  let profileSystemPromptOverride = null;

  async function getKnownProfiles() {
    const defaultBuiltinProfile = core.DEFAULT_BUILTIN_PROFILE || null;

    let dbProfiles = [];
    if (typeof core.getConfig === "function") {
      try {
        const raw = await core.getConfig(
          db,
          core.CONFIG_KEYS?.TOOL_PROFILES || "tool_profiles",
        );
        if (typeof raw === "string") {
          dbProfiles = JSON.parse(raw);
        } else if (Array.isArray(raw)) {
          dbProfiles = raw;
        }
      } catch {}
    }

    const configProfiles =
      workspaceConfig?.toolProfiles ||
      workspaceSettings?.toolProfiles ||
      workspaceConfig?.profiles ||
      [];

    return [defaultBuiltinProfile, ...dbProfiles, ...configProfiles].filter(
      Boolean,
    );
  }

  // 2. Check --no-tools / disabled tools
  const disableTools =
    options.noTools === true ||
    options.tools === false ||
    options.tools === "none" ||
    options.tools === "";

  if (disableTools) {
    enabledTools = [];
    return { enabledTools, profileSystemPromptOverride };
  }

  // 3. Check explicit tools list from CLI
  if (options.tools !== undefined && options.tools !== null) {
    const requestedNames = (
      Array.isArray(options.tools)
        ? options.tools
        : String(options.tools).split(",")
    )
      .map((t) => String(t).trim())
      .filter(Boolean);

    enabledTools = requestedNames
      .map((name) => allAvailableTools.find((t) => t.name === name))
      .filter(Boolean);
    return { enabledTools, profileSystemPromptOverride };
  }

  // 4. Check explicit toolsProfile from CLI
  if (options.toolsProfile) {
    const profiles = await getKnownProfiles();
    const target = String(options.toolsProfile).trim().toLowerCase();
    const matched = profiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );

    if (!matched) {
      throw new Error(
        `Error: Tool profile "${options.toolsProfile}" not found.`,
      );
    }

    const enabledNames = new Set(matched.enabledToolNames || []);
    enabledTools = allAvailableTools.filter((t) => enabledNames.has(t.name));
    if (matched.customTools && Array.isArray(matched.customTools)) {
      for (const ct of matched.customTools) {
        if (
          !BROWSER_ONLY_TOOLS.has(ct.name) &&
          !enabledTools.some((t) => t.name === ct.name)
        ) {
          enabledTools.push(ct);
        }
      }
    }
    if (matched.systemPromptOverride) {
      profileSystemPromptOverride = matched.systemPromptOverride;
    }
    return { enabledTools, profileSystemPromptOverride };
  }

  // 5. Check workspace config (shadow-claw.config.json)
  const configTools = workspaceAgent?.tools ?? workspaceAgent?.enabledTools;
  if (configTools !== undefined && configTools !== null) {
    if (configTools === false || configTools === "none" || configTools === "") {
      enabledTools = [];
      return { enabledTools, profileSystemPromptOverride };
    }
    const requestedNames = (
      Array.isArray(configTools) ? configTools : String(configTools).split(",")
    )
      .map((t) => String(t).trim())
      .filter(Boolean);
    enabledTools = requestedNames
      .map((name) => allAvailableTools.find((t) => t.name === name))
      .filter(Boolean);
    return { enabledTools, profileSystemPromptOverride };
  }

  const configProfile =
    workspaceAgent?.toolsProfile || workspaceAgent?.defaultToolsProfile;
  if (configProfile) {
    const profiles = await getKnownProfiles();
    const target = String(configProfile).trim().toLowerCase();
    const matched = profiles.find(
      (p) =>
        (p.id && String(p.id).toLowerCase() === target) ||
        (p.name && String(p.name).toLowerCase() === target),
    );
    if (matched) {
      const enabledNames = new Set(matched.enabledToolNames || []);
      enabledTools = allAvailableTools.filter((t) => enabledNames.has(t.name));
      if (matched.systemPromptOverride) {
        profileSystemPromptOverride = matched.systemPromptOverride;
      }
      return { enabledTools, profileSystemPromptOverride };
    }
  }

  return { enabledTools, profileSystemPromptOverride };
}

/**
 * Execute a prompt in headless agent mode.
 * @param {string} [prompt]
 * @param {import("../../src/worker/headless-types.js").AgentRunOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").AgentRunResult>}
 */
export async function runAgentRun(prompt, options = {}) {
  const { db, workspaceDir, core } = await bootstrapHeadlessAgent(options);
  const groupId =
    options.group || core.DEFAULT_SERVER_GROUP_ID || DEFAULT_SERVER_GROUP_ID;

  // Stdin support: use pre-read stdin data (_stdinData injected by runAgentCommand or caller)
  const piped = options._stdinData ?? null;
  if (prompt === "-") {
    // "-" means: use only stdin as the prompt
    prompt = piped || "";
  } else if (piped) {
    // Both CLI prompt and piped data: combine them
    prompt = prompt ? `${prompt}\n\n${piped}` : piped;
  }

  if (!prompt) {
    const errorMsg =
      "Error: Prompt required. Provide a prompt argument or pipe text to stdin.";
    if (!options.quiet) console.error(errorMsg);
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  let providerId,
    providerConfig,
    apiKey,
    model,
    workspaceConfigData,
    workspaceConfig,
    workspaceSettings,
    workspaceAgent;
  try {
    const resolved = await resolveAgentProvider(
      db,
      core,
      workspaceDir,
      options,
    );
    providerId = resolved.providerId;
    providerConfig = resolved.providerConfig;
    apiKey = resolved.apiKey;
    model = resolved.model;
    workspaceConfigData = resolved.workspaceConfigData;
    workspaceConfig = resolved.workspaceConfig;
    workspaceSettings = resolved.workspaceSettings;
    workspaceAgent = resolved.workspaceAgent;
  } catch (err) {
    if (!options.quiet) {
      console.error(err.message);
    }
    process.exitCode = 1;
    return { success: false, error: err.message };
  }

  const requiresApiKey = providerConfig.requiresApiKey !== false;
  if (requiresApiKey && !apiKey) {
    const envVar =
      providerId === "huggingface"
        ? "HUGGINGFACE_API_KEY"
        : `${providerId.toUpperCase()}_API_KEY`;
    const errorMsg =
      `Error: Provider "${providerId}" requires an API key, but none was provided.\n` +
      `Please provide an API key via --api-key <key> or export ${envVar}="...".`;
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }

  // 4. Load recent message history
  let history = [];
  if (typeof core.getRecentMessages === "function") {
    try {
      history = await core.getRecentMessages(db, groupId, 50);
    } catch {}
  }

  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    groupId,
    role: "user",
    content: prompt,
    timestamp: Date.now(),
  };

  if (typeof core.saveMessage === "function") {
    try {
      await core.saveMessage(db, userMessage);
    } catch {}
  }

  const supportsStreaming = providerConfig?.supportsStreaming === true;
  const allowStreaming =
    options.stream !== false &&
    options.streaming !== false &&
    !options.noStream;
  const isStreaming = supportsStreaming && allowStreaming;

  const maxTokens =
    Number(options.maxTokens) ||
    (typeof core.getModelMaxTokens === "function"
      ? core.getModelMaxTokens(model)
      : core.DEFAULT_MAX_TOKENS || 8192);

  if (options.verbose && !options.quiet) {
    const providerName = providerConfig?.name || providerId;
    const streamLabel = isStreaming ? "streaming" : "standard";
    process.stderr.write(
      `[Agent] Connecting to ${providerName} (${model}) [${streamLabel}]...\n`,
    );
    process.stderr.write(
      `[Agent] Workspace: ${workspaceDir}\n[Agent] Group: ${groupId}\n[Agent] Max tokens: ${maxTokens}\n`,
    );
  }

  // 5. Setup postHandler capture
  let capturedResponse = null;
  let capturedError = null;
  let hasStreamedChunks = false;
  const pendingWrites = [];

  core.setPostHandler(async (message) => {
    switch (message.type) {
      case "streaming-start":
        hasStreamedChunks = true;
        break;
      case "streaming-chunk":
        if (message.payload?.text) {
          hasStreamedChunks = true;
          capturedResponse = (capturedResponse || "") + message.payload.text;
          if (!options.quiet && !options.output) {
            process.stdout.write(message.payload.text);
          }
        }
        break;
      case "streaming-done":
      case "streaming-end":
        break;
      case "response":
        if (message.payload?.text) {
          capturedResponse = message.payload.text;
          if (options.output) {
            const writePromise = writeFile(
              path.resolve(options.output),
              message.payload.text,
              "utf8",
            )
              .then(() => {
                if (!options.quiet) {
                  process.stderr.write(`Output written to ${options.output}\n`);
                }
              })
              .catch(() => {});
            pendingWrites.push(writePromise);
          } else if (!options.quiet) {
            if (hasStreamedChunks) {
              if (!message.payload.text.endsWith("\n")) {
                process.stdout.write("\n");
              }
            } else {
              process.stdout.write(message.payload.text + "\n");
            }
          }
        }
        break;
      case "intermediate-response":
        if (options.verbose && !options.quiet && message.payload?.text) {
          process.stderr.write(`[Thought] ${message.payload.text}\n`);
        }
        break;
      case "error":
        if (message.payload?.error) {
          capturedError = message.payload.error;
          if (!options.quiet) {
            console.error(`Error: ${message.payload.error}`);
          }
        }
        break;
      case "tool-activity":
        if (options.verbose && !options.quiet && message.payload) {
          const toolName = message.payload.tool || "tool";
          const status = message.payload.status || "executing";
          process.stderr.write(`[Tool] ${toolName} (${status})\n`);
        }
        break;
      case "status":
        if (options.verbose && !options.quiet && message.payload) {
          const label = message.payload.label
            ? `[${message.payload.label}] `
            : "";
          process.stderr.write(`${label}${message.payload.message || ""}\n`);
        }
        break;
      case "log":
        if (options.verbose && !options.quiet && message.payload) {
          const label = message.payload.label || message.payload.level || "Log";
          process.stderr.write(`[${label}] ${message.payload.message || ""}\n`);
        }
        break;
      case "token-usage":
        if (options.verbose && !options.quiet && message.payload?.usage) {
          const u = message.payload.usage;
          const promptT = u.prompt_tokens ?? u.input_tokens ?? 0;
          const compT = u.completion_tokens ?? u.output_tokens ?? 0;
          const totalT = u.total_tokens ?? promptT + compT;
          process.stderr.write(
            `[Tokens] Prompt: ${promptT}, Completion: ${compT}, Total: ${totalT}\n`,
          );
        }
        break;
      case "request-native-ai-task":
        if (message.payload && typeof core.executeNativeAiTask === "function") {
          const { id, groupId: taskGroupId, taskType, input } = message.payload;
          core
            .executeNativeAiTask({
              taskType,
              input,
              groupId: taskGroupId,
              db,
            })
            .then((res) => {
              const resolvers = globalThis.pendingNativeAiResolvers;
              if (resolvers && resolvers[id]) {
                resolvers[id].resolve(res);
                delete resolvers[id];
              }
            })
            .catch((err) => {
              const resolvers = globalThis.pendingNativeAiResolvers;
              if (resolvers && resolvers[id]) {
                resolvers[id].reject(err);
                delete resolvers[id];
              }
            });
        }
        break;
    }
  });

  let toolResolution;
  try {
    toolResolution = await resolveToolsAndProfile(
      db,
      core,
      groupId,
      workspaceConfig,
      workspaceSettings,
      workspaceAgent,
      options,
    );
  } catch (err) {
    const errorMsg = err.message || String(err);
    if (!options.quiet) {
      console.error(errorMsg);
    }
    process.exitCode = 1;
    return { success: false, error: errorMsg };
  }
  const { enabledTools, profileSystemPromptOverride } = toolResolution;

  const DEFAULT_SYSTEM_PROMPT =
    "You are ShadowClaw, a helpful AI assistant operating in a headless workspace. Answer concisely.";

  let systemPrompt = options.systemPrompt;

  if (!systemPrompt && options.systemPromptFile) {
    try {
      const filePath = path.resolve(options.systemPromptFile);
      systemPrompt = await readFile(filePath, "utf8");
    } catch (err) {
      const errorMsg = `Error: Failed to read system prompt file "${options.systemPromptFile}": ${err.message}`;
      if (!options.quiet) console.error(errorMsg);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }
  }

  if (!systemPrompt) {
    systemPrompt =
      process.env.SHADOW_CLAW_SYSTEM_PROMPT ||
      process.env.SHADOWCLAW_SYSTEM_PROMPT;
  }

  if (!systemPrompt && profileSystemPromptOverride) {
    systemPrompt = profileSystemPromptOverride;
  }

  if (!systemPrompt && workspaceAgent?.systemPromptFile) {
    try {
      const baseDir = workspaceConfigData?.configPath
        ? path.dirname(workspaceConfigData.configPath)
        : workspaceDir;
      const filePath = path.resolve(baseDir, workspaceAgent.systemPromptFile);
      systemPrompt = await readFile(filePath, "utf8");
    } catch (err) {
      if (options.verbose && !options.quiet) {
        console.error(
          `Warning: Failed to read systemPromptFile from config: ${err.message}`,
        );
      }
    }
  }

  if (!systemPrompt) {
    systemPrompt =
      workspaceAgent?.systemPrompt ||
      workspaceSettings?.systemPrompt ||
      workspaceSettings?.systemPromptOverride;
  }

  if (!systemPrompt && typeof core.getConfig === "function") {
    try {
      const dbOverride = await core.getConfig(
        db,
        core.CONFIG_KEYS?.SYSTEM_PROMPT_OVERRIDE || "system_prompt_override",
      );
      if (dbOverride && typeof dbOverride === "string") {
        systemPrompt = dbOverride;
      }
    } catch {}
  }

  if (!systemPrompt) {
    systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }

  const invokePayload = {
    apiKey: apiKey || "",
    assistantName: "ShadowClaw",
    enabledTools,
    groupId,
    maxTokens,
    messages: [...history, userMessage],
    model,
    provider: providerId,
    streaming: isStreaming,
    verbose: Boolean(options.verbose),
    systemPrompt,
  };

  const abortController = new AbortController();
  if (options.abortSignal) {
    if (options.abortSignal.aborted) {
      abortController.abort();
    } else {
      options.abortSignal.addEventListener(
        "abort",
        () => abortController.abort(),
        { once: true },
      );
    }
  }

  let wasInterrupted = false;
  const onSigint = () => {
    if (wasInterrupted) return;
    wasInterrupted = true;
    abortController.abort();
    try {
      if (typeof core.cleanupAllLlamafileProcesses === "function") {
        core.cleanupAllLlamafileProcesses();
      }
    } catch {}
  };

  process.on("SIGINT", onSigint);

  const invoker = options.invokeHandler || core.handleInvoke;
  try {
    await invoker(db, invokePayload, abortController.signal);
  } catch (err) {
    capturedError = err instanceof Error ? err.message : String(err);
    if (!wasInterrupted && !options.quiet) {
      console.error(`Error: ${capturedError}`);
    }
  } finally {
    process.removeListener("SIGINT", onSigint);
  }

  if (wasInterrupted) {
    if (!options.quiet) {
      process.stderr.write("\nOperation cancelled.\n");
    }
    process.exitCode = 130;
    if (typeof options.onExit === "function") {
      options.onExit(130);
    }
    return { success: false, error: "Operation cancelled." };
  }

  if (capturedError && hasStreamedChunks && !options.quiet && !options.output) {
    process.stdout.write("\n");
  }

  if (capturedError) {
    process.exitCode = 1;
    return { success: false, error: capturedError };
  }

  if (capturedResponse && typeof core.saveMessage === "function") {
    try {
      await core.saveMessage(db, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        groupId,
        role: "assistant",
        content: capturedResponse,
        timestamp: Date.now(),
      });
    } catch {}
  }

  if (options.output && capturedResponse && pendingWrites.length === 0) {
    const writePromise = writeFile(
      path.resolve(options.output),
      capturedResponse,
      "utf8",
    )
      .then(() => {
        if (!options.quiet) {
          process.stderr.write(`Output written to ${options.output}\n`);
        }
      })
      .catch(() => {});
    pendingWrites.push(writePromise);
  }

  await Promise.all(pendingWrites);

  if (typeof core.setPostHandler === "function") {
    core.setPostHandler(null);
  }

  return {
    success: true,
    response: capturedResponse,
    model,
    provider: providerId,
  };
}

/**
 * Manage local models for Transformers.js.
 * @param {"list" | "download" | "set"} [subaction="list"]
 * @param {string} [modelId]
 * @param {Record<string, any>} [options]
 */
export async function runAgentModel(subaction = "list", modelId, options = {}) {
  const {
    listLocalModels,
    listLlamafileModels,
    downloadLocalModel,
    fetchRemoteModels,
    DEFAULT_LOCAL_MODEL,
  } = await import("../utils/local-models.mjs");

  const workspaceDir = options.workspace
    ? path.resolve(options.workspace)
    : process.cwd();
  const action = subaction || "list";

  if (action === "list" || action === "remote") {
    const isRemote =
      action === "remote" ||
      Boolean(options.remote || options.all || options.huggingface);

    const configData = await loadWorkspaceConfig(workspaceDir);
    const configuredModel =
      configData?.config?.agent?.defaultModel ||
      configData?.config?.settings?.defaultModel ||
      DEFAULT_LOCAL_MODEL;

    if (isRemote) {
      if (!options.quiet) {
        process.stdout.write(
          "\nFetching available ONNX models from Hugging Face (onnx-community)...\n",
        );
      }
      const remoteModels = await fetchRemoteModels({
        cacheDir: options.cacheDir,
        query:
          options.query ||
          (action === "remote" && modelId ? modelId : undefined),
      });

      if (!options.quiet) {
        if (remoteModels.length === 0) {
          process.stdout.write(
            "No models found on Hugging Face or could not reach huggingface.co.\n\n",
          );
        } else {
          process.stdout.write(
            `\nHugging Face ONNX Models (${remoteModels.length} available):\n\n`,
          );
          for (const m of remoteModels) {
            const isDefault = m.id === configuredModel;
            const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
            const defaultStr = isDefault ? " (Default)" : "";
            process.stdout.write(`  • ${m.id}${defaultStr}${cachedStr}\n`);
          }
          process.stdout.write(
            "\nTip: Run `shadow-claw agent model download <modelId>` to download any model,\n",
          );
          process.stdout.write(
            "     or `shadow-claw agent model set <modelId>` to set it as default.\n\n",
          );
        }
      }
      return {
        success: true,
        models: remoteModels,
        defaultModel: configuredModel,
      };
    }

    const models = listLocalModels(options.cacheDir);
    const llamafileModels = listLlamafileModels(options.cacheDir);

    if (!options.quiet) {
      process.stdout.write(
        "\nCurated Transformers.js Models (Local ONNX):\n\n",
      );
      for (const m of models) {
        const isDefault = m.id === configuredModel;
        const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
        const defaultStr = isDefault ? " (Default)" : "";
        process.stdout.write(`  • ${m.id}${defaultStr}${cachedStr}\n`);
        process.stdout.write(`    Name: ${m.name}\n`);
        process.stdout.write(
          `    Context: ${m.contextLength.toLocaleString()} tokens | Tools: ${m.supportsTools ? "Yes" : "No"}\n`,
        );
        process.stdout.write(`    ${m.description}\n\n`);
      }

      process.stdout.write("Curated Llamafile Models (Local Executable):\n\n");
      for (const m of llamafileModels) {
        const isDefault =
          m.fileName === configuredModel ||
          m.id === configuredModel ||
          configuredModel.endsWith(m.fileName);
        const cachedStr = m.cached ? " [Cached]" : " [Not downloaded]";
        const defaultStr = isDefault ? " (Default)" : "";
        process.stdout.write(`  • ${m.fileName}${defaultStr}${cachedStr}\n`);
        process.stdout.write(`    Name: ${m.name}\n`);
        process.stdout.write(`    URL: ${m.url}\n`);
        process.stdout.write(`    ${m.description}\n\n`);
      }

      process.stdout.write(
        "Tip: Run `shadow-claw agent model list --remote` (or `shadow-claw agent model remote`) to browse all ONNX models from Hugging Face.\n\n",
      );
    }
    return {
      success: true,
      models,
      llamafileModels,
      defaultModel: configuredModel,
    };
  }

  if (action === "download") {
    const targetModel = modelId || options.model || DEFAULT_LOCAL_MODEL;
    if (options.verbose && !options.quiet) {
      process.stderr.write(`Preparing to download model: ${targetModel}\n`);
    }
    const result = await downloadLocalModel(targetModel, {
      cacheDir: options.cacheDir,
      verbose: options.verbose,
      isTTY: options.isTTY,
      progress: options.progress !== false && !options.noProgress,
    });
    if (!result.success) {
      process.exitCode = 1;
    }
    return result;
  }

  if (action === "set") {
    const targetModel = modelId || options.model;
    if (!targetModel) {
      const errorMsg = "Error: Please specify a model ID to set as default.";
      if (!options.quiet) console.error(errorMsg);
      process.exitCode = 1;
      return { success: false, error: errorMsg };
    }

    const configData = await loadWorkspaceConfig(workspaceDir);
    const configPath =
      configData?.configPath ||
      path.join(workspaceDir, "shadow-claw.config.json");
    const currentConfig = configData?.config || {};

    const updatedConfig = {
      ...currentConfig,
      agent: {
        ...(currentConfig.agent || {}),
        defaultModel: targetModel,
      },
    };

    await writeFile(
      configPath,
      JSON.stringify(updatedConfig, null, 2) + "\n",
      "utf8",
    );

    if (!options.quiet) {
      process.stdout.write(
        `Updated default CLI agent model to: ${targetModel}\n`,
      );
    }

    return { success: true, model: targetModel, configPath };
  }

  const errorMsg = `Unknown model action: "${action}". Available: list, download, set`;
  if (!options.quiet) console.error(errorMsg);
  process.exitCode = 1;
  return { success: false, error: errorMsg };
}

/**
 * Main dispatcher for the `agent` command group.
 */
export async function runAgentCommand(action, args = [], options = {}) {
  let actualArgs = args;
  let actualOptions = options;
  if (!Array.isArray(args) && typeof args === "object") {
    actualOptions = args;
    actualArgs = [];
  }

  // Read stdin once before dispatching so sub-functions never block on process.stdin.
  // Only attempt when stdin is not a TTY (i.e. data is actually piped in).
  // A 500ms safety timeout prevents hanging in environments where stdin never sends EOF.
  // Pass the result as _stdinData so callers in tests can also inject it directly.
  if (actualOptions._stdinData === undefined) {
    try {
      actualOptions = {
        ...actualOptions,
        _stdinData: process.stdin.isTTY
          ? null
          : await readStdin({ timeoutMs: 500 }),
      };
    } catch {
      actualOptions = { ...actualOptions, _stdinData: null };
    }
  }

  switch (action) {
    case "init": {
      const targetDir = actualArgs[0] || actualOptions.workspace;
      const result = await runAgentInit({
        ...actualOptions,
        workspace: targetDir,
      });
      console.log(
        `Headless agent workspace initialized at: ${result.workspace}`,
      );
      return result;
    }

    case "skills": {
      const result = await runAgentSkills(actualOptions);
      if (result.skills.length === 0) {
        console.log("No skills found in workspace (.agents/skills/).");
      } else {
        console.log(`Available skills (${result.skills.length}):\n`);
        for (const skill of result.skills) {
          console.log(
            `  - ${skill.name}: ${skill.description || "No description"}`,
          );
        }
      }
      return result;
    }

    case "tools": {
      const toolName = actualArgs[0];
      if (toolName) {
        return await runAgentTool(toolName, actualArgs[1], actualOptions);
      }
      const result = await runAgentTools(actualOptions);
      console.log(`Available tools (${result.tools.length}):\n`);
      for (const tool of result.tools) {
        const tag = tool.headlessSafe ? "[headless-safe]" : "[browser-only]";
        console.log(
          `  - ${tool.name.padEnd(25)} ${tag} ${tool.description || ""}`,
        );
      }
      return result;
    }

    case "tool": {
      const toolName = actualArgs[0];
      if (!toolName) {
        console.error(
          "Error: Tool name required. Usage: shadow-claw agent tool <name> [input-json]",
        );
        process.exitCode = 1;
        return;
      }
      return await runAgentTool(toolName, actualArgs[1], actualOptions);
    }

    case "skill": {
      const skillName = actualArgs[0];
      if (!skillName) {
        console.error(
          "Error: Skill name required. Usage: shadow-claw agent skill <name>",
        );
        process.exitCode = 1;
        return;
      }
      return await runAgentSkill(skillName, actualOptions);
    }

    case "run": {
      // Prompt may be empty when data is piped via stdin
      const prompt = actualArgs.join(" ") || "";
      return await runAgentRun(prompt || "-", actualOptions);
    }

    case "models":
    case "model": {
      const subaction = actualArgs[0] || "list";
      const modelId = actualArgs[1];
      return await runAgentModel(subaction, modelId, actualOptions);
    }

    default: {
      console.log(
        "Usage: shadow-claw agent <init|model|skills|tools|tool|skill|run> [args...]",
      );
    }
  }
}
