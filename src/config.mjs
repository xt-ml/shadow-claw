/** Default assistant name (used in trigger pattern) */
export const ASSISTANT_NAME = "rover";

/**
 * Build a trigger pattern for the assistant name
 * @param {string} name
 *
 * @returns {RegExp}
 */
export function buildTriggerPattern(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${escaped}\\b`, "i");
}

export const TRIGGER_PATTERN = buildTriggerPattern(ASSISTANT_NAME);

/** How many recent messages to include in agent context */
export const CONTEXT_WINDOW_SIZE = 50;

/** Max tokens for API response */
export const DEFAULT_MAX_TOKENS = 8096; //16384

/** Default provider */
export const DEFAULT_PROVIDER = "openrouter";

/** Task scheduler check interval (ms) */
export const SCHEDULER_INTERVAL = 60_000;

/** Message processing loop interval (ms) */
export const PROCESS_LOOP_INTERVAL = 100;

/** Fetch tool response truncation limit */
export const FETCH_MAX_RESPONSE = 20_000;

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

/** Copilot-specific Azure AI Inference proxy endpoint */
export const COPILOT_AZURE_OPENAI_PROXY_URL =
  "http://localhost:8888/copilot-proxy/azure-openai/chat/completions";

/** Verified Copilot Azure models. Keep this as the single allowlist source. */
export const COPILOT_AZURE_OPENAI_ALLOWED_MODELS = ["gpt-4o", "gpt-4o-mini"];

/**
 * @typedef {Object} ProviderConfig
 *
 * @property {string} id
 * @property {string} name
 * @property {string} baseUrl
 * @property {string} format
 * @property {string} apiKeyHeader
 * @property {string} [apiKeyHeaderFormat]
 * @property {Record<string, string>} headers
 * @property {string} defaultModel
 * @property {string[]} [models]
 */

/**
 * LLM Provider definitions
 *
 * Each provider specifies how to make API calls and format messages
 *
 * @type {Record<string, ProviderConfig>}
 */
export const PROVIDERS = {
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai", // uses OpenAI message format
    apiKeyHeader: "Authorization",
    apiKeyHeaderFormat: "Bearer {key}", // {key} will be replaced with actual key
    headers: {
      "HTTP-Referer": "https://shadowclaw.local",
      "X-Title": "ShadowClaw",
    },
    defaultModel: "anthropic/claude-haiku-4.5",
  },
  copilot_azure_openai_proxy: {
    id: "copilot_azure_openai_proxy",
    name: "Copilot Azure OpenAI (Local Proxy)",
    baseUrl: COPILOT_AZURE_OPENAI_PROXY_URL,
    format: "openai",
    apiKeyHeader: "api-key",
    headers: {},
    defaultModel: "gpt-4o-mini",
    models: COPILOT_AZURE_OPENAI_ALLOWED_MODELS,
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
  // },
  // // Future providers can be added here:
  // local: { ... }, // for local LLM servers (e.g., Ollama, LM Studio)
  // prompt_api: { ... }, // for Chrome Built-in AI (browser-native inference via Prompt API)
  // google: { ... }, // for Google models
};

/**
 * Get provider configuration by ID
 * @param {string} providerId - The provider ID (e.g., 'anthropic', 'openrouter')
 *
 * @returns {ProviderConfig|null} - The provider config or null if not found
 */
export function getProvider(providerId) {
  return PROVIDERS[providerId] || null;
}

/**
 * Get the default provider configuration
 *
 * @returns {ProviderConfig} - The default provider config
 */
export function getDefaultProvider() {
  return PROVIDERS[DEFAULT_PROVIDER];
}

/**
 * Get list of available provider IDs
 *
 * @returns {string[]} - Array of provider IDs
 */
export function getAvailableProviders() {
  return Object.keys(PROVIDERS);
}

/**
 * Get the config key used to store an API key for a specific provider.
 *
 * @param {string} providerId
 *
 * @returns {string}
 */
export function getProviderApiKeyConfigKey(providerId) {
  return `api_key:${providerId}`;
}

/** Config keys */
export const CONFIG_KEYS = {
  PROVIDER: "provider",
  API_KEY: "api_key",
  TRIGGER_PATTERN: "trigger_pattern",
  MODEL: "model",
  MAX_TOKENS: "max_tokens",
  PASSPHRASE_SALT: "passphrase_salt",
  PASSPHRASE_VERIFY: "passphrase_verify",
  ASSISTANT_NAME: "assistant_name",
  STORAGE_HANDLE: "storage_handle",
  GIT_TOKEN: "git_token",
  GIT_AUTHOR_NAME: "git_author_name",
  GIT_AUTHOR_EMAIL: "git_author_email",
  GIT_CORS_PROXY: "git_cors_proxy",
  VM_BOOT_MODE: "vm_boot_mode",
  VM_BOOT_HOST: "vm_boot_host",
  VM_NETWORK_RELAY_URL: "vm_network_relay_url",
  VM_BASH_TIMEOUT_SEC: "vm_bash_timeout_sec",
};

/** Default dev server host */
export const DEFAULT_DEV_HOST = "localhost";

/** Default dev server IP */
export const DEFAULT_DEV_IP = "127.0.0.1";

/** Default dev server port */
export const DEFAULT_DEV_PORT = 8888;
