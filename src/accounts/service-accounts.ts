import {
  CONFIG_KEYS,
  GENERAL_ACCOUNT_PROVIDER_CAPABILITIES,
  getGeneralAccountProviderCapabilities,
} from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { decryptValue, encryptValue } from "../crypto.js";
import {
  resolveStoredCredentialAuthMode,
  type StoredCredentialAuthMode,
  type StoredCredentialBase,
  type StoredCredentialOAuthFields,
} from "./stored-credentials.js";

import type { ShadowClawDatabase } from "../types.js";
import type { GeneralAccountProviderCapabilities } from "../config.js";

export type AccountAuthMode = StoredCredentialAuthMode;

export interface ServiceAccount
  extends StoredCredentialBase, StoredCredentialOAuthFields {
  service: string;
}

export interface ResolvedServiceCredentials {
  token: string;
  service: string;
  hostPattern: string;
  headerName: string; // e.g. "Authorization", "X-Figma-Token"
  headerValue: string; // e.g. "Bearer TOKEN", "TOKEN" (no prefix)
  accountId: string;
  authMode: AccountAuthMode;
  reauthRequired?: boolean;
}

export interface ResolveServiceCredentialsOptions {
  accountId?: string;
  authMode?: AccountAuthMode;
  forceRefresh?: boolean;
}

const OAUTH_REFRESH_WINDOW_MS = 60_000;
const OAUTH_REFRESH_FAILURE_THRESHOLD = 3;

function resolveAccountAuthMode(account: ServiceAccount): AccountAuthMode {
  return resolveStoredCredentialAuthMode(account);
}

function shouldRefreshOAuthToken(
  account: ServiceAccount,
  options: ResolveServiceCredentialsOptions,
): boolean {
  if (resolveAccountAuthMode(account) !== "oauth") {
    return false;
  }

  if (account.oauthReauthRequired) {
    return false;
  }

  if (
    !account.refreshToken ||
    !account.oauthProviderId ||
    !account.oauthClientId
  ) {
    return false;
  }

  if (options.forceRefresh) {
    return true;
  }

  if (!account.accessTokenExpiresAt) {
    return false;
  }

  return account.accessTokenExpiresAt <= Date.now() + OAUTH_REFRESH_WINDOW_MS;
}

async function tryRefreshOAuthAccount(
  db: ShadowClawDatabase,
  accounts: ServiceAccount[],
  account: ServiceAccount,
): Promise<ServiceAccount> {
  if (
    !account.refreshToken ||
    !account.oauthProviderId ||
    !account.oauthClientId
  ) {
    return account;
  }

  const decryptedRefreshToken = await decryptValue(account.refreshToken);
  if (!decryptedRefreshToken) {
    return account;
  }

  const oauthClientSecret = account.oauthClientSecret
    ? await decryptValue(account.oauthClientSecret)
    : undefined;

  const persistAccount = async (updatedAccount: ServiceAccount) => {
    const idx = accounts.findIndex((candidate) => candidate.id === account.id);
    if (idx !== -1) {
      accounts[idx] = updatedAccount;
      await setConfig(db, CONFIG_KEYS.SERVICE_ACCOUNTS, accounts);
    }
  };

  const markRefreshFailure = async (): Promise<ServiceAccount> => {
    const failureCount = (account.oauthRefreshFailureCount || 0) + 1;
    const reauthRequired = failureCount >= OAUTH_REFRESH_FAILURE_THRESHOLD;
    const updatedAccount: ServiceAccount = {
      ...account,
      oauthRefreshFailureCount: failureCount,
      oauthReauthRequired: reauthRequired,
      oauthReauthRequiredAt: reauthRequired
        ? account.oauthReauthRequiredAt || Date.now()
        : undefined,
    };
    await persistAccount(updatedAccount);

    return updatedAccount;
  };

  try {
    const response = await fetch("/oauth/refresh", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        providerId: account.oauthProviderId,
        clientId: account.oauthClientId,
        clientSecret: oauthClientSecret,
        refreshToken: decryptedRefreshToken,
        scope: account.scopes,
        tokenUrl: account.oauthCustomTokenUrl,
      }),
    });

    if (!response.ok) {
      return markRefreshFailure();
    }

    const payload = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      expiresIn?: number;
      tokenType?: string;
      scope?: string;
    };

    if (!payload.accessToken) {
      return markRefreshFailure();
    }

    const encryptedAccessToken = await encryptValue(payload.accessToken);
    if (!encryptedAccessToken) {
      return markRefreshFailure();
    }

    let encryptedRefreshToken = account.refreshToken;
    if (payload.refreshToken) {
      const maybeEncryptedRefreshToken = await encryptValue(
        payload.refreshToken,
      );
      if (maybeEncryptedRefreshToken) {
        encryptedRefreshToken = maybeEncryptedRefreshToken;
      }
    }

    const updatedAccount: ServiceAccount = {
      ...account,
      token: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      accessTokenExpiresAt: payload.expiresIn
        ? Date.now() + payload.expiresIn * 1000
        : account.accessTokenExpiresAt,
      tokenType: payload.tokenType || account.tokenType,
      scopes: payload.scope
        ? payload.scope
            .split(/[\s,]+/)
            .map((scope) => scope.trim())
            .filter(Boolean)
        : account.scopes,
      oauthRefreshFailureCount: 0,
      oauthReauthRequired: false,
      oauthReauthRequiredAt: undefined,
    };

    await persistAccount(updatedAccount);

    return updatedAccount;
  } catch {
    return markRefreshFailure();
  }
}

function resolveProviderCapabilities(
  account: ServiceAccount,
  url?: string,
): GeneralAccountProviderCapabilities | null {
  if (account.oauthProviderId) {
    const direct = getGeneralAccountProviderCapabilities(
      account.oauthProviderId,
    );
    if (direct) {
      return direct;
    }
  }

  const hints = [account.service, account.hostPattern, url]
    .filter((value): value is string => !!value)
    .map((value) => value.toLowerCase());

  for (const provider of Object.values(GENERAL_ACCOUNT_PROVIDER_CAPABILITIES)) {
    const aliases = [provider.providerId, ...(provider.aliases || [])].map(
      (alias) => alias.toLowerCase(),
    );

    if (aliases.some((alias) => hints.some((hint) => hint.includes(alias)))) {
      return provider;
    }
  }

  return null;
}

/**
 * Resolve auth header format from provider capabilities. Falls back to Bearer.
 */
function getServiceAuthFormat(
  account: ServiceAccount,
  url?: string,
): {
  headerName: string;
  headerPrefix: string;
} {
  const authMode = resolveAccountAuthMode(account);
  const provider = resolveProviderCapabilities(account, url);
  if (provider) {
    const scheme =
      authMode === "oauth" ? provider.tokenAuth.oauth : provider.tokenAuth.pat;

    return {
      headerName: scheme.headerName,
      headerPrefix: scheme.headerPrefix || "",
    };
  }

  return { headerName: "Authorization", headerPrefix: "Bearer " };
}

/**
 * Find the most-specific (longest hostPattern) account that matches a URL.
 */
function matchAccountsByHost(
  accounts: ServiceAccount[],
  url: string,
): ServiceAccount[] {
  const matches: ServiceAccount[] = [];
  let bestLen = -1;
  const lower = url.toLowerCase();

  for (const acct of accounts) {
    if (!acct.hostPattern) {
      continue;
    }

    const pattern = acct.hostPattern.toLowerCase();
    if (lower.includes(pattern)) {
      if (pattern.length > bestLen) {
        bestLen = pattern.length;
        matches.length = 0;
        matches.push(acct);
      } else if (pattern.length === bestLen) {
        matches.push(acct);
      }
    }
  }

  return matches;
}

function pickAccountByAuthMode(
  accounts: ServiceAccount[],
  authMode?: AccountAuthMode,
): ServiceAccount | undefined {
  if (!accounts.length) {
    return undefined;
  }

  if (!authMode) {
    return accounts[0];
  }

  const modeMatch = accounts.find(
    (acct) => resolveAccountAuthMode(acct) === authMode,
  );
  if (modeMatch) {
    return modeMatch;
  }

  return accounts[0];
}

/**
 * Resolve a decrypted service account PAT for the given URL.
 *
 * Resolution order:
 * 1. Longest hostPattern match against the URL
 * 2. SERVICE_DEFAULT_ACCOUNT
 * 3. First account in the list
 *
 * Returns undefined when no accounts are configured.
 */
export async function resolveServiceCredentials(
  db: ShadowClawDatabase,
  url?: string,
  options: ResolveServiceCredentialsOptions = {},
): Promise<ResolvedServiceCredentials | undefined> {
  const raw = await getConfig(db, CONFIG_KEYS.SERVICE_ACCOUNTS);
  const accounts: ServiceAccount[] = Array.isArray(raw) ? raw : [];

  if (accounts.length === 0) {
    return undefined;
  }

  let account: ServiceAccount | undefined;

  if (options.accountId) {
    account = accounts.find((a) => a.id === options.accountId);
  }

  // 1. Match by URL host pattern
  if (!account && url) {
    const hostMatches = matchAccountsByHost(accounts, url);
    if (options.authMode) {
      account = pickAccountByAuthMode(hostMatches, options.authMode);
    } else {
      const preferredMode = hostMatches[0]
        ? resolveProviderCapabilities(hostMatches[0], url)?.defaultMode
        : undefined;
      account = pickAccountByAuthMode(hostMatches, preferredMode);
    }
  }

  // 2. Fall back to stored default
  if (!account) {
    const defaultId = await getConfig(db, CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT);
    if (defaultId) {
      account = accounts.find((a) => a.id === defaultId);
    }
  }

  // 3. Fall back to first account matching requested mode
  if (!account && options.authMode) {
    account = pickAccountByAuthMode(accounts, options.authMode);
  }

  // 4. Fall back to first
  if (!account) {
    account = accounts[0];
  }

  if (!account) {
    return undefined;
  }

  if (shouldRefreshOAuthToken(account, options)) {
    account = await tryRefreshOAuthAccount(db, accounts, account);
  }

  if (
    resolveAccountAuthMode(account) === "oauth" &&
    account.oauthReauthRequired
  ) {
    return {
      token: "",
      service: account.service,
      hostPattern: account.hostPattern,
      headerName: "Authorization",
      headerValue: "",
      accountId: account.id,
      authMode: "oauth",
      reauthRequired: true,
    };
  }

  let token = "";
  if (account.token) {
    token = (await decryptValue(account.token)) ?? "";
  }

  const { headerName, headerPrefix } = getServiceAuthFormat(account, url);
  const headerValue = headerPrefix ? `${headerPrefix}${token}` : token;

  return {
    token,
    service: account.service,
    hostPattern: account.hostPattern,
    headerName,
    headerValue,
    accountId: account.id,
    authMode: resolveAccountAuthMode(account),
  };
}
