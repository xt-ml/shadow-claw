import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-page-header-action-button.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawPageHeaderActionButton",
  component: "shadow-claw-page-header-action-button",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.maxWidth = "12rem";
    container.style.display = "flex";

    const el = document.createElement("shadow-claw-page-header-action-button");
    if (args.variant) {
      el.setAttribute("variant", String(args.variant));
    }
    if (args.disabled) {
      el.setAttribute("disabled", "");
    }
    el.textContent = args.label ?? "Action";
    container.append(el);
    return container;
  },
  args: {
    label: "Save Changes",
    variant: "default",
    disabled: false,
  },
  argTypes: {
    label: { control: "text" },
    variant: {
      control: "select",
      options: ["default", "primary", "danger"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Primary: Story = {
  args: {
    label: "Publish",
    variant: "primary",
  },
};

export const Danger: Story = {
  args: {
    label: "Delete File",
    variant: "danger",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled Button",
    disabled: true,
  },
};
