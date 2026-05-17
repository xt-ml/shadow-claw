import type { Config } from "dompurify";

import { escapeHtml, sanitizeHtml } from "../utils.js";

type TrustedMarkup = string | { toString: () => string };

type TrustedTypesPolicyLike = {
  createHTML: (input: string) => TrustedMarkup;
  createScriptURL?: (input: string) => TrustedMarkup;
};

type TrustedTypesFactoryLike = {
  createPolicy: (
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
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
      // Input is already sanitized by sanitizeToTrustedHtml before policy use.
      // Keep this an identity transform so caller-provided sanitize options
      // (for example blob URL allowlists) are not lost.
      createHTML: (input: string) => input,
      createScriptURL: (input: string) => input,
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

export function sanitizeSrcdocHtml(html: string, options: Config = {}): string {
  return sanitizeHtml(html, options);
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

export function toTrustedScriptUrl(url: string): TrustedMarkup {
  const policy = getTrustedTypesPolicy();

  if (!policy || typeof policy.createScriptURL !== "function") {
    return url;
  }

  return policy.createScriptURL(url);
}
