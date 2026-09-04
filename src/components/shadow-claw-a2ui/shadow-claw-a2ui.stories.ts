import type { Meta, StoryObj } from "@storybook/web-components";

import "./shadow-claw-a2ui.js";
import type { ShadowClawA2UI } from "./shadow-claw-a2ui.js";
import type { A2UIEnvelope } from "../../ui/a2ui/types.js";

function renderA2UIEnvelope(
  envelope: A2UIEnvelope,
  maxWidth = "38rem",
): HTMLElement {
  const container = document.createElement("div");
  container.style.maxWidth = maxWidth;
  container.style.width = "100%";
  container.style.boxSizing = "border-box";

  const el = document.createElement("shadow-claw-a2ui") as ShadowClawA2UI;
  if (
    typeof customElements !== "undefined" &&
    typeof customElements.upgrade === "function"
  ) {
    customElements.upgrade(el);
  }
  container.append(el);

  const apply = () => {
    if (typeof el.applyEnvelope === "function") {
      el.applyEnvelope(envelope);
    }
  };

  apply();

  if (
    typeof customElements !== "undefined" &&
    typeof customElements.whenDefined === "function"
  ) {
    customElements.whenDefined("shadow-claw-a2ui").then(apply);
  }

  // Microtask and tick fallbacks to guarantee envelope rendering
  queueMicrotask(apply);
  setTimeout(apply, 0);

  return container;
}

const sampleSvgImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">' +
      '<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#8b5cf6"/>' +
      "</linearGradient></defs>" +
      '<rect width="100%" height="100%" rx="12" fill="url(#g)"/>' +
      '<text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-weight="700" font-size="22">A2UI Responsive Media</text>' +
      '<text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" fill="#e0e7ff" font-family="system-ui, sans-serif" font-size="14">v1.0 Basic Catalog Vector Preview</text>' +
      "</svg>",
  );

const samplePosterImage =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
      '<rect width="100%" height="100%" rx="12" fill="#0f172a"/>' +
      '<circle cx="320" cy="180" r="44" fill="#38bdf8" opacity="0.85"/>' +
      '<polygon points="312,162 336,180 312,198" fill="#ffffff"/>' +
      '<text x="320" y="260" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="16">Video Player Preview</text>' +
      "</svg>",
  );

const meta: Meta = {
  title: "Components/A2UI/ShadowClawA2UI",
  component: "shadow-claw-a2ui",
  tags: ["autodocs"],
  render: (args) => {
    return renderA2UIEnvelope({
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
          children: [
            "header-row",
            "divider-top",
            "prompt-field",
            "options-row",
            "slider-item",
            "divider-bottom",
            "actions-row",
          ],
        },
        {
          id: "header-row",
          component: "Row",
          align: "center",
          justify: "spaceBetween",
          children: ["header-texts", "header-icon"],
        },
        {
          id: "header-texts",
          component: "Column",
          children: ["title", "desc"],
        },
        {
          id: "title",
          component: "Text",
          text: args.title ?? "Generative AI Surface",
          variant: "h2",
          weight: "bold",
        },
        {
          id: "desc",
          component: "Text",
          text:
            args.description ??
            "Rendered via the A2UI v1.0 protocol dynamically from assistant instructions.",
          variant: "caption",
        },
        {
          id: "header-icon",
          component: "Icon",
          name: "smart_toy",
        },
        {
          id: "divider-top",
          component: "Divider",
        },
        {
          id: "prompt-field",
          component: "TextField",
          label: "Agent Instructions",
          variant: "longText",
          value:
            "Analyze current cluster telemetry, verify health status, and draft resolution steps.",
        },
        {
          id: "options-row",
          component: "Row",
          justify: "spaceBetween",
          align: "center",
          children: ["stream-check", "auto-exec-check"],
        },
        {
          id: "stream-check",
          component: "CheckBox",
          label: "Enable Streaming",
          value: true,
        },
        {
          id: "auto-exec-check",
          component: "CheckBox",
          label: "Tool Allowlist Only",
          value: true,
        },
        {
          id: "slider-item",
          component: "Slider",
          label: "Creativity Level",
          min: 0,
          max: 100,
          value: 65,
        },
        {
          id: "divider-bottom",
          component: "Divider",
        },
        {
          id: "actions-row",
          component: "Row",
          justify: "end",
          children: ["btn-cancel", "btn-submit"],
        },
        {
          id: "btn-cancel",
          component: "Button",
          text: "Dismiss",
          variant: "secondary",
          action: { event: { name: "dismiss" } },
        },
        {
          id: "btn-submit",
          component: "Button",
          text: "Execute Plan",
          variant: "primary",
          action: { event: { name: "execute-plan" } },
        },
      ],
      dataModel: {},
    });
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

export const AllComponents: Story = {
  render: () => {
    return renderA2UIEnvelope(
      {
        type: "createSurface",
        surfaceId: "all-components-surface",
        components: [
          {
            id: "root",
            component: "Card",
            child: "main-container",
          },
          {
            id: "main-container",
            component: "Column",
            children: [
              "header-bar",
              "div-1",
              "catalog-tabs",
              "div-2",
              "footer-actions",
            ],
          },
          {
            id: "header-bar",
            component: "Row",
            align: "center",
            justify: "spaceBetween",
            children: ["header-title-group", "header-badge-icon"],
          },
          {
            id: "header-title-group",
            component: "Column",
            children: ["catalog-heading", "catalog-caption"],
          },
          {
            id: "catalog-heading",
            component: "Text",
            text: "A2UI v1.0 Basic Catalog (All 18 Components)",
            variant: "h2",
            weight: "bold",
          },
          {
            id: "catalog-caption",
            component: "Text",
            text: "Complete showcase of all 18 official A2UI Basic catalog components in one surface.",
            variant: "caption",
          },
          {
            id: "header-badge-icon",
            component: "Icon",
            name: "verified",
          },
          {
            id: "div-1",
            component: "Divider",
          },
          {
            id: "catalog-tabs",
            component: "Tabs",
            tabs: [
              { title: "Inputs & Selection", child: "tab-inputs" },
              { title: "Layout & Data", child: "tab-layout" },
              { title: "Media & Modals", child: "tab-media" },
            ],
          },
          // ── Tab 1: Inputs & Selection ────────────────────────────────────
          {
            id: "tab-inputs",
            component: "Column",
            children: [
              "text-field-std",
              "text-field-obscured",
              "text-field-long",
              "checkbox-group",
              "choice-picker-single",
              "choice-picker-multi",
              "slider-ctrl",
              "datetime-ctrl",
            ],
          },
          {
            id: "text-field-std",
            component: "TextField",
            label: "Model Name (TextField)",
            value: { path: "/model" },
          },
          {
            id: "text-field-obscured",
            component: "TextField",
            label: "API Access Key (TextField variant: obscured)",
            variant: "obscured",
            value: "sk-ant-live-mock-token-9982",
          },
          {
            id: "text-field-long",
            component: "TextField",
            label: "System Prompt Instructions (TextField variant: longText)",
            variant: "longText",
            value:
              "You are an autonomous engineering agent configured with A2UI surfaces.",
          },
          {
            id: "checkbox-group",
            component: "Row",
            justify: "spaceBetween",
            children: ["cb-1", "cb-2"],
          },
          {
            id: "cb-1",
            component: "CheckBox",
            label: "Enable Streaming (CheckBox)",
            value: { path: "/streaming" },
          },
          {
            id: "cb-2",
            component: "CheckBox",
            label: "Sandboxed WebVM (CheckBox)",
            value: { path: "/sandboxed" },
          },
          {
            id: "choice-picker-single",
            component: "ChoicePicker",
            variant: "singleSelection",
            value: { path: "/activeModel" },
            options: [
              {
                label: "Claude 3.7 Sonnet (ChoicePicker Single)",
                value: "sonnet",
              },
              { label: "GPT-4o", value: "gpt4o" },
              { label: "Gemini 2.5 Flash", value: "gemini" },
            ],
          },
          {
            id: "choice-picker-multi",
            component: "ChoicePicker",
            variant: "multipleSelection",
            value: { path: "/selectedTools" },
            options: [
              { label: "Code Search (ChoicePicker Multi)", value: "search" },
              { label: "Bash Tool", value: "bash" },
              { label: "Web Fetch", value: "fetch" },
            ],
          },
          {
            id: "slider-ctrl",
            component: "Slider",
            label: "Generation Temperature (Slider)",
            min: 0,
            max: 100,
            steps: 5,
            value: { path: "/temperature" },
          },
          {
            id: "datetime-ctrl",
            component: "DateTimeInput",
            label: "Trigger Execution Timestamp (DateTimeInput)",
            enableDate: true,
            enableTime: true,
            value: "2026-09-03T14:00",
          },
          // ── Tab 2: Layout & Data ─────────────────────────────────────────
          {
            id: "tab-layout",
            component: "Column",
            children: ["row-demo", "list-demo"],
          },
          {
            id: "row-demo",
            component: "Row",
            justify: "spaceBetween",
            align: "center",
            children: ["chip-a", "chip-b", "chip-c"],
          },
          {
            id: "chip-a",
            component: "Button",
            variant: "secondary",
            text: "Row Item A",
            action: { event: { name: "item-a" } },
          },
          {
            id: "chip-b",
            component: "Button",
            variant: "secondary",
            text: "Row Item B",
            action: { event: { name: "item-b" } },
          },
          {
            id: "chip-c",
            component: "Button",
            variant: "secondary",
            text: "Row Item C",
            action: { event: { name: "item-c" } },
          },
          {
            id: "list-demo",
            component: "List",
            direction: "vertical",
            children: ["list-card-1", "list-card-2"],
          },
          {
            id: "list-card-1",
            component: "Card",
            child: "list-item-1-row",
          },
          {
            id: "list-item-1-row",
            component: "Row",
            justify: "spaceBetween",
            align: "center",
            children: ["list-item-1-text", "list-item-1-icon"],
          },
          {
            id: "list-item-1-text",
            component: "Text",
            text: "List Item 1 (Inside Card component)",
            variant: "body",
          },
          {
            id: "list-item-1-icon",
            component: "Icon",
            name: "check_circle",
          },
          {
            id: "list-card-2",
            component: "Card",
            child: "list-item-2-row",
          },
          {
            id: "list-item-2-row",
            component: "Row",
            justify: "spaceBetween",
            align: "center",
            children: ["list-item-2-text", "list-item-2-icon"],
          },
          {
            id: "list-item-2-text",
            component: "Text",
            text: "List Item 2 (Inside Card component)",
            variant: "body",
          },
          {
            id: "list-item-2-icon",
            component: "Icon",
            name: "bolt",
          },
          // ── Tab 3: Media & Modals ────────────────────────────────────────
          {
            id: "tab-media",
            component: "Column",
            children: [
              "img-preview",
              "audio-preview",
              "video-preview",
              "modal-preview",
            ],
          },
          {
            id: "img-preview",
            component: "Image",
            url: sampleSvgImage,
            description: "A2UI Vector Image Component",
            variant: "mediumFeature",
            fit: "cover",
          },
          {
            id: "audio-preview",
            component: "AudioPlayer",
            url: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
            description: "Notification Chime (AudioPlayer Component)",
          },
          {
            id: "video-preview",
            component: "Video",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            posterUrl: samplePosterImage,
          },
          {
            id: "modal-preview",
            component: "Modal",
            trigger: "modal-trigger-btn",
            content: "modal-inner-card",
          },
          {
            id: "modal-trigger-btn",
            component: "Button",
            variant: "primary",
            text: "Open Dialog (Modal Component)",
          },
          {
            id: "modal-inner-card",
            component: "Card",
            child: "modal-inner-col",
          },
          {
            id: "modal-inner-col",
            component: "Column",
            children: ["modal-title", "modal-body", "modal-close-btn"],
          },
          {
            id: "modal-title",
            component: "Text",
            text: "A2UI Modal Overlay Active",
            variant: "h3",
            weight: "bold",
          },
          {
            id: "modal-body",
            component: "Text",
            text: "This dialog content is dynamically rendered inside the surface modal container.",
            variant: "body",
          },
          {
            id: "modal-close-btn",
            component: "Button",
            variant: "secondary",
            text: "Close Dialog",
            action: { event: { name: "closeModal" } },
          },
          // ── Footer Actions ───────────────────────────────────────────────
          {
            id: "div-2",
            component: "Divider",
          },
          {
            id: "footer-actions",
            component: "Row",
            justify: "end",
            children: ["btn-reset", "btn-save"],
          },
          {
            id: "btn-reset",
            component: "Button",
            variant: "secondary",
            text: "Reset Surface",
            action: { event: { name: "reset" } },
          },
          {
            id: "btn-save",
            component: "Button",
            variant: "primary",
            text: "Apply Changes",
            action: { event: { name: "save" } },
          },
        ],
        dataModel: {
          model: "claude-3-7-sonnet",
          streaming: true,
          sandboxed: false,
          activeModel: "sonnet",
          selectedTools: ["search", "bash"],
          temperature: 70,
        },
      },
      "42rem",
    );
  },
};

export const Text: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "text-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: [
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "body",
            "caption",
            "data-bound",
          ],
        },
        {
          id: "h1",
          component: "Text",
          text: "Heading 1 (h1)",
          variant: "h1",
          weight: "bold",
        },
        { id: "h2", component: "Text", text: "Heading 2 (h2)", variant: "h2" },
        { id: "h3", component: "Text", text: "Heading 3 (h3)", variant: "h3" },
        { id: "h4", component: "Text", text: "Heading 4 (h4)", variant: "h4" },
        { id: "h5", component: "Text", text: "Heading 5 (h5)", variant: "h5" },
        {
          id: "body",
          component: "Text",
          text: "Standard body text providing clear readability with theme typography variables.",
          variant: "body",
        },
        {
          id: "caption",
          component: "Text",
          text: "Small caption note supporting lightweight metadata or timestamp annotations.",
          variant: "caption",
        },
        {
          id: "data-bound",
          component: "Text",
          text: { path: "/dynamicStatus" },
          variant: "body",
          weight: "bold",
        },
      ],
      dataModel: {
        dynamicStatus: "Live Data-Bound String via JSON Pointer /dynamicStatus",
      },
    }),
};

export const Button: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "button-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["btn-heading", "btn-row"],
        },
        {
          id: "btn-heading",
          component: "Text",
          text: "A2UI Button Variants",
          variant: "h3",
          weight: "bold",
        },
        { id: "btn-row", component: "Row", children: ["b1", "b2", "b3", "b4"] },
        {
          id: "b1",
          component: "Button",
          text: "Primary Button",
          variant: "primary",
          action: { event: { name: "click-primary" } },
        },
        {
          id: "b2",
          component: "Button",
          text: "Secondary Button",
          variant: "secondary",
          action: { event: { name: "click-secondary" } },
        },
        {
          id: "b3",
          component: "Button",
          text: "Text Action",
          variant: "text",
          action: { event: { name: "click-text" } },
        },
        {
          id: "b4",
          component: "Button",
          child: "b4-label",
          variant: "primary",
          checked: true,
          action: { event: { name: "click-checked" } },
        },
        { id: "b4-label", component: "Text", text: "Checked Button" },
      ],
      dataModel: {},
    }),
};

export const TextField: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "textfield-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["tf-title", "f-text", "f-obscured", "f-number", "f-long"],
        },
        {
          id: "tf-title",
          component: "Text",
          text: "A2UI TextField Variants",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "f-text",
          component: "TextField",
          label: "User Name (Standard Input)",
          value: { path: "/username" },
        },
        {
          id: "f-obscured",
          component: "TextField",
          label: "API Token (Obscured / Password)",
          variant: "obscured",
          value: "secret-token-key-123",
        },
        {
          id: "f-number",
          component: "TextField",
          label: "Port Number (Number Input)",
          variant: "number",
          value: "8080",
        },
        {
          id: "f-long",
          component: "TextField",
          label: "Execution Instructions (LongText / Textarea)",
          variant: "longText",
          value:
            "Multi-line agent instructions with automatic two-way binding.",
        },
      ],
      dataModel: { username: "ShadowClaw Operator" },
    }),
};

export const Row: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "row-surface",
      components: [
        { id: "root", component: "Card", child: "main-col" },
        {
          id: "main-col",
          component: "Column",
          children: ["title", "r-between", "r-center", "r-end"],
        },
        {
          id: "title",
          component: "Text",
          text: "A2UI Row Justify Layouts",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "r-between",
          component: "Row",
          justify: "spaceBetween",
          align: "center",
          children: ["b1", "b2"],
        },
        {
          id: "b1",
          component: "Button",
          text: "Left (Start)",
          variant: "secondary",
        },
        {
          id: "b2",
          component: "Button",
          text: "Right (End)",
          variant: "primary",
        },
        {
          id: "r-center",
          component: "Row",
          justify: "center",
          children: ["b3"],
        },
        {
          id: "b3",
          component: "Button",
          text: "Centered Button",
          variant: "secondary",
        },
        {
          id: "r-end",
          component: "Row",
          justify: "end",
          children: ["b4", "b5"],
        },
        { id: "b4", component: "Button", text: "Cancel", variant: "text" },
        { id: "b5", component: "Button", text: "Save", variant: "primary" },
      ],
      dataModel: {},
    }),
};

export const Column: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "column-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          align: "stretch",
          children: ["t1", "t2", "d1", "btn-stack"],
        },
        {
          id: "t1",
          component: "Text",
          text: "Vertical Column Container",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "t2",
          component: "Text",
          text: "Stacks child items vertically with responsive spacing.",
          variant: "body",
        },
        { id: "d1", component: "Divider" },
        {
          id: "btn-stack",
          component: "Column",
          children: ["action1", "action2"],
        },
        {
          id: "action1",
          component: "Button",
          text: "Top Action",
          variant: "primary",
        },
        {
          id: "action2",
          component: "Button",
          text: "Bottom Action",
          variant: "secondary",
        },
      ],
      dataModel: {},
    }),
};

export const Card: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "card-surface",
      components: [
        { id: "root", component: "Column", children: ["card-1", "card-2"] },
        { id: "card-1", component: "Card", child: "c1-content" },
        {
          id: "c1-content",
          component: "Column",
          children: ["c1-title", "c1-body"],
        },
        {
          id: "c1-title",
          component: "Text",
          text: "Elevated Card Container",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "c1-body",
          component: "Text",
          text: "Cards provide a themed container surface with border radius and subtle drop shadows.",
          variant: "body",
        },
        { id: "card-2", component: "Card", child: "c2-content" },
        {
          id: "c2-content",
          component: "Row",
          justify: "spaceBetween",
          align: "center",
          children: ["c2-text", "c2-btn"],
        },
        {
          id: "c2-text",
          component: "Text",
          text: "Card with action bar",
          variant: "body",
          weight: "bold",
        },
        {
          id: "c2-btn",
          component: "Button",
          text: "View Details",
          variant: "primary",
        },
      ],
      dataModel: {},
    }),
};

export const CheckBox: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "checkbox-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["title", "cb1", "cb2", "cb3"],
        },
        {
          id: "title",
          component: "Text",
          text: "A2UI CheckBox Bindings",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "cb1",
          component: "CheckBox",
          label: "Real-time Telemetry (Checked)",
          value: { path: "/telemetry" },
        },
        {
          id: "cb2",
          component: "CheckBox",
          label: "Verbose Audit Logging (Unchecked)",
          value: { path: "/logging" },
        },
        {
          id: "cb3",
          component: "CheckBox",
          label: "Static Boolean Value",
          value: true,
        },
      ],
      dataModel: { telemetry: true, logging: false },
    }),
};

export const ChoicePicker: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "choice-picker-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: [
            "title",
            "single-heading",
            "cp-single",
            "div",
            "multi-heading",
            "cp-multi",
          ],
        },
        {
          id: "title",
          component: "Text",
          text: "A2UI ChoicePicker Controls",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "single-heading",
          component: "Text",
          text: "Single Selection (Radio)",
          variant: "body",
          weight: "bold",
        },
        {
          id: "cp-single",
          component: "ChoicePicker",
          variant: "singleSelection",
          value: { path: "/provider" },
          options: [
            { label: "Anthropic Claude", value: "anthropic" },
            { label: "OpenAI GPT", value: "openai" },
            { label: "Google Gemini", value: "google" },
          ],
        },
        { id: "div", component: "Divider" },
        {
          id: "multi-heading",
          component: "Text",
          text: "Multiple Selection (Checkboxes)",
          variant: "body",
          weight: "bold",
        },
        {
          id: "cp-multi",
          component: "ChoicePicker",
          variant: "multipleSelection",
          value: { path: "/features" },
          options: [
            { label: "Automatic Backups", value: "backup" },
            { label: "WebRTC Peer Sync", value: "webrtc" },
            { label: "In-Browser WebVM", value: "webvm" },
          ],
        },
      ],
      dataModel: { provider: "anthropic", features: ["backup", "webrtc"] },
    }),
};

export const Slider: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "slider-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "s1", "s2"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI Slider Range Controls",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "s1",
          component: "Slider",
          label: "Creativity Level (0 - 100)",
          min: 0,
          max: 100,
          value: { path: "/creativity" },
        },
        {
          id: "s2",
          component: "Slider",
          label: "Max Context Budget (1024 - 8192, step 512)",
          min: 1024,
          max: 8192,
          steps: 512,
          value: { path: "/maxTokens" },
        },
      ],
      dataModel: { creativity: 70, maxTokens: 4096 },
    }),
};

export const DateTimeInput: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "datetime-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["title", "dt-both", "dt-date", "dt-time"],
        },
        {
          id: "title",
          component: "Text",
          text: "A2UI DateTimeInput Variants",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "dt-both",
          component: "DateTimeInput",
          label: "Date & Time (datetime-local)",
          enableDate: true,
          enableTime: true,
          value: "2026-09-03T15:30",
        },
        {
          id: "dt-date",
          component: "DateTimeInput",
          label: "Date Only (date)",
          enableDate: true,
          enableTime: false,
          value: "2026-09-03",
        },
        {
          id: "dt-time",
          component: "DateTimeInput",
          label: "Time Only (time)",
          enableDate: false,
          enableTime: true,
          value: "15:30",
        },
      ],
      dataModel: {},
    }),
};

export const Divider: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "divider-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["t1", "d1", "t2", "d2", "t3"],
        },
        {
          id: "t1",
          component: "Text",
          text: "Section One Content",
          variant: "body",
        },
        { id: "d1", component: "Divider", axis: "horizontal" },
        {
          id: "t2",
          component: "Text",
          text: "Section Two Content",
          variant: "body",
        },
        { id: "d2", component: "Divider", axis: "horizontal" },
        {
          id: "t3",
          component: "Text",
          text: "Section Three Content",
          variant: "body",
        },
      ],
      dataModel: {},
    }),
};

export const Icon: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "icon-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "icon-row"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI Material Symbols Icons",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "icon-row",
          component: "Row",
          justify: "spaceBetween",
          children: ["i1", "i2", "i3", "i4", "i5", "i6"],
        },
        { id: "i1", component: "Icon", name: "smart_toy" },
        { id: "i2", component: "Icon", name: "bolt" },
        { id: "i3", component: "Icon", name: "verified" },
        { id: "i4", component: "Icon", name: "terminal" },
        { id: "i5", component: "Icon", name: "settings" },
        { id: "i6", component: "Icon", name: "folder" },
      ],
      dataModel: {},
    }),
};

export const Image: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "image-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "img"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI Image Component",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "img",
          component: "Image",
          url: sampleSvgImage,
          description: "Responsive banner graphic",
          variant: "mediumFeature",
          fit: "cover",
        },
      ],
      dataModel: {},
    }),
};

export const Video: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "video-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "vid"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI Video Player Component",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "vid",
          component: "Video",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          posterUrl: samplePosterImage,
        },
      ],
      dataModel: {},
    }),
};

export const AudioPlayer: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "audio-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "aud"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI AudioPlayer Component",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "aud",
          component: "AudioPlayer",
          url: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg",
          description: "Assistant alert chime sound effect",
        },
      ],
      dataModel: {},
    }),
};

export const List: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "list-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "list-items"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI List Container",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "list-items",
          component: "List",
          direction: "vertical",
          children: ["card-1", "card-2", "card-3"],
        },
        { id: "card-1", component: "Card", child: "c1-text" },
        {
          id: "c1-text",
          component: "Text",
          text: "Task 1: Compile Rolldown bundles",
        },
        { id: "card-2", component: "Card", child: "c2-text" },
        {
          id: "c2-text",
          component: "Text",
          text: "Task 2: Launch WebRTC signalling mesh",
        },
        { id: "card-3", component: "Card", child: "c3-text" },
        {
          id: "c3-text",
          component: "Text",
          text: "Task 3: Seed offline service worker cache",
        },
      ],
      dataModel: {},
    }),
};

export const Tabs: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "tabs-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        { id: "col", component: "Column", children: ["title", "tabs-ctrl"] },
        {
          id: "title",
          component: "Text",
          text: "A2UI Tabs Container",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "tabs-ctrl",
          component: "Tabs",
          tabs: [
            { title: "General", child: "tab-1-content" },
            { title: "Security", child: "tab-2-content" },
            { title: "Network", child: "tab-3-content" },
          ],
        },
        {
          id: "tab-1-content",
          component: "Text",
          text: "General system overview, diagnostics, and active session telemetry.",
        },
        {
          id: "tab-2-content",
          component: "Text",
          text: "Access control policies, Trusted Types filters, and CSP sandboxes.",
        },
        {
          id: "tab-3-content",
          component: "Text",
          text: "WebRTC peer endpoints, WebSocket bridges, and relay signaling status.",
        },
      ],
      dataModel: {},
    }),
};

export const Modal: Story = {
  render: () =>
    renderA2UIEnvelope({
      type: "createSurface",
      surfaceId: "modal-surface",
      components: [
        { id: "root", component: "Card", child: "col" },
        {
          id: "col",
          component: "Column",
          children: ["title", "desc", "modal-ctrl"],
        },
        {
          id: "title",
          component: "Text",
          text: "A2UI Modal Dialog",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "desc",
          component: "Text",
          text: "Clicking the trigger button opens a focused dialog overlay.",
          variant: "body",
        },
        {
          id: "modal-ctrl",
          component: "Modal",
          trigger: "open-btn",
          content: "dialog-card",
        },
        {
          id: "open-btn",
          component: "Button",
          text: "Trigger Dialog",
          variant: "primary",
        },
        {
          id: "dialog-card",
          component: "Card",
          child: "dialog-col",
        },
        {
          id: "dialog-col",
          component: "Column",
          children: ["dialog-title", "dialog-body", "dialog-close"],
        },
        {
          id: "dialog-title",
          component: "Text",
          text: "Modal Dialog Active",
          variant: "h3",
          weight: "bold",
        },
        {
          id: "dialog-body",
          component: "Text",
          text: "Interactive dialog overlay with focus trap and escape-key dismissal.",
          variant: "body",
        },
        {
          id: "dialog-close",
          component: "Button",
          text: "Dismiss",
          variant: "secondary",
          action: { event: { name: "closeModal" } },
        },
      ],
      dataModel: {},
    }),
};
