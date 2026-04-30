import { decryptValue } from "./crypto.js";
import { getRemoteMcpConnection } from "./mcp-connections.js";
import { resolveServiceCredentials } from "./accounts/service-accounts.js";
import { buildAuthHeaders, resolveGitCredentials } from "./git/credentials.js";

import type { ShadowClawDatabase } from "./types.js";
import type { RemoteMcpConnectionRecord } from "./mcp-connections.js";
import type { AuthType } from "./config.js";

export interface ResolvedRemoteMcpAuth {
  connection: RemoteMcpConnectionRecord;
  authType: AuthType;
  headers: Record<string, string>;
  reauthRequired?: boolean;
}

export interface ResolveRemoteMcpAuthOptions {
  forceRefresh?: boolean;
}

function toAccountAuthMode(authType: AuthType): "pat" | "oauth" {
  return authType === "oauth" ? "oauth" : "pat";
}

export async function resolveRemoteMcpConnectionAuth(
  db: ShadowClawDatabase,
  connectionId: string,
  options: ResolveRemoteMcpAuthOptions = {},
): Promise<ResolvedRemoteMcpAuth | null> {
  const connection = await getRemoteMcpConnection(db, connectionId);
  if (!connection) {
    return null;
  }

  const ref = connection.credentialRef;
  if (!ref || ref.authType === "none") {
    return {
      connection,
      authType: "none",
      headers: {},
    };
  }

  if (ref.authType === "custom_header") {
    if (!ref.headerName || !ref.encryptedValue) {
      return {
        connection,
        authType: "custom_header",
        headers: {},
      };
    }

    const decrypted = await decryptValue(ref.encryptedValue);

    return {
      connection,
      authType: "custom_header",
      headers: decrypted ? { [ref.headerName]: decrypted } : {},
    };
  }

  const authMode = toAccountAuthMode(ref.authType);

  if (ref.accountId) {
    const creds = await resolveServiceCredentials(db, connection.serverUrl, {
      accountId: ref.accountId,
      authMode,
      forceRefresh: options.forceRefresh,
    });

    if (!creds) {
      return {
        connection,
        authType: ref.authType,
        headers: {},
      };
    }

    if (creds.reauthRequired) {
      return {
        connection,
        authType: ref.authType,
        headers: {},
        reauthRequired: true,
      };
    }

    return {
      connection,
      authType: ref.authType,
      headers: creds.headerValue
        ? { [creds.headerName]: creds.headerValue }
        : {},
    };
  }

  if (ref.gitAccountId) {
    const creds = await resolveGitCredentials(db, connection.serverUrl, {
      accountId: ref.gitAccountId,
      authMode,
      forceRefresh: options.forceRefresh,
    });

    if (creds.reauthRequired) {
      return {
        connection,
        authType: ref.authType,
        headers: {},
        reauthRequired: true,
      };
    }

    return {
      connection,
      authType: ref.authType,
      headers: buildAuthHeaders(creds),
    };
  }

  return {
    connection,
    authType: ref.authType,
    headers: {},
  };
}
