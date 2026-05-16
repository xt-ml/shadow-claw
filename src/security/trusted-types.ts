import type { Config } from "dompurify";

import { escapeHtml, sanitizeHtml } from "../utils.js";

type TrustedMarkup = string | { toString: () => string };

type TrustedTypesPolicyLike = {
  createHTML: (input: string) => TrustedMarkup;
};

type TrustedTypesFactoryLike = {
  createPolicy: (
    name: string,
    rules: { createHTML?: (input: string) => string },
  ) => TrustedTypesPolicyLike;
};

const APP_TRUSTED_TYPES_POLICY_NAME = "shadowclaw";

let cachedPolicy: TrustedTypesPolicyLike | null | undefined;

function getTrustedTypesFactory(): TrustedTypesFactoryLike | null {
  const factory = globalThis.trustedTypes;
  if (!factory || typeof factory.createPolicy !== "function") {
    return null;
  }

  return factory as TrustedTypesFactoryLike;
}

function getTrustedTypesPolicy(): TrustedTypesPolicyLike | null {
  if (cachedPolicy !== undefined) {
    return cachedPolicy;
  }

  const factory = getTrustedTypesFactory();
  if (!factory) {
    cachedPolicy = null;

    return cachedPolicy;
  }

  try {
    cachedPolicy = factory.createPolicy(APP_TRUSTED_TYPES_POLICY_NAME, {
      createHTML: (input: string) => sanitizeHtml(input),
    });
  } catch {
    cachedPolicy = null;
  }

  return cachedPolicy;
}

export function getTrustedTypesPolicyName(): string {
  return APP_TRUSTED_TYPES_POLICY_NAME;
}

export function sanitizeToTrustedHtml(
  dirty: string | Node = "",
  options: Config = {},
): TrustedMarkup {
  const sanitized = sanitizeHtml(dirty, options);
  const policy = getTrustedTypesPolicy();

  if (!policy) {
    return sanitized;
  }

  return policy.createHTML(sanitized);
}

export function escapeToTrustedHtml(text: string): TrustedMarkup {
  return sanitizeToTrustedHtml(escapeHtml(text));
}

export function sanitizeSrcdocHtml(html: string): string {
  return sanitizeHtml(html);
}

export function setSanitizedHtml(
  element: Element,
  dirty: string | Node = "",
  options: Config = {},
): TrustedMarkup {
  const trustedHtml = sanitizeToTrustedHtml(dirty, options);

  element.innerHTML = trustedHtml as string;

  return trustedHtml;
}

export function setEscapedHtml(element: Element, text: string): TrustedMarkup {
  const trustedHtml = escapeToTrustedHtml(text);

  element.innerHTML = trustedHtml as string;

  return trustedHtml;
}
