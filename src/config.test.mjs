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
  PROVIDERS,
  getProvider,
  getDefaultProvider,
  getAvailableProviders,
  CONFIG_KEYS,
  DEFAULT_DEV_HOST,
  DEFAULT_DEV_IP,
  DEFAULT_DEV_PORT,
} from "./config.mjs";

describe("config.mjs", () => {
  describe("Constants", () => {
    it("should have valid ASSISTANT_NAME", () => {
      expect(ASSISTANT_NAME).toBe("rover");
    });

    it("should have valid context window size", () => {
      expect(CONTEXT_WINDOW_SIZE).toBe(50);
    });

    it("should have valid DEFAULT_MAX_TOKENS", () => {
      expect(DEFAULT_MAX_TOKENS).toBe(8096);
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

    it("should have valid FETCH_MAX_RESPONSE", () => {
      expect(FETCH_MAX_RESPONSE).toBe(20_000);
    });

    it("should have valid DB_NAME", () => {
      expect(DB_NAME).toBe("shadowclaw");
    });

    it("should have valid DB_VERSION", () => {
      expect(DB_VERSION).toBe(1);
    });

    it("should have valid OPFS_ROOT", () => {
      expect(OPFS_ROOT).toBe("shadowclaw");
    });

    it("should have valid DEFAULT_GROUP_ID", () => {
      expect(DEFAULT_GROUP_ID).toBe("br:main");
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
  });

  describe("buildTriggerPattern", () => {
    it("should create a pattern that matches @name at start of message", () => {
      const pattern = buildTriggerPattern("rover");
      expect(pattern.test("@rover hello")).toBe(true);
    });

    it("should create a pattern that matches @name with space prefix", () => {
      const pattern = buildTriggerPattern("rover");
      expect(pattern.test("hey @rover what's up")).toBe(true);
    });

    it("should be case-insensitive", () => {
      const pattern = buildTriggerPattern("rover");
      expect(pattern.test("@Rover")).toBe(true);
      expect(pattern.test("@ROVER")).toBe(true);
    });

    it("should escape special regex characters", () => {
      const pattern = buildTriggerPattern("ro.ver");
      expect(pattern.test("@ro.ver")).toBe(true);
      expect(pattern.test("@rolver")).toBe(false); // . should be literal
    });

    it("should not match @name as part of a longer word", () => {
      const pattern = buildTriggerPattern("rover");
      expect(pattern.test("@rovers")).toBe(false); // word boundary enforced
    });

    it("TRIGGER_PATTERN should be a valid regex", () => {
      expect(TRIGGER_PATTERN).toBeInstanceOf(RegExp);
      expect(TRIGGER_PATTERN.test("@rover")).toBe(true);
    });
  });

  describe("PROVIDERS", () => {
    it("should have openrouter provider", () => {
      expect(PROVIDERS.openrouter).toBeDefined();
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
  });

  describe("CONFIG_KEYS", () => {
    it("should define all required config keys", () => {
      expect(CONFIG_KEYS.PROVIDER).toBe("provider");
      expect(CONFIG_KEYS.API_KEY).toBe("api_key");
      expect(CONFIG_KEYS.TRIGGER_PATTERN).toBe("trigger_pattern");
      expect(CONFIG_KEYS.MODEL).toBe("model");
      expect(CONFIG_KEYS.MAX_TOKENS).toBe("max_tokens");
      expect(CONFIG_KEYS.PASSPHRASE_SALT).toBe("passphrase_salt");
      expect(CONFIG_KEYS.PASSPHRASE_VERIFY).toBe("passphrase_verify");
      expect(CONFIG_KEYS.ASSISTANT_NAME).toBe("assistant_name");
      expect(CONFIG_KEYS.STORAGE_HANDLE).toBe("storage_handle");
      expect(CONFIG_KEYS.GIT_TOKEN).toBe("git_token");
      expect(CONFIG_KEYS.GIT_AUTHOR_NAME).toBe("git_author_name");
      expect(CONFIG_KEYS.GIT_AUTHOR_EMAIL).toBe("git_author_email");
      expect(CONFIG_KEYS.GIT_CORS_PROXY).toBe("git_cors_proxy");
    });
  });

  describe("getProvider", () => {
    it("should return provider config by ID", () => {
      const provider = getProvider("openrouter");
      expect(provider).toBeDefined();
      expect(provider.id).toBe("openrouter");
    });

    it("should return null for unknown provider ID", () => {
      const provider = getProvider("nonexistent");
      expect(provider).toBeNull();
    });

    it("should return null for undefined provider ID", () => {
      const provider = getProvider(undefined);
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

    it("should return only string IDs", () => {
      const providers = getAvailableProviders();
      providers.forEach((id) => {
        expect(typeof id).toBe("string");
      });
    });
  });
});
