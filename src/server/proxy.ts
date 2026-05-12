/**
 * Shared proxy route handlers used by both the Express dev server (src/server/server.ts)
 * and the Electron main process (electron/main.ts).
 *
 * This is a barrel file that maintains backward compatibility with the legacy monolith
 * while delegating to the new modular architecture.
 *
 * Usage:
 *   import { registerProxyRoutes } from "./proxy.js";
 *   registerProxyRoutes(app, { verbose: false });
 */

import type { Express } from "express";

import { registerHttpProxyRoutes } from "./routes/http-proxy.js";
import { registerGitHubModelsRoutes } from "./routes/github-models.js";
import { registerBedrockRoutes } from "./routes/bedrock.js";
import { registerGeminiRoutes } from "./routes/gemini.js";
import { registerVertexAiRoutes } from "./routes/vertex-ai.js";
import { registerOllamaRoutes } from "./routes/ollama.js";
import { registerTransformersJsRoutes } from "./routes/transformers-js.js";
import { registerLlamafileRoutes } from "./routes/llamafile.js";
import { registerIntegrationEmailRoutes } from "./routes/integrations-email.js";

import { createTransformersRuntimeService } from "./services/transformers-runtime.js";
import { createLlamafileManagerService } from "./services/llamafile-manager.js";

// Re-export common utilities expected by test suites or legacy callers
export {
  getFirstHeaderValue,
  extractBearerToken,
  handleProxyRequest,
  handleStreamingProxyRequest,
} from "./utils/proxy-helpers.js";

export { sendStreamingProxyError } from "./utils/openai-sse.js";
export { stripLlamafilePromptEcho } from "./services/llamafile-manager.js";

// Shared service singletons for backward-compatibility in tests
const transformersRuntimeService = createTransformersRuntimeService();
const llamafileManagerService = createLlamafileManagerService();

export function registerProxyRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  // Register generic HTTP proxy
  registerHttpProxyRoutes(app, options);

  // Register provider-specific routes
  registerGitHubModelsRoutes(app, options);
  registerBedrockRoutes(app, options);
  registerGeminiRoutes(app, options);
  registerVertexAiRoutes(app, options);
  registerOllamaRoutes(app, options);

  // Register locally hosted engine routes
  registerTransformersJsRoutes(app, transformersRuntimeService, options);
  registerLlamafileRoutes(app, llamafileManagerService, options);
  registerIntegrationEmailRoutes(app, options);
}

// --------------------------------------------------------------------------
// TEST HELPERS
// --------------------------------------------------------------------------

export function __setTransformersJsRuntimeForTests(
  modelId: string,
  runtime: any,
): void {
  transformersRuntimeService.__setRuntimeForTests(modelId, runtime);
}

export function __setTransformersJsDownloadStatusForTests(next: any): void {
  transformersRuntimeService.__setDownloadStatusForTests(next);
}

export async function __resetTransformersJsRuntimeForTests(): Promise<void> {
  await transformersRuntimeService.__resetRuntimeForTests();
}

export async function runTransformersJsChatCompletion(params: {
  modelId: string;
  messages: any[];
  maxCompletionTokens: number;
  verbose: boolean;
  onToken?: (text: string) => void;
  abortSignal?: AbortSignal;
}): Promise<{ text: string; promptTokens: number; completionTokens: number }> {
  return transformersRuntimeService.runChatCompletion(params);
}

export function __getLlamafileOfflineSupportCache(): Map<string, boolean> {
  return llamafileManagerService.__getOfflineSupportCache();
}

export function __getActiveLlamafileRequests(): Map<string, () => void> {
  return llamafileManagerService.__getActiveRequests();
}
