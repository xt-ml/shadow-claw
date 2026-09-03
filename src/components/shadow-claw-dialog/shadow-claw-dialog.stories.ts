import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-dialog.js";

const meta: Meta = {
  title: "Components/Dialog",
  component: "shadow-claw-dialog",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "flex-start";
    container.style.gap = "1rem";

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Open Dialog";
    button.style.padding = "0.5rem 1rem";
    button.style.borderRadius = "var(--shadow-claw-radius-m, 0.5rem)";
    button.style.backgroundColor = "var(--shadow-claw-accent-primary, #334155)";
    button.style.color = "var(--shadow-claw-on-primary, #ffffff)";
    button.style.border = "none";
    button.style.cursor = "pointer";
    button.style.fontWeight = "500";

    const dialog = document.createElement(
      "shadow-claw-dialog",
    ) as HTMLElement & {
      showModal: () => void;
      close: () => void;
    };
    dialog.setAttribute("dialog-class", "app-dialog");
    dialog.setAttribute(
      "dialog-aria-label",
      String(args.title ?? "Example Dialog"),
    );

    const content = document.createElement("div");
    content.style.padding = "1.5rem";
    content.style.maxWidth = "28rem";
    content.style.backgroundColor = "var(--shadow-claw-bg-secondary)";
    content.style.borderRadius = "var(--shadow-claw-radius-l, 1.25rem)";
    content.style.display = "flex";
    content.style.flexDirection = "column";
    content.style.gap = "1rem";
    content.style.fontFamily = "var(--shadow-claw-font-sans)";
    content.style.color = "var(--shadow-claw-text-primary)";

    const titleEl = document.createElement("h3");
    titleEl.textContent = String(args.title ?? "Example Dialog");
    titleEl.style.margin = "0";
    titleEl.style.fontSize = "1.125rem";
    titleEl.style.fontWeight = "600";
    titleEl.style.color = "var(--shadow-claw-text-primary)";

    const messageEl = document.createElement("p");
    messageEl.textContent = String(
      args.message ??
        "This is an interactive modal dialog powered by shadow-claw-dialog. It integrates cleanly with standard HTMLDialogElement methods.",
    );
    messageEl.style.margin = "0";
    messageEl.style.fontSize = "0.875rem";
    messageEl.style.color = "var(--shadow-claw-text-secondary)";
    messageEl.style.lineHeight = "1.5";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "0.5rem";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.padding = "0.375rem 0.75rem";
    cancelBtn.style.borderRadius = "var(--shadow-claw-radius-s, 0.375rem)";
    cancelBtn.style.border =
      "0.0625rem solid var(--shadow-claw-border-color, #e2e8f0)";
    cancelBtn.style.backgroundColor = "var(--shadow-claw-bg-tertiary, #e2e8f0)";
    cancelBtn.style.color = "var(--shadow-claw-text-primary)";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.addEventListener("click", () => dialog.close());

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.padding = "0.375rem 0.75rem";
    confirmBtn.style.borderRadius = "var(--shadow-claw-radius-s, 0.375rem)";
    confirmBtn.style.border = "none";
    confirmBtn.style.backgroundColor =
      "var(--shadow-claw-accent-primary, #334155)";
    confirmBtn.style.color = "var(--shadow-claw-on-primary, #ffffff)";
    confirmBtn.style.cursor = "pointer";
    confirmBtn.addEventListener("click", () => dialog.close());

    actions.append(cancelBtn, confirmBtn);
    content.append(titleEl, messageEl, actions);
    dialog.append(content);

    button.addEventListener("click", () => {
      dialog.showModal();
    });

    container.append(button, dialog);
    return container;
  },
  args: {
    title: "Confirm Action",
    message:
      "Are you sure you want to proceed with this operation? This dialog demonstrates modal backdrop and focus management.",
  },
  argTypes: {
    title: { control: "text" },
    message: { control: "text" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};
