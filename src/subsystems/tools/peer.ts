import type { ToolDefinition } from "./types.js";

export const prompt_peer: ToolDefinition = {
  name: "prompt_peer",
  description:
    "Send a prompt or message directly to another connected ShadowClaw peer or agent over WebRTC, " +
    "triggering their orchestration loop and returning their answer. Use this to ask another agent " +
    "to perform a task, answer a question, or analyze data.",
  input_schema: {
    type: "object",
    properties: {
      peer_id: {
        type: "string",
        description:
          "The PeerJS peer ID or client ID of the target agent to prompt.",
      },
      prompt: {
        type: "string",
        description: "The prompt, question, or instruction for the peer agent.",
      },
      timeout_seconds: {
        type: "number",
        description:
          "Optional timeout in seconds to wait for the peer agent's response (default: 120).",
      },
    },
    required: ["peer_id", "prompt"],
  },
};

export const list_peers: ToolDefinition = {
  name: "list_peers",
  description:
    "List the currently connected peers or clients available over WebRTC and the control plane. " +
    "Returns peer IDs and device labels so you know which peers you can prompt or collaborate with.",
  input_schema: {
    type: "object",
    properties: {},
  },
};
