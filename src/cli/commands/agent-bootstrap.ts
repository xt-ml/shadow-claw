import "../utils/suppress-warnings.js";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getAgentCore } from "../utils/agent-core.js";
import { loadWorkspaceConfig } from "../utils/load-workspace-config.js";
import { resolveCacheDir } from "../utils/resolve-cache-dir.js";
import { handleNativeAiTaskMessage } from "./native-ai-task-handler.js";
import type {
  BootstrapAgentOptions,
  BootstrapAgentResult,
} from "../../worker/headless-types.js";

export type { BootstrapAgentOptions, BootstrapAgentResult };

export interface ExtendedBootstrapAgentOptions extends BootstrapAgentOptions {
  core?: any;
}

/**
 * Bootstrap the headless agent environment.
 * Sets the headless flag, initializes/opens the SQLite DB, sets the storage root
 * to the workspace directory, and wires up post() output routing.
 */
export async function bootstrapHeadlessAgent(
  options: ExtendedBootstrapAgentOptions = {},
): Promise<BootstrapAgentResult> {
  const core = options.core || (await getAgentCore());

  // 1. Mark runtime as headless
  core.setHeadlessMode(true);

  // 2. Resolve workspace and database directories
  let workspaceDir: string;
  let dbDir: string;

  if (options.workspace) {
    workspaceDir = path.resolve(options.workspace);
    if (options.databaseDir) {
      dbDir = path.resolve(options.databaseDir);
    } else if (options.cacheDir) {
      dbDir = path.resolve(options.cacheDir, "database");
    } else {
      dbDir = path.resolve(workspaceDir, "database");
    }
  } else {
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
    workspaceDir = resolved.cacheDir;
    dbDir = resolved.databaseDir;
  }

  await mkdir(workspaceDir, { recursive: true });
  await mkdir(dbDir, { recursive: true });
  const dbPath = path.join(dbDir, "agent.db");

  // 4. Open SQLite database & register singleton
  const db = core.openSqliteDatabase(dbPath);
  core.setDB(db);

  // 5. Configure filesystem storage root
  core.setStorageRootFromPath(workspaceDir);

  // 6. Synchronize internet access setting to SQLite DB
  const workspaceConfigData = await loadWorkspaceConfig(workspaceDir);
  const workspaceConfig = workspaceConfigData?.config || {};
  const workspaceSettings =
    (workspaceConfig.settings as Record<string, unknown>) || {};
  const declaredInternetAccess =
    options.internetAccess ??
    options.allowInternet ??
    workspaceSettings.internetAccess ??
    workspaceSettings.vm_bash_full_internet_access ??
    workspaceSettings.fullInternetAccess ??
    workspaceConfig.internetAccess;

  if (
    declaredInternetAccess !== undefined &&
    typeof core.setConfig === "function"
  ) {
    const internetAccessKey =
      core.CONFIG_KEYS?.VM_BASH_FULL_INTERNET_ACCESS ||
      "vm_bash_full_internet_access";
    await core.setConfig(
      db,
      internetAccessKey,
      declaredInternetAccess ? "true" : "false",
    );
  }

  // 7. Route post messages to stdout / console & native AI task handling
  const messageHandlers: Record<string, (message: any) => void> = {
    response: (msg) => {
      if (!options.quiet && msg.payload?.text) {
        console.log(msg.payload.text);
      }
    },
    error: (msg) => {
      if (!options.quiet && msg.payload?.error) {
        console.error(`Error: ${msg.payload.error}`);
      }
    },
    "tool-activity": (msg) => {
      if (!options.quiet && options.verbose && msg.payload) {
        console.log(
          `[Tool] ${msg.payload.tool} (${msg.payload.status || "executing"})`,
        );
      }
    },
    "thinking-log": (msg) => {
      if (!options.quiet && options.verbose && msg.payload) {
        const label = msg.payload.label || msg.payload.level || "Log";
        console.log(`[${label}] ${msg.payload.message || ""}`);
      }
    },
    "request-native-ai-task": (msg) => {
      handleNativeAiTaskMessage(core, db, msg.payload);
    },
  };

  core.setPostHandler((message: any) => {
    messageHandlers[message.type]?.(message);
  });

  return { db, workspaceDir, dbPath, core };
}
