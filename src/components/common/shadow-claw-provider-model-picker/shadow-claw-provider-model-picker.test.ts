import { jest } from "@jest/globals";

import { ShadowClawProviderModelPicker } from "./shadow-claw-provider-model-picker.js";

describe("shadow-claw-provider-model-picker", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-provider-model-picker")).toBe(
      ShadowClawProviderModelPicker,
    );
  });

  it("supports custom model ids when provider has no static model list", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setProviders([{ id: "custom-provider", name: "Custom" }]);
    el.setValue({ providerId: "custom-provider", modelId: "my-model-id" });
    await el.render();

    const root = el.shadowRoot;
    const modelSelect = root?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;
    const customInput = root?.querySelector(
      '[data-role="custom-model-input"]',
    ) as HTMLInputElement | null;

    expect(modelSelect?.value).toBe("__custom__");
    expect(customInput?.value).toBe("my-model-id");

    el.remove();
  });

  it("emits provider-model-change when provider changes", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setProviders([{ id: "openai", name: "OpenAI", models: ["gpt-4o"] }]);
    await el.render();

    const listener = jest.fn();
    el.addEventListener("provider-model-change", listener as EventListener);

    const providerSelect = el.shadowRoot?.querySelector(
      '[data-role="provider-select"]',
    ) as HTMLSelectElement | null;

    if (!providerSelect) {
      throw new Error("provider select missing");
    }

    providerSelect.value = "openai";
    providerSelect.dispatchEvent(new Event("change"));

    expect(listener).toHaveBeenCalled();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      providerId: "openai",
      modelId: null,
    });

    el.remove();
  });

  it("shows the custom model input when Custom Model is selected", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setProviders([
      { id: "openai", name: "OpenAI", models: ["gpt-4o"] } as any,
    ]);
    el.setValue({ providerId: "openai", modelId: null });
    await el.render();

    const root = el.shadowRoot;
    const modelSelect = root?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;
    const customInput = root?.querySelector(
      '[data-role="custom-model-input"]',
    ) as HTMLInputElement | null;

    if (!modelSelect || !customInput) {
      throw new Error("model controls missing");
    }

    modelSelect.value = "__custom__";
    modelSelect.dispatchEvent(new Event("change"));

    expect(customInput.style.display).toBe("block");

    el.remove();
  });

  it("renders object-based model options and loads dynamic provider models", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    const loader = jest.fn<() => Promise<any[]>>().mockResolvedValue([
      {
        id: "gpt-4.1",
        displayName: "GPT-4.1",
        supports_tools: true,
        context_length: 1048576,
      },
    ]);

    el.setModelLoader(loader as any);
    el.setProviders([
      {
        id: "openrouter",
        name: "OpenRouter",
        modelsUrl: "https://example.test/models",
      } as any,
      {
        id: "provider-a",
        name: "Provider A",
        models: [
          {
            id: "model-a",
            displayName: "Model A",
            supports_tools: true,
            context_length: 8192,
          },
        ],
      } as any,
    ]);

    el.setValue({ providerId: "provider-a", modelId: "model-a" });
    await el.render();

    let modelSelect = el.shadowRoot?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;

    expect(
      Array.from(modelSelect?.options || []).some(
        (option) => option.value === "model-a",
      ),
    ).toBe(true);

    el.setValue({ providerId: "openrouter", modelId: "gpt-4.1" });
    await el.render();
    await Promise.resolve();
    await Promise.resolve();

    modelSelect = el.shadowRoot?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement | null;

    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({ id: "openrouter" }),
    );
    expect(
      Array.from(modelSelect?.options || []).some(
        (option) => option.value === "gpt-4.1",
      ),
    ).toBe(true);

    el.remove();
  });

  it("handles getValue, setLabels, and invalidateProviderModels", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setValue({ providerId: "prov-1", modelId: "mod-1" });
    expect(el.getValue()).toEqual({ providerId: "prov-1", modelId: "mod-1" });

    el.setLabels({
      providerLabel: "Custom Provider Label",
      modelLabel: "Custom Model Label",
    });
    const root = el.shadowRoot;
    expect(root?.textContent).toContain("Custom Provider Label");

    el.invalidateProviderModels("prov-1");
    el.invalidateProviderModels();

    el.remove();
  });

  it("handles various model tool badges and context window structures", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setProviders([
      {
        id: "multi-models",
        name: "Multi Models",
        models: [
          {
            id: "no-tools",
            name: "No Tools",
            supports_tools: false,
            context_window: 4096,
          },
          {
            id: "supported-params",
            name: "Params",
            supported_parameters: ["tools"],
            context_length: 8192,
          },
          {
            id: "no-params",
            name: "No Params",
            supported_parameters: ["temperature"],
          },
          {
            id: "provider-list",
            name: "With Provider List",
            providers: [{ supports_tools: false, context_length: 16384 }],
          },
          {
            id: "provider-tools",
            name: "With Provider Tools",
            providers: [{ supports_tools: true, context_length: 32768 }],
          },
          { name: "Only Name" },
        ],
      } as any,
    ]);

    el.setValue({ providerId: "multi-models", modelId: "no-tools" });
    await el.render();

    const root = el.shadowRoot;
    const modelSelect = root?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement;
    expect(modelSelect).not.toBeNull();
    const options = Array.from(modelSelect.options).map((o) => o.textContent);
    expect(options.some((t) => t?.includes("🚫🛠️"))).toBe(true);
    expect(options.some((t) => t?.includes("🛠️"))).toBe(true);

    el.remove();
  });

  it("handles loader failure and custom model input events", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    const failingLoader = jest
      .fn<() => Promise<any[]>>()
      .mockRejectedValue(new Error("Network fail"));
    el.setModelLoader(failingLoader as any);
    el.setProviders([
      { id: "dynamic", name: "Dynamic", modelsUrl: "https://fail.test" } as any,
    ]);

    el.setValue({ providerId: "dynamic", modelId: null });
    await el.render();
    await Promise.resolve();
    await Promise.resolve();

    const root = el.shadowRoot;
    const modelSelect = root?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement;
    if (modelSelect) {
      modelSelect.value = "__custom__";
      modelSelect.dispatchEvent(new Event("change"));
    }

    const customInput = root?.querySelector(
      '[data-role="custom-model-input"]',
    ) as HTMLInputElement;
    const listener = jest.fn();
    el.addEventListener("provider-model-change", listener as EventListener);

    if (customInput) {
      customInput.value = "typed-model";
      customInput.dispatchEvent(new Event("input"));
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { providerId: "dynamic", modelId: "typed-model" },
        }),
      );
    }

    el.remove();
  });

  it("handles localOnlyProviderIds instruction models, empty model items, and million-token context", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    el.setProviders([
      {
        id: "llamafile",
        name: "Llamafile",
        models: [
          {
            id: "Llama-3.2-3B-Instruct.Q4_K_M.llamafile",
            name: "Llama 3.2 3B Instruct",
            context_length: 2000000,
          },
          {
            id: "base-model.llamafile",
            name: "Base Model",
          },
          {} as any, // Empty model object
          "simple-string-model" as any,
        ],
      } as any,
    ]);

    el.setValue({
      providerId: "llamafile",
      modelId: "Llama-3.2-3B-Instruct.Q4_K_M.llamafile",
    });
    await el.render();

    const root = el.shadowRoot;
    const modelSelect = root?.querySelector(
      '[data-role="model-select"]',
    ) as HTMLSelectElement;
    expect(modelSelect).not.toBeNull();
    const options = Array.from(modelSelect.options).map((o) => o.textContent);
    expect(options.some((t) => t?.includes("2.0M"))).toBe(true);
    expect(options.some((t) => t?.includes("🛠️"))).toBe(true);
    expect(options.some((t) => t?.includes("❔🛠️"))).toBe(true);

    el.remove();
  });

  it("handles race condition when provider is switched while loader is in-flight", async () => {
    const el = new ShadowClawProviderModelPicker();
    document.body.appendChild(el);

    let resolveFirstLoader: (models: any[]) => void;
    let rejectSecondLoader: (err: any) => void;

    const slowLoader = jest.fn((provider: any) => {
      if (provider.id === "slow-1") {
        return new Promise<any[]>((resolve) => {
          resolveFirstLoader = resolve;
        });
      }
      return new Promise<any[]>((_, reject) => {
        rejectSecondLoader = reject;
      });
    });

    el.setModelLoader(slowLoader as any);
    el.setProviders([
      { id: "slow-1", name: "Slow 1", modelsUrl: "https://slow1.test" } as any,
      { id: "slow-2", name: "Slow 2", modelsUrl: "https://slow2.test" } as any,
    ]);

    // Start loading slow-1
    el.setValue({ providerId: "slow-1", modelId: null });
    await el.render();

    // Quickly switch to slow-2
    el.setValue({ providerId: "slow-2", modelId: null });
    await el.render();

    // Now resolve first and reject second
    resolveFirstLoader!(["late-model-1"]);
    rejectSecondLoader!(new Error("late-error-2"));

    await Promise.resolve();
    await Promise.resolve();

    el.remove();
  });
});
