import { modelRegistry } from "./model-registry.js";

/** Default assistant name (used in trigger pattern) */

export const ASSISTANT_NAME = "k9";

/**
 * Build a trigger pattern for the assistant name
 */
export function buildTriggerPattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`(^|\\s)@${escaped}\\b`, "i");
}

export const TRIGGER_PATTERN = buildTriggerPattern(ASSISTANT_NAME);

/** How many recent messages to include in agent context */
export const CONTEXT_WINDOW_SIZE = 50;

/** Max tokens for API response (fallback for unknown models) */
export const DEFAULT_MAX_TOKENS = 8192;

/** Default max tool-use iterations per invocation */
export const DEFAULT_MAX_ITERATIONS = 50;

/**
 * Model-specific max output token limits.
 * Matched in order — first pattern whose string appears in the model ID wins.
 * More specific entries must come before broader ones.
 *
 * Sources:
 *   Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
 *   OpenAI:    https://platform.openai.com/docs/models
 */
export const MODEL_OUTPUT_LIMITS: Array<{
  pattern: string;
  maxTokens: number;
}> = [
  // Anthropic Claude Opus 4.x — 128k max output
  { pattern: "claude-opus-4", maxTokens: 128000 },
  // Anthropic Claude Sonnet 4.x — 64k max output
  { pattern: "claude-sonnet-4", maxTokens: 64000 },
  // Anthropic Claude Haiku 4.x — 64k max output
  { pattern: "claude-haiku-4", maxTokens: 64000 },
  // Anthropic Claude 3.5 family — 8192 max output
  { pattern: "claude-3-5", maxTokens: 8192 },
  // Anthropic Claude 3 family — 4096 max output
  { pattern: "claude-3", maxTokens: 4096 },
  // OpenAI GPT-4o variants — 16384 max output
  { pattern: "gpt-4o", maxTokens: 16384 },
  // OpenAI GPT-4 (non-4o) — 8192 max output
  { pattern: "gpt-4", maxTokens: 8192 },
  // OpenAI GPT-3.5 — 4096 max output
  { pattern: "gpt-3.5", maxTokens: 4096 },
  // Qwen 2.5 family — 32k+ max output
  { pattern: "qwen-2.5", maxTokens: 32768 },
  // OpenRouter Free — generous 32k fallback for routing
  { pattern: "openrouter/free", maxTokens: 32768 },
  // Ollama Qwen3 8B — 4096 max output
  { pattern: "qwen3:8b", maxTokens: 4096 },
  // Ollama Llama3 8B — 8192 max output (if you use it)
  { pattern: "llama3:8b", maxTokens: 8192 },
];

/**
 * Resolve max output tokens for a model ID.
 * Falls back to DEFAULT_MAX_TOKENS for unknown models.
 */
export function getModelMaxTokens(modelId: string): number {
  if (!modelId) {
    return DEFAULT_MAX_TOKENS;
  }

  // Check dynamic registry first
  const info = modelRegistry.getModelInfo(modelId);
  if (info) {
    // If the provider specifies maxOutput natively:
    if (typeof info.maxOutput === "number") {
      // If the provider set maxOutput equal to the total contextWindow (e.g. Nemotron=128k),
      // we must cap it so total requested tokens don't exceed the window.
      // E.g. Math.min(128000, 32768) prevents 400 errors for long outputs.
      const safeMax = info.contextWindow
        ? Math.max(8192, Math.floor(info.contextWindow / 2))
        : 32768;

      return Math.min(info.maxOutput, safeMax);
    }

    // Registry hit but no explicit maxOutput.
    // Use half the context window for smaller models, capped generously at 32k.
    if (info.contextWindow) {
      return Math.min(32768, Math.floor(info.contextWindow / 2));
    }
  }

  for (const { pattern, maxTokens } of MODEL_OUTPUT_LIMITS) {
    if (modelId.includes(pattern)) {
      return maxTokens;
    }
  }

  return DEFAULT_MAX_TOKENS;
}

/** Default provider */
export const DEFAULT_PROVIDER = "openrouter";

/** Task scheduler check interval (ms) */
export const SCHEDULER_INTERVAL = 60_000;

/** Message processing loop interval (ms) */
export const PROCESS_LOOP_INTERVAL = 100;

/** Fetch tool response truncation limit (100 KB to match tool description) */
export const FETCH_MAX_RESPONSE = 102_400;

/** Default bash tool timeout in WebVM (seconds) */
export const BASH_DEFAULT_TIMEOUT_SEC = 900;

/** Max bash tool timeout in WebVM (seconds) */
export const BASH_MAX_TIMEOUT_SEC = 1_800;

/** Default VM network relay URL */
export const DEFAULT_VM_NETWORK_RELAY_URL = "wss://relay.widgetry.org/";

/**
 * Default hosted WebVM asset root used by Settings and worker startup when
 * vm_boot_host has never been configured.
 */
export const DEFAULT_VM_BOOT_HOST = "http://localhost:8888";

/** IndexedDB database name */
export const DB_NAME = "shadowclaw";

/** IndexedDB version */
export const DB_VERSION = 1;

/** OPFS root directory name */
export const OPFS_ROOT = "shadowclaw";

/** Default group for browser chat */
export const DEFAULT_GROUP_ID = "br:main";

/** Telegram Bot API base URL */
export const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/** Same-origin Telegram proxy base URL */
export const TELEGRAM_PROXY_BASE = "/telegram/bot";

/** Telegram message length limit */
export const TELEGRAM_MAX_LENGTH = 4096;

/** Telegram long-poll timeout in seconds */
export const TELEGRAM_POLL_TIMEOUT = 30;

/** iMessage bridge long-poll timeout in seconds */
export const IMESSAGE_POLL_TIMEOUT = 25;

/** iMessage bridge request timeout in milliseconds */
export const IMESSAGE_REQUEST_TIMEOUT_MS = 15000;

/** Bedrock proxy endpoint (models fetched dynamically) */
export const BEDROCK_PROXY_URL = "http://localhost:8888/bedrock-proxy/invoke";

/** Bedrock proxy models endpoint */
export const BEDROCK_PROXY_MODELS_URL =
  "http://localhost:8888/bedrock-proxy/models";
export const COPILOT_AZURE_OPENAI_PROXY_URL =
  "http://localhost:8888/copilot-proxy/azure-openai/chat/completions";
export const GITHUB_MODELS_PROXY_URL =
  "http://localhost:8888/github-models-proxy/inference/chat/completions";
export const GITHUB_MODELS_PROXY_MODELS_URL =
  "http://localhost:8888/github-models-proxy/catalog/models";

/** Transformers.js local proxy endpoint (Node-side inference) */
export const TRANSFORMERS_JS_PROXY_URL =
  "http://localhost:8888/transformers-js-proxy/chat/completions";

/** Transformers.js local proxy models endpoint */
export const TRANSFORMERS_JS_PROXY_MODELS_URL =
  "http://localhost:8888/transformers-js-proxy/models";

/** Llamafile proxy endpoint (local binary execution) */
export const LLAMAFILE_PROXY_URL =
  "http://localhost:8888/llamafile-proxy/chat/completions";

/** Llamafile proxy models endpoint */
export const LLAMAFILE_PROXY_MODELS_URL =
  "http://localhost:8888/llamafile-proxy/models";

/** Ollama proxy endpoint (local LLM server) */
export const OLLAMA_PROXY_URL =
  "http://localhost:8888/ollama-proxy/chat/completions";

/** Ollama proxy models endpoint */
export const OLLAMA_PROXY_MODELS_URL =
  "http://localhost:8888/ollama-proxy/models";

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  format: string;
  apiKeyHeader: string;
  apiKeyHeaderFormat?: string;
  headers: Record<string, string>;
  defaultModel: string;
  models?: string[];
  modelsUrl?: string;
  requiresApiKey?: boolean;
  /**
   * Whether the provider endpoint returns SSE streams.
   * When true, the proxy must support returning an SSE stream when the request
   * includes `stream: true`. The orchestrator will only enable streaming when
   * this flag is explicitly `true`.
   */
  supportsStreaming?: boolean;
}

export type ProviderAuthMode = "pat" | "oauth";

export type ServiceType =
  | "http_api"
  | "git_remote"
  | "mcp_remote"
  | "webmcp_local";

export type AuthType =
  | "none"
  | "pat"
  | "oauth"
  | "basic_userpass"
  | "custom_header"
  | "ssh_key";

export type OAuthClientAuthMethod = "request_body" | "basic_header";

export type OAuthScopeSeparator = "space" | "comma";

export interface ProviderTokenAuthScheme {
  headerName: string;
  headerPrefix?: string;
}

export interface OAuthProviderFlowCapabilities {
  authorizeUrl: string;
  tokenUrl: string;
  refreshUrl?: string;
  redirectUri?: string;
  defaultScopes: string[];
  usePkce: boolean;
  clientAuthMethod: OAuthClientAuthMethod;
  scopeSeparator: OAuthScopeSeparator;
}

export interface GeneralAccountProviderCapabilities {
  providerId: string;
  name: string;
  aliases?: string[];
  modes: ProviderAuthMode[];
  defaultMode: ProviderAuthMode;
  serviceTypes?: ServiceType[];
  authTypes?: AuthType[];
  tokenAuth: {
    pat: ProviderTokenAuthScheme;
    oauth: ProviderTokenAuthScheme;
  };
  tokenAuthByServiceType?: Partial<
    Record<
      ServiceType,
      {
        pat: ProviderTokenAuthScheme;
        oauth: ProviderTokenAuthScheme;
      }
    >
  >;
  oauth?: OAuthProviderFlowCapabilities;
}

export interface ProviderAuthCapabilities {
  providerId: string;
  modes: ProviderAuthMode[];
  defaultMode: ProviderAuthMode;
}

export interface OAuthProviderDefinition {
  id: string;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri?: string;
  defaultScopes: string[];
  usePkce: boolean;
  clientAuthMethod?: OAuthClientAuthMethod;
  scopeSeparator?: OAuthScopeSeparator;
}

/**
 * Unified provider capability catalog for "General Accounts".
 *
 * Goal: onboarding providers should be mostly data/configuration, not custom code.
 * This schema covers auth modes, OAuth endpoints/settings, and request auth headers.
 */
export const GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: Record<
  string,
  GeneralAccountProviderCapabilities
> = {
  github: {
    providerId: "github",
    name: "GitHub",
    aliases: ["github", "api.github.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api", "git_remote"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "token " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      defaultScopes: ["repo", "read:user"],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  gitlab: {
    providerId: "gitlab",
    name: "GitLab",
    aliases: ["gitlab", "gitlab.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api", "git_remote"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "PRIVATE-TOKEN", headerPrefix: "" },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    tokenAuthByServiceType: {
      git_remote: {
        pat: { headerName: "Authorization", headerPrefix: "Bearer " },
        oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
      },
    },
    oauth: {
      authorizeUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      defaultScopes: ["read_api", "read_user"],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  figma: {
    providerId: "figma",
    name: "Figma",
    aliases: ["figma", "api.figma.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "X-Figma-Token", headerPrefix: "" },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      refreshUrl: "https://api.figma.com/v1/oauth/refresh",
      // Leave empty so no scope param is sent unless user explicitly overrides.
      // When entering multiple scopes, separate them with spaces.
      defaultScopes: [],
      usePkce: true,
      clientAuthMethod: "basic_header",
      scopeSeparator: "space",
    },
  },
  notion: {
    providerId: "notion",
    name: "Notion",
    aliases: ["notion", "api.notion.com", "notion.so"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
      tokenUrl: "https://api.notion.com/v1/oauth/token",
      defaultScopes: [],
      usePkce: true,
      clientAuthMethod: "basic_header",
      scopeSeparator: "space",
    },
  },
  microsoft_graph: {
    providerId: "microsoft_graph",
    name: "Microsoft Graph",
    aliases: ["microsoft", "graph.microsoft.com", "microsoft_graph"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl:
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      defaultScopes: ["openid", "profile", "offline_access", "User.Read"],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  google: {
    providerId: "google",
    name: "Google",
    aliases: ["google", "googleapis.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      defaultScopes: ["openid", "profile", "email"],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  atlassian: {
    providerId: "atlassian",
    name: "Atlassian",
    aliases: ["atlassian", "api.atlassian.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api", "git_remote"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://auth.atlassian.com/authorize",
      tokenUrl: "https://auth.atlassian.com/oauth/token",
      defaultScopes: [],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  slack: {
    providerId: "slack",
    name: "Slack",
    aliases: ["slack", "slack.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      defaultScopes: [],
      usePkce: false,
      clientAuthMethod: "request_body",
      scopeSeparator: "comma",
    },
  },
  linear: {
    providerId: "linear",
    name: "Linear",
    aliases: ["linear", "api.linear.app", "linear.app"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api"],
    authTypes: ["pat", "oauth"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://linear.app/oauth/authorize",
      tokenUrl: "https://api.linear.app/oauth/token",
      defaultScopes: [],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  azure_devops: {
    providerId: "azure_devops",
    name: "Azure DevOps",
    aliases: ["azure_devops", "dev.azure.com"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["http_api", "git_remote"],
    authTypes: ["pat", "oauth", "basic_userpass", "ssh_key"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    tokenAuthByServiceType: {
      git_remote: {
        pat: { headerName: "Authorization", headerPrefix: "Basic " },
        oauth: { headerName: "Authorization", headerPrefix: "Basic " },
      },
    },
    oauth: {
      authorizeUrl: "https://app.vssps.visualstudio.com/oauth2/authorize",
      tokenUrl: "https://app.vssps.visualstudio.com/oauth2/token",
      defaultScopes: ["vso.code", "vso.profile", "offline_access"],
      usePkce: false,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
  custom_mcp: {
    providerId: "custom_mcp",
    name: "Custom MCP",
    aliases: ["custom_mcp"],
    modes: ["oauth", "pat"],
    defaultMode: "oauth",
    serviceTypes: ["mcp_remote", "webmcp_local"],
    authTypes: ["none", "pat", "oauth", "custom_header", "ssh_key"],
    tokenAuth: {
      pat: { headerName: "Authorization", headerPrefix: "Bearer " },
      oauth: { headerName: "Authorization", headerPrefix: "Bearer " },
    },
    oauth: {
      authorizeUrl: "https://example.com/oauth/authorize",
      tokenUrl: "https://example.com/oauth/token",
      defaultScopes: [],
      usePkce: true,
      clientAuthMethod: "request_body",
      scopeSeparator: "space",
    },
  },
};

/**
 * OAuth provider catalog used by both UI and server-side allowlist enforcement.
 * Only providers listed here can be used by /oauth/authorize.
 */
export const OAUTH_PROVIDER_DEFINITIONS: Record<
  string,
  OAuthProviderDefinition
> = Object.fromEntries(
  Object.values(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES)
    .filter((provider) => !!provider.oauth)
    .map((provider) => {
      const oauth = provider.oauth!;

      return [
        provider.providerId,
        {
          id: provider.providerId,
          name: provider.name,
          authorizeUrl: oauth.authorizeUrl,
          tokenUrl: oauth.tokenUrl,
          redirectUri: oauth.redirectUri,
          defaultScopes: oauth.defaultScopes,
          usePkce: oauth.usePkce,
          clientAuthMethod: oauth.clientAuthMethod,
          scopeSeparator: oauth.scopeSeparator,
        },
      ];
    }),
) as Record<string, OAuthProviderDefinition>;

/**
 * Provider-level auth mode support for non-LLM endpoint credentials.
 * Used by Accounts and tool auth resolution to support dual-mode PAT/OAuth flows.
 */
export const PROVIDER_AUTH_CAPABILITIES: Record<
  string,
  ProviderAuthCapabilities
> = Object.fromEntries(
  Object.values(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES).map((provider) => [
    provider.providerId,
    {
      providerId: provider.providerId,
      modes: provider.modes,
      defaultMode: provider.defaultMode,
    },
  ]),
) as Record<string, ProviderAuthCapabilities>;

/**
 * LLM Provider definitions
 *
 * Each provider specifies how to make API calls and format messages
 *
 */
export const PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai", // uses OpenAI message format
    apiKeyHeader: "Authorization",
    apiKeyHeaderFormat: "Bearer {key}", // {key} will be replaced with actual key
    headers: {
      "HTTP-Referer": "https://xt-ml.github.io/shadow-claw/",
      "X-OpenRouter-Title": "ShadowClaw",
    },
    defaultModel: "openrouter/free",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    requiresApiKey: true,
    supportsStreaming: true,
  },
  huggingface: {
    id: "huggingface",
    name: "HuggingFace",
    baseUrl: "https://router.huggingface.co/v1/chat/completions",
    format: "openai",
    apiKeyHeader: "Authorization",
    apiKeyHeaderFormat: "Bearer {key}",
    headers: {},
    defaultModel: "meta-llama/Llama-3.1-8B-Instruct",
    modelsUrl: "https://router.huggingface.co/v1/models",
    requiresApiKey: true,
    supportsStreaming: true,
  },
  github_models: {
    id: "github_models",
    name: "GitHub Models (Local Proxy)",
    baseUrl: GITHUB_MODELS_PROXY_URL,
    format: "openai",
    apiKeyHeader: "api-key",
    headers: {},
    defaultModel: "openai/gpt-4.1-mini",
    modelsUrl: GITHUB_MODELS_PROXY_MODELS_URL,
    requiresApiKey: true,
    supportsStreaming: true,
  },
  copilot_azure_openai_proxy: {
    id: "copilot_azure_openai_proxy",
    name: "Copilot / GitHub Models (Local Proxy)",
    baseUrl: COPILOT_AZURE_OPENAI_PROXY_URL,
    format: "openai",
    apiKeyHeader: "api-key",
    headers: {},
    defaultModel: "gpt-4o-mini",
    modelsUrl: "http://localhost:8888/copilot-proxy/azure-openai/models",
    requiresApiKey: true,
    supportsStreaming: true, // proxy pipes upstream SSE stream when stream: true
  },
  bedrock_proxy: {
    id: "bedrock_proxy",
    name: "AWS Bedrock (Local Proxy)",
    baseUrl: BEDROCK_PROXY_URL,
    format: "anthropic",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "anthropic.claude-sonnet-4-6-v1:0",
    modelsUrl: BEDROCK_PROXY_MODELS_URL,
    requiresApiKey: false,
    supportsStreaming: true, // proxy uses InvokeModelWithResponseStreamCommand when stream: true
  },
  ollama: {
    id: "ollama",
    name: "Ollama (Local Proxy)",
    baseUrl: OLLAMA_PROXY_URL,
    format: "openai",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "qwen3:8b",
    modelsUrl: OLLAMA_PROXY_MODELS_URL,
    requiresApiKey: false,
    supportsStreaming: true,
  },
  llamafile: {
    id: "llamafile",
    name: "Llamafile (Local Proxy)",
    baseUrl: LLAMAFILE_PROXY_URL,
    format: "openai",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "Qwen3.5-9B-Q5_K_S",
    modelsUrl: LLAMAFILE_PROXY_MODELS_URL,
    requiresApiKey: false,
    supportsStreaming: true,
  },
  transformers_js_local: {
    id: "transformers_js_local",
    name: "Transformers.js (Local Proxy)",
    baseUrl: TRANSFORMERS_JS_PROXY_URL,
    format: "openai",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "onnx-community/gemma-4-E2B-it-ONNX",
    modelsUrl: TRANSFORMERS_JS_PROXY_MODELS_URL,
    models: [
      "onnx-community/gemma-3-1b-it-ONNX",
      "onnx-community/gemma-3-1b-it-ONNX-GQA",
      "onnx-community/gemma-4-E2B-it-ONNX",
      "onnx-community/gemma-4-E4B-it-ONNX",
      "onnx-community/gemma-4-E9B-it-ONNX",
      "onnx-community/gemma-4-E27B-it-ONNX",
      "onnx-community/Phi-3.5-mini-instruct-onnx-web",
      "onnx-community/Phi-4-mini-instruct-ONNX",
      "onnx-community/Llama-3.2-1B-Instruct-ONNX",
      "onnx-community/Llama-3.2-3B-Instruct-ONNX",
      "webgpu/Qwen3-4B-ONNX",
      "onnx-community/Qwen3-0.6B-ONNX",
      "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
      "onnx-community/gpt-oss-20b-ONNX",
      "onnx-community/LFM2-1.2B-ONNX",
      "LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
      "HuggingFaceTB/SmolLM3-3B-ONNX",
      "onnx-community/Qwen3.5-0.8B-ONNX-OPT",
      "onnx-community/Qwen3.5-4B-ONNX-OPT",
    ],
    requiresApiKey: false,
    supportsStreaming: true,
  },
  transformers_js_browser: {
    id: "transformers_js_browser",
    name: "Transformers.js (Browser - No Proxy - Experimental)",
    baseUrl: "local://transformers-js",
    format: "transformers_js",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "onnx-community/gemma-4-E2B-it-ONNX",
    modelsUrl: "https://huggingface.co/api/models?author=onnx-community",
    models: [
      "onnx-community/gemma-3-1b-it-ONNX",
      "onnx-community/gemma-3-1b-it-ONNX-GQA",
      "onnx-community/gemma-4-E2B-it-ONNX",
      "onnx-community/gemma-4-E4B-it-ONNX",
      "onnx-community/gemma-4-E9B-it-ONNX",
      "onnx-community/gemma-4-E27B-it-ONNX",
      "onnx-community/Phi-3.5-mini-instruct-onnx-web",
      "onnx-community/Phi-4-mini-instruct-ONNX",
      "onnx-community/Llama-3.2-1B-Instruct-ONNX",
      "onnx-community/Llama-3.2-3B-Instruct-ONNX",
      "webgpu/Qwen3-4B-ONNX",
      "onnx-community/Qwen3-0.6B-ONNX",
      "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX",
      "onnx-community/gpt-oss-20b-ONNX",
      "onnx-community/LFM2-1.2B-ONNX",
      "LiquidAI/LFM2.5-1.2B-Thinking-ONNX",
      "HuggingFaceTB/SmolLM3-3B-ONNX",
      "onnx-community/Qwen3.5-0.8B-ONNX-OPT",
      "onnx-community/Qwen3.5-4B-ONNX-OPT",
    ],
    requiresApiKey: false,
    supportsStreaming: false, // Handled via dedicated path
  },
  prompt_api: {
    id: "prompt_api",
    name: "Web Prompt API (Experimental)",
    baseUrl: "builtin://language-model",
    format: "prompt_api",
    apiKeyHeader: "Authorization",
    headers: {},
    defaultModel: "browser-built-in",
    models: ["browser-built-in", "gemini-nano", "phi-4-mini"],
    requiresApiKey: false,
    supportsStreaming: false, // handled via dedicated Prompt API path, not SSE
  },
  // anthropic: {
  //   id: "anthropic",
  //   name: "Anthropic (Claude)",
  //   baseUrl: "https://api.anthropic.com/v1/messages",
  //   format: "anthropic", // native Anthropic message format
  //   apiKeyHeader: "x-api-key",
  //   headers: {
  //     "anthropic-version": "2023-06-01",
  //     "anthropic-dangerous-direct-browser-access": "true",
  //   },
  //   defaultModel: "claude-sonnet-4-6",
  //   supportsStreaming: true,
  // },
  // // Future providers can be added here:
  // local: { ... }, // for local LLM servers (e.g., Ollama, LM Studio)
  // google: { ... }, // for Google models
};

/**
 * Get provider configuration by ID
 */
export function getProvider(providerId: string): ProviderConfig | null {
  return PROVIDERS[providerId] || null;
}

/**
 * Get the default provider configuration
 */
export function getDefaultProvider(): ProviderConfig {
  return PROVIDERS[DEFAULT_PROVIDER];
}

/**
 * Get list of available provider IDs
 */
export function getAvailableProviders(): string[] {
  return Object.keys(PROVIDERS);
}

/**
 * Get the config key used to store an API key for a specific provider.
 */
export function getProviderApiKeyConfigKey(providerId: string): string {
  return `api_key:${providerId}`;
}

export function getGeneralAccountProviderCapabilities(
  providerId: string,
): GeneralAccountProviderCapabilities | null {
  return GENERAL_ACCOUNT_PROVIDER_CAPABILITIES[providerId] || null;
}

export function getProviderTokenAuthScheme(
  providerId: string,
  authMode: ProviderAuthMode,
  serviceType: ServiceType = "http_api",
): ProviderTokenAuthScheme | null {
  const provider = getGeneralAccountProviderCapabilities(providerId);
  if (!provider) {
    return null;
  }

  const byServiceType =
    provider.tokenAuthByServiceType?.[serviceType]?.[authMode];
  if (byServiceType) {
    return byServiceType;
  }

  return provider.tokenAuth[authMode] || null;
}

export function getProviderAuthCapabilities(
  providerId: string,
): ProviderAuthCapabilities | null {
  return PROVIDER_AUTH_CAPABILITIES[providerId] || null;
}

export function getOAuthProviderDefinition(
  providerId: string,
): OAuthProviderDefinition | null {
  return OAUTH_PROVIDER_DEFINITIONS[providerId] || null;
}

/** Config keys */
export const CONFIG_KEYS = {
  PROVIDER: "provider",
  API_KEY: "api_key",
  CHANNEL_ENABLED_PREFIX: "channel_enabled:",
  TELEGRAM_BOT_TOKEN: "telegram_bot_token",
  TELEGRAM_CHAT_IDS: "telegram_chat_ids",
  TELEGRAM_USE_PROXY: "telegram_use_proxy",
  IMESSAGE_SERVER_URL: "imessage_server_url",
  IMESSAGE_API_KEY: "imessage_api_key",
  IMESSAGE_CHAT_IDS: "imessage_chat_ids",
  TRIGGER_PATTERN: "trigger_pattern",
  MODEL: "model",
  MAX_TOKENS: "max_tokens",
  PASSPHRASE_SALT: "passphrase_salt",
  PASSPHRASE_VERIFY: "passphrase_verify",
  ASSISTANT_NAME: "assistant_name",
  STORAGE_HANDLE: "storage_handle",
  SERVICE_ACCOUNTS: "service_accounts",
  SERVICE_DEFAULT_ACCOUNT: "service_default_account",
  GIT_TOKEN: "git_token",
  GIT_USERNAME: "git_username",
  GIT_PASSWORD: "git_password",
  GIT_AUTHOR_NAME: "git_author_name",
  GIT_AUTHOR_EMAIL: "git_author_email",
  GIT_CORS_PROXY: "git_cors_proxy",
  GIT_ACCOUNTS: "git_accounts",
  GIT_DEFAULT_ACCOUNT: "git_default_account",
  VM_BOOT_MODE: "vm_boot_mode",
  VM_BOOT_HOST: "vm_boot_host",
  VM_NETWORK_RELAY_URL: "vm_network_relay_url",
  VM_BASH_TIMEOUT_SEC: "vm_bash_timeout_sec",
  ENABLED_TOOLS: "enabled_tools",
  CUSTOM_TOOLS: "custom_tools",
  SYSTEM_PROMPT_OVERRIDE: "system_prompt_override",
  TOOL_PROFILES: "tool_profiles",
  ACTIVE_TOOL_PROFILE: "active_tool_profile",
  WEBMCP_TOOLS_ENABLED: "webmcp_tools_enabled",
  WEBMCP_MODE: "webmcp_mode",
  STREAMING_ENABLED: "streaming_enabled",
  MAX_ITERATIONS: "max_iterations",
  RATE_LIMIT_CALLS_PER_MINUTE: "rate_limit_calls_per_minute",
  RATE_LIMIT_AUTO_ADAPT: "rate_limit_auto_adapt",
  TASK_SYNC_OUTBOX: "task_sync_outbox",
  LAST_ACTIVE_GROUP: "last_active_group",
  CONVERSATIONS_HEIGHT: "conversations_height",
  SIDEBAR_WIDTH: "sidebar_width",
  CHAT_INPUT_AREA_HEIGHT: "chat_input_area_height",
  VAPID_SUBJECT: "vapid_subject",
  USE_PROXY: "use_proxy",
  PROXY_URL: "proxy_url",
  GIT_PROXY_URL: "git_proxy_url",
  PUSH_PROXY_URL: "push_proxy_url",
  TASK_SERVER_URL: "task_server_url",
  REMOTE_MCP_CONNECTIONS: "remote_mcp_connections",
  CONTEXT_COMPRESSION_ENABLED: "context_compression_enabled",
  TRANSFORMERS_JS_BACKEND: "transformers_js_backend",
  TRANSFORMERS_JS_DTYPE_STRATEGY: "transformers_js_dtype_strategy",
  DIRECT_TOOL_COMMAND_POLICY: "direct_tool_command_policy",
  LLAMAFILE_MODE: "llamafile_mode",
  LLAMAFILE_HOST: "llamafile_host",
  LLAMAFILE_PORT: "llamafile_port",
  LLAMAFILE_OFFLINE: "llamafile_offline",
  BEDROCK_REGION_FALLBACK: "bedrock_region_fallback",
  BEDROCK_PROFILE_FALLBACK: "bedrock_profile_fallback",
  LAST_ACTIVE_PAGE: "last_active_page",
};

/** Default dev server host */
export const DEFAULT_DEV_HOST = "localhost";

/** Default dev server IP */
export const DEFAULT_DEV_IP = "127.0.0.1";

/** Default dev server port */
export const DEFAULT_DEV_PORT = 8888;
