import { getProvider } from "../../../config.js";
import type { AppDialogOptions } from "../../../types.js";

export type ProviderHelpType =
  | "api-key-missing"
  | "api-key-invalid"
  | "provider-unreachable"
  | "rate-limited";

const PROVIDER_HELP_LINKS: Record<string, { label: string; href: string }> = {
  openrouter: {
    label: "OpenRouter API Keys",
    href: "https://openrouter.ai/keys",
  },
  huggingface: {
    label: "HuggingFace Access Tokens",
    href: "https://huggingface.co/settings/tokens",
  },
  github_models: {
    label: "GitHub Personal Access Tokens",
    href: "https://github.com/settings/personal-access-tokens",
  },
  copilot_azure_openai_proxy: {
    label: "GitHub Models Docs",
    href: "https://docs.github.com/en/github-models",
  },
  bedrock_proxy: {
    label: "AWS Bedrock Setup",
    href: "https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html",
  },
  ollama: {
    label: "Install Ollama",
    href: "https://ollama.com/download",
  },
};

const LOCAL_PROXY_PROVIDER_IDS = new Set([
  "ollama",
  "bedrock_proxy",
  "github_models",
  "copilot_azure_openai_proxy",
  "llamafile",
  "transformers_js_local",
]);

function getProviderLabel(providerId: string): string {
  return getProvider(providerId)?.name || providerId;
}

export function detectProviderHelpType(
  providerId: string,
  reason: string,
  requiresApiKey: boolean,
): ProviderHelpType | null {
  void providerId;

  const normalized = (reason || "").toLowerCase();

  if (!normalized) {
    return null;
  }

  if (
    requiresApiKey &&
    (normalized.includes("api key not configured") ||
      normalized.includes("go to settings to add your api key") ||
      normalized.includes("missing api key") ||
      normalized.includes("no api key"))
  ) {
    return "api-key-missing";
  }

  if (
    requiresApiKey &&
    (normalized.includes("invalid api key") ||
      normalized.includes("incorrect api key") ||
      normalized.includes("authentication failed") ||
      normalized.includes("401") ||
      normalized.includes("403") ||
      normalized.includes("unauthorized") ||
      normalized.includes("forbidden"))
  ) {
    return "api-key-invalid";
  }

  if (
    normalized.includes("429") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "rate-limited";
  }

  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network error") ||
    normalized.includes("econnrefused") ||
    normalized.includes("connection refused") ||
    normalized.includes("enotfound") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("503") ||
    normalized.includes("502")
  ) {
    return "provider-unreachable";
  }

  return null;
}

export function buildProviderHelpDialogOptions(
  providerId: string,
  helpType: ProviderHelpType,
  reason?: string,
): AppDialogOptions {
  const providerLabel = getProviderLabel(providerId);
  const links = PROVIDER_HELP_LINKS[providerId]
    ? [PROVIDER_HELP_LINKS[providerId]]
    : [];

  const details: string[] = [];
  let title = `${providerLabel} Issue`;
  let message = `ShadowClaw hit a ${providerLabel} provider error.`;

  if (helpType === "api-key-missing") {
    title = `${providerLabel} API Key Required`;
    message = `${providerLabel} needs an API key before requests can run.`;
    details.push(
      "Open Settings > LLM and enter an API key for the active provider.",
    );
    details.push("Click Save API Key, then retry your message.");
  } else if (helpType === "api-key-invalid") {
    title = `${providerLabel} Authentication Failed`;
    message = `${providerLabel} rejected the current API key.`;
    details.push("Generate or copy a fresh API key for this provider.");
    details.push(
      "Open Settings > LLM, replace the key, click Save API Key, then retry.",
    );
  } else if (helpType === "provider-unreachable") {
    title = `${providerLabel} Not Reachable`;
    message = `ShadowClaw could not reach ${providerLabel}.`;
    if (LOCAL_PROXY_PROVIDER_IDS.has(providerId)) {
      details.push(
        "Make sure the local ShadowClaw server is running (npm start) and the proxy URL in Settings is correct.",
      );
      details.push(
        "If this provider depends on another local runtime, verify it is running too.",
      );
    } else {
      details.push(
        "Check internet connectivity and confirm the provider service is available.",
      );
      details.push(
        "If you are using a proxy or VPN, ensure requests to the provider are allowed.",
      );
    }
  } else if (helpType === "rate-limited") {
    title = `${providerLabel} Rate Limited`;
    message = `${providerLabel} is throttling requests right now.`;
    details.push("Wait a moment and retry the request.");
    details.push(
      "If this keeps happening, switch to a lower-traffic model or reduce request frequency.",
    );
  }

  if (reason && reason.trim()) {
    details.push(`Details: ${reason.trim()}`);
  }

  return {
    mode: "info",
    title,
    message,
    details,
    links,
    confirmLabel: "OK",
  };
}
