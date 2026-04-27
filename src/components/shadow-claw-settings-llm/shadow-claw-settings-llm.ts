import { getDb } from "../../db/db.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../toast.js";
import { effect } from "../../effect.js";
import { getModelMaxTokens } from "../../config.js";

import type { Orchestrator } from "../../orchestrator.js";
import type { LLMProvider, ShadowClawDatabase } from "../../types.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings-llm";

type BrowserNavigator = Navigator & {
  deviceMemory?: number;
};

function getRecommendedMaxTokens(
  providerId: string,
  modelId: string,
): {
  recommended: number;
  detail: string;
} {
  const modelCeiling = getModelMaxTokens(modelId);
  const browserNavigator: BrowserNavigator | null =
    typeof navigator === "undefined" ? null : (navigator as BrowserNavigator);
  const deviceMemory =
    typeof browserNavigator?.deviceMemory === "number"
      ? browserNavigator.deviceMemory
      : null;
  const cpuThreads =
    typeof browserNavigator?.hardwareConcurrency === "number"
      ? browserNavigator.hardwareConcurrency
      : null;

  if (providerId !== "ollama") {
    return {
      recommended: modelCeiling,
      detail: `Model-aware ceiling: ${modelCeiling.toLocaleString()} tokens.`,
    };
  }

  let recommended = modelCeiling;

  if (deviceMemory !== null) {
    if (deviceMemory >= 32) {
      recommended = Math.min(recommended, 16384);
    } else if (deviceMemory >= 16) {
      recommended = Math.min(recommended, 8192);
    } else if (deviceMemory >= 8) {
      recommended = Math.min(recommended, 4096);
    } else {
      recommended = Math.min(recommended, 2048);
    }
  }

  if (cpuThreads !== null) {
    if (cpuThreads <= 4) {
      recommended = Math.min(recommended, 2048);
    } else if (cpuThreads >= 16) {
      recommended = Math.min(modelCeiling, Math.max(recommended, 8192));
    } else if (cpuThreads >= 8) {
      recommended = Math.min(modelCeiling, Math.max(recommended, 4096));
    }
  }

  if (/thinking|reasoning/i.test(modelId)) {
    recommended = Math.min(recommended, 4096);
  }

  recommended = Math.max(512, Math.min(recommended, modelCeiling));

  const hints: string[] = [];
  if (deviceMemory !== null) {
    hints.push(`${deviceMemory} GB browser-reported memory`);
  }

  if (cpuThreads !== null) {
    hints.push(`${cpuThreads} CPU threads`);
  }

  if (/thinking|reasoning/i.test(modelId)) {
    hints.push("reasoning model");
  }

  return {
    recommended,
    detail:
      hints.length > 0
        ? `Recommended for this device: ${recommended.toLocaleString()} tokens (${hints.join(", ")}). Model ceiling: ${modelCeiling.toLocaleString()}.`
        : `Recommended for local inference: ${recommended.toLocaleString()} tokens. Model ceiling: ${modelCeiling.toLocaleString()}.`,
  };
}

/**
 * Settings sub-component for LLM Provider, API Key, Model selection,
 * and streaming toggle.
 */
export class ShadowClawSettingsLlm extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettingsLlm.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettingsLlm.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null;
  orchestrator: Orchestrator | null;

  constructor() {
    super();

    this.db = null;
    this.orchestrator = null;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();
    this.orchestrator = orchestratorStore.orchestrator;

    this.bindEventListeners();

    this.setupEffects();
  }

  /**
   * Set up reactive effects.
   */
  setupEffects() {
    effect(() => {
      if (orchestratorStore.ready) {
        this.orchestrator = orchestratorStore.orchestrator;
        this.render();
      }
    });
  }

  /**
   * Bind all event listeners.
   */
  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-setting="provider-select"]')
      ?.addEventListener("change", () => this.onProviderChange());

    root
      .querySelector('[data-action="save-api-key"]')
      ?.addEventListener("click", () => this.saveApiKey());

    root
      .querySelector('[data-action="save-model"]')
      ?.addEventListener("click", () => this.saveModel());

    root
      .querySelector('[data-setting="model-select"]')
      ?.addEventListener("change", (e) => {
        const customInput = root.querySelector(
          '[data-setting="custom-model-input"]',
        ) as HTMLElement | null;

        const target = e.target as HTMLSelectElement | null;
        if (customInput && target) {
          customInput.style.display =
            target.value === "__custom__" ? "block" : "none";
        }
      });

    root
      .querySelector('[data-action="save-assistant-name"]')
      ?.addEventListener("click", () => this.saveAssistantName());

    root
      .querySelector('[data-setting="streaming-toggle"]')
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          this.onStreamingToggle(e.target.checked);
        }
      });

    root
      .querySelector('[data-setting="proxy-toggle"]')
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          this.onProxyToggle(e.target.checked);
        }
      });

    root
      .querySelector('[data-setting="context-compression-toggle"]')
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          this.onContextCompressionToggle(e.target.checked);
        }
      });

    root
      .querySelector('[data-action="save-proxy-url"]')
      ?.addEventListener("click", () => this.saveProxyUrl());

    root
      .querySelector('[data-action="save-max-iterations"]')
      ?.addEventListener("click", () => this.saveMaxIterations());

    root
      .querySelector('[data-action="save-max-tokens"]')
      ?.addEventListener("click", () => this.saveMaxTokens());

    root
      .querySelector('[data-action="apply-recommended-max-tokens"]')
      ?.addEventListener("click", () => this.applyRecommendedMaxTokens());

    root
      .querySelector('[data-action="save-llamafile-settings"]')
      ?.addEventListener("click", () => this.saveLlamafileSettings());

    root
      .querySelector('[data-action="save-bedrock-settings"]')
      ?.addEventListener("click", () => this.saveBedrockSettings());

    root
      .querySelector('[data-setting="llamafile-mode"]')
      ?.addEventListener("change", () => {
        this.updateLlamafileModeVisibility();
        this.updateLlamafileModelSectionVisibility();
        this.updateModelSelector();
      });
  }

  /**
   * Load and populate all settings fields.
   */
  async render() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Populate provider selector
    const providers = this.orchestrator.getAvailableProviders();
    const currentProvider = this.orchestrator.getProvider();
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;

    if (providerSelect) {
      providerSelect.innerHTML = providers
        .map(
          (p: LLMProvider) =>
            `<option value="${p.id}" ${p.id === currentProvider ? "selected" : ""}>${p.name}</option>`,
        )
        .join("");
    }

    // Populate model selector
    this.updateModelSelector();

    this.updateLlamafileSettingsVisibility(currentProvider);
    this.renderLlamafileSettings();
    this.updateLlamafileModeVisibility();
    this.updateLlamafileModelSectionVisibility();
    this.updateBedrockSettingsVisibility(currentProvider);
    this.renderBedrockSettings();

    // Load assistant name
    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement | null;
    if (nameInput) {
      nameInput.value = this.orchestrator.getAssistantName() || "k9";
    }

    // Load streaming toggle
    const streamingToggle = root.querySelector(
      '[data-setting="streaming-toggle"]',
    ) as HTMLInputElement | null;
    if (streamingToggle) {
      streamingToggle.checked = this.orchestrator.getStreamingEnabled();
    }

    // Load proxy toggle
    const proxyToggle = root.querySelector(
      '[data-setting="proxy-toggle"]',
    ) as HTMLInputElement | null;
    if (proxyToggle) {
      proxyToggle.checked = this.orchestrator.getUseProxy();
    }

    // Load context compression toggle
    const ccToggle = root.querySelector(
      '[data-setting="context-compression-toggle"]',
    ) as HTMLInputElement | null;
    if (ccToggle) {
      ccToggle.checked = this.orchestrator.getContextCompressionEnabled();
    }

    // Load proxy URL
    const proxyUrlInput = root.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;
    if (proxyUrlInput && this.orchestrator) {
      proxyUrlInput.value = this.orchestrator.getProxyUrl();
    }

    // Load max iterations
    const maxIterInput = root.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement | null;
    if (maxIterInput && this.orchestrator) {
      maxIterInput.value = String(this.orchestrator.getMaxIterations());
    }

    this.updateMaxTokensUI();
  }

  updateMaxTokensUI() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    const helper = root.querySelector(
      '[data-setting="max-tokens-helper"]',
    ) as HTMLElement | null;

    const providerId = this.orchestrator.getProvider();
    const modelId = this.orchestrator.getModel();
    const currentValue = this.orchestrator.getMaxTokens();
    const recommendation = getRecommendedMaxTokens(providerId, modelId);

    if (input) {
      input.value = String(currentValue);
      input.max = String(getModelMaxTokens(modelId));
    }

    if (helper) {
      helper.textContent = `${recommendation.detail} Current value: ${currentValue.toLocaleString()}.`;
    }
  }

  /**
   * Update model selector based on current provider.
   */
  updateModelSelector() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providers = this.orchestrator.getAvailableProviders();
    const currentProvider = this.orchestrator.getProvider();
    const currentProviderData = providers.find(
      (p: LLMProvider) => p.id === currentProvider,
    ) as LLMProvider | undefined;

    let skipModelFetch = false;
    if (currentProvider === "llamafile") {
      const llamafileSettings = this.orchestrator.getLlamafileSettings?.();
      if (llamafileSettings?.mode === "server") {
        const modelSelect = root.querySelector(
          '[data-setting="model-select"]',
        ) as HTMLSelectElement | null;

        if (modelSelect) {
          modelSelect.innerHTML =
            '<option value="">Model is served by local llamafile server</option>';
          modelSelect.disabled = true;
        }

        skipModelFetch = true;
      }
    }

    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement | null;
    const customModelInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLInputElement | null;
    const currentModel = this.orchestrator.getModel();

    /**
     * Heuristic to determine if a model is "free" or "included" based on provider metadata
     */
    const isFreeModel = (m: any) => {
      if (typeof m === "string") {
        return false;
      }

      // HuggingFace Router format
      if (Array.isArray(m.providers)) {
        return m.providers.some(
          (p) =>
            p.provider === "hf-inference" ||
            !p.pricing ||
            (parseFloat(String(p.pricing.input || p.pricing.prompt || 0)) ===
              0 &&
              parseFloat(
                String(p.pricing.output || p.pricing.completion || 0),
              ) === 0),
        );
      }

      // OpenRouter format
      if (m.pricing) {
        return (
          parseFloat(String(m.pricing.prompt || 0)) === 0 &&
          parseFloat(String(m.pricing.completion || 0)) === 0
        );
      }

      return false;
    };

    /**
     * Helper to check if a model supports tool calling
     */
    const supportsTools = (m: any): boolean => {
      if (typeof m === "string") {
        return false;
      }

      // Explicit property from our proxy or other custom formats
      if (m.supports_tools === true || m.supportsTools === true) {
        return true;
      }

      // HuggingFace format
      if (Array.isArray(m.providers)) {
        return m.providers.some((p) => p.supports_tools === true);
      }

      // OpenRouter format
      if (Array.isArray(m.supported_parameters)) {
        return m.supported_parameters.includes("tools");
      }

      return false;
    };

    const getToolsBadge = (m: any): string => {
      if (typeof m === "string") {
        return " ❔🛠️";
      }

      if (m.supports_tools === true || m.supportsTools === true) {
        return " 🛠️";
      }

      if (m.supports_tools === false || m.supportsTools === false) {
        return " 🚫🛠️";
      }

      if (Array.isArray(m.providers)) {
        const anySupportsTools = m.providers.some(
          (p) => p.supports_tools === true,
        );
        const anyExplicitNoTools = m.providers.some(
          (p) => p.supports_tools === false,
        );
        if (anySupportsTools) {
          return " 🛠️";
        }

        if (anyExplicitNoTools) {
          return " 🚫🛠️";
        }
      }

      if (Array.isArray(m.supported_parameters)) {
        return m.supported_parameters.includes("tools") ? " 🛠️" : " 🚫🛠️";
      }

      return " ❔🛠️";
    };

    /**
     * Helper to get context length
     */
    const getContextLength = (m: any) => {
      if (typeof m === "string") {
        return 0;
      }

      if (typeof m.context_length === "number") {
        return m.context_length;
      }

      if (typeof m.context_window === "number") {
        return m.context_window;
      }

      if (Array.isArray(m.providers)) {
        return Math.max(...m.providers.map((p) => p.context_length || 0), 0);
      }

      return 0;
    };

    /**
     * Helper to render options and ensure current model is selected or custom is shown
     */
    const renderOptions = (modelItems: any[]) => {
      if (!modelSelect || !customModelInput) {
        return;
      }

      if (!Array.isArray(modelItems) || modelItems.length === 0) {
        console.warn("No models to render", modelItems);
        modelSelect.innerHTML = `<option value="__custom__">-- Custom Model ID --</option>`;
        modelSelect.value = "__custom__";
        customModelInput.value = this.orchestrator?.getModel() || "";
        customModelInput.style.display = "block";

        return;
      }

      const freeModels: any[] = [];
      const paidModels: any[] = [];

      for (const item of modelItems) {
        if (!item || (typeof item !== "string" && !item.id)) {
          continue;
        }

        if (isFreeModel(item)) {
          freeModels.push(item);
        } else {
          paidModels.push(item);
        }
      }

      const modelComparator = (a, b) => {
        // 1. Tools support
        const toolsA = supportsTools(a);
        const toolsB = supportsTools(b);
        if (toolsA !== toolsB) {
          return toolsB ? 1 : -1;
        }

        // 2. Context length
        const ctxA = getContextLength(a);
        const ctxB = getContextLength(b);
        if (ctxA !== ctxB) {
          return ctxB - ctxA;
        }

        // 3. ID
        const idA = typeof a === "string" ? a : a.id;
        const idB = typeof b === "string" ? b : b.id;

        return idA.localeCompare(idB);
      };

      freeModels.sort(modelComparator);
      paidModels.sort(modelComparator);

      const toOption = (m) => {
        const id = typeof m === "string" ? m : m.id;
        const toolsBadge = getToolsBadge(m);
        const ctx = getContextLength(m);
        let ctxStr = "";
        if (ctx >= 1000000) {
          ctxStr = ` (${(ctx / 1000000).toFixed(1)}M)`;
        } else if (ctx >= 1000) {
          ctxStr = ` (${Math.round(ctx / 1024)}k)`;
        } else if (ctx > 0) {
          ctxStr = ` (${ctx})`;
        }

        return `<option value="${id}">${id}${ctxStr}${toolsBadge}</option>`;
      };

      let html = "";
      if (currentProvider === "llamafile") {
        const localModels = [...freeModels, ...paidModels].sort(
          modelComparator,
        );
        if (localModels.length > 0) {
          html += `<optgroup label="Local">`;
          html += localModels.map(toOption).join("");
          html += `</optgroup>`;
        }
      } else {
        if (freeModels.length > 0) {
          html += `<optgroup label="Free / Included">`;
          html += freeModels.map(toOption).join("");
          html += `</optgroup>`;
        }

        if (paidModels.length > 0) {
          html += `<optgroup label="Paid / Pro">`;
          html += paidModels.map(toOption).join("");
          html += `</optgroup>`;
        }
      }

      html += `<option value="__custom__">-- Custom Model ID --</option>`;
      modelSelect.innerHTML = html;

      // Check if current model exists in the list
      const allModelIds = modelItems.map((m) =>
        typeof m === "string" ? m : m.id,
      );

      if (allModelIds.includes(currentModel)) {
        modelSelect.value = currentModel;
        customModelInput.style.display = "none";
      } else {
        // Fallback to custom input
        modelSelect.value = "__custom__";
        customModelInput.value = currentModel || "";
        customModelInput.style.display = "block";
      }
    };

    // If the provider has a pre-selected list, prioritize it
    if (skipModelFetch) {
      // Server mode: no model list fetch; runtime server decides model.
    }

    // If the provider has a pre-selected list, prioritize it
    else if (currentProviderData?.models && modelSelect) {
      modelSelect.disabled = false;
      renderOptions(currentProviderData.models);
    }

    // Otherwise, if the provider exposes a modelsUrl, fetch models dynamically
    else if (currentProviderData?.modelsUrl && modelSelect) {
      modelSelect.innerHTML = "<option>Loading models\u2026</option>";
      modelSelect.disabled = true;

      const headers = { ...currentProviderData.headers };
      if (currentProvider === "llamafile") {
        const llamafileSettings = this.orchestrator.getLlamafileSettings?.();
        if (llamafileSettings) {
          headers["x-llamafile-mode"] = llamafileSettings.mode;
          headers["x-llamafile-host"] = llamafileSettings.host;
          headers["x-llamafile-port"] = String(llamafileSettings.port);
          headers["x-llamafile-offline"] = llamafileSettings.offline
            ? "true"
            : "false";
        }
      } else if (currentProvider === "bedrock_proxy") {
        const bedrockSettings = this.orchestrator.getBedrockSettings?.();
        if (bedrockSettings?.region) {
          headers["x-bedrock-region"] = bedrockSettings.region;
        }

        if (bedrockSettings?.profile) {
          headers["x-bedrock-profile"] = bedrockSettings.profile;
        }
      }

      if (this.orchestrator.apiKey && currentProviderData.apiKeyHeader) {
        const format = currentProviderData.apiKeyHeaderFormat || "{key}";
        const authValue = format.replace("{key}", this.orchestrator.apiKey);
        headers[currentProviderData.apiKeyHeader] = authValue;
      }

      fetch(currentProviderData.modelsUrl, { headers })
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
          }

          return r.json();
        })
        .then((data) => {
          // Robustly handle different API response structures
          let items: any[] = [];
          if (Array.isArray(data)) {
            items = data;
          } else if (data && typeof data === "object") {
            // Standard wrappers
            items = data.models || data.data || [];

            // If still empty, scan for any non-empty array in the response (some proxies/routers flatten differently)
            if (items.length === 0) {
              for (const key in data) {
                if (Array.isArray(data[key]) && data[key].length > 0) {
                  items = data[key];

                  break;
                }
              }
            }

            // If still empty but the object itself looks like a model
            if (items.length === 0 && data.id) {
              items = [data];
            }
          }

          modelSelect.disabled = false;
          renderOptions(items);
        })
        .catch((err) => {
          console.error(
            "[ShadowClaw] Failed to load models from",
            currentProviderData.modelsUrl,
            err,
          );
          modelSelect.innerHTML = "<option>Failed to load models</option>";
          showError(
            "Could not reach the model server \u2014 or proxy configuration is wrong",
            5000,
          );
        });
    } else if (modelSelect) {
      modelSelect.disabled = false;
      renderOptions([]);
    }

    // Update helper text for API key
    const helperText = root.querySelector('[data-setting="api-key-helper"]');
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;

    if (helperText && providerSelect) {
      const providerName =
        providerSelect.selectedOptions[0]?.text || "Provider";
      const requiresApiKey = currentProviderData?.requiresApiKey !== false;
      helperText.textContent =
        currentProvider === "copilot_azure_openai_proxy"
          ? "Enter your Azure/GitHub Models API key. It is encrypted and stored locally, then forwarded only through your local proxy."
          : currentProvider === "llamafile"
            ? "Runs local .llamafile binaries through the local proxy. No API key required."
            : !requiresApiKey
              ? "This provider does not require an API key."
              : `Enter your ${providerName} API key. It is encrypted and stored locally.`;
    }

    const keyInput = root.querySelector(
      '[data-setting="api-key-input"]',
    ) as HTMLInputElement | null;
    if (keyInput) {
      const noKeyProvider = currentProviderData?.requiresApiKey === false;
      keyInput.disabled = noKeyProvider;
      keyInput.placeholder = noKeyProvider ? "No API key required" : "sk-...";
    }
  }

  updateLlamafileSettingsVisibility(providerId: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const section = root.querySelector(
      '[data-setting="llamafile-settings"]',
    ) as HTMLElement | null;
    if (!section) {
      return;
    }

    section.style.display = providerId === "llamafile" ? "block" : "none";
  }

  updateBedrockSettingsVisibility(providerId: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const section = root.querySelector(
      '[data-setting="bedrock-settings"]',
    ) as HTMLElement | null;
    if (!section) {
      return;
    }

    section.style.display = providerId === "bedrock_proxy" ? "block" : "none";
  }

  renderBedrockSettings() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const settings = this.orchestrator.getBedrockSettings?.();

    const regionInput = root.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement | null;
    const profileInput = root.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement | null;

    if (regionInput) {
      regionInput.value = settings?.region || "";
    }

    if (profileInput) {
      profileInput.value = settings?.profile || "";
    }
  }

  updateLlamafileModeVisibility() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const serverOnly = root.querySelector(
      '[data-setting="llamafile-server-only"]',
    ) as HTMLElement | null;
    const cliOnly = root.querySelector(
      '[data-setting="llamafile-cli-only"]',
    ) as HTMLElement | null;

    if (!serverOnly && !cliOnly) {
      return;
    }

    const provider = this.orchestrator.getProvider();
    const settings = this.orchestrator.getLlamafileSettings?.();
    const mode = settings?.mode || "cli";
    const isServerMode = provider === "llamafile" && mode === "server";

    if (serverOnly) {
      serverOnly.style.display = isServerMode ? "block" : "none";
    }

    if (cliOnly) {
      cliOnly.style.display = isServerMode ? "none" : "block";
    }
  }

  updateLlamafileModelSectionVisibility() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modelSection = root.querySelector(
      '[data-setting="model-settings"]',
    ) as HTMLElement | null;
    if (!modelSection) {
      return;
    }

    const provider = this.orchestrator.getProvider();
    if (provider !== "llamafile") {
      modelSection.style.display = "block";

      return;
    }

    const llamafileSettings = this.orchestrator.getLlamafileSettings?.();
    modelSection.style.display =
      llamafileSettings?.mode === "server" ? "none" : "block";
  }

  renderLlamafileSettings() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const settings = this.orchestrator.getLlamafileSettings?.();
    if (!settings) {
      return;
    }

    const modeInput = root.querySelector(
      '[data-setting="llamafile-mode"]',
    ) as HTMLSelectElement | null;
    const hostInput = root.querySelector(
      '[data-setting="llamafile-host"]',
    ) as HTMLInputElement | null;
    const portInput = root.querySelector(
      '[data-setting="llamafile-port"]',
    ) as HTMLInputElement | null;
    const offlineInput = root.querySelector(
      '[data-setting="llamafile-offline"]',
    ) as HTMLInputElement | null;

    if (modeInput) {
      modeInput.value = settings.mode;
    }

    if (hostInput) {
      hostInput.value = settings.host;
    }

    if (portInput) {
      portInput.value = String(settings.port);
    }

    if (offlineInput) {
      offlineInput.checked = settings.offline;
    }
  }

  /**
   * Handle provider selection change.
   */
  async onProviderChange() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;
    if (!providerSelect) {
      return;
    }

    const providerId = providerSelect.value;
    const currentProvider = this.orchestrator.getProvider();

    if (providerId !== currentProvider) {
      try {
        await this.orchestrator.setProvider(this.db, providerId);
        this.updateModelSelector();
        this.updateMaxTokensUI();
        this.updateLlamafileSettingsVisibility(providerId);
        this.renderLlamafileSettings();
        this.updateLlamafileModeVisibility();
        this.updateLlamafileModelSectionVisibility();
        this.updateBedrockSettingsVisibility(providerId);
        this.renderBedrockSettings();

        const selectedText =
          providerSelect.selectedOptions[0]?.text || providerId;
        showSuccess(`Switched to ${selectedText}`, 3000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showError("Error switching provider: " + errorMsg, 6000);
        providerSelect.value = currentProvider;
      }
    }
  }

  /**
   * Save API key and provider.
   */
  async saveApiKey() {
    if (!this.orchestrator || !this.db) {
      showError("Orchestrator not initialized", 5000);

      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const keyInput = root.querySelector(
      '[data-setting="api-key-input"]',
    ) as HTMLInputElement | null;
    const providerSelect = root.querySelector(
      '[data-setting="provider-select"]',
    ) as HTMLSelectElement | null;

    if (!keyInput || !providerSelect) {
      return;
    }

    const key = keyInput.value.trim();
    const providerId = providerSelect.value;
    const selectedProvider = this.orchestrator
      .getAvailableProviders()
      .find((p: LLMProvider) => p.id === providerId);
    const requiresApiKey = selectedProvider?.requiresApiKey !== false;

    if (!requiresApiKey) {
      try {
        await this.orchestrator.setProvider(this.db, providerId);
        keyInput.value = "";
        showSuccess("Provider saved (no API key required)", 3000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showError("Error saving provider: " + errorMsg, 6000);
      }

      return;
    }

    if (!key) {
      showWarning("Please enter an API key", 3000);

      return;
    }

    try {
      await this.orchestrator.setApiKey(this.db, key);
      keyInput.value = "";
      showSuccess("API key and provider saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving API key: " + errorMsg, 6000);
    }
  }

  /**
   * Save model selection.
   */
  async saveModel() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement | null;
    const customModelInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLInputElement | null;

    if (!modelSelect || !customModelInput) {
      return;
    }

    let finalModel = modelSelect.value;
    if (finalModel === "__custom__") {
      finalModel = customModelInput.value.trim();
    }

    try {
      await this.orchestrator.setModel(this.db, finalModel);
      this.updateMaxTokensUI();
      const isLlamafileProvider =
        this.orchestrator.getProvider() === "llamafile";
      if (isLlamafileProvider) {
        const restarted = await orchestratorStore.restartCurrentRequest();
        showSuccess(
          restarted ? "Model saved, request restarted" : "Model saved",
          3000,
        );

        return;
      }

      showSuccess("Model saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving model: " + errorMsg, 6000);
    }
  }

  /**
   * Save assistant name.
   */
  async saveAssistantName() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const nameInput = root.querySelector(
      '[data-setting="assistant-name-input"]',
    ) as HTMLInputElement | null;
    if (!nameInput) {
      return;
    }

    const name = nameInput.value.trim();
    if (!name) {
      showWarning("Please enter a name", 3000);

      return;
    }

    localStorage.setItem("assistantName", name);

    try {
      await this.orchestrator.setAssistantName(this.db, name);
    } catch (e) {
      console.warn("Could not update orchestrator:", e);
    }

    showSuccess("Assistant name saved", 3000);
  }

  /**
   * Handle streaming toggle change.
   */
  async onStreamingToggle(enabled: boolean) {
    if (!this.orchestrator || !this.db) {
      return;
    }

    try {
      await this.orchestrator.setStreamingEnabled(this.db, enabled);
      showSuccess(enabled ? "Streaming enabled" : "Streaming disabled", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving streaming setting: " + errorMsg, 6000);
    }
  }

  /**
   * Handle context compression toggle change.
   */
  async onContextCompressionToggle(enabled: boolean) {
    if (!this.orchestrator || !this.db) {
      return;
    }

    try {
      await this.orchestrator.setContextCompressionEnabled(this.db, enabled);
      showSuccess(
        enabled
          ? "Context compression enabled"
          : "Context compression disabled",
        2500,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving context compression setting: " + errorMsg, 6000);
    }
  }

  /**
   * Handle proxy toggle change.
   */
  async onProxyToggle(enabled: boolean) {
    if (!this.orchestrator || !this.db) {
      return;
    }

    try {
      await this.orchestrator.setUseProxy(this.db, enabled);
      showSuccess(enabled ? "CORS Proxy enabled" : "CORS Proxy disabled", 2500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving proxy setting: " + errorMsg, 6000);
    }
  }

  /**
   * Save custom proxy URL.
   */
  async saveProxyUrl() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const url = input.value.trim();
    if (!url) {
      showWarning("Please enter a proxy URL (e.g. /proxy)", 3000);

      return;
    }

    try {
      await this.orchestrator.setProxyUrl(this.db, url);
      showSuccess("Proxy URL saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving proxy URL: " + errorMsg, 6000);
    }
  }

  async saveMaxIterations() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const value = parseInt(input.value, 10);
    if (!value || value < 1) {
      showWarning("Please enter a valid number (1 or higher)", 3000);

      return;
    }

    try {
      await this.orchestrator.setMaxIterations(this.db, value);
      showSuccess("Max iterations saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving max iterations: " + errorMsg, 6000);
    }
  }

  applyRecommendedMaxTokens() {
    if (!this.orchestrator) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const recommendation = getRecommendedMaxTokens(
      this.orchestrator.getProvider(),
      this.orchestrator.getModel(),
    );

    input.value = String(recommendation.recommended);
  }

  async saveMaxTokens() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="max-tokens-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const value = parseInt(input.value, 10);
    if (!value || value < 1) {
      showWarning("Please enter a valid number (1 or higher)", 3000);

      return;
    }

    try {
      await this.orchestrator.setMaxTokens(this.db, value);
      this.updateMaxTokensUI();
      showSuccess("Max tokens saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving max tokens: " + errorMsg, 6000);
    }
  }

  async saveLlamafileSettings() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const modeInput = root.querySelector(
      '[data-setting="llamafile-mode"]',
    ) as HTMLSelectElement | null;
    const hostInput = root.querySelector(
      '[data-setting="llamafile-host"]',
    ) as HTMLInputElement | null;
    const portInput = root.querySelector(
      '[data-setting="llamafile-port"]',
    ) as HTMLInputElement | null;
    const offlineInput = root.querySelector(
      '[data-setting="llamafile-offline"]',
    ) as HTMLInputElement | null;

    if (!modeInput || !hostInput || !portInput || !offlineInput) {
      return;
    }

    const mode = modeInput.value === "cli" ? "cli" : "server";
    const host = hostInput.value.trim();
    const port = parseInt(portInput.value, 10);

    if (!host) {
      showWarning("Please enter a host", 3000);

      return;
    }

    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      showWarning("Please enter a valid port (1-65535)", 3000);

      return;
    }

    try {
      await this.orchestrator.setLlamafileSettings(this.db, {
        mode,
        host,
        port,
        offline: offlineInput.checked,
      });
      this.updateLlamafileModeVisibility();
      this.updateLlamafileModelSectionVisibility();
      this.updateModelSelector();

      const isLlamafileProvider =
        this.orchestrator.getProvider() === "llamafile";
      if (isLlamafileProvider) {
        const restarted = await orchestratorStore.restartCurrentRequest();
        showSuccess(
          restarted
            ? "Llamafile settings saved, request restarted"
            : "Llamafile settings saved",
          3000,
        );

        return;
      }

      showSuccess("Llamafile settings saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving llamafile settings: " + errorMsg, 6000);
    }
  }

  async saveBedrockSettings() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const regionInput = root.querySelector(
      '[data-setting="bedrock-region-input"]',
    ) as HTMLInputElement | null;
    const profileInput = root.querySelector(
      '[data-setting="bedrock-profile-input"]',
    ) as HTMLInputElement | null;

    if (!regionInput || !profileInput) {
      return;
    }

    const region = regionInput.value.trim();
    const profile = profileInput.value.trim();

    if ((region && !profile) || (!region && profile)) {
      showWarning(
        "Enter both Bedrock region and profile (or leave both blank to rely on environment variables)",
        4000,
      );

      return;
    }

    if (!this.orchestrator.setBedrockSettings) {
      showError("Bedrock settings are not available in this build", 5000);

      return;
    }

    try {
      await this.orchestrator.setBedrockSettings(this.db, { region, profile });
      showSuccess("Bedrock fallback settings saved", 3000);
      if (this.orchestrator.getProvider() === "bedrock_proxy") {
        this.updateModelSelector();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Bedrock fallback settings: " + errorMsg, 6000);
    }
  }
}

customElements.define(elementName, ShadowClawSettingsLlm);
