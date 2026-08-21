import{I as e,M as t,d as n,l as r,r as i}from"./config-64zJ5TLN.js";import{n as a}from"./txPromise-EBECky1b.js";import{t as o}from"./getConfig-D89uJgo5.js";import{d as s}from"./custom-element-security-MwgLnC6q.js";import{B as c,H as l,J as u,Lt as d,U as f,W as p,X as m,Y as h,Z as g,at as _,c as v,d as y,et as b,f as x,it as S,kt as C,l as w,m as T,p as E,s as D,t as O}from"./orchestrator-DrMg2dnI.js";import{t as k}from"./setConfig-DFMYnYLE.js";import{a as A,r as j,t as M}from"./toast-D3gxhZpN.js";import{t as N}from"./shadow-claw-element-na_3JW5e.js";import{t as P}from"./effect-BEsuusE8.js";import{n as F,r as I}from"./prompt-api-CyfgoCqW.js";import{n as L,t as R}from"./model-ranking-C60HgQ2c.js";const z=[{pattern:`gemma-3-1b-it-ONNX-GQA`,contextWindow:128e3},{pattern:`gemma-3-1b-it-ONNX`,contextWindow:128e3},{pattern:`Qwen3-0.6B-ONNX`,contextWindow:131072},{pattern:`Qwen3.5`,contextWindow:32768},{pattern:`Llama-3.2`,contextWindow:128e3},{pattern:`Phi-4`,contextWindow:128e3},{pattern:`Phi-3.5`,contextWindow:128e3},{pattern:`SmolLM`,contextWindow:8192},{pattern:`DeepSeek-R1`,contextWindow:128e3},{pattern:`LFM2`,contextWindow:32768},{pattern:`gpt-oss`,contextWindow:32768},{pattern:`gemma-4`,contextWindow:128e3},{pattern:`browser-built-in`,contextWindow:4096}];function B(t){let n=e.getModelInfo(t);if(n&&typeof n.contextWindow==`number`&&n.contextWindow>0)return n.contextWindow;for(let{pattern:e,contextWindow:n}of z)if(t.includes(e))return n;return null}function V(e,n,i){let a=n;e===`prompt_api`&&(n===`browser-built-in`||!n)&&(i?a=i:C()||(a=r));let o=t(a),s=typeof navigator>`u`?null:navigator,c=typeof s?.deviceMemory==`number`?s.deviceMemory:null,l=typeof s?.hardwareConcurrency==`number`?s.hardwareConcurrency:null;if(e===`prompt_api`||e===`transformers_js_browser`||e===`litert_lm_browser`||e===`ollama`){let e=B(a),t=o;c!==null&&(t=c>=32?Math.min(t,16384):c>=16?Math.min(t,8192):c>=8?Math.min(t,4096):Math.min(t,2048)),l!==null&&(l<=4?t=Math.min(t,2048):l>=16?t=Math.min(o,Math.max(t,8192)):l>=8&&(t=Math.min(o,Math.max(t,4096)))),/thinking|reasoning/i.test(a)&&(t=Math.min(t,4096)),t=Math.max(512,Math.min(t,o));let n=[];return e!==null&&n.push(`native context: ${e.toLocaleString()} tokens`),c!==null&&n.push(`${c} GB browser-reported memory`),l!==null&&n.push(`${l} CPU threads`),/thinking|reasoning/i.test(a)&&n.push(`reasoning model`),{recommended:t,detail:n.length>0?`Recommended for this device: ${t.toLocaleString()} tokens (${n.join(`, `)}). Model ceiling: ${o.toLocaleString()}.`:`Recommended for local inference: ${t.toLocaleString()} tokens. Model ceiling: ${o.toLocaleString()}.`}}return{recommended:o,detail:`Model-aware ceiling: ${o.toLocaleString()} tokens.`}}const H=new CSSStyleSheet;H.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
}

:host {
  display: block;
}

.settings-section {
  margin-bottom: 1.75rem;
}

.settings-section h3 {
  align-items: center;
  display: flex;
  font-size: 1rem;
  font-weight: 600;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

.form-input,
.form-select {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  padding: 0.625rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.06);
  outline: none;
}

.password-input-wrapper {
  position: relative;
}

.password-input-wrapper .form-input {
  padding-right: 2.75rem;
}

.password-toggle-btn {
  align-items: center;
  background: transparent;
  border: none;
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  display: inline-flex;
  font-size: 1rem;
  height: 1.875rem;
  justify-content: center;
  padding: 0;
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.875rem;
}

.password-toggle-btn:hover {
  color: var(--shadow-claw-text-primary);
}

.password-toggle-btn:focus-visible {
  border-radius: 999px;
  outline: 0.125rem solid
    color-mix(in srgb, var(--shadow-claw-accent-primary) 55%, transparent);
  outline-offset: 0.0625rem;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.form-toggle {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.form-toggle input[type="checkbox"] {
  accent-color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  height: 1.125rem;
  width: 1.125rem;
}

.form-toggle .form-label {
  cursor: pointer;
  display: inline;
  margin-bottom: 0;
}

.save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin-top: 1rem;
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}
`);const U=new DOMParser().parseFromString(`<template>
  <div class="settings-section" data-setting="llm-provider-settings">
    <h3>🔑 LLM Provider</h3>
    <div class="form-group">
      <label class="form-label">Select Provider</label>
      <select class="form-select" data-setting="provider-select"></select>
    </div>
    <div class="form-group" data-setting="api-key-group">
      <label class="form-label">API Key</label>
      <div class="password-input-wrapper">
        <input
          class="form-input"
          data-setting="api-key-input"
          placeholder="Enter API Key"
          type="password"
        />
        <button
          aria-label="Toggle Password Visibility"
          class="password-toggle-btn"
          data-action="toggle-api-key-visibility"
          type="button"
        >
          👁️
        </button>
      </div>
    </div>
    <button class="save-btn" data-action="save-llm-provider">
      💾 Save Provider
    </button>
  </div>

  <div class="settings-section" data-setting="model-settings">
    <h3>🤖 Model</h3>
    <div class="form-group">
      <label class="form-label">Select Model</label>
      <select
        class="form-select"
        data-setting="model-select"
        style="margin-bottom: 0.5rem"
      ></select>
      <input
        class="form-input"
        data-setting="custom-model-input"
        placeholder="Type your custom model ID (e.g. org/model-name)"
        style="display: none"
        type="text"
      />
      <div class="form-helper">
        Select a model from the list, or choose "Custom Model" to provide your
        own ID.
      </div>
      <div
        class="form-helper"
        data-setting="model-provider-helper"
        style="
          font-style: italic;
          margin-top: 0.25rem;
          color: var(--shadow-claw-text-secondary);
        "
      ></div>
    </div>

    <div
      class="form-group"
      data-setting="prompt-api-fallback-group"
      style="display: none; margin-top: 1rem"
    >
      <label class="form-label">Select Prompt API Fallback Model</label>
      <select class="form-select" data-setting="prompt-api-fallback-select">
        <option value="onnx-community/Qwen3-0.6B-ONNX">
          onnx-community/Qwen3-0.6B-ONNX — Recommended (Fast, Compact &amp; Tool
          Calling)
        </option>
        <option value="onnx-community/gemma-3-1b-it-ONNX-GQA">
          onnx-community/gemma-3-1b-it-ONNX-GQA — Alternative (1B Parameters,
          Larger Download)
        </option>
      </select>
      <div class="form-helper">
        Local model used when the browser's native Prompt API is unavailable.
      </div>
      <div class="form-group" style="margin-top: 1rem">
        <label class="form-label">Preferred Device</label>
        <select class="form-select" data-setting="prompt-api-device-select">
          <option value="auto">
            Auto-detect (WebGPU if available, WASM fallback)
          </option>
          <option value="webgpu">WebGPU (Fastest)</option>
          <option value="wasm">WASM / CPU (Compatibility)</option>
        </select>
        <div class="form-helper">
          Select the hardware backend for local model execution. WebGPU is
          recommended for modern browsers and dedicated GPUs.
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Preferred Dtype</label>
        <select class="form-select" data-setting="prompt-api-dtype-select">
          <option value="auto">Auto (Default: q4f16)</option>
          <option value="q4f16">
            Quantized 4-bit Float16 KV (q4f16 — Fast &amp; Compact)
          </option>
          <option value="q4">Quantized 4-bit (q4 — Ultra Small)</option>
          <option value="q8">Quantized 8-bit (q8 — Memory Efficient)</option>
          <option value="fp16">Float16 (fp16 — Performance)</option>
          <option value="fp32">Float32 (fp32 — High Precision)</option>
          <option value="memory">Memory Optimized (Smallest Download)</option>
          <option value="balanced">Balanced (Speed &amp; Memory)</option>
          <option value="quality">Quality Optimized (Highest Precision)</option>
        </select>
        <div class="form-helper">
          Controls dtype preference order for browser inference. Models are not
          re-quantized; this selects the closest available model revision.
        </div>
      </div>
    </div>

    <button class="save-btn" data-action="refresh-models">
      ↻ Refresh Models
    </button>
    <button class="save-btn" data-action="save-model">💾 Save Model</button>
  </div>

  <div
    class="settings-section"
    data-setting="llamafile-settings"
    style="display: none"
  >
    <h3>🦙 Llamafile Runtime</h3>
    <div class="form-group">
      <label class="form-label">Runtime Mode</label>
      <select class="form-select" data-setting="llamafile-mode-select">
        <option value="cli">CLI (Managed)</option>
        <option value="server">Server (External)</option>
      </select>
      <div class="form-helper">
        CLI mode starts llamafile automatically when needed. Server mode
        connects to an existing llamafile server.
      </div>
    </div>

    <div data-setting="llamafile-server-only" style="display: none">
      <div class="form-group">
        <label class="form-label">Server Host</label>
        <input
          class="form-input"
          data-setting="llamafile-host-input"
          placeholder="127.0.0.1"
          type="text"
        />
      </div>
      <div class="form-group">
        <label class="form-label">Server Port</label>
        <input
          class="form-input"
          data-setting="llamafile-port-input"
          placeholder="8080"
          type="number"
        />
      </div>
    </div>

    <div data-setting="llamafile-cli-only">
      <div class="form-group">
        <div class="form-toggle">
          <input
            data-setting="llamafile-offline-toggle"
            id="llamafile-offline-toggle"
            type="checkbox"
          />
          <label class="form-label" for="llamafile-offline-toggle">
            Offline Mode
          </label>
        </div>
        <div class="form-helper">
          When enabled, llamafile will not attempt to download models from the
          internet.
        </div>
      </div>
    </div>

    <button class="save-btn" data-action="save-llamafile-settings">
      💾 Save Llamafile Settings
    </button>
  </div>

  <div
    class="settings-section"
    data-setting="bedrock-settings"
    style="display: none"
  >
    <h3>☁️ AWS Bedrock Fallback</h3>
    <div class="form-group">
      <label class="form-label">Region</label>
      <input
        class="form-input"
        data-setting="bedrock-region-input"
        placeholder="us-east-1"
        type="text"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Profile</label>
      <input
        class="form-input"
        data-setting="bedrock-profile-input"
        placeholder="default"
        type="text"
      />
    </div>
    <div class="form-group">
      <label class="form-label">Authentication Mode</label>
      <select class="form-select" data-setting="bedrock-auth-mode-select">
        <option value="provider_chain">Default Provider Chain</option>
        <option value="profile">Named Profile</option>
      </select>
    </div>
    <div class="form-helper">
      These settings are used when Bedrock is configured as a fallback model
      directly.
    </div>
    <button class="save-btn" data-action="save-bedrock-settings">
      💾 Save Bedrock Settings
    </button>
  </div>

  <div
    class="settings-section"
    data-setting="mesh-llm-settings"
    style="display: none"
  >
    <h3>🌐 Mesh LLM Host</h3>
    <div class="form-group">
      <label class="form-label">Mesh LLM Host</label>
      <input
        class="form-input"
        data-setting="mesh-llm-host-input"
        placeholder="https://public.mesh-llm.cloud"
        type="text"
      />
      <div class="form-helper">
        Leave empty to use the default public mesh, or provide a local endpoint
        (e.g. <code>http://localhost:9337</code>).
      </div>
    </div>
    <button class="save-btn" data-action="save-mesh-llm-settings">
      💾 Save Mesh LLM Settings
    </button>
  </div>

  <div
    class="settings-section"
    data-setting="transformers-js-settings"
    style="display: none"
  >
    <h3>✨ Transformers.js Browser</h3>
    <div class="form-group">
      <label class="form-label">Preferred Device</label>
      <select class="form-select" data-setting="transformers-js-device-select">
        <option value="auto">
          Auto-detect (WebGPU if available, WASM fallback)
        </option>
        <option value="webgpu">WebGPU (Fastest)</option>
        <option value="wasm">WASM / CPU (Compatibility)</option>
      </select>
      <div class="form-helper">
        Select the hardware backend for local model execution. WebGPU is
        recommended for modern browsers and dedicated GPUs.
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Preferred Dtype</label>
      <select class="form-select" data-setting="transformers-js-dtype-select">
        <option value="auto">Auto (Default: q4f16)</option>
        <option value="q4f16">
          Quantized 4-bit Float16 KV (q4f16 — Fast &amp; Compact)
        </option>
        <option value="q4">Quantized 4-bit (q4 — Ultra Small)</option>
        <option value="q8">Quantized 8-bit (q8 — Memory Efficient)</option>
        <option value="fp16">Float16 (fp16 — Performance)</option>
        <option value="fp32">Float32 (fp32 — High Precision)</option>
        <option value="memory">Memory Optimized (Smallest Download)</option>
        <option value="balanced">Balanced (Speed &amp; Memory)</option>
        <option value="quality">Quality Optimized (Highest Precision)</option>
      </select>
      <div class="form-helper">
        Controls dtype preference order for browser inference. Models are not
        re-quantized; this selects the closest available model revision.
      </div>
    </div>
    <button class="save-btn" data-action="save-transformers-js-settings">
      💾 Save Browser Inference Settings
    </button>
  </div>

  <div class="settings-section">
    <h3>📏 Max Output Tokens</h3>
    <div class="form-group">
      <label class="form-label">Max Tokens</label>
      <input
        class="form-input"
        data-setting="max-tokens-input"
        placeholder="4096"
        type="number"
      />
      <div class="form-helper" data-setting="max-tokens-helper">
        Caps the assistant response length for the current model.
      </div>
    </div>
    <button class="save-btn" data-action="apply-recommended-max-tokens">
      ✨ Apply Recommended
    </button>
    <button class="save-btn" data-action="save-max-tokens">
      💾 Save Max Tokens
    </button>
  </div>

  <div class="settings-section">
    <h3>⚡ Streaming Responses</h3>
    <div class="form-group">
      <div class="form-toggle">
        <input
          data-setting="streaming-toggle"
          id="streaming-toggle"
          type="checkbox"
        />
        <label class="form-label" for="streaming-toggle">
          Enable Streaming
        </label>
      </div>
      <div class="form-helper">
        When enabled, responses appear token-by-token. Supports OpenAI,
        Anthropic, and local providers.
      </div>
    </div>
  </div>

  <div class="settings-section">
    <h3>🗜️ Context Compression</h3>
    <div class="form-group">
      <div class="form-toggle">
        <input
          data-setting="context-compression-toggle"
          id="context-compression-toggle"
          type="checkbox"
        />
        <label class="form-label" for="context-compression-toggle">
          Enable Context Compression
        </label>
      </div>
      <div class="form-helper">
        Reduces token usage by summarizing history or stripping older latest
        messages. For OpenRouter models, this also activates their native
        context windowing.
      </div>
    </div>
  </div>

  <div class="settings-section">
    <h3>⚡ Built-in AI Task Infrastructure</h3>
    <div class="form-group">
      <label class="form-label" for="compaction-engine-select">
        Context Compaction Engine
      </label>
      <select
        class="form-select"
        data-setting="compaction-engine-select"
        id="compaction-engine-select"
      >
        <option value="auto">Active LLM Provider (Default)</option>
        <option value="builtin_task_api">
          Local Task API (Zero Token Cost)
        </option>
      </select>
      <div class="form-helper">
        Controls how conversation context history is summarized during
        compaction.
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="builtin-ai-tools-backend-select">
        Task Tools Backend
      </label>
      <select
        class="form-select"
        data-setting="builtin-ai-tools-backend-select"
        id="builtin-ai-tools-backend-select"
      >
        <option value="active_provider">
          Active Conversation LLM (Default)
        </option>
        <option value="local">Local Browser Task API (Native/Polyfill)</option>
      </select>
      <div class="form-helper">
        Controls whether task tools (summarize, rewrite, translate) run via
        local browser APIs or the active conversation LLM.
      </div>
    </div>
    <button class="save-btn" data-action="save-builtin-ai-settings">
      💾 Save Built-in AI Settings
    </button>
  </div>

  <div class="settings-section">
    <h3>🧠 Reasoning Effort</h3>
    <div class="form-group">
      <label class="form-label" for="reasoning-effort-select">
        Effort Level
      </label>
      <select
        class="form-select"
        data-setting="reasoning-effort-select"
        id="reasoning-effort-select"
      >
        <option value="none">Off</option>
        <option value="minimal">Minimal</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="xhigh">XHigh</option>
        <option value="max">Max</option>
      </select>
      <div class="form-helper">
        Controls adaptive thinking depth for compatible models.
      </div>
    </div>
    <button class="save-btn" data-action="save-reasoning-effort">
      💾 Save Reasoning Effort
    </button>
  </div>

  <div class="settings-section">
    <h3>🔄 Max Iterations</h3>
    <div class="form-group">
      <label class="form-label">Limit</label>
      <input
        class="form-input"
        data-setting="max-iterations-input"
        placeholder="50"
        type="number"
      />
      <div class="form-helper">
        Caps the number of tool calls the agent can make in a single turn.
      </div>
    </div>
    <button class="save-btn" data-action="save-max-iterations">
      💾 Save Max Iterations
    </button>
  </div>

  <div class="settings-section">
    <h3>🤖 Max Parallel Subagents</h3>
    <div class="form-group">
      <label class="form-label">Limit</label>
      <input
        class="form-input"
        data-setting="subagent-max-parallel-input"
        placeholder="5"
        type="number"
      />
      <div class="form-helper">
        Maximum number of subagents that can run concurrently via the
        spawn_subagent tool.
      </div>
    </div>
    <button class="save-btn" data-action="save-subagent-max-parallel">
      💾 Save Subagent Limit
    </button>
  </div>

  <div class="settings-section">
    <h3>🗂️ Subagent Workspace Mode</h3>
    <div class="form-group">
      <label class="form-label" for="subagent-workspace-mode-select"
        >Mode</label
      >
      <select
        class="form-select"
        data-setting="subagent-workspace-mode-select"
        id="subagent-workspace-mode-select"
      >
        <option value="automatic">Automatic (agent decides)</option>
        <option value="parent">Manual: Parent workspace</option>
        <option value="isolated">Manual: Isolated workspace</option>
      </select>
      <div class="form-helper">
        Automatic lets spawn_subagent choose via workspace_group_id. Parent and
        isolated modes force that behavior for all subagents.
      </div>
    </div>
    <button class="save-btn" data-action="save-subagent-workspace-mode">
      💾 Save Workspace Mode
    </button>
  </div>

  <div class="settings-section">
    <h3>🚦 Request Rate Limit</h3>
    <div class="form-group">
      <label class="form-label">Calls per Minute</label>
      <input
        class="form-input"
        data-setting="rate-limit-calls-per-minute-input"
        placeholder="0"
        type="number"
      />
      <div class="form-helper">
        Set to 0 to disable. Manual override for model request rate limits.
      </div>
    </div>
    <div class="form-group">
      <div class="form-toggle">
        <input
          data-setting="rate-limit-auto-adapt-toggle"
          id="rate-limit-auto-adapt-toggle"
          type="checkbox"
        />
        <label class="form-label" for="rate-limit-auto-adapt-toggle">
          Auto-adapt (Recommended)
        </label>
      </div>
      <div class="form-helper">
        Applies a local sliding-window limit across model requests, including
        tool loop turns.
      </div>
    </div>
    <button class="save-btn" data-action="save-rate-limit-settings">
      💾 Save Rate Limit Settings
    </button>
  </div>
</template>
`,`text/html`),W=U.querySelector(`template`);let G=[];G=W?Array.from(W.content.children):Array.from(U.head.children).concat(Array.from(U.body.children));var K=G;const q=`shadow-claw-llm`;var J=class extends N{static styles=H;static template=K;db;lastLlamafileHelpKey;llamafileDiscoveredModelIds;llamafileModelLoadError;modelFetchToken;orchestrator;constructor(){super(),this.db=null,this.orchestrator=null,this.llamafileDiscoveredModelIds=[],this.llamafileModelLoadError=null,this.lastLlamafileHelpKey=``,this.modelFetchToken=0}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await a(),this.orchestrator=O.orchestrator,this.bindEventListeners(),this.setupEffects()}applyRecommendedMaxTokens(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="max-tokens-input"]`);if(!t)return;let n=this.orchestrator.provider,r=this.orchestrator.model,i;n===`prompt_api`&&(i=e.querySelector(`[data-setting="prompt-api-fallback-select"]`)?.value||`onnx-community/Qwen3-0.6B-ONNX`);let a=V(n,r,i);t.value=String(a.recommended)}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-setting="provider-select"]`)?.addEventListener(`change`,()=>this.onProviderChange()),e.querySelector(`[data-setting="prompt-api-fallback-select"]`)?.addEventListener(`change`,e=>{let t=e.target;t?.value&&d(t.value).then(()=>this.updateMaxTokensUI()).catch(()=>{}),this.updateMaxTokensUI()}),e.querySelector(`[data-action="save-llm-provider"]`)?.addEventListener(`click`,()=>this.saveApiKey()),e.querySelector(`[data-action="save-model"]`)?.addEventListener(`click`,()=>this.saveModel()),e.querySelector(`[data-action="refresh-models"]`)?.addEventListener(`click`,()=>this.updateModelSelector()),e.querySelector(`[data-setting="model-select"]`)?.addEventListener(`change`,t=>{let n=e.querySelector(`[data-setting="custom-model-input"]`),r=t.target;n&&r&&(n.style.display=r.value===`__custom__`?`block`:`none`)}),e.querySelector(`[data-setting="streaming-toggle"]`)?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.onStreamingToggle(e.target.checked)}),e.querySelector(`[data-setting="context-compression-toggle"]`)?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.onContextCompressionToggle(e.target.checked)}),e.querySelector(`[data-action="save-max-iterations"]`)?.addEventListener(`click`,()=>this.saveMaxIterations()),e.querySelector(`[data-action="save-subagent-max-parallel"]`)?.addEventListener(`click`,()=>this.saveSubagentMaxParallel()),e.querySelector(`[data-action="save-subagent-workspace-mode"]`)?.addEventListener(`click`,()=>this.saveSubagentWorkspaceMode()),e.querySelector(`[data-action="save-rate-limit-settings"]`)?.addEventListener(`click`,()=>this.saveRateLimitSettings()),e.querySelector(`[data-action="save-max-tokens"]`)?.addEventListener(`click`,()=>this.saveMaxTokens()),e.querySelector(`[data-action="save-reasoning-effort"]`)?.addEventListener(`click`,()=>this.saveReasoningEffort()),e.querySelector(`[data-action="apply-recommended-max-tokens"]`)?.addEventListener(`click`,()=>this.applyRecommendedMaxTokens()),e.querySelector(`[data-action="save-llamafile-settings"]`)?.addEventListener(`click`,()=>this.saveLlamafileSettings()),e.querySelector(`[data-action="save-bedrock-settings"]`)?.addEventListener(`click`,()=>this.saveBedrockSettings()),e.querySelector(`[data-action="save-mesh-llm-settings"]`)?.addEventListener(`click`,()=>this.saveMeshLlmSettings()),e.querySelector(`[data-action="save-transformers-js-settings"]`)?.addEventListener(`click`,()=>this.saveTransformersJsSettings()),e.querySelector(`[data-action="save-builtin-ai-settings"]`)?.addEventListener(`click`,()=>this.saveBuiltinAiSettings()),e.querySelector(`[data-setting="llamafile-mode"]`)?.addEventListener(`change`,()=>{this.updateLlamafileModeVisibility(),this.updateLlamafileModelSectionVisibility(),this.updateModelSelector()}))}renderBedrockSettings(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=this.orchestrator?f(this.orchestrator):null,n=e.querySelector(`[data-setting="bedrock-region-input"]`),r=e.querySelector(`[data-setting="bedrock-profile-input"]`),i=e.querySelector(`[data-setting="bedrock-auth-mode"]`);n&&(n.value=t?.region||``),r&&(r.value=t?.profile||``),i&&(i.value=t?.authMode||`provider_chain`)}renderLlamafileSettings(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=p(this.orchestrator);if(!t)return;let n=e.querySelector(`[data-setting="llamafile-mode"]`),r=e.querySelector(`[data-setting="llamafile-host"]`),i=e.querySelector(`[data-setting="llamafile-port"]`),a=e.querySelector(`[data-setting="llamafile-offline"]`);n&&(n.value=t.mode),r&&(r.value=t.host),i&&(i.value=String(t.port)),a&&(a.checked=t.offline)}renderMeshLlmSettings(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=this.orchestrator.getMeshLlmSettings?.(),n=e.querySelector(`[data-setting="mesh-llm-host-input"]`);n&&(n.value=t?.host||``)}async renderBuiltinAiSettings(){if(!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="compaction-engine-select"]`),n=e.querySelector(`[data-setting="builtin-ai-tools-backend-select"]`),r=await o(this.db,i.COMPACTION_ENGINE_PREFERENCE),a=await o(this.db,i.BUILTIN_AI_TOOLS_BACKEND);t&&(t.value=r||`auto`),n&&(n.value=a||`active_provider`)}async saveBuiltinAiSettings(){if(!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="compaction-engine-select"]`),n=e.querySelector(`[data-setting="builtin-ai-tools-backend-select"]`);try{t&&await k(this.db,i.COMPACTION_ENGINE_PREFERENCE,t.value),n&&await k(this.db,i.BUILTIN_AI_TOOLS_BACKEND,n.value),j(`Built-in AI settings saved successfully`,2500)}catch(e){M(`Error saving Built-in AI settings: `+(e instanceof Error?e.message:String(e)),5e3)}}setupEffects(){P(()=>{O.ready&&(this.orchestrator=O.orchestrator,this.render())})}updateBedrockSettingsVisibility(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="bedrock-settings"]`);n&&(n.style.display=e===`bedrock_proxy`?`block`:`none`)}updateLlamafileModelSectionVisibility(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="model-settings"]`);if(!t)return;let n=p(this.orchestrator);t.style.display=n?.mode===`server`?`none`:`block`}updateLlamafileModeVisibility(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="llamafile-server-only"]`),n=e.querySelector(`[data-setting="llamafile-cli-only"]`);if(!t&&!n)return;let r=this.orchestrator.provider===`llamafile`&&p(this.orchestrator)?.mode===`server`;t&&(t.style.display=r?`block`:`none`),n&&(n.style.display=r?`none`:`block`)}updateLlamafileSettingsVisibility(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="llamafile-settings"]`);n&&(n.style.display=e===`llamafile`?`block`:`none`)}updateMaxTokensUI(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="max-tokens-input"]`),n=e.querySelector(`[data-setting="max-tokens-helper"]`),r=this.orchestrator.provider,i=this.orchestrator.model,a;r===`prompt_api`&&(a=e.querySelector(`[data-setting="prompt-api-fallback-select"]`)?.value||`onnx-community/Qwen3-0.6B-ONNX`);let o=this.orchestrator.maxTokens,s=V(r,i,a);t&&(t.value=String(o),t.removeAttribute(`max`)),n&&(n.textContent=`${s.detail} Current value: ${o.toLocaleString()}.`)}updateMeshLlmSettingsVisibility(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="mesh-llm-settings"]`);n&&(n.style.display=e===`mesh-llm`?`block`:`none`)}updateModelProviderHelperText(){let e=this.shadowRoot;if(!e||!this.orchestrator)return;let t=e.querySelector(`[data-setting="model-provider-helper"]`);if(!t)return;let n=this.orchestrator.provider,r=p(this.orchestrator);if(n!==`llamafile`||r?.mode===`server`){t.hidden=!0,t.textContent=``;return}if(t.hidden=!1,this.llamafileDiscoveredModelIds.length>0){t.textContent=`Discovered ${this.llamafileDiscoveredModelIds.length} *.llamafile model${this.llamafileDiscoveredModelIds.length===1?``:`s`} in ${S}. Choose Custom Model ID to target a file name that is not listed yet.`;return}if(this.llamafileModelLoadError){t.textContent=`Could not load llamafile models from ${S}. You can still enter a custom model id, but the file must exist there.`;return}t.textContent=`ShadowClaw looks for *.llamafile binaries in ${S}.`}updateModelSelector(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=l(),n=this.orchestrator.provider,r=t.find(e=>e.id===n),i=++this.modelFetchToken;n!==`llamafile`&&(this.llamafileDiscoveredModelIds=[],this.llamafileModelLoadError=null);let a=!1;if(n===`llamafile`&&p(this.orchestrator)?.mode===`server`){let t=e.querySelector(`[data-setting="model-select"]`);t&&(s(t,`<option value="">Model is served by local llamafile server</option>`),t.disabled=!0),a=!0}this.updateModelProviderHelperText();let o=e.querySelector(`[data-setting="prompt-api-fallback-group"]`);if(o){let e=F()||I();o.style.display=n===`prompt_api`&&!e?`block`:`none`}let u=e.querySelector(`[data-setting="model-select"]`),d=e.querySelector(`[data-setting="custom-model-input"]`),m=this.orchestrator.model,h=new Set([`transformers_js_local`,`transformers_js_browser`,`ollama`,`llamafile`,`prompt_api`]),g=e=>e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/\"/g,`&quot;`).replace(/'/g,`&#39;`),_=e=>h.has(n)||n===`mesh-llm`?!0:typeof e==`string`?!1:Array.isArray(e.providers)?e.providers.some(e=>e.provider===`hf-inference`||!e.pricing||parseFloat(String(e.pricing.input||e.pricing.prompt||0))===0&&parseFloat(String(e.pricing.output||e.pricing.completion||0))===0):e.pricing?parseFloat(String(e.pricing.prompt||0))===0&&parseFloat(String(e.pricing.completion||0))===0:!1,v=e=>{let t=typeof e==`string`?e:e.id||e.name;return h.has(n)?L(t):typeof e==`string`?!1:e.supports_tools===!0||e.supportsTools===!0?!0:Array.isArray(e.providers)?e.providers.some(e=>e.supports_tools===!0):Array.isArray(e.supported_parameters)?e.supported_parameters.includes(`tools`):!1},y=e=>{let t=typeof e==`string`?e:e.id||e.name;if(h.has(n))return L(t)?` 🛠️`:` ❔🛠️`;if(typeof e==`string`)return` ❔🛠️`;if(e.supports_tools===!0||e.supportsTools===!0)return` 🛠️`;if(e.supports_tools===!1||e.supportsTools===!1)return` 🚫🛠️`;if(Array.isArray(e.providers)){let t=e.providers.some(e=>e.supports_tools===!0),n=e.providers.some(e=>e.supports_tools===!1);if(t)return` 🛠️`;if(n)return` 🚫🛠️`}return Array.isArray(e.supported_parameters)?e.supported_parameters.includes(`tools`)?` 🛠️`:` 🚫🛠️`:` ❔🛠️`},b=e=>typeof e==`string`?0:typeof e.context_length==`number`?e.context_length:typeof e.context_window==`number`?e.context_window:Array.isArray(e.providers)?Math.max(...e.providers.map(e=>e.context_length||0),0):0,x=e=>{if(!u||!d)return;if(!Array.isArray(e)||e.length===0){let e=this.orchestrator?.model||``,t=n===`llamafile`?`No *.llamafile models found in ${S}`:`No models available`;s(u,[`<option value="" ${e?``:`selected`}>${g(t)}</option>`,`<option value="__custom__">-- Custom Model ID --</option>`].join(``)),e?(u.value=`__custom__`,d.value=e,d.style.display=`block`):(u.value=``,d.value=``,d.style.display=`none`),n===`llamafile`&&!e&&this.showLlamafileHelpDialog(this.llamafileModelLoadError?`Failed to load *.llamafile models: ${this.llamafileModelLoadError}`:`No *.llamafile files were found in ${S}.`),this.updateModelProviderHelperText();return}let t=[],r=[];for(let n of e)!n||typeof n!=`string`&&!n.id||(_(n)?t.push(n):r.push(n));let i=(e,t)=>{if(h.has(n)){let r=typeof e==`string`?e:e.id||e.name,i=typeof t==`string`?t:t.id||t.name;return R({id:r,supportsTools:v(e),contextLength:b(e)},{id:i,supportsTools:v(t),contextLength:b(t)},n)}let r=v(e),i=v(t);if(r!==i)return i?1:-1;let a=b(e),o=b(t);if(a!==o)return o-a;let s=typeof e==`string`?e:e.id||e.name,c=typeof t==`string`?t:t.id||t.name;return s.localeCompare(c)};t.sort(i),r.sort(i);let a=e=>{let t=typeof e==`string`?e:e.id||e.name,n=typeof e==`string`?t:typeof e.displayName==`string`&&e.displayName.trim()?e.displayName.trim():typeof e.name==`string`&&e.name.trim()?e.name.trim():t,r=y(e),i=b(e),a=``;i>=1e6?a=` (${(i/1e6).toFixed(1)}M)`:i>=1e3?a=` (${Math.round(i/1024)}k)`:i>0&&(a=` (${i})`);let o=n===t?t:`${n} - ${t}`;return`<option value="${g(t)}">${g(o)}${a}${r}</option>`},o=``;if(h.has(n)){let e=[...t,...r].sort(i);e.length>0&&(o+=`<optgroup label="${n===`prompt_api`?`Built-in`:`Local / Self-hosted`}">`,o+=e.map(a).join(``),o+=`</optgroup>`)}else t.length>0&&(o+=`<optgroup label="Free / Included">`,o+=t.map(a).join(``),o+=`</optgroup>`),r.length>0&&(o+=`<optgroup label="Paid / Pro">`,o+=r.map(a).join(``),o+=`</optgroup>`);o+=`<option value="__custom__">-- Custom Model ID --</option>`,s(u,o),e.map(e=>typeof e==`string`?e:e.id||e.name).includes(m)?(u.value=m,d.style.display=`none`):(u.value=`__custom__`,d.value=m||``,d.style.display=`block`),this.updateModelProviderHelperText()};if(!a)if(r?.modelsUrl&&u){let e=i;s(u,`<option>Loading models…</option>`),u.disabled=!0;let t={...r.headers};if(n===`llamafile`){let e=p(this.orchestrator);e&&(t[`x-llamafile-mode`]=e.mode,t[`x-llamafile-host`]=e.host,t[`x-llamafile-port`]=String(e.port),t[`x-llamafile-offline`]=e.offline?`true`:`false`)}else if(n===`bedrock_proxy`){let e=this.orchestrator?f(this.orchestrator):null;e?.region&&(t[`x-bedrock-region`]=e.region),e?.profile&&(t[`x-bedrock-profile`]=e.profile),e?.authMode&&(t[`x-bedrock-auth-mode`]=e.authMode)}c(this.orchestrator).then(i=>{if(i&&r.apiKeyHeader){let e=(r.apiKeyHeaderFormat||`{key}`).replace(`{key}`,i);t[r.apiKeyHeader]=e}r.modelsUrl&&fetch(r.modelsUrl,{headers:t}).then(e=>{if(!e.ok)throw Error(`HTTP ${e.status}`);return e.json()}).then(t=>{if(e!==this.modelFetchToken||this.orchestrator?.provider!==n)return;let i=[];if(Array.isArray(t))i=t;else if(t&&typeof t==`object`){if(i=t.models||t.data||[],i.length===0){for(let e in t)if(Array.isArray(t[e])&&t[e].length>0){i=t[e];break}}i.length===0&&t.id&&(i=[t])}if(Array.isArray(r.models)){let e=new Set(i.map(e=>typeof e==`string`?e:e.id||e.name));i=[...r.models.filter(t=>{let n=typeof t==`string`?t:t.id||t.name;return!e.has(n)}),...i]}n===`llamafile`&&(this.llamafileModelLoadError=null,this.llamafileDiscoveredModelIds=i.map(e=>typeof e==`string`?e:String(e?.id||e?.name||``)).filter(Boolean)),u.disabled=!1,x(i)}).catch(t=>{if(e!==this.modelFetchToken||this.orchestrator?.provider!==n)return;console.error(`[ShadowClaw] Failed to load models from`,r.modelsUrl,t);let i=t instanceof Error?t.message:String(t);if(n===`llamafile`){this.llamafileDiscoveredModelIds=[],this.llamafileModelLoadError=i,u.disabled=!1,x([]);return}s(u,`<option>Failed to load models</option>`),r?.models?(console.warn(`Falling back to statically configured models due to fetch failure.`),u.disabled=!1,x(r.models)):M(`Could not reach the model server — or proxy configuration is wrong`,5e3)})})}else r?.models&&u?(u.disabled=!1,x(r.models)):u&&(u.disabled=!1,x([]));let C=e.querySelector(`[data-setting="api-key-helper"]`),w=e.querySelector(`[data-setting="provider-select"]`);if(C&&w){let e=w.selectedOptions[0]?.text||`Provider`,t=r?.requiresApiKey!==!1;C.textContent=n===`llamafile`?`Runs local .llamafile binaries through the local proxy. No API key required.`:t?`Enter your ${e} API key. It is encrypted and stored locally.`:`This provider does not require an API key.`}let T=e.querySelector(`[data-setting="api-key-input"]`);if(T){let e=r?.requiresApiKey===!1;T.disabled=e,T.placeholder=e?`No API key required`:`sk-...`}}updateTransformersJsSettingsVisibility(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="transformers-js-settings"]`);n&&(n.style.display=e===`transformers_js_browser`?`block`:`none`)}async onContextCompressionToggle(e){if(!(!this.orchestrator||!this.db))try{await D(this.orchestrator,this.db,e),j(e?`Context compression enabled`:`Context compression disabled`,2500)}catch(e){M(`Error saving context compression setting: `+(e instanceof Error?e.message:String(e)),6e3)}}async onProviderChange(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="provider-select"]`);if(!t)return;let n=t.value,r=this.orchestrator.provider;if(n!==r)try{await b(this.orchestrator,this.db,n,{loadApiKeyForProvider:this.orchestrator.loadApiKeyForProvider.bind(this.orchestrator),getApiKeyForHeaders:()=>c(this.orchestrator)}),this.updateModelSelector(),this.updateMaxTokensUI(),this.updateLlamafileSettingsVisibility(n),this.renderLlamafileSettings(),this.updateLlamafileModeVisibility(),this.updateLlamafileModelSectionVisibility(),this.updateBedrockSettingsVisibility(n),this.updateBedrockSettingsVisibility(n),this.updateMeshLlmSettingsVisibility(n),this.updateTransformersJsSettingsVisibility(n),await this.renderTransformersJsSettings(),j(`Switched to ${t.selectedOptions[0]?.text||n}`,3e3)}catch(e){M(`Error switching provider: `+(e instanceof Error?e.message:String(e)),6e3),t.value=r}}async onStreamingToggle(e){if(!(!this.orchestrator||!this.db))try{await T(this.orchestrator,this.db,e),j(e?`Streaming enabled`:`Streaming disabled`,2500)}catch(e){M(`Error saving streaming setting: `+(e instanceof Error?e.message:String(e)),6e3)}}async render(){let e=this.shadowRoot;if(!e||!this.orchestrator||!this.db)return;this.bindEventListeners();let t=l(),r=this.orchestrator.provider,a=e.querySelector(`[data-setting="provider-select"]`);a&&s(a,t.map(e=>`<option value="${e.id}" ${e.id===r?`selected`:``}>${e.name}</option>`).join(``)),this.updateModelSelector(),this.updateLlamafileSettingsVisibility(r),this.renderLlamafileSettings(),this.updateLlamafileModeVisibility(),this.updateLlamafileModelSectionVisibility(),this.updateModelProviderHelperText(),this.updateBedrockSettingsVisibility(r),this.renderBedrockSettings(),this.updateMeshLlmSettingsVisibility(r),this.renderMeshLlmSettings(),this.updateTransformersJsSettingsVisibility(r),await this.renderTransformersJsSettings(),this.renderBuiltinAiSettings();let c=e.querySelector(`[data-setting="prompt-api-fallback-select"]`);c&&(c.value=await o(this.db,i.PROMPT_API_FALLBACK_MODEL)||`onnx-community/Qwen3-0.6B-ONNX`,this.updateMaxTokensUI(),c.value&&d(c.value).then(()=>{this.updateMaxTokensUI()}).catch(()=>{}));let u=e.querySelector(`[data-setting="prompt-api-device-select"]`);u&&(u.value=await o(this.db,i.PROMPT_API_BACKEND)||`auto`);let f=e.querySelector(`[data-setting="prompt-api-dtype-select"]`);f&&(f.value=await o(this.db,i.PROMPT_API_DTYPE_STRATEGY)||`auto`);let p=e.querySelector(`[data-setting="streaming-toggle"]`);p&&(p.checked=this.orchestrator.streamingEnabled);let m=e.querySelector(`[data-setting="context-compression-toggle"]`);m&&(m.checked=this.orchestrator.contextCompressionEnabled);let h=e.querySelector(`[data-setting="reasoning-effort-select"]`);h&&(h.value=this.orchestrator.reasoningEffort||`none`);let g=e.querySelector(`[data-setting="max-iterations-input"]`);g&&this.orchestrator&&(g.value=String(this.orchestrator.maxIterations));let _=e.querySelector(`[data-setting="subagent-max-parallel-input"]`);if(_){let e=await o(this.db,i.SUBAGENT_MAX_PARALLEL),t=Number(e);_.value=String(Number.isFinite(t)&&t>0?t:5)}let v=e.querySelector(`[data-setting="subagent-workspace-mode-select"]`);if(v){let e=await o(this.db,i.SUBAGENT_WORKSPACE_MODE);v.value=e===`parent`||e===`isolated`||e===`automatic`?e:n}let y=e.querySelector(`[data-setting="rate-limit-calls-per-minute-input"]`);y&&this.orchestrator&&(y.value=String(this.orchestrator.rateLimitCallsPerMinute||0));let b=e.querySelector(`[data-setting="rate-limit-auto-adapt-toggle"]`);b&&this.orchestrator&&(b.checked=this.orchestrator.rateLimitAutoAdapt!==!1),this.updateMaxTokensUI()}async renderTransformersJsSettings(){if(!this.db)return;let e=this.shadowRoot;if(!e)return;let{getConfig:t}=await import(`./getConfig-D89uJgo5.js`).then(e=>e.n),{CONFIG_KEYS:n}=await import(`./config-64zJ5TLN.js`).then(e=>e.O),r=await t(this.db,n.TRANSFORMERS_JS_BACKEND)||`auto`,i=await t(this.db,n.TRANSFORMERS_JS_DTYPE_STRATEGY)||`auto`,a=e.querySelector(`[data-setting="transformers-js-backend"], [data-setting="transformers-js-device-select"]`);a&&(a.value=r);let o=e.querySelector(`[data-setting="transformers-js-dtype-strategy"], [data-setting="transformers-js-dtype-select"]`);o&&(o.value=i)}async requestAppDialog(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog(e):!1}async saveApiKey(){if(!this.orchestrator||!this.db){M(`Orchestrator not initialized`,5e3);return}let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="api-key-input"]`),n=e.querySelector(`[data-setting="provider-select"]`);if(!t||!n)return;let r=t.value.trim(),i=n.value;if(l().find(e=>e.id===i)?.requiresApiKey===!1){try{await b(this.orchestrator,this.db,i,{loadApiKeyForProvider:this.orchestrator.loadApiKeyForProvider.bind(this.orchestrator),getApiKeyForHeaders:()=>c(this.orchestrator)}),t.value=``,j(`Provider saved (no API key required)`,3e3)}catch(e){M(`Error saving provider: `+(e instanceof Error?e.message:String(e)),6e3)}return}if(!r){A(`Please enter an API key`,3e3);return}try{await this.orchestrator.setApiKey(this.db,r),t.value=``,j(`API key and provider saved`,3e3)}catch(e){M(`Error saving API key: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveBedrockSettings(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="bedrock-region-input"]`),n=e.querySelector(`[data-setting="bedrock-profile-input"]`),r=e.querySelector(`[data-setting="bedrock-auth-mode"]`);if(!t||!n)return;let i=t.value.trim(),a=n.value.trim(),o=r?.value||`provider_chain`;if(i&&!a||!i&&a){A(`Enter both Bedrock region and profile (or leave both blank to rely on environment variables)`,4e3);return}try{await u(this.orchestrator,this.db,{region:i,profile:a,authMode:o}),j(`Bedrock fallback settings saved`,3e3),this.orchestrator.provider===`bedrock_proxy`&&this.updateModelSelector()}catch(e){M(`Error saving Bedrock fallback settings: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveLlamafileSettings(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="llamafile-mode"]`),n=e.querySelector(`[data-setting="llamafile-host"]`),r=e.querySelector(`[data-setting="llamafile-port"]`),i=e.querySelector(`[data-setting="llamafile-offline"]`);if(!t||!n||!r||!i)return;let a=t.value===`cli`?`cli`:`server`,o=n.value.trim(),s=parseInt(r.value,10);if(!o){A(`Please enter a host`,3e3);return}if(!Number.isFinite(s)||s<1||s>65535){A(`Please enter a valid port (1-65535)`,3e3);return}try{if(await h(this.orchestrator,this.db,{mode:a,host:o,port:s,offline:i.checked}),this.updateLlamafileModeVisibility(),this.updateLlamafileModelSectionVisibility(),this.updateModelSelector(),this.orchestrator.provider===`llamafile`){j(await O.restartCurrentRequest()?`Llamafile settings saved, request restarted`:`Llamafile settings saved`,3e3);return}j(`Llamafile settings saved`,3e3)}catch(e){M(`Error saving llamafile settings: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveMaxIterations(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="max-iterations-input"]`);if(!t)return;let n=parseInt(t.value,10);if(!n||n<1){A(`Please enter a valid number (1 or higher)`,3e3);return}try{await v(this.orchestrator,this.db,n),j(`Max iterations saved`,3e3)}catch(e){M(`Error saving max iterations: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveMaxTokens(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="max-tokens-input"]`);if(!t)return;let n=parseInt(t.value,10);if(!n||n<1){A(`Please enter a valid number (1 or higher)`,3e3);return}try{await w(this.orchestrator,this.db,n),this.updateMaxTokensUI(),j(`Max tokens saved`,3e3)}catch(e){M(`Error saving max tokens: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveMeshLlmSettings(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="mesh-llm-host-input"]`);if(!t)return;let n=t.value.trim();try{this.orchestrator&&(await m(this.orchestrator,this.db,{host:n}),j(`Mesh LLM settings saved`,3e3),this.orchestrator.provider===`mesh-llm`&&this.updateModelSelector())}catch(e){M(`Error saving Mesh LLM settings: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveModel(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="model-select"]`),n=e.querySelector(`[data-setting="custom-model-input"]`);if(!t||!n)return;let r=t.value;if(r===`__custom__`&&(r=n.value.trim()),this.orchestrator.provider===`llamafile`&&p(this.orchestrator).mode===`cli`&&!r){await this.showLlamafileHelpDialog(`Select a discovered *.llamafile model or enter a custom model id that matches a file in the ${S} folder.`);return}if(this.orchestrator.provider===`prompt_api`){let t=e.querySelector(`[data-setting="prompt-api-fallback-select"]`);if(t)try{await k(this.db,i.PROMPT_API_FALLBACK_MODEL,t.value)}catch(e){console.warn(`Error saving prompt api fallback model`,e)}let n=e.querySelector(`[data-setting="prompt-api-device-select"]`);if(n)try{await k(this.db,i.PROMPT_API_BACKEND,n.value)}catch(e){console.warn(`Error saving prompt api backend`,e)}let r=e.querySelector(`[data-setting="prompt-api-dtype-select"]`);if(r)try{await k(this.db,i.PROMPT_API_DTYPE_STRATEGY,r.value)}catch(e){console.warn(`Error saving prompt api dtype strategy`,e)}}try{if(await g(this.orchestrator,this.db,r),this.updateMaxTokensUI(),this.orchestrator.provider===`llamafile`){j(await O.restartCurrentRequest()?`Model saved, request restarted`:`Model saved`,3e3);return}j(`Model saved`,3e3)}catch(e){M(`Error saving model: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveRateLimitSettings(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="rate-limit-calls-per-minute-input"]`),n=e.querySelector(`[data-setting="rate-limit-auto-adapt-toggle"]`);if(!t||!n)return;let r=parseInt(t.value,10);if(!Number.isFinite(r)||r<0){A(`Please enter a valid non-negative calls-per-minute value`,3e3);return}try{await x(this.orchestrator,this.db,r),await y(this.orchestrator,this.db,n.checked),j(`Rate limit settings saved`,3e3)}catch(e){M(`Error saving rate limit settings: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveReasoningEffort(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="reasoning-effort-select"]`);if(t)try{await E(this.orchestrator,this.db,t.value||`none`),j(`Reasoning effort saved`,3e3)}catch(e){M(`Error saving reasoning effort: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveSubagentMaxParallel(){if(!this.db){M(`Database not initialized`,3e3);return}let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="subagent-max-parallel-input"]`);if(!t)return;let n=parseInt(t.value,10);if(!n||n<1){A(`Please enter a valid number (1 or higher)`,3e3);return}try{await k(this.db,i.SUBAGENT_MAX_PARALLEL,String(n)),j(`Subagent limit saved`,3e3)}catch(e){M(`Error saving subagent limit: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveSubagentWorkspaceMode(){if(!this.db){M(`Database not initialized`,3e3);return}let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="subagent-workspace-mode-select"]`);if(!t)return;let n=t.value;if(n!==`automatic`&&n!==`parent`&&n!==`isolated`){A(`Please select a valid subagent workspace mode`,3e3);return}try{await k(this.db,i.SUBAGENT_WORKSPACE_MODE,n),j(`Subagent workspace mode saved`,3e3)}catch(e){M(`Error saving subagent workspace mode: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveTransformersJsSettings(){if(!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="transformers-js-backend"], [data-setting="transformers-js-device-select"]`)?.value||`auto`,n=e.querySelector(`[data-setting="transformers-js-dtype-strategy"], [data-setting="transformers-js-dtype-select"]`)?.value||`auto`,{setConfig:r}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n),{CONFIG_KEYS:i}=await import(`./config-64zJ5TLN.js`).then(e=>e.O);await r(this.db,i.TRANSFORMERS_JS_BACKEND,t),await r(this.db,i.TRANSFORMERS_JS_DTYPE_STRATEGY,n),j(`Transformers.js settings saved.`)}async showLlamafileHelpDialog(e){let t=`${e||``}|${this.orchestrator?.model||``}`;this.lastLlamafileHelpKey!==t&&(this.lastLlamafileHelpKey=t,await this.requestAppDialog(_(e)))}};customElements.get(q)||customElements.define(q,J);export{J as ShadowClawLlm};