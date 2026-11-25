import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-status-bar.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawStatusBar",
  component: "shadow-claw-status-bar",
  tags: ["autodocs"],
  render: (args) => {
    const el = document.createElement("shadow-claw-status-bar");
    el.setAttribute("label", String(args.label ?? "Workspace status"));
    el.setAttribute("message", String(args.message ?? "Ready"));
    if (args.dirty) {
      el.setAttribute("dirty", "");
    }
    if (args.error) {
      el.setAttribute("error", String(args.error));
    }

    const metricA = document.createElement("span");
    metricA.setAttribute("slot", "metrics");
    metricA.textContent = "120 BPM";
    const metricB = document.createElement("span");
    metricB.setAttribute("slot", "metrics");
    metricB.textContent = "100%";
    el.append(metricA, metricB);

    return el;
  },
  args: {
    label: "Workspace status",
    message: "Ready",
    dirty: false,
    error: "",
  },
  argTypes: {
    label: { control: "text" },
    message: { control: "text" },
    dirty: { control: "boolean" },
    error: { control: "text" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    message: "Unsaved changes",
    dirty: true,
    error: "Audio context suspended",
  },
};
