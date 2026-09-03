import type { Meta, StoryObj } from "@storybook/web-components";

import type { LLMProvider } from "../../../subsystems/providers/types.js";
import { ShadowClawProviderModelPicker } from "./shadow-claw-provider-model-picker.js";

const mockProviders: LLMProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    type: "anthropic",
    models: ["claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"],
    requiresApiKey: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    type: "openai",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    requiresApiKey: true,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    type: "ollama",
    models: ["llama3.2", "qwen2.5-coder", "deepseek-r1"],
    requiresApiKey: false,
  },
];

const meta: Meta = {
  title: "Components/Common/ShadowClawProviderModelPicker",
  component: "shadow-claw-provider-model-picker",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.maxWidth = "28rem";
    container.style.width = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "1rem";

    const el = document.createElement(
      "shadow-claw-provider-model-picker",
    ) as ShadowClawProviderModelPicker;
    if (
      typeof customElements !== "undefined" &&
      typeof customElements.upgrade === "function"
    ) {
      customElements.upgrade(el);
    }

    const applyConfig = () => {
      if (typeof el.setProviders === "function") {
        el.setProviders(mockProviders);
      }
      if (typeof el.setValue === "function") {
        el.setValue({
          providerId: args.providerId ?? "anthropic",
          modelId: args.modelId ?? "claude-3-7-sonnet",
        });
      }
    };

    applyConfig();

    if (
      typeof customElements !== "undefined" &&
      typeof customElements.whenDefined === "function"
    ) {
      customElements
        .whenDefined("shadow-claw-provider-model-picker")
        .then(() => {
          applyConfig();
        });
    }

    const statusEl = document.createElement("div");
    statusEl.style.fontSize = "0.75rem";
    statusEl.style.color = "var(--shadow-claw-text-tertiary)";
    statusEl.textContent = `Selected: ${args.providerId ?? "anthropic"} / ${args.modelId ?? "claude-3-7-sonnet"}`;

    el.addEventListener("provider-model-change", () => {
      const val = el.getValue();
      statusEl.textContent = `Selected: ${val.providerId ?? "default"} / ${val.modelId ?? "default"}`;
    });

    container.append(el, statusEl);
    return container;
  },
  args: {
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet",
  },
  argTypes: {
    providerId: {
      control: "select",
      options: ["anthropic", "openai", "ollama"],
    },
    modelId: { control: "text" },
  },
};

export default meta;

type Story = StoryObj;

export const AnthropicSelected: Story = {
  args: {
    providerId: "anthropic",
    modelId: "claude-3-7-sonnet",
  },
};

export const LocalOllamaSelected: Story = {
  args: {
    providerId: "ollama",
    modelId: "qwen2.5-coder",
  },
};
