import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-actions.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawActions",
  component: "shadow-claw-actions",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.padding = "0.75rem 1rem";
    container.style.border =
      "0.0625rem solid var(--shadow-claw-border-color, #e2e8f0)";
    container.style.borderRadius = "var(--shadow-claw-radius-s, 0.5rem)";
    container.style.backgroundColor =
      "var(--shadow-claw-bg-secondary, #f1f5f9)";
    container.style.justifyContent = "space-between";
    container.style.maxWidth = "28rem";
    container.style.width = "100%";

    const label = document.createElement("span");
    label.textContent =
      args.kind === "connection"
        ? "PostgreSQL MCP Bridge"
        : "Anthropic Claude API";
    label.style.fontWeight = "500";
    label.style.fontSize = "0.875rem";

    const el = document.createElement("shadow-claw-actions");
    el.setAttribute("kind", String(args.kind ?? "account"));
    el.setAttribute("item-id", "item-123");
    if (args.isDefault) {
      el.setAttribute("is-default", "");
    }

    const logEl = document.createElement("div");
    logEl.style.fontSize = "0.75rem";
    logEl.style.color = "var(--shadow-claw-text-tertiary)";
    logEl.style.marginTop = "0.5rem";

    container.addEventListener("settings-action", (e: Event) => {
      const customEvent = e as CustomEvent<{ action: string; id: string }>;
      logEl.textContent = `Triggered: ${customEvent.detail.action} for ${customEvent.detail.id}`;
    });

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "0.5rem";

    container.append(label, el);
    wrapper.append(container, logEl);
    return wrapper;
  },
  args: {
    kind: "account",
    isDefault: false,
  },
  argTypes: {
    kind: {
      control: "select",
      options: ["account", "connection"],
    },
    isDefault: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const AccountActions: Story = {
  args: {
    kind: "account",
    isDefault: false,
  },
};

export const DefaultAccountActions: Story = {
  args: {
    kind: "account",
    isDefault: true,
  },
};

export const ConnectionActions: Story = {
  args: {
    kind: "connection",
    isDefault: false,
  },
};
