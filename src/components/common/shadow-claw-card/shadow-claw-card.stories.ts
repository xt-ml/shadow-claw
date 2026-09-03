import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-card.js";

const meta: Meta = {
  title: "Components/Common/ShadowClawCard",
  component: "shadow-claw-card",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.maxWidth = "24rem";
    container.style.width = "100%";

    const el = document.createElement("shadow-claw-card");
    el.setAttribute("label", String(args.label ?? "Card label"));
    el.setAttribute("meta", String(args.meta ?? "Metadata"));
    if (args.badge) {
      el.setAttribute("badge", String(args.badge));
    }
    if (args.highlight) {
      el.setAttribute("highlight", "");
    }
    if (args.muted) {
      el.setAttribute("muted", "");
    }

    if (args.hasActions) {
      const editBtn = document.createElement("button");
      editBtn.setAttribute("slot", "actions");
      editBtn.textContent = "Edit";
      const delBtn = document.createElement("button");
      delBtn.setAttribute("slot", "actions");
      delBtn.className = "delete-btn";
      delBtn.textContent = "Delete";
      el.append(editBtn, delBtn);
    }

    container.append(el);
    return container;
  },
  args: {
    label: "Local Storage Backup",
    meta: "Updated 2 hours ago • 4.2 MB",
    badge: "Active",
    highlight: false,
    muted: false,
    hasActions: true,
  },
  argTypes: {
    label: { control: "text" },
    meta: { control: "text" },
    badge: { control: "text" },
    highlight: { control: "boolean" },
    muted: { control: "boolean" },
    hasActions: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Highlighted: Story = {
  args: {
    label: "Primary Production Cluster",
    meta: "Connected • 12 active workers",
    badge: "Running",
    highlight: true,
  },
};

export const Muted: Story = {
  args: {
    label: "Archived Snapshot",
    meta: "Created 30 days ago",
    badge: "Archived",
    muted: true,
  },
};
