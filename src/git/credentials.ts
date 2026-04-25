import { CONFIG_KEYS, getProviderTokenAuthScheme } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { decryptValue, encryptValue } from "../crypto.js";

import {
  resolveStoredCredentialAuthMode,
  type StoredCredentialAuthMode,
  type StoredCredentialBase,
  type StoredCredentialOAuthFields,
} from "../accounts/stored-credentials.js";

import type { ShadowClawDatabase } from "../types.js";

export type GitProvider = "github" | "azure-devops" | "gitlab" | "generic";
export type GitAuthMode = StoredCredentialAuthMode;

export interface GitAccount
  extends StoredCredentialBase, StoredCredentialOAuthFields {
  username: string; // Plaintext username (empty string if not set)
  password: string; // Encrypted password (empty string if not set)
  authorName: string; // Commit author name (empty string to use global default)
  authorEmail: string; // Commit author email (empty string to use global default)
  provider?: GitProvider; // Explicit provider type (auto-detected from hostPattern if omitted)
}

export interface ResolvedGitCredentials {
  token?: string;
  username?: string;
  password?: string;
  authorName?: string;
  authorEmail?: string;
  provider?: GitProvider; // Detected or explicit provider type
  hostPattern?: string; // Host pattern from the matched account
  accountId?: string;
  authMode?: GitAuthMode;
  reauthRequired?: boolean;
}

export interface ResolveGitCredentialsOptions {
  accountId?: string;
  authMode?: GitAuthMode;
  forceRefresh?: boolean;
}

const OAUTH_REFRESH_WINDOW_MS = 60_000;
const OAUTH_REFRESH_FAILURE_THRESHOLD = 3;

function resolveGitAuthMode(account: GitAccount): GitAuthMode {
  return resolveStoredCredentialAuthMode(account);
}

function mapGitProviderToGeneralProviderId(provider: GitProvider): string {
  switch (provider) {
    case "azure-devops":
      return "azure_devops";
    default:
      return provider;
  }
}

/**
 * Detect the git provider type from a hostname or host pattern.
 */
export function detectProvider(hostPattern: string): GitProvider {
  if (!hostPattern) {
    return "generic";
  }

  const lower = hostPattern.toLowerCase();
  if (lower.includes("github")) {
    return "github";
  }

  if (lower.includes("dev.azure.com") || lower.includes("visualstudio.com")) {
    return "azure-devops";
  }

  if (lower.includes("gitlab")) {
    return "gitlab";
  }

  return "generic";
}

/**
 * Build HTTP Authorization headers for a resolved credential set.
 */
export function buildAuthHeaders(
  creds: Partial<ResolvedGitCredentials> & {
    hostPattern?: string;
    provider?: GitProvider;
  },
): Record<string, string> {
  if (creds.reauthRequired) {
    return {};
  }

  const provider = creds.provider || detectProvider(creds.hostPattern || "");

  const mappedProviderId = mapGitProviderToGeneralProviderId(provider);
  const authMode = creds.authMode || "pat";

  // Some git providers (Azure DevOps) need Basic auth for PAT/OAuth over git HTTP.
  if (
    creds.token &&
    mappedProviderId === "azure_devops" &&
    getProviderTokenAuthScheme(mappedProviderId, authMode, "git_remote")
      ?.headerPrefix === "Basic "
  ) {
    return { Authorization: `Basic ${btoa(":" + creds.token)}` };
  }

  switch (provider) {
    case "azure-devops": {
      if (creds.username && creds.password) {
        return {
          Authorization: `Basic ${btoa(creds.username + ":" + creds.password)}`,
        };
      }

      break;
    }

    default:
      break;
  }

  if (creds.token) {
    const scheme = getProviderTokenAuthScheme(
      mappedProviderId,
      authMode,
      "git_remote",
    );

    if (scheme?.headerName) {
      return {
        [scheme.headerName]: `${scheme.headerPrefix || ""}${creds.token}`,
      };
    }

    return { Authorization: `Bearer ${creds.token}` };
  }

  return {};
}

/**
 * Extract hostname + pathname from a git remote URL.
 * Returns e.g. "dev.azure.com/exampleOrg2/project/_git/repo" so that
 * path-based host patterns like "dev.azure.com/exampleOrg2" can match.
 */
function extractHostAndPath(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "");

    return path ? parsed.hostname + path : parsed.hostname;
  } catch {
    return undefined;
  }
}

/**
 * Find the best matching account for a URL by host (and optional path prefix).
 * When multiple accounts match, the longest (most specific) pattern wins.
 */
function matchAccountsByHost(
  accounts: GitAccount[],
  hostAndPath: string,
): GitAccount[] {
  const lower = hostAndPath.toLowerCase();
  const matches: GitAccount[] = [];
  let bestLen = -1;
  for (const a of accounts) {
    if (!a.hostPattern) {
      continue;
    }

    const pattern = a.hostPattern.toLowerCase();
    if (lower.includes(pattern)) {
      if (pattern.length > bestLen) {
        bestLen = pattern.length;
        matches.length = 0;
        matches.push(a);
      } else if (pattern.length === bestLen) {
        matches.push(a);
      }
    }
  }

  return matches;
}

function pickAccountByAuthMode(
  accounts: GitAccount[],
  authMode?: GitAuthMode,
): GitAccount | undefined {
  if (!accounts.length) {
    return undefined;
  }

  if (!authMode) {
    return accounts[0];
  }

  const modeMatch = accounts.find(
    (acct) => resolveGitAuthMode(acct) === authMode,
  );
  if (modeMatch) {
    return modeMatch;
  }

  // Legacy accounts without explicit mode should behave as PAT accounts.
  if (authMode === "pat") {
    const legacyPat = accounts.find(
      (acct) => resolveGitAuthMode(acct) === "pat" && !acct.authMode,
    );
    if (legacyPat) {
      return legacyPat;
    }
  }

  return accounts[0];
}

/**
 * Decrypt a stored encrypted value, returning undefined for empty/missing.
 */
async function decryptIfPresent(
  encrypted: string | null | undefined,
): Promise<string | undefined> {
  if (!encrypted) {
    return undefined;
  }

  const result = await decryptValue(encrypted);

  return result ?? undefined;
}

function shouldRefreshOAuthToken(
  account: GitAccount,
  options: ResolveGitCredentialsOptions,
): boolean {
  if (resolveGitAuthMode(account) !== "oauth") {
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
  accounts: GitAccount[],
  account: GitAccount,
): Promise<GitAccount> {
  if (
    !account.refreshToken ||
    !account.oauthProviderId ||
    !account.oauthClientId
  ) {
    return account;
  }

  const decryptedRefreshToken = await decryptIfPresent(account.refreshToken);
  if (!decryptedRefreshToken) {
    return account;
  }

  const oauthClientSecret = account.oauthClientSecret
    ? await decryptIfPresent(account.oauthClientSecret)
    : undefined;

  const persistAccount = async (updatedAccount: GitAccount) => {
    const idx = accounts.findIndex((candidate) => candidate.id === account.id);
    if (idx !== -1) {
      accounts[idx] = updatedAccount;
      await setConfig(db, CONFIG_KEYS.GIT_ACCOUNTS, accounts);
    }
  };

  const markRefreshFailure = async (): Promise<GitAccount> => {
    const failureCount = (account.oauthRefreshFailureCount || 0) + 1;
    const reauthRequired = failureCount >= OAUTH_REFRESH_FAILURE_THRESHOLD;
    const updatedAccount: GitAccount = {
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

    const updatedAccount: GitAccount = {
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

/**
 * Resolve git credentials for a given operation.
 *
 * Resolution order:
 * 1. If GIT_ACCOUNTS exist, match by URL hostname → default account → first account
 * 2. Fall back to legacy single-key config (GIT_TOKEN, GIT_USERNAME, etc.)
 */
export async function resolveGitCredentials(
  db: ShadowClawDatabase,
  url?: string,
  options: ResolveGitCredentialsOptions = {},
): Promise<ResolvedGitCredentials> {
  const accounts = (await getConfig(db, CONFIG_KEYS.GIT_ACCOUNTS)) as
    | GitAccount[]
    | undefined;

  if (Array.isArray(accounts) && accounts.length > 0) {
    return resolveFromAccounts(db, accounts, url, options);
  }

  return resolveFromLegacy(db);
}

/**
 * Resolve credentials from the multi-account list.
 */
async function resolveFromAccounts(
  db: ShadowClawDatabase,
  accounts: GitAccount[],
  url?: string,
  options: ResolveGitCredentialsOptions = {},
): Promise<ResolvedGitCredentials> {
  let account: GitAccount | undefined;

  if (options.accountId) {
    account = accounts.find((a) => a.id === options.accountId);
  }

  // 1. Match by URL host (+ path prefix when the pattern includes a path)
  if (!account && url) {
    const hostAndPath = extractHostAndPath(url);
    if (hostAndPath) {
      const hostMatches = matchAccountsByHost(accounts, hostAndPath);
      account = pickAccountByAuthMode(hostMatches, options.authMode);
    }
  }

  // 2. Fall back to default account
  if (!account) {
    const defaultId = await getConfig(db, CONFIG_KEYS.GIT_DEFAULT_ACCOUNT);
    if (defaultId) {
      account = accounts.find((a) => a.id === defaultId);
    }
  }

  // 3. Fall back to first account matching requested mode
  if (!account && options.authMode) {
    account = pickAccountByAuthMode(accounts, options.authMode);
  }

  // 4. Fall back to first account
  if (!account) {
    account = accounts[0];
  }

  if (!account) {
    return {
      token: undefined,
      username: undefined,
      password: undefined,
      authorName: undefined,
      authorEmail: undefined,
      provider: "generic",
      authMode: "pat",
    };
  }

  if (shouldRefreshOAuthToken(account, options)) {
    account = await tryRefreshOAuthAccount(db, accounts, account);
  }

  const provider =
    account.provider || detectProvider(account.hostPattern || "");

  if (resolveGitAuthMode(account) === "oauth" && account.oauthReauthRequired) {
    return {
      token: undefined,
      username: account.username || undefined,
      password: undefined,
      authorName: account.authorName || undefined,
      authorEmail: account.authorEmail || undefined,
      provider,
      hostPattern: account.hostPattern || undefined,
      accountId: account.id,
      authMode: "oauth",
      reauthRequired: true,
    };
  }

  return {
    token: await decryptIfPresent(account.token),
    username: account.username || undefined,
    password: await decryptIfPresent(account.password),
    authorName: account.authorName || undefined,
    authorEmail: account.authorEmail || undefined,
    provider,
    hostPattern: account.hostPattern || undefined,
    accountId: account.id,
    authMode: resolveGitAuthMode(account),
  };
}

/**
 * Resolve credentials from legacy single-key config.
 */
async function resolveFromLegacy(
  db: ShadowClawDatabase,
): Promise<ResolvedGitCredentials> {
  const encToken = await getConfig(db, CONFIG_KEYS.GIT_TOKEN);
  const encPassword = await getConfig(db, CONFIG_KEYS.GIT_PASSWORD);

  return {
    token: encToken ? await decryptIfPresent(encToken) : undefined,
    username: (await getConfig(db, CONFIG_KEYS.GIT_USERNAME)) || undefined,
    password: encPassword ? await decryptIfPresent(encPassword) : undefined,
    authorName: (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_NAME)) || undefined,
    authorEmail:
      (await getConfig(db, CONFIG_KEYS.GIT_AUTHOR_EMAIL)) || undefined,
    provider: "generic" as GitProvider,
    authMode: "pat",
  };
}
