import { jest } from "@jest/globals";
import { TextDecoder, TextEncoder } from "util";

const originalIndexedDb = globalThis.indexedDB;
const originalCrypto = globalThis.crypto;
const originalTextEncoder = globalThis.TextEncoder;
const originalTextDecoder = globalThis.TextDecoder;

describe("crypto helpers", () => {
  beforeEach(() => {
    jest.resetModules();

    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;

    const keyStore = new Map();
    const db = {
      createObjectStore: jest.fn(),
      close: jest.fn(),
      transaction: (_name, mode) => {
        const tx = {
          objectStore: () => ({
            get: () => {
              const req = {};
              setTimeout(() => {
                req.result = keyStore.get("api-key-encryption");
                req.onsuccess?.();
              }, 0);
              return req;
            },
            put: (value, key) => {
              keyStore.set(key, value);
              setTimeout(() => tx.oncomplete?.(), 0);
            },
          }),
        };
        if (mode === "readonly") {
          tx.objectStore = () => ({
            get: () => {
              const req = {};
              setTimeout(() => {
                req.result = keyStore.get("api-key-encryption");
                req.onsuccess?.();
              }, 0);
              return req;
            },
          });
        }
        return tx;
      },
    };

    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      writable: true,
      value: {
        open: () => {
          const req = { result: db };
          setTimeout(() => {
            req.onupgradeneeded?.();
            req.onsuccess?.();
          }, 0);
          return req;
        },
      },
    });

    const subtle = {
      generateKey: jest.fn(async () => ({ kid: "k1" })),
      encrypt: jest.fn(async (_cfg, _key, bytes) => {
        const arr = new Uint8Array(bytes);
        return arr.map((n) => (n + 1) % 256).buffer;
      }),
      decrypt: jest.fn(async (_cfg, _key, bytes) => {
        const arr = new Uint8Array(bytes);
        return arr.map((n) => (n + 255) % 256).buffer;
      }),
    };

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: {
        subtle,
        getRandomValues: (arr) => {
          arr.fill(1);
          return arr;
        },
      },
    });
  });

  afterAll(() => {
    globalThis.indexedDB = originalIndexedDb;
    globalThis.crypto = originalCrypto;
    globalThis.TextEncoder = originalTextEncoder;
    globalThis.TextDecoder = originalTextDecoder;
  });

  it("encrypts and decrypts values", async () => {
    const { encryptValue, decryptValue } = await import("./crypto.mjs");

    const encoded = await encryptValue("secret");
    const plain = await decryptValue(encoded);

    expect(typeof encoded).toBe("string");
    expect(plain).toBe("secret");
  });
});
