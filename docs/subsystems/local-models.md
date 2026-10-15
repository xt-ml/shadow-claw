# Local Models & Hugging Face Dependency Downloading

> Architecture and roadmap for running local LLMs, downloading model weights and dependencies from Hugging Face, and transitioning between OpenRouter and offline execution.

**Source:** `src/server/services/transformers-runtime.ts` · `src/server/routes/transformers-js.ts` · `src/config/config.ts` · `src/cli/commands/agent.ts` · `src/subsystems/providers/utils/parse-local-model-tool-call.ts` · `src/worker/tools/node-transformers-executor.ts`

---

## Overview

ShadowClaw supports both cloud-based providers (defaulting out-of-the-box to **OpenRouter**) and completely local, offline execution using ONNX models powered by `@huggingface/transformers`, Ollama, or Llamafile.

Default providers and models can be configured declaratively in `shadow-claw.config.json` or overridden via CLI flags and environment variables.

---

## Declarative Configuration

### Declarative CLI Agent Configuration

To configure the CLI agent defaults without affecting browser client settings, use the `"agent"` block in `shadow-claw.config.json`:

```json
{
  "agent": {
    "defaultProvider": "transformers_js_local",
    "defaultModel": "onnx-community/Qwen3-0.6B-ONNX"
  }
}
```

> [!NOTE]
> The browser client defaults out-of-the-box to Transformers.js (`transformers_js_browser` with `onnx-community/Qwen3-0.6B-ONNX`) with guided onboarding. Setting `"agent"` configures headless CLI executions while keeping browser state pristine.

### CLI-Curated ONNX Models

These four ONNX models are listed by `shadow-claw agent model list` and supported by the headless CLI's Transformers.js executor:

| Model ID                                | Name                  | Context | Tools | Notes                                                      |
| --------------------------------------- | --------------------- | ------- | ----- | ---------------------------------------------------------- |
| `onnx-community/gemma-4-E2B-it-ONNX`    | Gemma 4 E2B (ONNX)    | 128,000 | Yes   | Headless CLI local-model default (128k context, tools)     |
| `onnx-community/gemma-4-E4B-it-ONNX`    | Gemma 4 E4B (ONNX)    | 128,000 | Yes   | Google Gemma 4 E4B instruction-tuned (128k context, tools) |
| `onnx-community/Qwen3-0.6B-ONNX`        | Qwen 3 0.6B (ONNX)    | 32,768  | Yes   | Server runtime default; ultra-compact and fast             |
| `onnx-community/gemma-3-1b-it-ONNX-GQA` | Gemma 3 1B GQA (ONNX) | 32,000  | No    | Chat only (chat template does not support tool calling)    |

> **Note on Tool Calling:** Tool calling requires a chat template that renders `tools`. Gemma 3's official chat template does not render tool definitions or support tool role turns, so tool calling is disabled for Gemma 3.

The server-side runtime also advertises ONNX models beyond this CLI-curated list. With no model ID, `shadow-claw agent model download` downloads Gemma 4 E2B; the server runtime's default model is Qwen 3 0.6B.

---

## CLI Model Management & Progress Bar

ShadowClaw provides dedicated CLI commands to inspect, set, and download local models with a visual progress bar.

### 1. List Available Models

```bash
shadow-claw agent model list
```

Displays all curated models, their token context length, tool-calling capability, and whether they are locally cached.

### 2. Download Model with Progress Bar

```bash
# Download default CLI model (Gemma 4 E2B)
shadow-claw agent model download

# Download specific model (e.g. Gemma 4 E2B)
shadow-claw agent model download onnx-community/gemma-4-E2B-it-ONNX
```

During download, a terminal progress bar displays:

- Current file being downloaded
- Visual progress bar and percentage: `[=========>           ] 45.2%`
- Transferred vs. total size in human-readable units (e.g. `(245.3 MB / 542.1 MB)`)
- Dynamic single-line updates in interactive TTY terminals; milestone logs in non-interactive CI/log pipes.

Downloads are resumable:

- Files are written to a stable `<file>.part` path and renamed to the final path only when complete.
- After an interruption (Ctrl+C, network drop), re-running the command sends `Range: bytes=N-` and appends only the missing bytes.
- A `416 Range Not Satisfiable` response discards the stale `.part` file and restarts the file from zero.
- Download routines safely close and clean up active write streams upon errors or interruptions.
- Local model cache detection (`isModelLocallyCached`) traverses the model cache directory recursively, verifying that no `.part` or `.tmp` files exist and confirming valid completed `.onnx` files are present.
- Llamafile cache detection (`isLlamafileLocallyCached`) matches curated models by ID, filename, or URL, and similarly excludes incomplete downloads with `.part` files.
- Executing `agent run` with an uncached local model requires `--download` or `--yes` (`-y`) to initiate the download.
- Pass `--cache-dir <dir>` to store model files in a custom cache directory.
- Llamafile downloads use the same `.part` resume behavior.

### 3. Set Default CLI Model

```bash
shadow-claw agent model set onnx-community/gemma-4-E2B-it-ONNX
```

Persists the selection to `shadow-claw.config.json` under `"agent": { "defaultModel": "..." }`.

### 4. Initialize Workspace with Model Prewarming

```bash
# Initialize with custom model and download immediately
shadow-claw agent init --model onnx-community/gemma-4-E2B-it-ONNX --download
```

### 5. Interactive Hugging Face Model Browser (`agent init`)

When running interactive initialization (`npx shadow-claw agent init`), option `12` (or typing `r` directly) opens the Hugging Face ONNX model browser:

- **Bounded Pagination:** Displays 25 models per page with clear page indicators (e.g. `Page 2 of 4, showing 26-50 of 87`).
- **Interactive Navigation Commands:**
  - `n` / `next`: Advance to the next page.
  - `p` / `prev`: Return to the previous page.
  - `s <query>` or `s`: Filter available models by search query on the fly (leave query blank or type `s` to reset).
  - `b` / `back`: Return to the main model selection menu.
  - `1-N`: Select any displayed model by number (or type a custom model ID directly).
- **Session Caching:** Model lists and search queries are cached in-memory during the picker session, eliminating redundant network requests while paging back and forth.

---

## Model & Dependency Downloading Architecture

### 0. Resumable Download Interceptor (`createFileModelCacheFetch`)

Located at `src/subsystems/providers/utils/create-file-model-cache-fetch.ts`, this interceptor is installed as `env.fetch` for in-process Transformers.js runs:

- `downloadWithResume()` streams each file into `<path>.part` and atomically renames it on completion.
- Transformers.js `FileCache.put()` is bypassed, so interrupted downloads are no longer deleted.
- `FileCache` is patched at runtime to find completed files as cache hits.
- Byte-level progress is emitted through `modelDownloadEvents` and merged into the aggregate `progress_total` progress reported to the CLI progress bar.
- `TransformersRuntimeService.prewarmModel()` accepts an optional `cacheDir` that overrides the default runtime cache directory.

### 1. In-Process Node.js Execution (`executeNodeTransformersCompletion`)

Located at `src/worker/tools/node-transformers-executor.ts`, this executor runs directly within the Node process during headless agent operations (`shadow-claw agent run`):

- Eliminates the need for a background HTTP proxy server on port 8888.
- Automatically initializes the model download progress bar on stderr if weights are not yet cached.
- Streams generation in-process, returning OpenAI-compatible JSON objects normalized for the tool-use loop.
- **System Prompt Forwarding**: During headless agent invocation (`handleInvoke`), messages formatted with the active system prompt (`body.messages`) are passed directly to both `node-transformers-executor.ts` and `node-llamafile-executor.ts`, ensuring complete system prompt adherence in offline headless runs.

### 2. `TransformersRuntimeService`

Located at `src/server/services/transformers-runtime.ts`, this service manages the lifecycle of local ONNX models:

```text
Client / CLI Agent
       │
       ├── Headless Mode: in-process executeNodeTransformersCompletion()
       │
       └── Browser Mode: HTTP Local Proxy (/v1/chat/completions)
              │
              ▼
       TransformersRuntimeService
              │
              ├── Checks disk cache: assets/cache/transformers.js/
              ├── Downloads ONNX weights & tokenizer via progress callbacks
              ├── Pre-warms pipeline and loads ONNX runtime (device: CPU / q4)
              └── Executes inference via TextStreamer
```

### 3. Unified Local Model Tool Calling (`parseLocalModelToolCalls`)

Located at `src/subsystems/providers/utils/parse-local-model-tool-call.ts`, this utility standardizes tool invocation formatting, schema normalization, and parsing across local models:

- **Defensive Schema Sanitization**: Converts internal tool definitions (`ToolDefinition`) into standard OpenAI-compatible function definitions (`{ type: "function", function: { name, description, parameters } }`), recursively sanitizing nested property definitions (`sanitizePropertySchema`) so all object and array fields include explicit `type` metadata required by strict Jinja chat templates (e.g. Gemma 4).
- **Tokenizer Template Integration**: Passes sanitized tool schemas directly into the tokenizer's Jinja chat template via `tools: currentTools`, allowing models trained on tool use (such as Qwen and Gemma) to structure tool calls natively.
- **Multi-Tool Parsing & Grammar Support**: Parses single and multi-tool invocations (`parseLocalModelToolCalls`) across varied model grammars, including Gemma 4 `call:function{...}` syntax with balanced brace extraction, Qwen `<|tool_call>`, `<tool_call>`, `<execute_tool>`, and Markdown JSON code blocks, with `<think>` reasoning block stripping.
- **Streaming Tool Call Suppression Filter**: Uses `createToolCallStreamFilter` in `src/subsystems/providers/utils/parse-local-model-tool-call.ts` to intercept and buffer token output that matches potential tool-call prefixes. When a tool call is detected, streaming is suppressed so raw tool-call syntax does not leak to stdout or the chat UI; when normal conversational text is detected, buffered tokens are flushed and subsequent tokens stream in real-time.
- **Chat Template Normalization**: In `normalizeMessagesForChatTemplate` (`src/subsystems/providers/utils/chat-template.ts`), stringified assistant tool arguments are parsed to objects, and `tool_call_id` and tool `name` attributes are preserved on `role: "tool"` turns to satisfy Jinja template requirements.

### 4. Llamafile & Agentfile Local Binary Driver Architecture (`LocalBinaryDriver`)

Located at `src/server/services/llamafile-manager.ts`, `src/server/routes/llamafile.ts`, `src/cli/utils/local-models.ts`, and `src/worker/tools/node-llamafile-executor.ts`:

- **Unified Tool Calling**: Llamafile models execute tools across both browser and headless environments:
  - **Server Mode**: Forwards `tools` schemas directly to `/v1/chat/completions` when connected to a running Llamafile server, parsing OpenAI-standard `tool_calls`. Upstream built-in tools (`read_file`, `grep_search`, `exec_shell_command`, etc.) are exposed through the proxy via `GET /llamafile-proxy/tools` and `POST /llamafile-proxy/tools`.
  - **CLI Mode**: When running directly against local binaries without a daemon, `buildCliPrompt` formats system tool declarations directly into the prompt. Output is parsed by `parseLocalModelToolCalls` (recovering both `call:name{...}` and `<tool_call>` formats), and `createToolCallStreamFilter` suppresses raw tool syntax from leaking over SSE streams.
  - **Headless In-Process Execution**: `executeNodeLlamafileCompletion` in `node-llamafile-executor.ts` receives active runtime tool schemas from `handleInvoke` and dispatches them seamlessly to the local Llamafile CLI or server process.
  - **POSIX Shell Script Mode Execution**: On POSIX platforms, spawned binary processes launch via `/bin/sh` to bypass Linux `binfmt_misc` / `run-detectors` interpreter resolution errors, ensuring reliable execution of Actually Portable Executable (APE) binaries across host distributions.
- **Full Agentfile (`.agentfile`) Support**:
  - **Autonomous Agent Binary Execution**: Single-executable autonomous agents built with Mozilla's `agent.cpp` / `agentfile` execute tools internally on the host OS or inside sandboxes (`--tools-runtime <docker|ssh>`).
  - **I/O Channel Semantics**: Tool execution activity and progress warnings go to `stderr`, while final synthesized answers are streamed or emitted directly to `stdout`.
  - **CLI Flag Translation (`buildAgentfileArgs`)**: Automatically constructs `-p <prompt>`, `-c <ctx_size>`, `-s <system_prompt>`, `--yes` (for unattended runs), `--tools <all|none|list>`, `--tools-runtime <sandbox>`, `--searxng-url <url>`, `--session <file>`, `--trace <file>`, and `--max-iterations <N>`.
  - **Proxy & Provider Integration**: Exposes `PROVIDERS.agentfile` via `/agentfile-proxy/models`, `/agentfile-proxy/tools`, and `/agentfile-proxy/chat/completions`, with seamless fallback to headless in-process execution via `executeNodeLlamafileCompletion`.
