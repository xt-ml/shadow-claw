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
});
