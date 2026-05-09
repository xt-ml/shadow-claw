import { getDb } from "../../../db/db.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess, showWarning } from "../../../toast.js";
import { effect } from "../../../effect.js";
import { getModelMaxTokens } from "../../../config.js";
import {
  buildLlamafileHelpDialogOptions,
  LLAMAFILE_EXPECTED_DIR,
} from "../../common/help/llamafile.js";
import {
  compareLocalModelCandidates,
  isLikelyInstructionModelId,
} from "./model-ranking.js";

import type { Orchestrator } from "../../../orchestrator.js";
import type {
  AppDialogOptions,
  LLMProvider,
  ShadowClawDatabase,
} from "../../../types.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-llm";

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
export class ShadowClawLlm extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawLlm.componentPath}/${elementName}.css`;
  static template = `${ShadowClawLlm.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null;
  orchestrator: Orchestrator | null;
  llamafileDiscoveredModelIds: string[];
  llamafileModelLoadError: string | null;
  lastLlamafileHelpKey: string;
  modelFetchToken: number;

  constructor() {
    super();

    this.db = null;
    this.orchestrator = null;
    this.llamafileDiscoveredModelIds = [];
    this.llamafileModelLoadError = null;
    this.lastLlamafileHelpKey = "";
    this.modelFetchToken = 0;
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
      .querySelector('[data-action="refresh-models"]')
      ?.addEventListener("click", () => this.updateModelSelector());

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
      .querySelector('[data-setting="context-compression-toggle"]')
      ?.addEventListener("change", (e) => {
        if (e.target instanceof HTMLInputElement) {
          this.onContextCompressionToggle(e.target.checked);
        }
      });

    root
      .querySelector('[data-action="save-max-iterations"]')
      ?.addEventListener("click", () => this.saveMaxIterations());

    root
      .querySelector('[data-action="save-rate-limit-settings"]')
      ?.addEventListener("click", () => this.saveRateLimitSettings());

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
      .querySelector('[data-action="save-transformers-js-settings"]')
      ?.addEventListener("click", () => this.saveTransformersJsSettings());

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
    this.updateModelProviderHelperText();
    this.updateBedrockSettingsVisibility(currentProvider);
    this.renderBedrockSettings();
    this.updateTransformersJsSettingsVisibility(currentProvider);
    this.renderTransformersJsSettings();

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

    // Load context compression toggle
    const ccToggle = root.querySelector(
      '[data-setting="context-compression-toggle"]',
    ) as HTMLInputElement | null;
    if (ccToggle) {
      ccToggle.checked = this.orchestrator.getContextCompressionEnabled();
    }

    // Load max iterations
    const maxIterInput = root.querySelector(
      '[data-setting="max-iterations-input"]',
    ) as HTMLInputElement | null;
    if (maxIterInput && this.orchestrator) {
      maxIterInput.value = String(this.orchestrator.getMaxIterations());
    }

    const rateLimitInput = root.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement | null;
    if (rateLimitInput && this.orchestrator) {
      rateLimitInput.value = String(
        this.orchestrator.getRateLimitCallsPerMinute?.() || 0,
      );
    }

    const rateLimitAutoToggle = root.querySelector(
      '[data-setting="rate-limit-auto-adapt-toggle"]',
    ) as HTMLInputElement | null;
    if (rateLimitAutoToggle && this.orchestrator) {
      rateLimitAutoToggle.checked =
        this.orchestrator.getRateLimitAutoAdapt?.() !== false;
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
    const selectionToken = ++this.modelFetchToken;

    if (currentProvider !== "llamafile") {
      this.llamafileDiscoveredModelIds = [];
      this.llamafileModelLoadError = null;
    }

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

    this.updateModelProviderHelperText();

    const modelSelect = root.querySelector(
      '[data-setting="model-select"]',
    ) as HTMLSelectElement | null;
    const customModelInput = root.querySelector(
      '[data-setting="custom-model-input"]',
    ) as HTMLInputElement | null;
    const currentModel = this.orchestrator.getModel();
    const localOnlyProviderIds = new Set([
      "transformers_js_local",
      "transformers_js_browser",
      "ollama",
      "llamafile",
      "prompt_api",
    ]);

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    /**
     * Heuristic to determine if a model is "free" or "included" based on provider metadata
     */
    const isFreeModel = (m: any) => {
      if (localOnlyProviderIds.has(currentProvider)) {
        return true;
      }

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
      const id = typeof m === "string" ? m : m.id || m.name;
      if (localOnlyProviderIds.has(currentProvider)) {
        return isLikelyInstructionModelId(id);
      }

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
      const id = typeof m === "string" ? m : m.id || m.name;
      if (localOnlyProviderIds.has(currentProvider)) {
        return isLikelyInstructionModelId(id) ? " 🛠️" : " ❔🛠️";
      }

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
        const currentValue = this.orchestrator?.getModel() || "";
        const emptyMessage =
          currentProvider === "llamafile"
            ? `No *.llamafile models found in ${LLAMAFILE_EXPECTED_DIR}`
            : "No models available";

        modelSelect.innerHTML = [
          `<option value="" ${currentValue ? "" : "selected"}>${escapeHtml(emptyMessage)}</option>`,
          `<option value="__custom__">-- Custom Model ID --</option>`,
        ].join("");

        if (currentValue) {
          modelSelect.value = "__custom__";
          customModelInput.value = currentValue;
          customModelInput.style.display = "block";
        } else {
          modelSelect.value = "";
          customModelInput.value = "";
          customModelInput.style.display = "none";
        }

        if (currentProvider === "llamafile" && !currentValue) {
          void this.showLlamafileHelpDialog(
            this.llamafileModelLoadError
              ? `Failed to load *.llamafile models: ${this.llamafileModelLoadError}`
              : `No *.llamafile files were found in ${LLAMAFILE_EXPECTED_DIR}.`,
          );
        }

        this.updateModelProviderHelperText();

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
        if (localOnlyProviderIds.has(currentProvider)) {
          const idA = typeof a === "string" ? a : a.id || a.name;
          const idB = typeof b === "string" ? b : b.id || b.name;

          return compareLocalModelCandidates(
            {
              id: idA,
              supportsTools: supportsTools(a),
              contextLength: getContextLength(a),
            },
            {
              id: idB,
              supportsTools: supportsTools(b),
              contextLength: getContextLength(b),
            },
            currentProvider,
          );
        }

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
        const idA = typeof a === "string" ? a : a.id || a.name;
        const idB = typeof b === "string" ? b : b.id || b.name;

        return idA.localeCompare(idB);
      };

      freeModels.sort(modelComparator);
      paidModels.sort(modelComparator);

      const toOption = (m) => {
        const id = typeof m === "string" ? m : m.id || m.name;
        const displayName =
          typeof m === "string"
            ? id
            : typeof m.displayName === "string" && m.displayName.trim()
              ? m.displayName.trim()
              : typeof m.name === "string" && m.name.trim()
                ? m.name.trim()
                : id;
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

        const label = displayName === id ? id : `${displayName} - ${id}`;

        return `<option value="${escapeHtml(id)}">${escapeHtml(label)}${ctxStr}${toolsBadge}</option>`;
      };

      let html = "";
      if (localOnlyProviderIds.has(currentProvider)) {
        const localModels = [...freeModels, ...paidModels].sort(
          modelComparator,
        );
        if (localModels.length > 0) {
          const localLabel =
            currentProvider === "prompt_api"
              ? "Built-in"
              : "Local / Self-hosted";
          html += `<optgroup label="${localLabel}">`;
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
        typeof m === "string" ? m : m.id || m.name,
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

      this.updateModelProviderHelperText();
    };

    // If the provider has a pre-selected list, prioritize it
    if (skipModelFetch) {
      // Server mode: no model list fetch; runtime server decides model.
    } else if (currentProviderData?.modelsUrl && modelSelect) {
      // Fetch models dynamically and merge with static models
      const fetchToken = selectionToken;
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

        if (bedrockSettings?.authMode) {
          headers["x-bedrock-auth-mode"] = bedrockSettings.authMode;
        }
      }

      this.orchestrator.getApiKeyForHeaders().then((apiKey) => {
        if (apiKey && currentProviderData.apiKeyHeader) {
          const format = currentProviderData.apiKeyHeaderFormat || "{key}";
          const authValue = format.replace("{key}", apiKey);
          headers[currentProviderData.apiKeyHeader] = authValue;
        }

        if (!currentProviderData.modelsUrl) {
          return;
        }

        fetch(currentProviderData.modelsUrl, { headers })
          .then((r) => {
            if (!r.ok) {
              throw new Error(`HTTP ${r.status}`);
            }

            return r.json();
          })
          .then((data) => {
            if (fetchToken !== this.modelFetchToken) {
              return;
            }

            if (this.orchestrator?.getProvider?.() !== currentProvider) {
              return;
            }

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

            // Merge static models if any
            if (Array.isArray(currentProviderData.models)) {
              const dynamicIds = new Set(
                items.map((i) => (typeof i === "string" ? i : i.id || i.name)),
              );
              const statics = currentProviderData.models.filter((m: any) => {
                const mId = typeof m === "string" ? m : m.id || m.name;

                return !dynamicIds.has(mId);
              });
              items = [...statics, ...items];
            }

            if (currentProvider === "llamafile") {
              this.llamafileModelLoadError = null;
              this.llamafileDiscoveredModelIds = items
                .map((item) =>
                  typeof item === "string"
                    ? item
                    : String(item?.id || item?.name || ""),
                )
                .filter(Boolean);
            }

            modelSelect.disabled = false;
            renderOptions(items);
          })
          .catch((err) => {
            if (fetchToken !== this.modelFetchToken) {
              return;
            }

            if (this.orchestrator?.getProvider?.() !== currentProvider) {
              return;
            }

            console.error(
              "[ShadowClaw] Failed to load models from",
              currentProviderData.modelsUrl,
              err,
            );
            const message = err instanceof Error ? err.message : String(err);

            if (currentProvider === "llamafile") {
              this.llamafileDiscoveredModelIds = [];
              this.llamafileModelLoadError = message;
              modelSelect.disabled = false;
              renderOptions([]);

              return;
            }

            modelSelect.innerHTML = "<option>Failed to load models</option>";

            if (currentProviderData?.models) {
              console.warn(
                "Falling back to statically configured models due to fetch failure.",
              );
              modelSelect.disabled = false;
              renderOptions(currentProviderData.models);
            } else {
              showError(
                "Could not reach the model server \u2014 or proxy configuration is wrong",
                5000,
              );
            }
          });
      });
    } else if (currentProviderData?.models && modelSelect) {
      modelSelect.disabled = false;
      renderOptions(currentProviderData.models);
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

  updateModelProviderHelperText() {
    const root = this.shadowRoot;
    if (!root || !this.orchestrator) {
      return;
    }

    const helper = root.querySelector(
      '[data-setting="model-provider-helper"]',
    ) as HTMLElement | null;
    if (!helper) {
      return;
    }

    const provider = this.orchestrator.getProvider();
    const llamafileSettings = this.orchestrator.getLlamafileSettings?.();
    if (provider !== "llamafile" || llamafileSettings?.mode === "server") {
      helper.hidden = true;
      helper.textContent = "";

      return;
    }

    helper.hidden = false;
    if (this.llamafileDiscoveredModelIds.length > 0) {
      helper.textContent = `Discovered ${this.llamafileDiscoveredModelIds.length} *.llamafile model${this.llamafileDiscoveredModelIds.length === 1 ? "" : "s"} in ${LLAMAFILE_EXPECTED_DIR}. Choose Custom Model ID to target a file name that is not listed yet.`;

      return;
    }

    if (this.llamafileModelLoadError) {
      helper.textContent = `Could not load llamafile models from ${LLAMAFILE_EXPECTED_DIR}. You can still enter a custom model id, but the file must exist there.`;

      return;
    }

    helper.textContent = `ShadowClaw looks for *.llamafile binaries in ${LLAMAFILE_EXPECTED_DIR}.`;
  }

  async requestAppDialog(options: AppDialogOptions): Promise<boolean> {
    const el = document.querySelector("shadow-claw") as any;
    if (el && typeof el.requestDialog === "function") {
      return await el.requestDialog(options);
    }

    return false;
  }

  async showLlamafileHelpDialog(reason?: string): Promise<void> {
    const key = `${reason || ""}|${this.orchestrator?.getModel() || ""}`;
    if (this.lastLlamafileHelpKey === key) {
      return;
    }

    this.lastLlamafileHelpKey = key;
    await this.requestAppDialog(buildLlamafileHelpDialogOptions(reason));
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
    const authModeSelect = root.querySelector(
      '[data-setting="bedrock-auth-mode"]',
    ) as HTMLSelectElement | null;

    if (regionInput) {
      regionInput.value = settings?.region || "";
    }

    if (profileInput) {
      profileInput.value = settings?.profile || "";
    }

    if (authModeSelect) {
      authModeSelect.value = settings?.authMode || "provider_chain";
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
        this.updateTransformersJsSettingsVisibility(providerId);
        this.renderTransformersJsSettings();

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

    const isLlamafileCli =
      this.orchestrator.getProvider() === "llamafile" &&
      this.orchestrator.getLlamafileSettings?.().mode === "cli";

    if (isLlamafileCli && !finalModel) {
      await this.showLlamafileHelpDialog(
        `Select a discovered *.llamafile model or enter a custom model id that matches a file in the ${LLAMAFILE_EXPECTED_DIR} folder.`,
      );

      return;
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

  async saveRateLimitSettings() {
    if (!this.orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const callsInput = root.querySelector(
      '[data-setting="rate-limit-calls-per-minute-input"]',
    ) as HTMLInputElement | null;
    const autoToggle = root.querySelector(
      '[data-setting="rate-limit-auto-adapt-toggle"]',
    ) as HTMLInputElement | null;

    if (!callsInput || !autoToggle) {
      return;
    }

    const callsPerMinute = parseInt(callsInput.value, 10);
    if (!Number.isFinite(callsPerMinute) || callsPerMinute < 0) {
      showWarning(
        "Please enter a valid non-negative calls-per-minute value",
        3000,
      );

      return;
    }

    try {
      await this.orchestrator.setRateLimitCallsPerMinute(
        this.db,
        callsPerMinute,
      );
      await this.orchestrator.setRateLimitAutoAdapt(
        this.db,
        autoToggle.checked,
      );
      showSuccess("Rate limit settings saved", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving rate limit settings: " + errorMsg, 6000);
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
    const authModeSelect = root.querySelector(
      '[data-setting="bedrock-auth-mode"]',
    ) as HTMLSelectElement | null;

    if (!regionInput || !profileInput) {
      return;
    }

    const region = regionInput.value.trim();
    const profile = profileInput.value.trim();
    const authMode = authModeSelect?.value || "provider_chain";

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
      await this.orchestrator.setBedrockSettings(this.db, {
        region,
        profile,
        authMode,
      });
      showSuccess("Bedrock fallback settings saved", 3000);
      if (this.orchestrator.getProvider() === "bedrock_proxy") {
        this.updateModelSelector();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Bedrock fallback settings: " + errorMsg, 6000);
    }
  }

  updateTransformersJsSettingsVisibility(provider: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const section = root.querySelector(
      '[data-setting="transformers-js-settings"]',
    ) as HTMLElement | null;
    if (section) {
      section.style.display =
        provider === "transformers_js_browser" ? "block" : "none";
    }
  }

  async renderTransformersJsSettings() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const { getConfig } = await import("../../../db/getConfig.js");
    const { CONFIG_KEYS } = await import("../../../config.js");

    const backend =
      (await getConfig(this.db, CONFIG_KEYS.TRANSFORMERS_JS_BACKEND)) || "cpu";
    const dtypeStrategy =
      (await getConfig(this.db, CONFIG_KEYS.TRANSFORMERS_JS_DTYPE_STRATEGY)) ||
      "auto";

    const backendSelect = root.querySelector(
      '[data-setting="transformers-js-backend"]',
    ) as HTMLSelectElement | null;
    if (backendSelect) {
      backendSelect.value = backend;
    }

    const dtypeStrategySelect = root.querySelector(
      '[data-setting="transformers-js-dtype-strategy"]',
    ) as HTMLSelectElement | null;
    if (dtypeStrategySelect) {
      dtypeStrategySelect.value = dtypeStrategy;
    }
  }

  async saveTransformersJsSettings() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const backendSelect = root.querySelector(
      '[data-setting="transformers-js-backend"]',
    ) as HTMLSelectElement | null;
    const backend = backendSelect?.value || "cpu";
    const dtypeStrategySelect = root.querySelector(
      '[data-setting="transformers-js-dtype-strategy"]',
    ) as HTMLSelectElement | null;
    const dtypeStrategy = dtypeStrategySelect?.value || "auto";

    const { setConfig } = await import("../../../db/setConfig.js");
    const { CONFIG_KEYS } = await import("../../../config.js");

    await setConfig(this.db, CONFIG_KEYS.TRANSFORMERS_JS_BACKEND, backend);
    await setConfig(
      this.db,
      CONFIG_KEYS.TRANSFORMERS_JS_DTYPE_STRATEGY,
      dtypeStrategy,
    );

    showSuccess("Transformers.js settings saved.");
  }
}

customElements.define(elementName, ShadowClawLlm);
