/**
 * Trusted Types API Tinyfill
 *
 * Provides minimal Trusted Types API support for browsers that don't natively support it.
 * Based on MDN guidance: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API
 *
 * This tinyfill does NOT perform any validation or enforcement—it simply provides
 * the API surface so code can uniformly use trustedTypes.createPolicy() and related
 * methods across all browsers. Actual HTML sanitization should be done by the caller
 * (e.g., DOMPurify) before passing to the policy.
 */

type TrustedMarkup = string | { toString: () => string };

interface TrustedTypesPolicy {
  createHTML?: (input: string) => TrustedMarkup;
  createScriptURL?: (input: string) => TrustedMarkup;
  createScript?: (input: string) => TrustedMarkup;
}

interface TrustedTypesFactory {
  createPolicy: (
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
      createScript?: (input: string) => string;
    },
  ) => TrustedTypesPolicy;
  getPolicy: (name: string) => TrustedTypesPolicy | null;
  isHTML?: (value: unknown) => boolean;
  isScriptURL?: (value: unknown) => boolean;
  isScript?: (value: unknown) => boolean;
}

/**
 * Initializes the Trusted Types tinyfill if the browser doesn't already support it.
 * Safe to call multiple times—only installs if `globalThis.trustedTypes` is not defined.
 */
export function initializeTrustedTypesTinyfill(): void {
  // Only install tinyfill if Trusted Types API is not already available
  if (globalThis.trustedTypes) {
    return;
  }

  const policies = new Map<string, TrustedTypesPolicy>();

  const factory: TrustedTypesFactory = {
    createPolicy: (
      name: string,
      rules: {
        createHTML?: (input: string) => string;
        createScriptURL?: (input: string) => string;
        createScript?: (input: string) => string;
      },
    ): TrustedTypesPolicy => {
      if (policies.has(name)) {
        throw new TypeError(`Policy with name "${name}" already exists.`);
      }

      const policy: TrustedTypesPolicy = {
        createHTML: rules.createHTML
          ? (input) => rules.createHTML!(input)
          : undefined,
        createScriptURL: rules.createScriptURL
          ? (input) => rules.createScriptURL!(input)
          : undefined,
        createScript: rules.createScript
          ? (input) => rules.createScript!(input)
          : undefined,
      };

      policies.set(name, policy);

      return policy;
    },

    getPolicy: (name: string): TrustedTypesPolicy | null => {
      return policies.get(name) ?? null;
    },

    isHTML: (value: unknown): boolean => {
      return (
        typeof value === "string" ||
        (value instanceof Object && "toString" in value)
      );
    },

    isScriptURL: (value: unknown): boolean => {
      return (
        typeof value === "string" ||
        (value instanceof Object && "toString" in value)
      );
    },

    isScript: (value: unknown): boolean => {
      return (
        typeof value === "string" ||
        (value instanceof Object && "toString" in value)
      );
    },
  };

  // Install tinyfill at globalThis.trustedTypes
  (
    globalThis as typeof globalThis & { trustedTypes?: TrustedTypesFactory }
  ).trustedTypes = factory;
}
