import type { ToolDefinition } from "./types.js";

export const javascript: ToolDefinition = {
  name: "javascript",
  description:
    "Execute JavaScript code in a sandboxed Worker and return the result. " +
    "Lighter than bash — no VM boot required. Use for calculations, " +
    "data transformations, JSON processing, string analysis, etc. " +
    "Runs in strict mode. No access to DOM, network, fetch, eval(), Function(), " +
    "self, postMessage, importScripts, navigator, or indexedDB — these are all undefined. " +
    "setTimeout is available but setInterval is blocked. " +
    "Write plain JavaScript expressions and statements — the return value of the " +
    "last expression is captured as the result.",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description:
          "JavaScript code to execute. The return value of the last expression is captured.",
      },
    },
    required: ["code"],
  },
};
