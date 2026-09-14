import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolchainRoot = path.resolve(__dirname, "../..");

let cachedCore = null;

export async function getAgentCore() {
  if (cachedCore) {
    return cachedCore;
  }

  const isTest = process.env.NODE_ENV === "test";
  const distAgentPath = path.join(toolchainRoot, "dist/headless-agent.js");

  // In non-test environments or when dist exists and not testing
  if (!isTest && existsSync(distAgentPath)) {
    cachedCore = await import(pathToFileURL(distAgentPath).href);
    return cachedCore;
  }

  // Load from src directly (works in Jest with jest-ts-resolver or ts loader)
  try {
    const headless = await import("../../src/config/headless.js");
    const db = await import("../../src/db/db.js");
    const sqliteDb = await import("../../src/db/sqlite/openSqliteDatabase.js");
    const sqliteTypes = await import("../../src/db/sqlite/types.js");
    const storage = await import("../../src/storage/storage.js");
    const nodeFs = await import("../../src/storage/node-fs-handle.js");
    const nativeBash =
      await import("../../src/worker/tools/bash/native-bash-executor.js");
    const config = await import("../../src/config/config.js");
    const getConfigModule = await import("../../src/db/getConfig.js");
    const setConfigModule = await import("../../src/db/setConfig.js");
    const saveMsg = await import("../../src/db/saveMessage.js");
    const getRecentMsg = await import("../../src/db/getRecentMessages.js");
    const skills =
      await import("../../src/subsystems/skills/discoverSkills.js");
    const tools = await import("../../src/subsystems/tools/index.js");
    const builtinProfiles =
      await import("../../src/subsystems/tools/builtin-profiles.js");
    const executeTool = await import("../../src/worker/utils/executeTool.js");
    const toolChain = await import("../../src/worker/utils/toolChain.js");
    const post = await import("../../src/worker/utils/post.js");
    const builtinAi =
      await import("../../src/worker/tools/builtin-ai/builtin-ai.js");
    const nativeAi =
      await import("../../src/subsystems/providers/executeNativeAiTask.js");
    const transformersRuntime =
      await import("../../src/server/services/transformers-runtime.js");
    const nodeTransformersExecutor =
      await import("../../src/worker/tools/node-transformers-executor.js");
    const llamafileManager =
      await import("../../src/server/services/llamafile-manager.js");
    const nodeLlamafileExecutor =
      await import("../../src/worker/tools/node-llamafile-executor.js");

    cachedCore = {
      ...headless,
      ...db,
      ...sqliteDb,
      ...sqliteTypes,
      ...storage,
      ...nodeFs,
      ...nativeBash,
      ...config,
      ...getConfigModule,
      ...setConfigModule,
      ...saveMsg,
      ...getRecentMsg,
      ...skills,
      ...tools,
      ...builtinProfiles,
      ...executeTool,
      ...toolChain,
      ...post,
      ...builtinAi,
      ...nativeAi,
      ...transformersRuntime,
      ...nodeTransformersExecutor,
      ...llamafileManager,
      ...nodeLlamafileExecutor,
    };
    return cachedCore;
  } catch (err) {
    if (existsSync(distAgentPath)) {
      cachedCore = await import(pathToFileURL(distAgentPath).href);
      return cachedCore;
    }
    throw err;
  }
}
