import type { ServiceAccount } from "../../../../subsystems/accounts/service-accounts.js";

export function resolveAccountAuthMode(
  account: ServiceAccount | null,
): "token" | "basic" | "oauth" {
  if (!account) {
    return "token";
  }

  if (
    account.authMode === "token" ||
    (account.authMode as string) === "token"
  ) {
    return "token";
  }

  if (account.authMode === "basic") {
    return "basic";
  }

  if (account.authMode === "oauth") {
    return "oauth";
  }

  if (
    account.oauthProviderId ||
    account.oauthClientId ||
    account.oauthClientSecret ||
    account.refreshToken ||
    account.accessTokenExpiresAt ||
    account.tokenType ||
    account.oauthReauthRequired
  ) {
    return "oauth";
  }

  return "token";
}
