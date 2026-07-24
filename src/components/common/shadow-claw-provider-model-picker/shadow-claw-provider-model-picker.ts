import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawProviderModelPickerStyles from "./shadow-claw-provider-model-picker.css" with { type: "css" };
import shadowClawProviderModelPickerTemplate from "./shadow-claw-provider-model-picker.html" with { type: "html" };
import { isLikelyInstructionModelId } from "../../settings/shadow-claw-llm/model-ranking.js";

import type { LLMProvider } from "../../../subsystems/providers/types.js";

const elementName = "shadow-claw-provider-model-picker";

export interface ProviderModelPickerLabels {
  providerLabel: string;
  defaultProviderLabel: string;
  modelLabel: string;
  defaultModelLabel: string;
  customModelPlaceholder: string;
}

export interface ProviderModelPickerValue {
  modelId: string | null;
  providerId: string | null;
}

export type ProviderModelItem =
  | string
  | {
      context_length?: number;
      context_window?: number;
      displayName?: string;
      id?: string;
      name?: string;
      pricing?: {
        completion?: number | string;
        input?: number | string;
        output?: number | string;
        prompt?: number | string;
      };
      providers?: Array<{
        context_length?: number;
        pricing?: {
          completion?: number | string;
          input?: number | string;
          output?: number | string;
          prompt?: number | string;
        };
        provider?: string;
        supports_tools?: boolean;
      }>;
      supported_parameters?: string[];
      supportsTools?: boolean;
      supports_tools?: boolean;
    };

export type ProviderModelLoader = (
  provider: LLMProvider,
) => Promise<ProviderModelItem[]>;

const DEFAULT_LABELS: ProviderModelPickerLabels = {
  providerLabel: "Pinned Provider",
  defaultProviderLabel: "Default",
  modelLabel: "Pinned Model",
  defaultModelLabel: "Default Model",
  customModelPlaceholder: "Custom model id",
};

export class ShadowClawProviderModelPicker extends ShadowClawElement {
  static styles = shadowClawProviderModelPickerStyles;
  static template = shadowClawProviderModelPickerTemplate;

  private customModelSelected = false;
  private labels: ProviderModelPickerLabels = { ...DEFAULT_LABELS };
  private loadedProviderIds = new Set<string>();
  private loadingProviderId: string | null = null;
  private modelLoadEpoch = 0;
  private modelLoader: ProviderModelLoader | null = null;
  private providerModels = new Map<string, ProviderModelItem[]>();
  private providers: LLMProvider[] = [];
  private value: ProviderModelPickerValue = {
    providerId: null,
    modelId: null,
  };

  async connectedCallback() {
    this.bindEvents();
    await this.render();
  }

  getValue(): ProviderModelPickerValue {
    return {
      providerId: this.value.providerId,
      modelId: this.value.modelId,
    };
  }

  invalidateProviderModels(providerId?: string | null): void {
    if (providerId) {
      this.providerModels.delete(providerId);
      this.loadedProviderIds.delete(providerId);
      if (this.loadingProviderId === providerId) {
        this.loadingProviderId = null;
        this.modelLoadEpoch += 1;
      }
    } else {
      this.providerModels.clear();
      this.loadedProviderIds.clear();
      this.loadingProviderId = null;
      this.modelLoadEpoch += 1;
    }

    this.render();
  }

  setLabels(labels: Partial<ProviderModelPickerLabels>): void {
    this.labels = {
      ...this.labels,
      ...labels,
    };
    this.render();
  }

  setModelLoader(loader: ProviderModelLoader | null): void {
    this.modelLoader = loader;
    this.providerModels.clear();
    this.loadedProviderIds.clear();
    this.loadingProviderId = null;
    this.modelLoadEpoch += 1;
    this.render();
  }

  setProviders(providers: LLMProvider[]): void {
    this.providers = Array.isArray(providers) ? [...providers] : [];
    const validIds = new Set(this.providers.map((provider) => provider.id));
    for (const providerId of this.providerModels.keys()) {
      if (!validIds.has(providerId)) {
        this.providerModels.delete(providerId);
        this.loadedProviderIds.delete(providerId);
      }
    }

    this.render();
  }

  setValue(value: ProviderModelPickerValue): void {
    this.value = {
      providerId: value.providerId || null,
      modelId: value.modelId || null,
    };
    this.customModelSelected = !!value.modelId;
    this.render();
  }

  async render(): Promise<void> {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providerLabel = root.querySelector(
      '[data-role="provider-label"]',
    ) as HTMLLabelElement | null;
    const providerSelect = root.querySelector(
      '[data-role="provider-select"]',
    ) as HTMLSelectElement | null;
    const modelContainer = root.querySelector(
      '[data-role="model-container"]',
    ) as HTMLElement | null;
    const modelLabel = root.querySelector(
      '[data-role="model-label"]',
    ) as HTMLLabelElement | null;
    const modelSelect = root.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;
    const customModelInput = root.querySelector(
      '[data-role="custom-model-input"]',
    ) as HTMLInputElement | null;

    if (
      !providerLabel ||
      !providerSelect ||
      !modelContainer ||
      !modelLabel ||
      !modelSelect ||
      !customModelInput
    ) {
      return;
    }

    providerLabel.textContent = this.labels.providerLabel;
    modelLabel.textContent = this.labels.modelLabel;
    customModelInput.placeholder = this.labels.customModelPlaceholder;

    providerSelect.replaceChildren();
    const defaultProviderOption = document.createElement("option");
    defaultProviderOption.value = "";
    defaultProviderOption.textContent = this.labels.defaultProviderLabel;
    providerSelect.appendChild(defaultProviderOption);

    for (const provider of this.providers) {
      const option = document.createElement("option");
      option.value = provider.id;
      option.textContent = provider.name;
      providerSelect.appendChild(option);
    }

    providerSelect.value = this.value.providerId || "";

    modelSelect.replaceChildren();
    const defaultModelOption = document.createElement("option");
    defaultModelOption.value = "";
    defaultModelOption.textContent = this.labels.defaultModelLabel;
    modelSelect.appendChild(defaultModelOption);

    const selectedProvider = this.value.providerId
      ? this.providers.find((p) => p.id === this.value.providerId)
      : undefined;

    const providerModels = this.getProviderModels(selectedProvider);
    const providerModelIds = providerModels
      .map((model) => this.getModelId(model))
      .filter((modelId): modelId is string => !!modelId);

    if (selectedProvider?.modelsUrl) {
      void this.ensureProviderModelsLoaded(selectedProvider);
    }

    if (
      selectedProvider?.modelsUrl &&
      this.loadingProviderId === selectedProvider.id &&
      providerModels.length === 0
    ) {
      const loadingOption = document.createElement("option");
      loadingOption.value = "";
      loadingOption.textContent = "Loading models...";
      modelSelect.appendChild(loadingOption);
    }

    for (const modelId of providerModels) {
      const option = document.createElement("option");
      const normalizedModelId = this.getModelId(modelId);
      if (!normalizedModelId) {
        continue;
      }

      option.value = normalizedModelId;
      option.textContent = this.getModelLabel(
        modelId,
        selectedProvider?.id || "",
      );
      modelSelect.appendChild(option);
    }

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "Custom Model...";
    modelSelect.appendChild(customOption);

    if (!this.value.providerId) {
      modelContainer.style.display = "none";
      customModelInput.style.display = "none";
      customModelInput.value = "";
      modelSelect.value = "";

      return;
    }

    modelContainer.style.display = "flex";

    if (!this.value.modelId && !this.customModelSelected) {
      modelSelect.value = "";
      customModelInput.style.display = "none";
      customModelInput.value = "";

      return;
    }

    if (
      this.value.modelId &&
      providerModelIds.includes(this.value.modelId) &&
      !this.customModelSelected
    ) {
      modelSelect.value = this.value.modelId;
      customModelInput.style.display = "none";
      customModelInput.value = "";

      return;
    }

    modelSelect.value = "__custom__";
    customModelInput.style.display = "block";
    customModelInput.value = this.value.modelId || "";
  }

  private bindEvents(): void {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const providerSelect = root.querySelector(
      '[data-role="provider-select"]',
    ) as HTMLSelectElement | null;
    const modelSelect = root.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;
    const customModelInput = root.querySelector(
      '[data-role="custom-model-input"]',
    ) as HTMLInputElement | null;

    providerSelect?.addEventListener("change", () => {
      this.value = {
        providerId: providerSelect.value || null,
        modelId: null,
      };
      this.customModelSelected = false;
      this.render();
      this.emitChange();
    });

    modelSelect?.addEventListener("change", () => {
      if (modelSelect.value === "__custom__") {
        this.customModelSelected = true;
        this.value.modelId =
          customModelInput?.value.trim() || this.value.modelId || null;
      } else {
        this.customModelSelected = false;
        this.value.modelId = modelSelect.value || null;
      }

      this.render();
      this.emitChange();
    });

    customModelInput?.addEventListener("input", () => {
      if (modelSelect?.value === "__custom__") {
        this.value.modelId = customModelInput.value.trim() || null;
        this.customModelSelected = true;
        this.emitChange();
      }
    });
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent("provider-model-change", {
        detail: {
          providerId: this.value.providerId,
          modelId: this.value.modelId,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getContextLength(model: ProviderModelItem): number {
    if (typeof model === "string") {
      return 0;
    }

    if (typeof model.context_length === "number") {
      return model.context_length;
    }

    if (typeof model.context_window === "number") {
      return model.context_window;
    }

    if (Array.isArray(model.providers)) {
      return Math.max(
        ...model.providers.map((provider) => provider.context_length || 0),
        0,
      );
    }

    return 0;
  }

  private getModelId(model: ProviderModelItem): string | null {
    if (typeof model === "string") {
      return model;
    }

    if (typeof model.id === "string" && model.id.trim()) {
      return model.id.trim();
    }

    if (typeof model.name === "string" && model.name.trim()) {
      return model.name.trim();
    }

    return null;
  }

  private getModelLabel(model: ProviderModelItem, providerId: string): string {
    const modelId = this.getModelId(model) || "";
    const displayName =
      typeof model === "string"
        ? modelId
        : typeof model.displayName === "string" && model.displayName.trim()
          ? model.displayName.trim()
          : typeof model.name === "string" && model.name.trim()
            ? model.name.trim()
            : modelId;
    const label =
      displayName === modelId ? modelId : `${displayName} - ${modelId}`;
    const contextLength = this.getContextLength(model);
    const contextSuffix =
      contextLength >= 1000000
        ? ` (${(contextLength / 1000000).toFixed(1)}M)`
        : contextLength >= 1000
          ? ` (${Math.round(contextLength / 1024)}k)`
          : contextLength > 0
            ? ` (${contextLength})`
            : "";

    return `${label}${contextSuffix}${this.getToolsBadge(model, providerId)}`;
  }

  private getProviderModels(provider?: LLMProvider): ProviderModelItem[] {
    if (!provider) {
      return [];
    }

    if (Array.isArray(provider.models) && provider.models.length > 0) {
      return provider.models as ProviderModelItem[];
    }

    return this.providerModels.get(provider.id) || [];
  }

  private getToolsBadge(model: ProviderModelItem, providerId: string): string {
    const localOnlyProviderIds = new Set([
      "transformers_js_local",
      "transformers_js_browser",
      "ollama",
      "llamafile",
      "prompt_api",
      "litert_lm",
    ]);

    const modelId = this.getModelId(model) || "";
    if (localOnlyProviderIds.has(providerId)) {
      return isLikelyInstructionModelId(modelId) ? " 🛠️" : " ❔🛠️";
    }

    if (typeof model === "string") {
      return " ❔🛠️";
    }

    if (model.supports_tools === true || model.supportsTools === true) {
      return " 🛠️";
    }

    if (model.supports_tools === false || model.supportsTools === false) {
      return " 🚫🛠️";
    }

    if (Array.isArray(model.providers)) {
      if (
        model.providers.some((provider) => provider.supports_tools === true)
      ) {
        return " 🛠️";
      }

      if (
        model.providers.some((provider) => provider.supports_tools === false)
      ) {
        return " 🚫🛠️";
      }
    }

    if (Array.isArray(model.supported_parameters)) {
      return model.supported_parameters.includes("tools") ? " 🛠️" : " 🚫🛠️";
    }

    return " ❔🛠️";
  }

  private async ensureProviderModelsLoaded(
    provider: LLMProvider,
  ): Promise<void> {
    if (
      !provider.modelsUrl ||
      !this.modelLoader ||
      this.loadedProviderIds.has(provider.id) ||
      this.loadingProviderId === provider.id
    ) {
      return;
    }

    const loadEpoch = ++this.modelLoadEpoch;
    this.loadingProviderId = provider.id;

    try {
      const models = await this.modelLoader(provider);
      if (loadEpoch !== this.modelLoadEpoch) {
        return;
      }

      this.providerModels.set(provider.id, Array.isArray(models) ? models : []);
      this.loadedProviderIds.add(provider.id);
    } catch {
      if (loadEpoch !== this.modelLoadEpoch) {
        return;
      }

      this.providerModels.set(provider.id, []);
      this.loadedProviderIds.add(provider.id);
    } finally {
      if (
        loadEpoch === this.modelLoadEpoch &&
        this.loadingProviderId === provider.id
      ) {
        this.loadingProviderId = null;
      }

      await this.render();
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawProviderModelPicker);
}
