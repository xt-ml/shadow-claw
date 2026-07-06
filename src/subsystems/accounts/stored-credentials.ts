export type StoredCredentialAuthMode = "token" | "basic" | "oauth";

export interface StoredCredentialBase {
  id: string;
  label: string;
  hostPattern: string;
  token: string;
  basicUsername?: string;
  authMode?: StoredCredentialAuthMode;
}

export interface StoredCredentialOAuthFields {
  oauthProviderId?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  scopes?: string[];
  tokenType?: string;
  oauthRefreshFailureCount?: number;
  oauthReauthRequired?: boolean;
  oauthReauthRequiredAt?: number;
  /** Custom authorize URL (used when oauthProviderId is "custom_mcp"). */
  oauthCustomAuthorizeUrl?: string;
  /** Custom token URL (used when oauthProviderId is "custom_mcp"). */
  oauthCustomTokenUrl?: string;
  /** Custom PKCE preference (used when oauthProviderId is "custom_mcp"). */
  oauthCustomUsePkce?: boolean;
  /** Custom redirect URI (used when oauthProviderId is "custom_mcp"). */
  oauthCustomRedirectUri?: string;
}

export interface PendingOAuthResult {
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
}

type OAuthCapableStoredCredential = {
  authMode?: StoredCredentialAuthMode;
} & StoredCredentialOAuthFields;

export function resolveStoredCredentialAuthMode(
  credential: OAuthCapableStoredCredential | null | undefined,
): StoredCredentialAuthMode {
  if (!credential) {
    return "token";
  }

  // Treat legacy "pat" string identically to "token" mode
  if (
    credential.authMode === "token" ||
    (credential.authMode as string) === "pat"
  ) {
    return "token";
  }

  if (credential.authMode === "basic") {
    return "basic";
  }

  if (credential.authMode === "oauth") {
    return "oauth";
  }

  if (
    credential.oauthProviderId ||
    credential.oauthClientId ||
    credential.oauthClientSecret ||
    credential.refreshToken ||
    credential.accessTokenExpiresAt ||
    credential.tokenType ||
    credential.oauthReauthRequired
  ) {
    return "oauth";
  }

  return "token";
}
