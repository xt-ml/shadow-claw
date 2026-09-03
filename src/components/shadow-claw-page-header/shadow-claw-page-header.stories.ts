import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-page-header.js";
import "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js";

const meta: Meta = {
  title: "Components/PageHeader",
  component: "shadow-claw-page-header",
  tags: ["autodocs"],
  render: (args) => {
    const el = document.createElement("shadow-claw-page-header");
    el.setAttribute("title", String(args.title ?? "Page title"));

    if (args.hasActions) {
      const btn1 = document.createElement(
        "shadow-claw-page-header-action-button",
      );
      btn1.setAttribute("slot", "actions");
      btn1.setAttribute("variant", "primary");
      btn1.textContent = "Deploy";

      const btn2 = document.createElement(
        "shadow-claw-page-header-action-button",
      );
      btn2.setAttribute("slot", "actions");
      btn2.setAttribute("variant", "default");
      btn2.textContent = "Settings";

      el.append(btn1, btn2);
    }

    if (args.breadcrumbs) {
      const breadcrumbs = document.createElement("nav");
      breadcrumbs.setAttribute("slot", "breadcrumbs");
      breadcrumbs.style.fontSize = "0.75rem";
      breadcrumbs.style.color = "var(--shadow-claw-text-tertiary)";
      breadcrumbs.textContent = String(args.breadcrumbs);
      el.append(breadcrumbs);
    }

    return el;
  },
  args: {
    title: "Project Settings",
    hasActions: true,
    breadcrumbs: "Home / Workspaces / Settings",
  },
  argTypes: {
    title: { control: "text" },
    hasActions: { control: "boolean" },
    breadcrumbs: { control: "text" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Simple: Story = {
  args: {
    title: "Overview",
    hasActions: false,
    breadcrumbs: "",
  },
};
