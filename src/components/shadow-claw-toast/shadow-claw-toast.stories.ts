import type { Meta, StoryObj } from "@storybook/web-components";

import {
  ShadowClawToast,
  showToast,
  toastStore,
  type ToastOptions,
} from "./shadow-claw-toast.js";

const meta: Meta = {
  title: "Components/Toast",
  component: "shadow-claw-toast",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "1rem";
    container.style.maxWidth = "28rem";
    container.style.fontFamily = "var(--shadow-claw-font-sans)";

    const description = document.createElement("p");
    description.textContent =
      "Click the buttons below to trigger real-time toasts. Notifications appear in real time and dismiss automatically.";
    description.style.margin = "0";
    description.style.color = "var(--shadow-claw-text-secondary)";
    description.style.fontSize = "0.875rem";

    const toastEl = document.createElement(
      "shadow-claw-toast",
    ) as ShadowClawToast;
    if (
      typeof customElements !== "undefined" &&
      typeof customElements.upgrade === "function"
    ) {
      customElements.upgrade(toastEl);
    }
    if (args.inline ?? true) {
      toastEl.setAttribute("inline", "");
    }

    const trigger = (message: string, options?: ToastOptions) => {
      if (typeof toastEl.show === "function") {
        toastEl.show(message, options);
      } else if (typeof showToast === "function") {
        showToast(message, options);
      } else if (toastStore && typeof toastStore.show === "function") {
        toastStore.show(message, options);
      }
    };

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.flexWrap = "wrap";
    buttonRow.style.gap = "0.5rem";

    const makeButton = (
      label: string,
      bg: string,
      color: string,
      onClick: () => void,
    ) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.style.padding = "0.5rem 0.875rem";
      btn.style.borderRadius = "var(--shadow-claw-radius-m, 0.5rem)";
      btn.style.border = "none";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "500";
      btn.style.fontSize = "0.8125rem";
      btn.style.backgroundColor = bg;
      btn.style.color = color;
      btn.addEventListener("click", onClick);
      return btn;
    };

    buttonRow.append(
      makeButton(
        "Success Toast",
        "var(--shadow-claw-success-color, #059669)",
        "#ffffff",
        () => {
          trigger("Files synced successfully to workspace!", {
            type: "success",
          });
        },
      ),
      makeButton(
        "Warning Toast",
        "var(--shadow-claw-warning-color, #d97706)",
        "#ffffff",
        () => {
          trigger("Low storage space remaining on device.", {
            type: "warning",
          });
        },
      ),
      makeButton(
        "Error Toast",
        "var(--shadow-claw-error-color, #ba1a1a)",
        "#ffffff",
        () => {
          trigger("Failed to connect to remote MCP host.", { type: "error" });
        },
      ),
      makeButton(
        "Info Toast",
        "var(--shadow-claw-accent-primary, #334155)",
        "#ffffff",
        () => {
          trigger("Agent task started in background.", { type: "info" });
        },
      ),
    );

    container.append(description, buttonRow, toastEl);

    // Trigger an initial sample toast so the user sees it immediately
    setTimeout(() => {
      trigger("ShadowClaw toast notifications are active!", { type: "info" });
    }, 100);

    return container;
  },
  args: {
    inline: true,
  },
  argTypes: {
    inline: { control: "boolean" },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const FixedBottomRight: Story = {
  args: {
    inline: false,
  },
};
