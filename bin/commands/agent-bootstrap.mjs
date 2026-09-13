import "../utils/suppress-warnings.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getAgentCore } from "../utils/agent-core.mjs";

/**
 * Bootstrap the headless agent environment.
 * Sets the headless flag, initializes/opens the SQLite DB, sets the storage root
 * to the workspace directory, and wires up post() output routing.
 * @param {import("../../src/worker/headless-types.js").BootstrapAgentOptions} [options]
 * @returns {Promise<import("../../src/worker/headless-types.js").BootstrapAgentResult>}
 */
export async function bootstrapHeadlessAgent(options = {}) {
  const core = await getAgentCore();

  // 1. Mark runtime as headless
  core.setHeadlessMode(true);

  // 2. Resolve workspace and database directories
  let workspaceDir;
  let dbDir;

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

  // 6. Route post messages to stdout / console & native AI task handling
  core.setPostHandler((message) => {
    switch (message.type) {
      case "response":
        if (!options.quiet && message.payload?.text) {
          console.log(message.payload.text);
        }
        break;
      case "error":
        if (!options.quiet && message.payload?.error) {
          console.error(`Error: ${message.payload.error}`);
        }
        break;
      case "tool-activity":
        if (!options.quiet && options.verbose && message.payload) {
          console.log(
            `[Tool] ${message.payload.tool} (${message.payload.status || "executing"})`,
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

  return { db, workspaceDir, dbPath, core };
}
