import {
  ASSISTANT_NAME,
  buildTriggerPattern,
  TRIGGER_PATTERN,
  CONTEXT_WINDOW_SIZE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  SCHEDULER_INTERVAL,
  PROCESS_LOOP_INTERVAL,
  FETCH_MAX_RESPONSE,
  DB_NAME,
  DB_VERSION,
  OPFS_ROOT,
  DEFAULT_GROUP_ID,
  COPILOT_AZURE_OPENAI_PROXY_URL,
  GITHUB_MODELS_PROXY_URL,
  GITHUB_MODELS_PROXY_MODELS_URL,
  TRANSFORMERS_JS_PROXY_URL,
  TRANSFORMERS_JS_PROXY_MODELS_URL,
  LLAMAFILE_PROXY_URL,
  LLAMAFILE_PROXY_MODELS_URL,
  PROVIDERS,
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES,
  PROVIDER_AUTH_CAPABILITIES,
  OAUTH_PROVIDER_DEFINITIONS,
  getProvider,
  getGeneralAccountProviderCapabilities,
  getProviderTokenAuthScheme,
  getProviderAuthCapabilities,
  getOAuthProviderDefinition,
  getDefaultProvider,
  getAvailableProviders,
  getProviderApiKeyConfigKey,
  CONFIG_KEYS,
  DEFAULT_VM_BOOT_HOST,
  DEFAULT_DEV_HOST,
  DEFAULT_DEV_IP,
  DEFAULT_DEV_PORT,
  getModelMaxTokens,
} from "./config.js";
import { modelRegistry } from "./model-registry.js";

describe("config.js", () => {
  beforeEach(() => {
    modelRegistry.models.clear();
  });

  describe("Constants", () => {
    it("should have valid ASSISTANT_NAME", () => {
      expect(ASSISTANT_NAME).toBe("k9");
    });

    it("should have valid context window size", () => {
      expect(CONTEXT_WINDOW_SIZE).toBe(50);
    });

    it("should have valid DEFAULT_MAX_TOKENS", () => {
      expect(DEFAULT_MAX_TOKENS).toBe(8192);
    });

    it("should have valid DEFAULT_PROVIDER", () => {
      expect(DEFAULT_PROVIDER).toBe("openrouter");
    });

    it("should have valid SCHEDULER_INTERVAL", () => {
      expect(SCHEDULER_INTERVAL).toBe(60_000);
    });

    it("should have valid PROCESS_LOOP_INTERVAL", () => {
      expect(PROCESS_LOOP_INTERVAL).toBe(100);
    });

    it("should have FETCH_MAX_RESPONSE set to 100KB to match documentation", () => {
      expect(FETCH_MAX_RESPONSE).toBe(102_400);
    });

    it("should have valid DB_NAME", () => {
      expect(DB_NAME).toBe("shadowclaw");
    });

    it("should have valid DB_VERSION", () => {
      expect(DB_VERSION).toBe(2);
    });

    it("should have valid OPFS_ROOT", () => {
      expect(OPFS_ROOT).toBe("shadowclaw");
    });

    it("should have valid DEFAULT_GROUP_ID", () => {
      expect(DEFAULT_GROUP_ID).toBe("br:main");
    });

    it("should have valid Copilot Azure proxy URL", () => {
      expect(COPILOT_AZURE_OPENAI_PROXY_URL).toBe(
        "http://localhost:8888/copilot-proxy/azure-openai/chat/completions",
      );
    });

    it("should have valid GitHub Models proxy URLs", () => {
      expect(GITHUB_MODELS_PROXY_URL).toBe(
        "http://localhost:8888/github-models-proxy/inference/chat/completions",
      );
      expect(GITHUB_MODELS_PROXY_MODELS_URL).toBe(
        "http://localhost:8888/github-models-proxy/catalog/models",
      );
    });

    it("should have valid Llamafile proxy URLs", () => {
      expect(LLAMAFILE_PROXY_URL).toBe(
        "http://localhost:8888/llamafile-proxy/chat/completions",
      );
      expect(LLAMAFILE_PROXY_MODELS_URL).toBe(
        "http://localhost:8888/llamafile-proxy/models",
      );
    });

    it("should have valid DEFAULT_DEV_HOST", () => {
      expect(DEFAULT_DEV_HOST).toBe("localhost");
    });

    it("should have valid DEFAULT_DEV_IP", () => {
      expect(DEFAULT_DEV_IP).toBe("127.0.0.1");
    });

    it("should have valid DEFAULT_DEV_PORT", () => {
      expect(DEFAULT_DEV_PORT).toBe(8888);
    });

    it("should have valid DEFAULT_VM_BOOT_HOST", () => {
      expect(DEFAULT_VM_BOOT_HOST).toBe("http://localhost:8888");
    });
  });

  describe("buildTriggerPattern", () => {
    it("should create a pattern that matches @name at start of message", () => {
      const pattern = buildTriggerPattern("k9");
      expect(pattern.test("@k9 hello")).toBe(true);
    });

    it("should create a pattern that matches @name with space prefix", () => {
      const pattern = buildTriggerPattern("k9");
      expect(pattern.test("hey @k9 what's up")).toBe(true);
    });

    it("should be case-insensitive", () => {
      const pattern = buildTriggerPattern("k9");
      expect(pattern.test("@k9")).toBe(true);
      expect(pattern.test("@K9")).toBe(true);
    });

    it("should escape special regex characters", () => {
      const pattern = buildTriggerPattern("ro.ver");
      expect(pattern.test("@ro.ver")).toBe(true);
      expect(pattern.test("@rolver")).toBe(false); // . should be literal
    });

    it("should not match @name as part of a longer word", () => {
      const pattern = buildTriggerPattern("k9");
      expect(pattern.test("@k9s")).toBe(false); // word boundary enforced
    });

    it("TRIGGER_PATTERN should be a valid regex", () => {
      expect(TRIGGER_PATTERN).toBeInstanceOf(RegExp);
      expect(TRIGGER_PATTERN.test("@k9")).toBe(true);
    });
  });

  describe("PROVIDERS", () => {
    it("should have openrouter provider", () => {
      expect(PROVIDERS.openrouter).toBeDefined();
    });

    it("should have copilot azure proxy provider", () => {
      expect(PROVIDERS.copilot_azure_openai_proxy).toBeDefined();
    });

    it("should have prompt api provider", () => {
      expect(PROVIDERS.prompt_api).toBeDefined();
    });

    it("should have github models provider", () => {
      expect(PROVIDERS.github_models).toBeDefined();
    });

    it("should have llamafile provider", () => {
      expect(PROVIDERS.llamafile).toBeDefined();
    });

    it("should have transformers js local provider", () => {
      expect(PROVIDERS.transformers_js_local).toBeDefined();
    });

    it("openrouter should have required fields", () => {
      const provider = PROVIDERS.openrouter;
      expect(provider.id).toBe("openrouter");
      expect(provider.name).toBe("OpenRouter");
      expect(provider.baseUrl).toBeDefined();
      expect(provider.format).toBe("openai");
      expect(provider.apiKeyHeader).toBe("Authorization");
      expect(provider.apiKeyHeaderFormat).toBe("Bearer {key}");
      expect(provider.headers).toBeDefined();
      expect(provider.defaultModel).toBeDefined();
    });

    it("copilot proxy provider should have required fields", () => {
      const provider = PROVIDERS.copilot_azure_openai_proxy;
      expect(provider.id).toBe("copilot_azure_openai_proxy");
      expect(provider.name).toBe("Copilot / GitHub Models (Local Proxy)");
      expect(provider.baseUrl).toBe(COPILOT_AZURE_OPENAI_PROXY_URL);
      expect(provider.format).toBe("openai");
      expect(provider.apiKeyHeader).toBe("api-key");
      expect(provider.defaultModel).toBe("gpt-4o-mini");
      expect(provider.modelsUrl).toBeDefined();
    });

    it("github models provider should have required fields", () => {
      const provider = PROVIDERS.github_models;
      expect(provider.id).toBe("github_models");
      expect(provider.name).toBe("GitHub Models (Local Proxy)");
      expect(provider.baseUrl).toBe(GITHUB_MODELS_PROXY_URL);
      expect(provider.modelsUrl).toBe(GITHUB_MODELS_PROXY_MODELS_URL);
      expect(provider.format).toBe("openai");
      expect(provider.apiKeyHeader).toBe("api-key");
      expect(provider.defaultModel).toBe("openai/gpt-4.1-mini");
      expect(provider.supportsStreaming).toBe(true);
    });

    it("llamafile provider should have required fields", () => {
      const provider = PROVIDERS.llamafile;
      expect(provider.id).toBe("llamafile");
      expect(provider.name).toBe("Llamafile (Local Proxy)");
      expect(provider.baseUrl).toBe(LLAMAFILE_PROXY_URL);
      expect(provider.modelsUrl).toBe(LLAMAFILE_PROXY_MODELS_URL);
      expect(provider.format).toBe("openai");
      expect(provider.requiresApiKey).toBe(false);
      expect(provider.supportsStreaming).toBe(true);
    });

    it("transformers js local provider should have required fields", () => {
      const provider = PROVIDERS.transformers_js_local;
      expect(provider.id).toBe("transformers_js_local");
      expect(provider.name).toBe("Transformers.js (Local Proxy)");
      expect(provider.baseUrl).toBe(TRANSFORMERS_JS_PROXY_URL);
      expect(provider.modelsUrl).toBe(TRANSFORMERS_JS_PROXY_MODELS_URL);
      expect(provider.format).toBe("openai");
      expect(provider.requiresApiKey).toBe(false);
      expect(provider.defaultModel).toBe("onnx-community/gemma-4-E2B-it-ONNX");
    });

    it("prompt api provider should be keyless and experimental", () => {
      const provider = PROVIDERS.prompt_api;
      expect(provider.id).toBe("prompt_api");
      expect(provider.format).toBe("prompt_api");
      expect(provider.requiresApiKey).toBe(false);
      expect(Array.isArray(provider.models)).toBe(true);
      expect(provider.defaultModel).toBe("browser-built-in");
      expect(provider.models).toContain("browser-built-in");
      expect(provider.models).toContain("gemini-nano");
      expect(provider.models).toContain("phi-4-mini");
    });

    describe("supportsStreaming", () => {
      it("every provider should explicitly declare supportsStreaming", () => {
        for (const [_id, config] of Object.entries(PROVIDERS)) {
          expect(typeof config.supportsStreaming).toBe("boolean");
        }
      });

      it("openrouter should support streaming (native SSE endpoint)", () => {
        expect(PROVIDERS.openrouter.supportsStreaming).toBe(true);
      });

      it("bedrock_proxy should support streaming (InvokeModelWithResponseStreamCommand)", () => {
        expect(PROVIDERS.bedrock_proxy.supportsStreaming).toBe(true);
      });

      it("copilot_azure_openai_proxy should support streaming (SSE passthrough)", () => {
        expect(PROVIDERS.copilot_azure_openai_proxy.supportsStreaming).toBe(
          true,
        );
      });

      it("github_models should support streaming (SSE passthrough)", () => {
        expect(PROVIDERS.github_models.supportsStreaming).toBe(true);
      });

      it("prompt_api should NOT support streaming via SSE (uses dedicated path)", () => {
        expect(PROVIDERS.prompt_api.supportsStreaming).toBe(false);
      });

      it("llamafile should support streaming (CLI SSE adaptation or SERVER passthrough)", () => {
        expect(PROVIDERS.llamafile.supportsStreaming).toBe(true);
      });

      it("transformers_js_local should support streaming via SSE", () => {
        expect(PROVIDERS.transformers_js_local.supportsStreaming).toBe(true);
      });
    });
  });

  describe("PROVIDER_AUTH_CAPABILITIES", () => {
    it("should expose dual-mode auth for GitHub", () => {
      const github = PROVIDER_AUTH_CAPABILITIES.github;
      expect(github).toBeDefined();
      expect(github.modes).toContain("oauth");
      expect(github.modes).toContain("pat");
      expect(github.defaultMode).toBe("oauth");
    });

    it("should return capability metadata for known provider IDs", () => {
      const caps = getProviderAuthCapabilities("gitlab");
      expect(caps).toBeDefined();
      expect(caps?.providerId).toBe("gitlab");
      expect(caps?.modes).toEqual(["oauth", "pat"]);
    });

    it("should return null for unknown capability provider IDs", () => {
      expect(getProviderAuthCapabilities("unknown")).toBeNull();
    });
  });

  describe("GENERAL_ACCOUNT_PROVIDER_CAPABILITIES", () => {
    it("should expose a single capability object per provider", () => {
      const github = GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.github;
      expect(github).toBeDefined();
      expect(github.providerId).toBe("github");
      expect(github.tokenAuth.pat.headerName).toBe("Authorization");
      expect(github.oauth?.authorizeUrl).toContain("github.com");
    });

    it("should include additional pre-configured providers for future onboarding", () => {
      expect(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.atlassian).toBeDefined();
      expect(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.slack).toBeDefined();
      expect(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.linear).toBeDefined();
    });

    it("should expose Figma OAuth as basic-header client auth", () => {
      const figma = GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.figma;
      expect(figma.oauth?.clientAuthMethod).toBe("basic_header");
      expect(figma.oauth?.scopeSeparator).toBe("space");
    });

    it("should include service/auth taxonomy for custom MCP", () => {
      const customMcp = GENERAL_ACCOUNT_PROVIDER_CAPABILITIES.custom_mcp;
      expect(customMcp.serviceTypes).toContain("mcp_remote");
      expect(customMcp.serviceTypes).toContain("webmcp_local");
      expect(customMcp.authTypes).toContain("oauth");
      expect(customMcp.authTypes).toContain("pat");
      expect(customMcp.authTypes).toContain("ssh_key");
    });

    it("should return unified capability metadata by provider ID", () => {
      const provider = getGeneralAccountProviderCapabilities("slack");
      expect(provider).toBeDefined();
      expect(provider?.providerId).toBe("slack");
      expect(provider?.oauth?.tokenUrl).toContain("slack.com");
    });

    it("should return null for unknown unified capability provider IDs", () => {
      expect(getGeneralAccountProviderCapabilities("unknown")).toBeNull();
    });

    it("should resolve service-type specific auth scheme for azure devops git remote", () => {
      const scheme = getProviderTokenAuthScheme(
        "azure_devops",
        "pat",
        "git_remote",
      );
      expect(scheme).toEqual({
        headerName: "Authorization",
        headerPrefix: "Basic ",
      });
    });

    it("should fall back to default auth scheme when service type override is absent", () => {
      const scheme = getProviderTokenAuthScheme("github", "pat", "http_api");
      expect(scheme).toEqual({
        headerName: "Authorization",
        headerPrefix: "token ",
      });
    });
  });

  describe("OAUTH_PROVIDER_DEFINITIONS", () => {
    it("should include GitHub OAuth endpoints", () => {
      const github = OAUTH_PROVIDER_DEFINITIONS.github;
      expect(github).toBeDefined();
      expect(github.authorizeUrl).toContain("github.com");
      expect(github.tokenUrl).toContain("github.com");
      expect(github.usePkce).toBe(true);
    });

    it("should return OAuth provider definition by ID", () => {
      const provider = getOAuthProviderDefinition("google");
      expect(provider).toBeDefined();
      expect(provider?.id).toBe("google");
      expect(provider?.authorizeUrl).toContain("accounts.google.com");
    });

    it("should return null for unknown OAuth provider IDs", () => {
      expect(getOAuthProviderDefinition("unknown")).toBeNull();
    });

    it("should not force default scopes for Figma", () => {
      const figma = getOAuthProviderDefinition("figma");
      expect(figma).toBeDefined();
      expect(figma?.defaultScopes).toEqual([]);
      expect(figma?.clientAuthMethod).toBe("basic_header");
      expect(figma?.scopeSeparator).toBe("space");
    });

    it("should include Yahoo Mail OAuth endpoints", () => {
      const yahoo = getOAuthProviderDefinition("yahoo_mail");
      expect(yahoo).toBeDefined();
      expect(yahoo?.authorizeUrl).toContain("api.login.yahoo.com");
      expect(yahoo?.tokenUrl).toContain("api.login.yahoo.com");
      expect(yahoo?.defaultScopes).toEqual(["mail-r", "mail-w"]);
    });
  });

  describe("CONFIG_KEYS", () => {
    it("should define all required config keys", () => {
      expect(CONFIG_KEYS.PROVIDER).toBe("provider");
      expect(CONFIG_KEYS.API_KEY).toBe("api_key");
      expect(CONFIG_KEYS.CHANNEL_ENABLED_PREFIX).toBe("channel_enabled:");
      expect(CONFIG_KEYS.TELEGRAM_BOT_TOKEN).toBe("telegram_bot_token");
      expect(CONFIG_KEYS.TELEGRAM_CHAT_IDS).toBe("telegram_chat_ids");
      expect(CONFIG_KEYS.TELEGRAM_USE_PROXY).toBe("telegram_use_proxy");
      expect(CONFIG_KEYS.IMESSAGE_SERVER_URL).toBe("imessage_server_url");
      expect(CONFIG_KEYS.IMESSAGE_API_KEY).toBe("imessage_api_key");
      expect(CONFIG_KEYS.IMESSAGE_CHAT_IDS).toBe("imessage_chat_ids");
      expect(CONFIG_KEYS.TRIGGER_PATTERN).toBe("trigger_pattern");
      expect(CONFIG_KEYS.MODEL).toBe("model");
      expect(CONFIG_KEYS.MAX_TOKENS).toBe("max_tokens");
      expect(CONFIG_KEYS.PASSPHRASE_SALT).toBe("passphrase_salt");
      expect(CONFIG_KEYS.PASSPHRASE_VERIFY).toBe("passphrase_verify");
      expect(CONFIG_KEYS.ASSISTANT_NAME).toBe("assistant_name");
      expect(CONFIG_KEYS.STORAGE_HANDLE).toBe("storage_handle");
      expect(CONFIG_KEYS.SERVICE_ACCOUNTS).toBe("service_accounts");
      expect(CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT).toBe(
        "service_default_account",
      );
      expect(CONFIG_KEYS.GIT_TOKEN).toBe("git_token");
      expect(CONFIG_KEYS.GIT_AUTHOR_NAME).toBe("git_author_name");
      expect(CONFIG_KEYS.GIT_AUTHOR_EMAIL).toBe("git_author_email");
      expect(CONFIG_KEYS.GIT_CORS_PROXY).toBe("git_cors_proxy");
      expect(CONFIG_KEYS.VM_BOOT_MODE).toBe("vm_boot_mode");
      expect(CONFIG_KEYS.VM_BOOT_HOST).toBe("vm_boot_host");
      expect(CONFIG_KEYS.VM_NETWORK_RELAY_URL).toBe("vm_network_relay_url");
      expect(CONFIG_KEYS.VM_BASH_TIMEOUT_SEC).toBe("vm_bash_timeout_sec");
      expect(CONFIG_KEYS.REMOTE_MCP_CONNECTIONS).toBe("remote_mcp_connections");
      expect(CONFIG_KEYS.INTEGRATION_CONNECTIONS).toBe(
        "integration_connections",
      );
      expect(CONFIG_KEYS.WEBMCP_TOOLS_ENABLED).toBe("webmcp_tools_enabled");
      expect((CONFIG_KEYS as any).TASK_SYNC_OUTBOX).toBe("task_sync_outbox");
      expect(CONFIG_KEYS.LLAMAFILE_MODE).toBe("llamafile_mode");
      expect(CONFIG_KEYS.LLAMAFILE_HOST).toBe("llamafile_host");
      expect(CONFIG_KEYS.LLAMAFILE_PORT).toBe("llamafile_port");
      expect(CONFIG_KEYS.LLAMAFILE_OFFLINE).toBe("llamafile_offline");
      expect(CONFIG_KEYS.BEDROCK_REGION_FALLBACK).toBe(
        "bedrock_region_fallback",
      );
      expect(CONFIG_KEYS.BEDROCK_PROFILE_FALLBACK).toBe(
        "bedrock_profile_fallback",
      );
      expect(CONFIG_KEYS.BEDROCK_AUTH_MODE).toBe("bedrock_auth_mode");
      expect(CONFIG_KEYS.RATE_LIMIT_CALLS_PER_MINUTE).toBe(
        "rate_limit_calls_per_minute",
      );
      expect(CONFIG_KEYS.RATE_LIMIT_AUTO_ADAPT).toBe("rate_limit_auto_adapt");
      expect(CONFIG_KEYS.SIDEBAR_WIDTH).toBe("sidebar_width");
      expect(CONFIG_KEYS.CHAT_INPUT_AREA_HEIGHT).toBe("chat_input_area_height");
    });

    it("should include STREAMING_ENABLED config key", () => {
      expect(CONFIG_KEYS.STREAMING_ENABLED).toBe("streaming_enabled");
    });

    it("should include LAST_ACTIVE_GROUP config key", () => {
      expect(CONFIG_KEYS.LAST_ACTIVE_GROUP).toBe("last_active_group");
    });
  });

  describe("getProvider", () => {
    it("should return provider config by ID", () => {
      const provider = getProvider("openrouter");
      expect(provider).toBeDefined();

      expect(provider!.id).toBe("openrouter");
    });

    it("should return null for unknown provider ID", () => {
      const provider = getProvider("nonexistent");
      expect(provider).toBeNull();
    });

    it("should return null for undefined provider ID", () => {
      const provider = getProvider(undefined as any);
      expect(provider).toBeNull();
    });
  });

  describe("getDefaultProvider", () => {
    it("should return the default provider configuration", () => {
      const provider = getDefaultProvider();
      expect(provider).toBeDefined();
      expect(provider.id).toBe(DEFAULT_PROVIDER);
    });

    it("default provider should be valid openrouter config", () => {
      const provider = getDefaultProvider();
      expect(provider.name).toBe("OpenRouter");
      expect(provider.format).toBe("openai");
    });
  });

  describe("getAvailableProviders", () => {
    it("should return array of provider IDs", () => {
      const providers = getAvailableProviders();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it("should include openrouter in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("openrouter");
    });

    it("should include copilot azure proxy in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("copilot_azure_openai_proxy");
    });

    it("should include prompt api in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("prompt_api");
    });

    it("should include github models in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("github_models");
    });

    it("should include llamafile in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("llamafile");
    });

    it("should include transformers js local in available providers", () => {
      const providers = getAvailableProviders();
      expect(providers).toContain("transformers_js_local");
    });

    it("should return only string IDs", () => {
      const providers = getAvailableProviders();
      providers.forEach((id) => {
        expect(typeof id).toBe("string");
      });
    });
  });

  describe("getProviderApiKeyConfigKey", () => {
    it("should return a provider-scoped API key config key", () => {
      expect(getProviderApiKeyConfigKey("openrouter")).toBe(
        "api_key:openrouter",
      );

      expect(getProviderApiKeyConfigKey("copilot_azure_openai_proxy")).toBe(
        "api_key:copilot_azure_openai_proxy",
      );

      expect(getProviderApiKeyConfigKey("github_models")).toBe(
        "api_key:github_models",
      );
    });
  });

  describe("getModelMaxTokens", () => {
    it("should return 128000 for Claude Opus 4.x models", () => {
      expect(getModelMaxTokens("anthropic.claude-opus-4-6-v1")).toBe(128000);
      expect(getModelMaxTokens("claude-opus-4-6")).toBe(128000);
      expect(getModelMaxTokens("anthropic/claude-opus-4-6")).toBe(128000);
    });

    it("should return 64000 for Claude Sonnet 4.x models", () => {
      expect(getModelMaxTokens("anthropic.claude-sonnet-4-6-v1:0")).toBe(64000);
      expect(getModelMaxTokens("claude-sonnet-4-6")).toBe(64000);
      expect(getModelMaxTokens("anthropic/claude-sonnet-4-6")).toBe(64000);
    });

    it("should return 64000 for Claude Haiku 4.x models", () => {
      expect(
        getModelMaxTokens("anthropic.claude-haiku-4-5-20251001-v1:0"),
      ).toBe(64000);
      expect(getModelMaxTokens("claude-haiku-4-5")).toBe(64000);
    });

    it("should return 8192 for Claude 3.5 models", () => {
      expect(getModelMaxTokens("anthropic/claude-3-5-sonnet")).toBe(8192);
      expect(getModelMaxTokens("claude-3-5-haiku")).toBe(8192);
    });

    it("should return 4096 for Claude 3 models", () => {
      expect(getModelMaxTokens("anthropic/claude-3-opus")).toBe(4096);
      expect(getModelMaxTokens("claude-3-haiku")).toBe(4096);
    });

    it("should return 16384 for GPT-4o models", () => {
      expect(getModelMaxTokens("gpt-4o")).toBe(16384);
      expect(getModelMaxTokens("gpt-4o-mini")).toBe(16384);
    });

    it("should return 8192 for GPT-4 models", () => {
      expect(getModelMaxTokens("gpt-4-turbo")).toBe(8192);
      expect(getModelMaxTokens("gpt-4")).toBe(8192);
    });

    it("should return DEFAULT_MAX_TOKENS for unknown models", () => {
      expect(getModelMaxTokens("some-unknown-model")).toBe(DEFAULT_MAX_TOKENS);
      expect(getModelMaxTokens("browser-built-in")).toBe(DEFAULT_MAX_TOKENS);
    });

    it("should return DEFAULT_MAX_TOKENS for empty/null model", () => {
      expect(getModelMaxTokens("")).toBe(DEFAULT_MAX_TOKENS);

      expect(getModelMaxTokens(null as any)).toBe(DEFAULT_MAX_TOKENS);

      expect(getModelMaxTokens(undefined as any)).toBe(DEFAULT_MAX_TOKENS);
    });

    it("should keep generous dynamic limits for hosted model IDs", () => {
      modelRegistry.registerModelInfo("openai/gpt-4.1", {
        contextWindow: 128000,
        maxOutput: null,
      });

      expect(getModelMaxTokens("openai/gpt-4.1")).toBe(32768);
    });
  });
});
