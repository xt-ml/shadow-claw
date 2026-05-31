import { initializeTrustedTypesTinyfill } from "./trusted-types-tinyfill.js";

describe("Trusted Types Tinyfill", () => {
  beforeEach(() => {
    // Clear the tinyfill state by deleting from globalThis
    delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
      .trustedTypes;
  });

  describe("initializeTrustedTypesTinyfill", () => {
    it("should install trustedTypes if not already present", () => {
      initializeTrustedTypesTinyfill();

      expect(globalThis.trustedTypes).toBeDefined();
      expect(typeof globalThis.trustedTypes.createPolicy).toBe("function");
      expect(typeof globalThis.trustedTypes.getPolicy).toBe("function");
    });

    it("should be idempotent—not override if already installed", () => {
      initializeTrustedTypesTinyfill();
      const firstFactory = globalThis.trustedTypes;

      initializeTrustedTypesTinyfill();
      const secondFactory = globalThis.trustedTypes;

      expect(firstFactory).toBe(secondFactory);
    });

    it("should not override native Trusted Types if browser supports it", () => {
      // Mock a native Trusted Types implementation
      const mockFn = () => {};
      const nativeFactory = {
        createPolicy: mockFn,
        getPolicy: mockFn,
      };

      (
        globalThis as typeof globalThis & { trustedTypes?: unknown }
      ).trustedTypes = nativeFactory as never;

      initializeTrustedTypesTinyfill();

      // Should remain the native implementation
      expect(globalThis.trustedTypes).toBe(nativeFactory);
    });
  });

  describe("trustedTypes.createPolicy", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should create a policy with provided rules", () => {
      const policy = globalThis.trustedTypes!.createPolicy("test-policy", {
        createHTML: (input) => input.toUpperCase(),
      });

      expect(policy).toBeDefined();
      expect(typeof policy.createHTML).toBe("function");
    });

    it("should apply rule function to input", () => {
      const policy = globalThis.trustedTypes!.createPolicy("html-policy", {
        createHTML: (input) => `<sanitized>${input}</sanitized>`,
      });

      const result = policy.createHTML!("hello");
      expect(result).toBe("<sanitized>hello</sanitized>");
    });

    it("should handle createScriptURL rules", () => {
      const policy = globalThis.trustedTypes!.createPolicy("script-policy", {
        createScriptURL: (input) => `https://example.com/${input}`,
      });

      const result = policy.createScriptURL!("script.js");
      expect(result).toBe("https://example.com/script.js");
    });

    it("should handle createScript rules", () => {
      const policy = globalThis.trustedTypes!.createPolicy(
        "script-content-policy",
        {
          createScript: (input) => `console.log("${input}");`,
        },
      );

      const result = policy.createScript!("wrapped");
      expect(result).toBe('console.log("wrapped");');
    });

    it("should throw if policy name already exists", () => {
      globalThis.trustedTypes!.createPolicy("duplicate", {
        createHTML: (input) => input,
      });

      expect(() => {
        globalThis.trustedTypes!.createPolicy("duplicate", {
          createHTML: (input) => input,
        });
      }).toThrow(TypeError);
      expect(() => {
        globalThis.trustedTypes!.createPolicy("duplicate", {
          createHTML: (input) => input,
        });
      }).toThrow(/already exists/);
    });
  });

  describe("trustedTypes.getPolicy", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should retrieve a created policy by name", () => {
      const created = globalThis.trustedTypes!.createPolicy("retrievable", {
        createHTML: (input) => input,
      });

      const retrieved = globalThis.trustedTypes!.getPolicy("retrievable");

      expect(retrieved).toBe(created);
    });

    it("should return null for non-existent policy", () => {
      const result = globalThis.trustedTypes!.getPolicy("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("trustedTypes.isHTML", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should return true for strings", () => {
      expect(globalThis.trustedTypes!.isHTML!("hello")).toBe(true);
    });

    it("should return true for objects with toString", () => {
      expect(
        globalThis.trustedTypes!.isHTML!({ toString: () => "value" }),
      ).toBe(true);
    });

    it("should return false for numbers", () => {
      expect(globalThis.trustedTypes!.isHTML!(42)).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(globalThis.trustedTypes!.isHTML!(null)).toBe(false);
      expect(globalThis.trustedTypes!.isHTML!(undefined)).toBe(false);
    });
  });

  describe("trustedTypes.isScriptURL", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should return true for strings", () => {
      expect(
        globalThis.trustedTypes!.isScriptURL!("https://example.com/script.js"),
      ).toBe(true);
    });

    it("should return true for objects with toString", () => {
      expect(
        globalThis.trustedTypes!.isScriptURL!({ toString: () => "url" }),
      ).toBe(true);
    });
  });

  describe("trustedTypes.isScript", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should return true for strings", () => {
      expect(globalThis.trustedTypes!.isScript!("console.log();")).toBe(true);
    });

    it("should return true for objects with toString", () => {
      expect(
        globalThis.trustedTypes!.isScript!({ toString: () => "code" }),
      ).toBe(true);
    });
  });

  describe("integration with default policy", () => {
    it("should work with ensureDefaultTrustedTypesPolicy", async () => {
      // Use dynamic import to avoid circular dependencies in test setup
      const mod = await import("./default-trusted-types-policy.js");
      const { ensureDefaultTrustedTypesPolicy } = mod;

      initializeTrustedTypesTinyfill();
      ensureDefaultTrustedTypesPolicy();

      const defaultPolicy = globalThis.trustedTypes!.getPolicy("default");
      expect(defaultPolicy).toBeDefined();
      expect(typeof defaultPolicy?.createHTML).toBe("function");
    });
  });

  describe("policy isolation", () => {
    beforeEach(() => {
      initializeTrustedTypesTinyfill();
    });

    it("should allow multiple independent policies", () => {
      const policy1 = globalThis.trustedTypes!.createPolicy("policy1", {
        createHTML: (input) => `<p>${input}</p>`,
      });

      const policy2 = globalThis.trustedTypes!.createPolicy("policy2", {
        createHTML: (input) => `<div>${input}</div>`,
      });

      expect(policy1.createHTML!("hello")).toBe("<p>hello</p>");
      expect(policy2.createHTML!("hello")).toBe("<div>hello</div>");
    });

    it("should handle partial rule definitions", () => {
      const policy = globalThis.trustedTypes!.createPolicy("partial", {
        createHTML: (input) => input,
        // createScriptURL is undefined
      });

      expect(policy.createHTML).toBeDefined();
      expect(policy.createScriptURL).toBeUndefined();
    });
  });
});
