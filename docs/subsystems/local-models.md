# Local Models & Hugging Face Dependency Downloading

> Architecture and roadmap for running local LLMs, downloading model weights and dependencies from Hugging Face, and transitioning between OpenRouter and offline execution.

**Source:** `src/server/services/transformers-runtime.ts` · `src/server/routes/transformers-js.ts` · `src/config/config.ts` · `src/cli/commands/agent.ts` · `src/subsystems/providers/utils/parseLocalModelToolCall.ts` · `src/worker/tools/node-transformers-executor.ts`

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
> The browser client remains defaulted to the Chrome Prompt API (`prompt_api`) with its onboarding setup dialog. Setting `"agent"` configures headless CLI executions while keeping browser state pristine.

### Curated ONNX Models

The following models are curated and supported out-of-the-box for in-process Node.js and Transformers.js local execution:

| Model ID                                | Name                  | Context | Tools | Notes                                             |
| --------------------------------------- | --------------------- | ------- | ----- | ------------------------------------------------- |
| `onnx-community/Qwen3-0.6B-ONNX`        | Qwen 3 0.6B (ONNX)    | 32,768  | Yes   | **Recommended / Default**: Ultra-compact and fast |
| `onnx-community/gemma-3-1b-it-ONNX-GQA` | Gemma 3 1B GQA (ONNX) | 32,000  | Yes   | Google Gemma 3 1B with Grouped Query Attention    |
| `onnx-community/gemma-4-E2B-it-ONNX`    | Gemma 4 E2B (ONNX)    | 128,000 | Yes   | Google Gemma 4 E2B instruction-tuned              |
| `onnx-community/gemma-4-E4B-it-ONNX`    | Gemma 4 E4B (ONNX)    | 128,000 | Yes   | Google Gemma 4 E4B instruction-tuned              |

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
# Download default model (Qwen3-0.6B-ONNX)
shadow-claw agent model download

# Download specific model (e.g. Gemma 4 E2B)
shadow-claw agent model download onnx-community/gemma-4-E2B-it-ONNX
```

During download, a terminal progress bar displays:

- Current file being downloaded
- Visual progress bar and percentage: `[=========>           ] 45.2%`
- Transferred vs. total size in human-readable units (e.g. `(245.3 MB / 542.1 MB)`)
- Dynamic single-line updates in interactive TTY terminals; milestone logs in non-interactive CI/log pipes.

### 3. Set Default CLI Model

```bash
shadow-claw agent model set onnx-community/gemma-4-E2B-it-ONNX
```

Persists the selection to `shadow-claw.config.json` under `"agent": { "defaultModel": "..." }`.

### 4. Initialize Workspace with Model Prewarming

```bash
# Initialize with custom model and download immediately
shadow-claw agent init --model onnx-community/gemma-3-1b-it-ONNX-GQA --download
```

---

## Model & Dependency Downloading Architecture

### 1. In-Process Node.js Execution (`executeNodeTransformersCompletion`)

Located at `src/worker/tools/node-transformers-executor.ts`, this executor runs directly within the Node process during headless agent operations (`shadow-claw agent run`):

- Eliminates the need for a background HTTP proxy server on port 8888.
- Automatically initializes the model download progress bar on stderr if weights are not yet cached.
- Streams generation in-process, returning OpenAI-compatible JSON objects normalized for the tool-use loop.

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

### 3. Unified Local Model Tool Calling (`parseLocalModelToolCall`)

Located at `src/subsystems/providers/utils/parseLocalModelToolCall.ts`, this utility standardizes tool invocation formatting and parsing across local models:

- **Schema Normalization**: Converts internal tool definitions (`ToolDefinition`) into standard OpenAI-compatible function definitions (`{ type: "function", function: { name, description, parameters } }`).
- **Tokenizer Template Integration**: Passes tool schemas directly into the tokenizer's Jinja chat template via `tools: currentTools`, allowing models trained on tool use (such as Qwen and Gemma) to structure tool calls natively.
- **Robust Extraction**: Parses tool call syntax from model outputs (e.g. `<tool_call>{"name": "...", "arguments": {...}}</tool_call>`, markdown code blocks, or raw JSON) across both the HTTP proxy route (`src/server/routes/transformers-js.ts`) and in-process Node execution (`src/worker/tools/node-transformers-executor.ts`).
