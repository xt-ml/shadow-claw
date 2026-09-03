import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-empty-state.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawEmptyState",
  component: "shadow-claw-empty-state",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.maxWidth = "28rem";
    container.style.width = "100%";

    const el = document.createElement("shadow-claw-empty-state");
    if (
      typeof customElements !== "undefined" &&
      typeof customElements.upgrade === "function"
    ) {
      customElements.upgrade(el);
    }
    if (args.message) {
      el.setAttribute("message", String(args.message));
    }
    if (args.hint) {
      el.setAttribute("hint", String(args.hint));
    }
    if (args.compact) {
      el.setAttribute("compact", "");
    }
    if (args.warning) {
      el.setAttribute("warning", "");
    }
    container.append(el);
    return container;
  },
  args: {
    message: "No files found in workspace",
    hint: "Drag and drop files here or click Upload to get started.",
    compact: false,
    warning: false,
  },
  argTypes: {
    message: { control: "text" },
    hint: { control: "text" },
    compact: { control: "boolean" },
    warning: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Warning: Story = {
  args: {
    message: "No active LLM providers configured",
    hint: "Add an API key in Settings > Providers to enable assistance.",
    warning: true,
  },
};

export const Compact: Story = {
  args: {
    message: "No search results found",
    hint: "Try refining your search terms.",
    compact: true,
  },
};
