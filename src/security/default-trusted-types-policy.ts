type TrustedMarkup = string | { toString: () => string };

type TrustedTypesPolicyLike = {
  createHTML?: (input: string) => TrustedMarkup;
  createScriptURL?: (input: string) => TrustedMarkup;
};

type TrustedTypesFactoryLike = {
  createPolicy?: (
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ) => unknown;
  getPolicy?: (name: string) => TrustedTypesPolicyLike | null;
  getPolicyNames?: () => string[];
};

type DefaultTrustedTypesPolicyState = {
  initialized: boolean;
  policy: TrustedTypesPolicyLike | null;
};

const DEFAULT_TRUSTED_TYPES_POLICY_STATE_KEY =
  "__shadowClawDefaultTrustedTypesPolicyState";
const DEFAULT_POLICY_NAME = "default";
const FALLBACK_SCRIPT_URL_POLICY_NAME = "shadowclaw-sandbox";

function getDefaultTrustedTypesPolicyState(): DefaultTrustedTypesPolicyState {
  const globalObject = globalThis as typeof globalThis & {
    [DEFAULT_TRUSTED_TYPES_POLICY_STATE_KEY]?: DefaultTrustedTypesPolicyState;
  };

  if (!globalObject[DEFAULT_TRUSTED_TYPES_POLICY_STATE_KEY]) {
    globalObject[DEFAULT_TRUSTED_TYPES_POLICY_STATE_KEY] = {
      initialized: false,
      policy: null,
    };
  }

  return globalObject[DEFAULT_TRUSTED_TYPES_POLICY_STATE_KEY]!;
}

export function ensureDefaultTrustedTypesPolicy(): void {
  const state = getDefaultTrustedTypesPolicyState();
  if (state.initialized) {
    return;
  }

  const factory = Reflect.get(globalThis, "trustedTypes") as
    | TrustedTypesFactoryLike
    | undefined;

  if (!factory || typeof factory.createPolicy !== "function") {
    return;
  }

  state.initialized = true;

  try {
    if (typeof factory.getPolicy === "function") {
      const existing = factory.getPolicy(DEFAULT_POLICY_NAME);
      if (existing) {
        state.policy = existing;

        return;
      }
    }

    let defaultPolicyExists = false;
    if (typeof factory.getPolicyNames === "function") {
      const existingNames = factory.getPolicyNames();
      if (
        Array.isArray(existingNames) &&
        existingNames.includes(DEFAULT_POLICY_NAME)
      ) {
        defaultPolicyExists = true;
      }
    }

    if (defaultPolicyExists) {
      if (typeof factory.getPolicy === "function") {
        const existingFallback = factory.getPolicy(
          FALLBACK_SCRIPT_URL_POLICY_NAME,
        );
        if (existingFallback) {
          state.policy = existingFallback;

          return;
        }
      }

      const fallback = factory.createPolicy(FALLBACK_SCRIPT_URL_POLICY_NAME, {
        createHTML: (input: string): string => input,
        createScriptURL: (input: string): string => input,
      });
      state.policy = fallback as TrustedTypesPolicyLike;

      return;
    }

    const created = factory.createPolicy(DEFAULT_POLICY_NAME, {
      createHTML: (input: string): string => input,
      createScriptURL: (input: string): string => input,
    });
    state.policy = created as TrustedTypesPolicyLike;
  } catch {
    if (typeof factory.getPolicy === "function") {
      state.policy =
        factory.getPolicy(DEFAULT_POLICY_NAME) ??
        factory.getPolicy(FALLBACK_SCRIPT_URL_POLICY_NAME) ??
        null;
    }

    // Ignore failures when policy already exists or browser rejects creation.
  }
}

export function toDefaultTrustedScriptUrl(url: string): TrustedMarkup {
  ensureDefaultTrustedTypesPolicy();

  const policy = getDefaultTrustedTypesPolicyState().policy;
  if (!policy || typeof policy.createScriptURL !== "function") {
    return url;
  }

  return policy.createScriptURL(url);
}
