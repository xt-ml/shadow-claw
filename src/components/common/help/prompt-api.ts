import type { AppDialogOptions } from "../../../ui/types.js";

export const PROMPT_API_DOCS_URL =
  "https://developer.chrome.com/docs/ai/built-in";

/**
 * Checks whether native browser Prompt API is detected in the current runtime.
 */
export function isNativePromptApiSupported(): boolean {
  if (typeof window === "undefined" && typeof globalThis === "undefined") {
    return false;
  }

  const g = (typeof window !== "undefined" ? window : globalThis) as any;

  if (g.LanguageModel && typeof g.LanguageModel.create === "function") {
    return true;
  }

  if (g.ai?.languageModel && typeof g.ai.languageModel.create === "function") {
    return true;
  }

  return false;
}

/**
 * Checks whether native browser Prompt API is potentially supported in the current environment
 * (e.g. Chrome or Edge on non-Apple platforms).
 */
export function isPromptApiPotentiallySupported(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent.toLowerCase();
  const isApple =
    ua.includes("mac") ||
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod");

  if (isApple) {
    return false;
  }

  return ua.includes("chrome") || ua.includes("edg");
}

/**
 * Renders status and instruction markup for the Prompt API onboarding dialog.
 */
export function renderPromptApiStatusHtml(isNativeSupported: boolean): string {
  if (isNativeSupported) {
    return `<div class="chat__prompt-api-badge chat__prompt-api-badge--success">&#10003; Native Prompt API detected</div>
<p class="chat__prompt-api-status-note">Your browser has built-in on-device AI support enabled.</p>`;
  }

  return `<div class="chat__prompt-api-badge chat__prompt-api-badge--warning">&#9888;&#65039; Native Prompt API not detected &mdash; using local ONNX fallback</div>
<div class="chat__prompt-api-instructions">
  <p class="chat__prompt-api-instructions-title"><strong>To enable native Prompt API in your browser:</strong></p>
  <ol class="chat__prompt-api-steps">
    <li>Navigate to <code>chrome://flags</code> (or <code>edge://flags</code>)</li>
    <li>Enable <code>#prompt-api-for-gemini-nano</code> (or <code>#prompt-api</code>) and <code>#enables-optimization-guide-on-device-model</code></li>
    <li>Visit <code>chrome://components</code> (or <code>edge://components</code>) and click <em>Check for update</em> next to the on-device model component</li>
    <li>Restart your browser</li>
  </ol>
</div>`;
}

/**
 * Builds dialog options for Prompt API error and help prompts.
 */
export function buildPromptApiHelpDialogOptions(
  reason?: string,
): AppDialogOptions {
  const details = [
    "ShadowClaw uses the browser-native Prompt API for local, private AI inference.",
    "If native browser Prompt API is unavailable, ShadowClaw falls back to running a local ONNX model in your browser (defaulting to Qwen 0.6B).",
    "To enable native Prompt API: enable the Prompt API flags and optimization guide under your browser's experimental flags (chrome://flags or edge://flags).",
  ];

  if (reason && reason.trim()) {
    details.push(`Details: ${reason.trim()}`);
  }

  return {
    mode: "info",
    title: "Prompt API Setup & Info",
    message: "ShadowClaw is configured to use the browser-native Prompt API.",
    details,
    confirmLabel: "OK",
    links: [
      {
        label: "Prompt API Documentation",
        href: PROMPT_API_DOCS_URL,
      },
    ],
  };
}
