import type { ToolDefinition } from "./types.js";

export const spawn_subagent: ToolDefinition = {
  name: "spawn_subagent",
  description:
    "Spawn one or more independent agent loops to work on subtasks in parallel and collect their results. " +
    "Each subagent has its own tool-use loop, inherits the current API key and provider, " +
    "and runs concurrently with other subagents via Promise.all. " +
    "Use spawn_subagent when a task has independent parallel workstreams — for example: " +
    "researching multiple topics simultaneously, processing a list of items in parallel, " +
    "or delegating isolated subtasks to specialized agents. " +
    "Do NOT use spawn_subagent for sequential tasks where step 2 depends on step 1's output — " +
    "just do those steps directly. " +
    "Do NOT use spawn_subagent for simple single-step work that takes one tool call. " +
    "Use the parallel_agents field to fan out multiple subagents in a single call.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "The task prompt for a single subagent. Required unless using parallel_agents for multi-agent fan-out.",
      },
      tools: {
        type: "array",
        description:
          "Optional list of tool names to allow in the subagent. " +
          "If omitted, the subagent inherits the current tool set (minus spawn_subagent to prevent recursion). " +
          "If provided, only these tools are available to the subagent.",
        items: { type: "string" },
      },
      model: {
        type: "string",
        description:
          "Optional model override for the subagent. Defaults to the current model.",
      },
      system_prompt: {
        type: "string",
        description:
          "Optional system prompt override for the subagent. Defaults to the current system prompt.",
      },
      parallel_agents: {
        type: "array",
        description:
          "Optional list of subagent specifications to run in parallel. " +
          "When provided, all agents are launched concurrently and their results are combined. " +
          "Note: There is a configurable maximum limit on parallel subagents (default 5). " +
          "Each entry can specify a prompt, optional tools list, optional model, and optional system_prompt.",
        items: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The task prompt for this subagent.",
            },
            tools: {
              type: "array",
              description: "Optional tool names for this subagent.",
              items: { type: "string" },
            },
            model: {
              type: "string",
              description: "Optional model override for this subagent.",
            },
            system_prompt: {
              type: "string",
              description: "Optional system prompt override for this subagent.",
            },
          },
          required: ["prompt"],
        },
      },
    },
    required: ["prompt"],
  },
};
