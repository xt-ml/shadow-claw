import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-resize-handle.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawResizeHandle",
  component: "shadow-claw-resize-handle",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "stretch";
    container.style.height =
      args.orientation === "horizontal" ? "auto" : "12rem";
    container.style.flexDirection =
      args.orientation === "horizontal" ? "column" : "row";
    container.style.border =
      "1px solid var(--shadow-claw-border-color, #e2e8f0)";
    container.style.borderRadius = "0.5rem";

    const pane = document.createElement("div");
    pane.style.padding = "0.75rem";
    pane.style.flex = "0 0 auto";
    if (args.orientation === "horizontal") {
      pane.style.height = `${args.value ?? 120}px`;
    } else {
      pane.style.width = `${args.value ?? 200}px`;
    }
    pane.textContent = "Resizable pane";

    const handle = document.createElement("shadow-claw-resize-handle");
    handle.setAttribute("orientation", String(args.orientation ?? "vertical"));
    handle.setAttribute("value", String(args.value ?? 200));
    handle.setAttribute("min", String(args.min ?? 100));
    handle.setAttribute("max", String(args.max ?? 400));
    handle.setAttribute("label", String(args.label ?? "Resize pane"));
    if (args.disabled) {
      handle.setAttribute("disabled", "");
    }

    handle.addEventListener("shadow-claw-resize", (ev) => {
      const val = (ev as CustomEvent<{ value: number }>).detail.value;
      if (args.orientation === "horizontal") {
        pane.style.height = `${val}px`;
      } else {
        pane.style.width = `${val}px`;
      }
    });

    const rest = document.createElement("div");
    rest.style.flex = "1";
    rest.style.padding = "0.75rem";
    rest.textContent = "Adjacent content";

    container.append(pane, handle, rest);
    return container;
  },
  args: {
    orientation: "vertical",
    value: 200,
    min: 100,
    max: 400,
    label: "Resize pane",
    disabled: false,
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["vertical", "horizontal"],
    },
    value: { control: "number" },
    min: { control: "number" },
    max: { control: "number" },
    label: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const Vertical: Story = {};

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
    value: 120,
    min: 80,
    max: 300,
  },
};
