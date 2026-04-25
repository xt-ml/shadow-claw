export type StoredCredentialAuthMode = "pat" | "oauth";

export interface StoredCredentialBase {
  id: string;
  label: string;
  hostPattern: string;
  token: string;
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
    return "pat";
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

  return "pat";
}
