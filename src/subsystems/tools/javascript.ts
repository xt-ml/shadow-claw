import type { ToolDefinition } from "./types.js";

export const javascript: ToolDefinition = {
  name: "javascript",
  description:
    "Execute JavaScript code in a sandboxed Worker and return the result. " +
    "Lighter than bash — no VM boot required. Use for calculations, " +
    "data transformations, JSON processing, string analysis, etc. " +
    "Runs in strict mode. No access to DOM, eval(), Function(), " +
    "self, postMessage, importScripts, navigator, or indexedDB — these are all undefined. " +
    "fetch availability is controlled by Tool Configuration -> Internet Access (shared with bash). " +
    "setTimeout is available but setInterval is blocked. " +
    "IMPORTANT: You CANNOT call other agent tools (like read_file, write_file, or bash) from inside this sandbox. " +
    "If you need to process file contents or tool outputs, you must fetch them in a previous turn " +
    "and pass the data into this tool via the $PIPE_DATA variable. " +
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
      data: {
        type: "string",
        description:
          "Optional input data string. Accessible inside the code sandbox via the global constant `$PIPE_DATA`.",
      },
    },
    required: ["code"],
  },
};
