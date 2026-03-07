import { handleMessage } from "./src/worker/agent.mjs";

/**
 * ShadowClaw Agent Worker
 *
 * Runs in a dedicated Web Worker. Owns the tool-use loop.
 *
 * Communicates with the main thread via postMessage.
 */
self.onmessage = handleMessage;
