import { ShadowClawDatabase } from "../../../../db/db.js";
import { decryptValue } from "../../../../security/crypto.js";
import { resolveServiceCredentials } from "../../../../subsystems/accounts/service-accounts.js";
import { EmailConnectionRecord } from "../../../../subsystems/email/connections.js";

import { ResolvedIntegrationEmailAuth } from "../email.js";

export async function resolveIntegrationEmailAuth(
  db: ShadowClawDatabase,
  connection: EmailConnectionRecord,
  input: Record<string, unknown>,
  forceRefresh = false,
): Promise<ResolvedIntegrationEmailAuth | string> {
  const username =
    (typeof input.username === "string" ? input.username.trim() : "") ||
    connection.credentialRef?.username ||
    (typeof connection.config.username === "string"
      ? connection.config.username
      : "");

  if (!username) {
    return `Error: Integration connection ${connection.id} is missing username credentials.`;
  }

  if (connection.credentialRef?.authType === "oauth") {
    const accountId = connection.credentialRef.accountId;
    if (!accountId) {
      return `Error: Integration connection ${connection.id} is missing linked OAuth account.`;
    }

    const creds = await resolveServiceCredentials(db, undefined, {
      accountId,
      authMode: "oauth",
      forceRefresh,
    });

    if (!creds || creds.reauthRequired || !creds.token) {
      const providerHint =
        connection.credentialRef?.providerId || "the configured";

      return (
        `Error: OAuth account reconnect required for integration ${connection.id}.\n` +
        `Open Settings -> Integrations, edit this email connection, and click Connect OAuth for ${providerHint} to re-authorize.`
      );
    }

    return {
      authType: "oauth",
      username,
      accessToken: creds.token,
    };
  }

  const password =
    (typeof input.password === "string" ? input.password.trim() : "") ||
    (connection.credentialRef?.encryptedSecret
      ? (await decryptValue(connection.credentialRef.encryptedSecret)) || ""
      : "");

  if (!password) {
    return `Error: Integration connection ${connection.id} is missing password credentials.`;
  }

  return {
    authType: "basic_userpass",
    username,
    password,
  };
}