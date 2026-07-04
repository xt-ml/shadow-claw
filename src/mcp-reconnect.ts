import { CONFIG_KEYS, OAUTH_PROVIDER_DEFINITIONS } from "./config.js";
import { decryptValue, encryptValue } from "./crypto.js";
import { getConfig } from "./db/getConfig.js";
import { setConfig } from "./db/setConfig.js";
import { getRemoteMcpConnection } from "./mcp-connections.js";
import { clearRemoteMcpSession } from "./remote-mcp-client.js";

import type { ServiceAccount } from "./accounts/service-accounts.js";
import type { RemoteMcpCredentialRef } from "./mcp-connections.js";
import type {
  GitAccount,
  OAuthAccountLike,
  ReconnectMcpOAuthOptions,
  ReconnectMcpOAuthResult,
  ShadowClawDatabase,
} from "./types.js";

/** Helper to build account update fields from OAuth token payload. */
function buildOAuthUpdateFields(
  payload: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    tokenType?: string;
    scope?: string;
  },
  existingAccount: OAuthAccountLike,
  encryptedAccessToken: string,
  encryptedRefreshToken: string | undefined,
) {
  return {
    accessTokenExpiresAt: payload.expiresIn
      ? Date.now() + payload.expiresIn * 1000
      : existingAccount.accessTokenExpiresAt,
    oauthReauthRequired: false,
    oauthReauthRequiredAt: undefined,
    oauthRefreshFailureCount: 0,
    refreshToken: encryptedRefreshToken,
    scopes: payload.scope
      ? payload.scope
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : existingAccount.scopes,
    token: encryptedAccessToken,
    tokenType: payload.tokenType || existingAccount.tokenType,
  };
}

/**
 * Try a silent OAuth token refresh using the existing refresh token.
 * Returns `true` if the token was successfully refreshed and persisted.
 */
async function trySilentRefresh(
  db: ShadowClawDatabase,
  account: OAuthAccountLike,
  accountStore: "service" | "git",
  serviceAccounts: ServiceAccount[],
  gitAccounts: GitAccount[],
  ref: RemoteMcpCredentialRef,
  connectionId: string,
): Promise<ReconnectMcpOAuthResult> {
  if (!account.refreshToken) {
    return { success: false, error: "No refresh token available." };
  }

  const decryptedRefreshToken = await decryptValue(account.refreshToken);
  if (!decryptedRefreshToken) {
    return { success: false, error: "Failed to decrypt refresh token." };
  }

  const clientSecret = account.oauthClientSecret
    ? await decryptValue(account.oauthClientSecret)
    : undefined;

  try {
    const response = await fetch("/oauth/refresh", {
      body: JSON.stringify({
        clientId: account.oauthClientId,
        clientSecret: clientSecret || undefined,
        providerId: account.oauthProviderId,
        refreshToken: decryptedRefreshToken,
        scope: account.scopes,
        tokenUrl: account.oauthCustomTokenUrl,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      return { success: false, error: "Token refresh request failed." };
    }

    const payload = (await response.json()) as {
      accessToken?: string;
      expiresIn?: number;
      refreshToken?: string;
      scope?: string;
      tokenType?: string;
    };

    if (!payload.accessToken) {
      return { success: false, error: "No access token in refresh response." };
    }

    const encryptedAccessToken = await encryptValue(payload.accessToken);
    if (!encryptedAccessToken) {
      return { success: false, error: "Failed to encrypt access token." };
    }

    let encryptedRefreshToken = account.refreshToken;
    if (payload.refreshToken) {
      const maybeEncrypted = await encryptValue(payload.refreshToken);
      if (maybeEncrypted) {
        encryptedRefreshToken = maybeEncrypted;
      }
    }

    const updatedFields = buildOAuthUpdateFields(
      {
        accessToken: payload.accessToken,
        expiresIn: payload.expiresIn,
        refreshToken: payload.refreshToken,
        scope: payload.scope,
        tokenType: payload.tokenType,
      },
      account,
      encryptedAccessToken,
      encryptedRefreshToken,
    );

    if (accountStore === "service" && ref.accountId) {
      const idx = serviceAccounts.findIndex(
        (acct) => acct.id === ref.accountId,
      );

      if (idx !== -1) {
        Object.assign(serviceAccounts[idx], updatedFields);

        await setConfig(db, CONFIG_KEYS.SERVICE_ACCOUNTS, serviceAccounts);
      }
    } else if (accountStore === "git" && ref.gitAccountId) {
      const idx = gitAccounts.findIndex((acct) => acct.id === ref.gitAccountId);
      if (idx !== -1) {
        Object.assign(gitAccounts[idx], updatedFields);

        await setConfig(db, CONFIG_KEYS.GIT_ACCOUNTS, gitAccounts);
      }
    }

    clearRemoteMcpSession(connectionId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return { success: false, error: `Silent refresh failed: ${message}` };
  }
}

/**
 * Performs OAuth re-authentication for a remote MCP connection.
 *
 * When `silentOnly` is true, only attempts a token refresh using the
 * existing refresh token — no popup is opened.  This is used for
 * automatic reconnection from the orchestrator (no user gesture).
 *
 * When `silentOnly` is false (default), first tries a silent refresh,
 * and if that fails, opens a popup for full re-authorization.
 */
export async function reconnectMcpOAuth(
  db: ShadowClawDatabase,
  connectionId: string,
  options: ReconnectMcpOAuthOptions = {},
): Promise<ReconnectMcpOAuthResult> {
  const connection = await getRemoteMcpConnection(db, connectionId);
  if (!connection?.credentialRef) {
    return { success: false, error: "Connection not found." };
  }

  const ref = connection.credentialRef;
  if (ref.authType !== "oauth") {
    return {
      success: false,
      error: "This connection does not use OAuth authentication.",
    };
  }

  // Load accounts from DB
  const serviceRaw = await getConfig(db, CONFIG_KEYS.SERVICE_ACCOUNTS);
  const serviceAccounts: ServiceAccount[] = Array.isArray(serviceRaw)
    ? serviceRaw
    : [];

  const gitRaw = await getConfig(db, CONFIG_KEYS.GIT_ACCOUNTS);
  const gitAccounts: GitAccount[] = Array.isArray(gitRaw) ? gitRaw : [];

  // Find the linked account
  let account: OAuthAccountLike | undefined;
  let accountStore: "service" | "git" | null = null;

  if (ref.accountId) {
    account = serviceAccounts.find((acct) => acct.id === ref.accountId) as
      | OAuthAccountLike
      | undefined;

    accountStore = "service";
  } else if (ref.gitAccountId) {
    account = gitAccounts.find((acct) => acct.id === ref.gitAccountId) as
      | OAuthAccountLike
      | undefined;

    accountStore = "git";
  }

  if (!account || !accountStore) {
    return {
      error:
        "Linked account not found. Edit the connection to re-configure authentication.",
      success: false,
    };
  }

  const clientId = account.oauthClientId;
  const providerId = account.oauthProviderId;

  if (!providerId || !clientId) {
    return {
      error:
        "Account is missing OAuth provider or client ID. Edit the account in Settings → Accounts to fix.",
      success: false,
    };
  }

  // ── Silent refresh attempt ───────────────────────────────────────
  // Always try a silent token refresh first.  This works without a
  // popup and handles the common case where the refresh token is
  // still valid but the access token expired.
  if (account.refreshToken) {
    const silentResult = await trySilentRefresh(
      db,
      account,
      accountStore,
      serviceAccounts,
      gitAccounts,
      ref,
      connectionId,
    );

    if (silentResult.success) {
      return silentResult;
    }
  }

  // If silentOnly was requested, don't open a popup.
  if (options.silentOnly) {
    return {
      error:
        "Silent token refresh failed. Use Settings → Remote MCP → Reconnect OAuth for full re-authorization.",
      success: false,
    };
  }

  const clientSecret = account.oauthClientSecret
    ? await decryptValue(account.oauthClientSecret)
    : undefined;

  const scope = account.scopes;

  // Resolve OAuth URLs
  const providerDef = OAUTH_PROVIDER_DEFINITIONS[providerId];
  const isCustomMcp = providerId === "custom_mcp";
  const redirectUri =
    isCustomMcp && account.oauthCustomRedirectUri
      ? account.oauthCustomRedirectUri
      : providerDef?.redirectUri
        ? providerDef.redirectUri
        : `${globalThis.location?.origin || ""}/oauth/callback`;

  try {
    const authorizeRes = await fetch("/oauth/authorize", {
      body: JSON.stringify({
        providerId,
        clientId,
        clientSecret: clientSecret || undefined,
        redirectUri,
        scope,
        ...(isCustomMcp && account.oauthCustomAuthorizeUrl
          ? { authorizeUrl: account.oauthCustomAuthorizeUrl }
          : {}),
        ...(isCustomMcp && account.oauthCustomTokenUrl
          ? { tokenUrl: account.oauthCustomTokenUrl }
          : {}),
        ...(isCustomMcp && typeof account.oauthCustomUsePkce === "boolean"
          ? { usePkce: account.oauthCustomUsePkce }
          : {}),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const authorizePayload = (await authorizeRes.json()) as {
      authorizeUrl?: string;
      error?: string;
      state?: string;
    };

    if (
      !authorizeRes.ok ||
      !authorizePayload.state ||
      !authorizePayload.authorizeUrl
    ) {
      throw new Error(authorizePayload.error || "OAuth authorize failed");
    }

    const popup = window.open(
      authorizePayload.authorizeUrl,
      "shadowclaw-oauth",
      "popup=yes,width=540,height=720",
    );

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      throw new Error(
        "OAuth popup was blocked by the browser. Please enable popups for this site and try again.",
      );
    }

    const state = authorizePayload.state;
    let status = "pending";
    for (let attempt = 0; attempt < 60; attempt++) {
      const sessionRes = await fetch(
        `/oauth/session/${encodeURIComponent(state)}`,
      );

      const sessionPayload = (await sessionRes.json()) as {
        error?: string;
        status?: string;
      };

      if (!sessionRes.ok) {
        throw new Error(sessionPayload.error || "OAuth session not found");
      }

      status = sessionPayload.status || "pending";

      if (status === "authorized") {
        break;
      }

      if (status === "error") {
        throw new Error(sessionPayload.error || "OAuth authorization failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (status !== "authorized") {
      throw new Error("OAuth authorization timed out");
    }

    const tokenRes = await fetch("/oauth/token", {
      body: JSON.stringify({ state }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const tokenPayload = (await tokenRes.json()) as {
      accessToken?: string;
      error?: string;
      expiresIn?: number;
      refreshToken?: string;
      scope?: string;
      tokenType?: string;
    };

    if (!tokenRes.ok || !tokenPayload.accessToken) {
      throw new Error(tokenPayload.error || "OAuth token exchange failed");
    }

    // Update the linked account with new tokens
    const encryptedAccessToken = await encryptValue(tokenPayload.accessToken);
    if (!encryptedAccessToken) {
      throw new Error("Failed to encrypt access token");
    }

    let encryptedRefreshToken = account.refreshToken;
    if (tokenPayload.refreshToken) {
      const maybeEncrypted = await encryptValue(tokenPayload.refreshToken);
      if (maybeEncrypted) {
        encryptedRefreshToken = maybeEncrypted;
      }
    }

    const updatedFields = buildOAuthUpdateFields(
      {
        accessToken: tokenPayload.accessToken,
        expiresIn: tokenPayload.expiresIn,
        refreshToken: tokenPayload.refreshToken,
        scope: tokenPayload.scope,
        tokenType: tokenPayload.tokenType,
      },
      account,
      encryptedAccessToken,
      encryptedRefreshToken,
    );

    // Persist to the correct account store
    if (accountStore === "service" && ref.accountId) {
      const idx = serviceAccounts.findIndex(
        (acct) => acct.id === ref.accountId,
      );
      if (idx !== -1) {
        Object.assign(serviceAccounts[idx], updatedFields);

        await setConfig(db, CONFIG_KEYS.SERVICE_ACCOUNTS, serviceAccounts);
      }
    } else if (accountStore === "git" && ref.gitAccountId) {
      const idx = gitAccounts.findIndex((acct) => acct.id === ref.gitAccountId);
      if (idx !== -1) {
        Object.assign(gitAccounts[idx], updatedFields);

        await setConfig(db, CONFIG_KEYS.GIT_ACCOUNTS, gitAccounts);
      }
    }

    // Clear the MCP session so the next call uses fresh credentials
    clearRemoteMcpSession(connectionId);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return { success: false, error: message };
  }
}
