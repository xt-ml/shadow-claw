/**
 * ShadowClaw Headless Agent Entry Point
 * Exposes core agent, skills, tools, and SQLite/NodeFs storage utilities
 * for CLI agent execution.
 */

import { setHeadlessBashExecutor } from "./tools/bash/bash.js";
import { nativeBashExecutor } from "./tools/bash/native-bash-executor.js";
import {
  setNodeTransformersCompletionExecutor,
  setNodeLlamafileCompletionExecutor,
} from "./utils/handleInvoke.js";
import { executeNodeTransformersCompletion } from "./tools/node-transformers-executor.js";
import { executeNodeLlamafileCompletion } from "./tools/node-llamafile-executor.js";
import { setHeadlessEvalExecutor } from "./utils/sandboxedEval.js";
import { nativeEvalExecutor } from "./utils/native-eval-executor.js";
import { setPeerClientFactory } from "./tools/peer/prompt-peer.js";
import { nativePeerClientFactory } from "./tools/peer/native-peer-client.js";

// Automatically wire native OS process execution for headless CLI agent
setHeadlessBashExecutor(nativeBashExecutor);
setNodeTransformersCompletionExecutor(executeNodeTransformersCompletion);
setNodeLlamafileCompletionExecutor(executeNodeLlamafileCompletion);
setHeadlessEvalExecutor(nativeEvalExecutor);
setPeerClientFactory(nativePeerClientFactory);

export { executeTool } from "./utils/executeTool.js";
export { executeToolChain } from "./utils/toolChain.js";
export { handleInvoke } from "./utils/handleInvoke.js";
export { post, setPostHandler } from "./utils/post.js";
export {
  setHeadlessMode,
  isHeadlessMode,
  BROWSER_ONLY_TOOLS,
  isToolHeadlessSafe,
  filterHeadlessTools,
} from "../config/headless.js";
export { setDB, getDb, resetDB } from "../db/db.js";
export {
  openSqliteDatabase,
  closeSqliteDatabase,
} from "../db/sqlite/openSqliteDatabase.js";
export { isSqliteDatabase, wrapSqliteDatabase } from "../db/sqlite/types.js";
export {
  setStorageRootFromPath,
  NodeFsDirectoryHandle,
  NodeFsFileHandle,
} from "../storage/node-fs-handle.js";
export {
  setStorageRoot,
  getStorageRoot,
  invalidateStorageRoot,
} from "../storage/storage.js";
export {
  discoverSkills,
  loadSkill,
} from "../subsystems/skills/discoverSkills.js";
export { TOOL_DEFINITIONS } from "../subsystems/tools/index.js";
export { DEFAULT_BUILTIN_PROFILE } from "../subsystems/tools/builtin-profiles.js";
export { loadDeclarativeTools } from "../subsystems/tools/declarative.js";
export {
  resolveDiscoveryUrl,
  fetchDiscoveryManifest,
} from "../subsystems/tools/remote/discovery.js";
export {
  importRemoteArtifacts,
  importRemoteTool,
  importRemoteSkill,
  importRemoteScript,
} from "../subsystems/tools/remote/importArtifacts.js";
export {
  getProvider,
  getDefaultProvider,
  getAvailableProviders,
  getModelMaxTokens,
  DEFAULT_MAX_TOKENS,
  DEFAULT_SERVER_GROUP_ID,
  CONFIG_KEYS,
} from "../config/config.js";
export { getContextLimit } from "../subsystems/providers/providers.js";
export { getConfig } from "../db/getConfig.js";
export { setConfig } from "../db/setConfig.js";
export { saveMessage } from "../db/saveMessage.js";
export { getRecentMessages } from "../db/getRecentMessages.js";
export { executeNativeAiTask } from "../subsystems/providers/executeNativeAiTask.js";
export {
  setNativeAiTaskHandler,
  executeRewriteText,
  executeSummarizeText,
  executeWriteText,
  executeProofreadText,
  executeDetectLanguage,
  executeTranslateText,
  executeEmbedText,
} from "./tools/builtin-ai/builtin-ai.js";
export { executeNodeTransformersCompletion } from "./tools/node-transformers-executor.js";
export { createTransformersRuntimeService } from "../server/services/transformers-runtime.js";
export { cleanupAllLlamafileProcesses } from "../server/services/llamafile-manager.js";
export { nativeBashExecutor, setHeadlessBashExecutor };
export { nativeEvalExecutor, setHeadlessEvalExecutor };
export { nativePeerClientFactory, setPeerClientFactory };
export type * from "./headless-types.js";
