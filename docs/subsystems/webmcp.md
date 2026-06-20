# WebMCP Integration

> Browser's Model Context Protocol integration and tool execution.

**Source:** `src/webmcp.ts`

## Overview

WebMCP allows the agent to execute tools registered through the browser's Model Context
Protocol. It bridges the gap between the isolated worker environment and the main thread
`document.modelContext`.

ShadowClaw registers its full built-in tool surface with the browser's ModelContext API,
making every tool — `bash`, `fetch_file`, `read_file`, `write_file`, git tools, and more —
callable by any external AI model that has access to the page's model context.

For details on remote MCP servers (the inverse direction: agent calling external MCP
servers), see [Remote MCP](remote-mcp.md).

---

## Modes

WebMCP operates in one of two modes, controlled by `setWebMcpMode()`:

| Mode                   | API surface                                                                      | Notes                                                                            |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `"polyfill"` (default) | `@mcp-b/webmcp-polyfill` on `navigator.modelContext`                             | Works in all browsers. Safe.                                                     |
| `"native"`             | Chrome's native `document.modelContext` (with `navigator.modelContext` fallback) | Requires `chrome://flags/#enable-webmcp-testing`. May crash early Canary builds. |

The active mode is readable via `getWebMcpMode()`.

---

## Architecture

```mermaid
sequenceDiagram
  participant Browser as "External AI / Browser"
  participant MC as "document.modelContext"
  participant Main as "Main Thread (webmcp.ts)"
  participant Worker as "Agent Worker"
  participant Exec as "executeTool.ts"

  Browser->>MC: "call tool: fetch_file({url, path})"
  MC->>Main: "execute() callback"
  Main->>Worker: "postMessage execute-tool {callId, name, input}"
  Worker->>Exec: "executeTool(db, name, input, groupId)"
  Exec-->>Worker: "result string"
  Worker-->>Main: "postMessage execute-tool-result {callId, result}"
  Main-->>MC: "resolve(result)"
  MC-->>Browser: "tool result"
```

When `registerWebMcpTools()` is called, each tool in `TOOL_DEFINITIONS` is registered with
the ModelContext API. The `execute` handler for each tool:

1. Generates a unique `callId` (timestamp + random suffix)
2. Posts an `execute-tool` message to the agent worker
3. Awaits an `execute-tool-result` message matching that `callId`
4. Resolves or rejects the promise accordingly

The timeout per tool call is **10 minutes** (600,000 ms).

---

## API

### `isWebMcpSupported(): boolean`

Feature-detects whether the ModelContext API is available. Use this before attempting
registration.

```ts
import { isWebMcpSupported } from "./webmcp.js";

if (isWebMcpSupported()) {
  await registerWebMcpTools(agentWorker, emit, groupId);
}
```

To test WebMCP tool registration in Chrome, use the
[Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)
extension.

### `registerWebMcpTools(agentWorker, emit, groupId?, tools?): Promise<boolean>`

Registers ShadowClaw tools with the ModelContext API.

| Parameter     | Type                | Description                                                                    |
| ------------- | ------------------- | ------------------------------------------------------------------------------ |
| `agentWorker` | `Worker \| null`    | The agent worker instance. Required for tool execution.                        |
| `emit`        | `(message) => void` | Message emitter (currently unused, reserved).                                  |
| `groupId`     | `string`            | Conversation group context for tool execution. Defaults to `DEFAULT_GROUP_ID`. |
| `tools`       | `ToolDefinition[]`  | Optional subset of tools to register. Defaults to all `TOOL_DEFINITIONS`.      |

Returns `true` on success, `false` if the ModelContext API is unavailable.

Registration is **idempotent** — tools already in `registeredToolNames` are skipped on
subsequent calls. The event loop is yielded between each registration to avoid blocking.

Each tool is registered with these annotations:

```ts
annotations: {
  readOnlyHint: false,       // tools may mutate state
  untrustedContentHint: true // outputs may contain untrusted content
}
```

### `unregisterWebMcpTools(): void`

Unregisters all previously registered tools.

- **Polyfill mode**: calls `modelContext.unregisterTool(name)` for each tool.
- **Native mode**: aborts the `AbortController` signal for each tool.

Clears both `registeredToolControllers` and `registeredToolNames`.

---

## Tool Surface

All tools in `TOOL_DEFINITIONS` (`src/tools/index.ts`) are exposed via WebMCP. This
includes the full built-in set:

| Category      | Tools                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| Files         | `read_file`, `write_file`, `patch_file`, `list_files`, `open_file`, `attach_file_to_chat` |
| Shell         | `bash`, `javascript`                                                                      |
| Web           | `fetch_url`, `fetch_file`                                                                 |
| Git           | `git_clone`, `git_sync`, `git_status`, `git_commit`, `git_push`, `git_pull`, and more     |
| Tasks         | `create_task`, `list_tasks`, `update_task`, `delete_task`, `enable_task`, `disable_task`  |
| Memory        | `update_memory`                                                                           |
| Notifications | `show_toast`, `send_notification`                                                         |
| Remote MCP    | `remote_mcp_list_tools`, `remote_mcp_call_tool`                                           |
| Email         | `manage_email`, `email_read_messages`, `email_send_message`                               |

---

## Composable Tool Chains

Because WebMCP tools and ShadowClaw's internal `TaskToolCall` surface are identical — both
dispatch through `executeTool(db, name, input, groupId)` — any sequence of tool calls can
be composed into a scheduled `Task` of `type: "tools"`.

### Dynamic LLM Composition vs. Static Task Chains

It's important to differentiate how tool composition happens depending on the context:

1. **Dynamic Real-Time Composition (Agent Loop):** An agent (via the standard `prompt` execution path) can evaluate the situation, call `fetch_file`, read the result into context, decide what to do next, and then call `bash`. The agent uses its temporary context window and the OPFS filesystem to bridge the steps dynamically.
2. **Static Task Chains (Task Scheduler):** A `Task` of `type: "tools"` defines a fixed, pre-determined sequence of tool calls that bypass the LLM entirely. The OPFS-backed workspace filesystem acts as the shared medium between steps: one tool writes a file, the next reads or transforms it blindly.

Agents can bridge these two paradigms: an agent can dynamically decide to automate a workflow by calling `create_task` with a `type: "tools"` payload, effectively writing a static WebMCP tool-chain program for the system to execute on a schedule.

**Example — Static tool chain to fetch a page and convert it to Markdown:**

```json
{
  "type": "tools",
  "schedule": "0 9 * * *",
  "tools": [
    {
      "name": "fetch_file",
      "input": {
        "url": "https://example.com",
        "path": "example.com.html",
        "method": "GET"
      }
    },
    {
      "name": "bash",
      "input": {
        "command": "/usr/bin/html-to-markdown /home/user/example.com.html > /home/user/example.com.md",
        "timeout": 0
      },
      "suppressOutput": true
    },
    {
      "name": "bash",
      "input": {
        "command": "/usr/bin/rm /home/user/example.com.html",
        "timeout": 0
      },
      "suppressOutput": true
    }
  ]
}
```

Steps execute **sequentially** in the agent worker. Each step's output is collected and
posted back as a single `response` message (unless `suppressOutput: true`). Errors in
individual steps are caught and reported without aborting the remaining steps.

The agent can create tool-chain tasks directly via `create_task` with `type: "tools"`.

### Recursion guard

Conceptually, since the task runner executes WebMCP tools, and there are WebMCP tools to create and manage tasks, one might imagine a scenario: a task composed of WebMCP tool calls that dynamically generates _other_ tasks, leading to cascading automation.

To ensure safety and prevent infinite execution loops (e.g., task → notification → task), the system enforces a strict recursion guard. When a task runs (`isScheduledTask: true`), the following tools are explicitly **blocked**:

- `create_task`, `update_task`, `delete_task`, `enable_task`, `disable_task`
- `send_notification`

Additionally, the `run_task` tool is explicitly blocked from within **any** task execution context (whether scheduled or triggered manually) to prevent runaway self-triggering loops.

This means while an _agent_ can create a task of composed WebMCP tools, a _task_ itself cannot spawn further tasks.

---

## Polyfill vs Native

|                    | Polyfill                  | Native                                                       |
| ------------------ | ------------------------- | ------------------------------------------------------------ |
| **Stability**      | Stable                    | Experimental (may crash Canary)                              |
| **Unregistration** | `AbortController.abort()` | `AbortController.abort()`                                    |
| **API location**   | `navigator.modelContext`  | `document.modelContext` (fallback: `navigator.modelContext`) |
| **Requirement**    | None                      | `chrome://flags/#enable-webmcp-testing`                      |

---

## Origin Trial Features (Tool Consumption)

With the introduction of the Chrome WebMCP Origin Trial (Chrome 149+), the API expanded to include new features:

- **Listing tools:** `document.modelContext.getTools()`
- **Executing tools:** `document.modelContext.executeTool(tool, input)`
- **Permissions Policy / Cross-origin iframes:** Support for WebMCP inside iframes via `allow="webmcp *"`.

**ShadowClaw's Role:**
ShadowClaw currently acts exclusively as a **Tool Provider**. Our integration focuses on `registerTool()` to expose ShadowClaw's built-in tools (Bash, Git, etc.) to the browser's context so they can be consumed by external AI agents (like Chrome's Built-in AI or MCP-B).

ShadowClaw's internal LLM does not currently act as a **Tool Consumer** via WebMCP (i.e., we do not dynamically poll `getTools()` to expose external page-provided tools to our agent). However, because we utilize `@mcp-b/webmcp-polyfill`, the polyfill already gracefully supports these consumer APIs should we choose to bridge them to the LLM in the future.
