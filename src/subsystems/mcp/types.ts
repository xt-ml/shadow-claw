export interface OAuthAccountLike {
  accessTokenExpiresAt?: number;
  id: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthCustomAuthorizeUrl?: string;
  oauthCustomRedirectUri?: string;
  oauthCustomTokenUrl?: string;
  oauthCustomUsePkce?: boolean;
  oauthProviderId?: string;
  refreshToken?: string;
  scopes?: string[];
  tokenType?: string;
}

export interface ReconnectMcpOAuthOptions {
  /** When true, only attempt a silent token refresh — do not open a popup. */
  silentOnly?: boolean;
}

export interface ReconnectMcpOAuthResult {
  error?: string;
  success: boolean;
}
