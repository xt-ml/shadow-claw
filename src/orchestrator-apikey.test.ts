import { jest } from "@jest/globals";

// In ESM, we must use unstable_mockModule BEFORE importing the module under test
jest.unstable_mockModule("./crypto.js", () => ({
  encryptValue: jest.fn(async (val: string) => `enc:${val}`),
  decryptValue: jest.fn(async (val: string) => val.replace("enc:", "")),
}));

jest.unstable_mockModule("./db/setConfig.js", () => ({
  setConfig: jest.fn(async () => {}),
}));

jest.unstable_mockModule("./db/getConfig.js", () => ({
  getConfig: jest.fn(async () => null),
}));

// Now we can import the modules
const { Orchestrator } = await import("./orchestrator.js");
const { encryptValue, decryptValue } = await import("./crypto.js");

describe("Orchestrator API Key Hardening", () => {
  let orchestrator: any;
  let mockDb: any;

  beforeEach(() => {
    orchestrator = new Orchestrator();
    mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          get: jest.fn(() => ({ onsuccess: null, onerror: null })),
          put: jest.fn(() => ({ onsuccess: null, onerror: null })),
        })),
      })),
    } as any;
    jest.clearAllMocks();
  });

  it("should not expose apiKey as a public field", () => {
    expect(orchestrator.apiKey).toBeUndefined();
  });

  it("should encrypt the API key when calling setApiKey", async () => {
    await orchestrator.setApiKey(mockDb, "test-key-123");
    expect(encryptValue).toHaveBeenCalledWith("test-key-123");
  });

  it("should decrypt the API key on demand via getApiKeyForRequest", async () => {
    await orchestrator.setApiKey(mockDb, "test-key-123");
    const key = await orchestrator.getApiKeyForRequest();

    expect(key).toBe("test-key-123");
    expect(decryptValue).toHaveBeenCalledWith("enc:test-key-123");
  });

  it("should return an empty string from getApiKeyForRequest if no key is set", async () => {
    const key = await orchestrator.getApiKeyForRequest();
    expect(key).toBe("");
  });

  it("should provide a method for model-list headers (getApiKeyForHeaders)", async () => {
    await orchestrator.setApiKey(mockDb, "test-key-123");
    const key = await orchestrator.getApiKeyForHeaders();
    expect(key).toBe("test-key-123");
  });

  it("isConfigured should return true if an encrypted key exists, without decrypting it", async () => {
    await orchestrator.setApiKey(mockDb, "test-key-123");
    jest.clearAllMocks();

    expect(orchestrator.isConfigured()).toBe(true);
    expect(decryptValue).not.toHaveBeenCalled();
  });

  it("should use the TTL cache for repeated key reads", async () => {
    await orchestrator.setApiKey(mockDb, "test-key-123");
    jest.clearAllMocks();

    await orchestrator.getApiKeyForRequest();
    await orchestrator.getApiKeyForRequest();
    await orchestrator.getApiKeyForRequest();

    // Should only decrypt once due to cache
    expect(decryptValue).toHaveBeenCalledTimes(1);
  });

  it("should invalidate the cache when setApiKey is called", async () => {
    await orchestrator.setApiKey(mockDb, "key-1");
    await orchestrator.getApiKeyForRequest(); // decrypt 1

    await orchestrator.setApiKey(mockDb, "key-2");
    const key = await orchestrator.getApiKeyForRequest(); // decrypt 2

    expect(key).toBe("key-2");
    expect(decryptValue).toHaveBeenCalledTimes(2);
  });
});
