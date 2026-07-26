import { jest } from "@jest/globals";

jest.unstable_mockModule("../../security/crypto.js", () => ({
  encryptValue: jest.fn(async (val: string) => `enc:${val}`),
  decryptValue: jest.fn(async (val: string) => val.replace("enc:", "")),
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: jest.fn(async () => {}),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn(async () => null),
}));

// Now we can import the modules
const { Orchestrator } = await import("./orchestrator.js");
const { encryptValue, decryptValue } = await import("../../security/crypto.js");
const { getApiKeyForHeaders, getApiKeyForRequest } =
  await import("./utils/operations/provider.js");

describe("Orchestrator API Key Hardening", () => {
  const mockApiKey = "test-key-123";

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
    await orchestrator.setApiKey(mockDb, mockApiKey);
    expect(encryptValue).toHaveBeenCalledWith(mockApiKey);
  });

  it("should decrypt the API key on demand via getApiKeyForRequest", async () => {
    await orchestrator.setApiKey(mockDb, mockApiKey);
    const key = await getApiKeyForRequest(orchestrator);

    expect(key).toBe(mockApiKey);
    expect(decryptValue).toHaveBeenCalledWith(`enc:${mockApiKey}`);
  });

  it("should return an empty string from getApiKeyForRequest if no key is set", async () => {
    const key = await getApiKeyForRequest(orchestrator);
    expect(key).toBe("");
  });

  it("should provide a method for model-list headers (getApiKeyForHeaders)", async () => {
    await orchestrator.setApiKey(mockDb, mockApiKey);
    const key = await getApiKeyForHeaders(orchestrator);
    expect(key).toBe(mockApiKey);
  });

  it("isConfigured should return true if an encrypted key exists, without decrypting it", async () => {
    await orchestrator.setApiKey(mockDb, mockApiKey);
    jest.clearAllMocks();

    expect(await orchestrator.getApiKey()).toBe(mockApiKey);
    expect(decryptValue).toHaveBeenCalledTimes(1);
  });

  it("should use the TTL cache for repeated key reads", async () => {
    await orchestrator.setApiKey(mockDb, mockApiKey);
    jest.clearAllMocks();

    await getApiKeyForRequest(orchestrator);
    await getApiKeyForRequest(orchestrator);
    await getApiKeyForRequest(orchestrator);

    // Should only decrypt once due to cache
    expect(decryptValue).toHaveBeenCalledTimes(1);
  });

  it("should invalidate the cache when setApiKey is called", async () => {
    await orchestrator.setApiKey(mockDb, "key-1");
    await getApiKeyForRequest(orchestrator); // decrypt 1

    await orchestrator.setApiKey(mockDb, "key-2");
    const key = await getApiKeyForRequest(orchestrator); // decrypt 2

    expect(key).toBe("key-2");
    expect(decryptValue).toHaveBeenCalledTimes(2);
  });
});
