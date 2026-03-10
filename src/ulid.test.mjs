import { jest } from "@jest/globals";

describe("ulid", () => {
  let originalNow;
  let originalCrypto;

  async function loadUlid() {
    jest.resetModules();
    const mod = await import("./ulid.mjs");
    return mod.ulid;
  }

  beforeEach(() => {
    originalNow = Date.now;
    originalCrypto = globalThis.crypto;
  });

  afterEach(() => {
    Date.now = originalNow;
    globalThis.crypto = originalCrypto;
  });

  it("generates a 26-char Crockford base32 ULID", async () => {
    Date.now = jest.fn(() => 1700000000000);
    globalThis.crypto = {
      getRandomValues: jest.fn((arr) => {
        arr.fill(7);
        return arr;
      }),
    };

    const ulid = await loadUlid();

    const id = ulid();

    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("is monotonic within the same millisecond", async () => {
    Date.now = jest.fn(() => 1700000000000);
    globalThis.crypto = {
      getRandomValues: jest.fn((arr) => {
        arr.fill(0);
        return arr;
      }),
    };

    const ulid = await loadUlid();

    const first = ulid();
    const second = ulid();

    expect(second).not.toBe(first);
    expect(second > first).toBe(true);
  });

  it("re-seeds random component when timestamp changes", async () => {
    const getRandomValues = jest.fn((arr) => {
      arr.fill(3);
      return arr;
    });

    let call = 0;
    Date.now = jest.fn(() => {
      call += 1;
      return 1700000000000 + (call > 1 ? 1 : 0);
    });

    globalThis.crypto = {
      getRandomValues,
    };

    const ulid = await loadUlid();

    const first = ulid();
    const second = ulid();

    expect(first.slice(0, 10)).not.toBe(second.slice(0, 10));
    expect(second).not.toBe(first);
  });
});
