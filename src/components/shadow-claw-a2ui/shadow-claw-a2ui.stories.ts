import type { Meta, StoryObj } from "@storybook/web-components";

import { ShadowClawA2UI } from "./shadow-claw-a2ui.js";

const meta: Meta = {
  title: "Components/A2UI/ShadowClawA2UI",
  component: "shadow-claw-a2ui",
  tags: ["autodocs"],
  render: (args) => {
    const container = document.createElement("div");
    container.style.maxWidth = "36rem";
    container.style.width = "100%";

    const el = document.createElement("shadow-claw-a2ui") as ShadowClawA2UI;
    if (
      typeof customElements !== "undefined" &&
      typeof customElements.upgrade === "function"
    ) {
      customElements.upgrade(el);
    }
    container.append(el);

    const applyDemoEnvelope = () => {
      if (typeof el.applyEnvelope === "function") {
        el.applyEnvelope({
          type: "createSurface",
          surfaceId: "demo-surface",
          components: [
            {
              id: "root",
              component: "Card",
              child: "main-col",
            },
            {
              id: "main-col",
              component: "Column",
              children: ["title", "desc", "divider1", "slider1", "actions-row"],
            },
            {
              id: "title",
              component: "Text",
              text: args.title ?? "Generative AI Surface",
              variant: "heading",
            },
            {
              id: "desc",
              component: "Text",
              text:
                args.description ??
                "Rendered via the A2UI v1.0 protocol dynamically from assistant instructions.",
            },
            {
              id: "divider1",
              component: "Divider",
            },
            {
              id: "slider1",
              component: "Slider",
              label: "Creativity Level",
              min: 0,
              max: 100,
              value: 65,
            },
            {
              id: "actions-row",
              component: "Row",
              children: ["btn-submit", "btn-cancel"],
            },
            {
              id: "btn-submit",
              component: "Button",
              text: "Execute Plan",
              variant: "primary",
              action: { id: "execute-plan" },
            },
            {
              id: "btn-cancel",
              component: "Button",
              text: "Dismiss",
              variant: "secondary",
              action: { id: "dismiss" },
            },
          ],
          dataModel: {},
        });
      }
    };

    if (
      typeof customElements !== "undefined" &&
      typeof customElements.whenDefined === "function"
    ) {
      customElements.whenDefined("shadow-claw-a2ui").then(() => {
        applyDemoEnvelope();
      });
    }

    setTimeout(() => {
      applyDemoEnvelope();
    }, 50);

    return container;
  },
  args: {
    title: "Generative AI Surface",
    description:
      "Rendered via the A2UI v1.0 protocol dynamically from assistant instructions.",
  },
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
  },
};

export default meta;

type Story = StoryObj;

export const InteractiveSurface: Story = {};
