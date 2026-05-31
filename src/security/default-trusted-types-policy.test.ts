import { afterEach, describe, expect, it, jest } from "@jest/globals";

import {
  ensureDefaultTrustedTypesPolicy,
  toDefaultTrustedScriptUrl,
} from "./default-trusted-types-policy.js";

const originalTrustedTypes = globalThis.trustedTypes;

afterEach(() => {
  delete (
    globalThis as typeof globalThis & {
      __shadowClawDefaultTrustedTypesPolicyState?: unknown;
    }
  ).__shadowClawDefaultTrustedTypesPolicyState;

  if (originalTrustedTypes === undefined) {
    delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
      .trustedTypes;
  } else {
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: originalTrustedTypes,
    });
  }
});

describe("ensureDefaultTrustedTypesPolicy", () => {
  it("creates the default policy when getPolicy is unavailable", () => {
    const createPolicy = jest.fn();

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    ensureDefaultTrustedTypesPolicy();

    expect(createPolicy).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        createHTML: expect.any(Function),
        createScriptURL: expect.any(Function),
      }),
    );
  });

  it("does not recreate the policy when default already exists", () => {
    const createPolicy = jest.fn();
    const getPolicy = jest.fn((_name: string) => ({
      createHTML: (input: string) => input,
    }));

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
        getPolicy,
      },
    });

    ensureDefaultTrustedTypesPolicy();

    expect(getPolicy).toHaveBeenCalledWith("default");
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it("creates a fallback policy when default exists but cannot be retrieved", () => {
    const trustedScriptUrl = {
      toString: () => "trusted:service-worker.js",
    };
    const createScriptURL = jest.fn((_url: string) => trustedScriptUrl);
    const createPolicy = jest.fn((_name: string, _rules: object) => ({
      createHTML: (input: string) => input,
      createScriptURL,
    }));
    const getPolicyNames = jest.fn(() => ["default", "shadowclaw"]);

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
        getPolicyNames,
      },
    });

    const url = toDefaultTrustedScriptUrl("service-worker.js") as {
      toString: () => string;
    };

    expect(getPolicyNames).toHaveBeenCalledTimes(1);
    expect(createPolicy).toHaveBeenCalledWith(
      "shadowclaw-sandbox",
      expect.objectContaining({
        createHTML: expect.any(Function),
        createScriptURL: expect.any(Function),
      }),
    );
    expect(createScriptURL).toHaveBeenCalledWith("service-worker.js");
    expect(url.toString()).toBe("trusted:service-worker.js");
  });

  it("swallows policy creation errors", () => {
    const createPolicy = jest.fn(() => {
      throw new Error("already exists");
    });

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    expect(() => ensureDefaultTrustedTypesPolicy()).not.toThrow();
  });

  it("only attempts default policy creation once per context", () => {
    const createPolicy = jest.fn();

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    ensureDefaultTrustedTypesPolicy();
    ensureDefaultTrustedTypesPolicy();

    expect(createPolicy).toHaveBeenCalledTimes(1);
  });

  it("returns TrustedScriptURL via created default policy without getPolicy", () => {
    const trustedScriptUrl = {
      toString: () => "trusted:service-worker.js",
    };
    const createScriptURL = jest.fn((_url: string) => trustedScriptUrl);
    const createPolicy = jest.fn((_name: string, _rules: object) => ({
      createHTML: (input: string) => input,
      createScriptURL,
    }));

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    const url = toDefaultTrustedScriptUrl("service-worker.js") as {
      toString: () => string;
    };

    expect(createPolicy).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({
        createHTML: expect.any(Function),
        createScriptURL: expect.any(Function),
      }),
    );
    expect(createScriptURL).toHaveBeenCalledWith("service-worker.js");
    expect(url.toString()).toBe("trusted:service-worker.js");
  });
});
