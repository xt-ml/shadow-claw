import { decryptValue, encryptValue } from "../../crypto.js";
import {
  getEmailPluginManifest,
  listEmailPluginManifests,
} from "../../email/catalog.js";
import {
  bindEmailCredentialRef,
  deleteEmailConnection,
  getEmailConnection,
  listEmailConnections,
  upsertEmailConnection,
  type EmailConnectionRecord,
} from "../../email/connections.js";
import { listRemoteMcpConnections } from "../../mcp-connections.js";
import { resolveServiceCredentials } from "../../accounts/service-accounts.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { writeGroupFileBytes } from "../../storage/writeGroupFileBytes.js";
import { groupFileExists } from "../../storage/groupFileExists.js";
import { ulid } from "../../ulid.js";
import type { ShadowClawDatabase } from "../../types.js";

interface ResolvedIntegrationEmailAuth {
  authType: "basic_userpass" | "oauth";
  username: string;
  password?: string;
  accessToken?: string;
}

interface EmailAttachmentInput {
  path: string;
  filename?: string;
  contentType?: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asNumber(
  value: unknown,
  fallback: number,
  options?: { min?: number; max?: number },
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  let result = parsed;
  if (typeof options?.min === "number") {
    result = Math.max(options.min, result);
  }

  if (typeof options?.max === "number") {
    result = Math.min(options.max, result);
  }

  return result;
}

function asUidArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uids = value
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.floor(item));

  return Array.from(new Set(uids));
}

function asEmailAttachmentInputs(value: unknown): EmailAttachmentInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: EmailAttachmentInput[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const path = item.trim();
      if (path) {
        parsed.push({ path });
      }

      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const path =
      typeof (item as { path?: unknown }).path === "string"
        ? (item as { path: string }).path.trim()
        : "";
    if (!path) {
      continue;
    }

    const filename =
      typeof (item as { filename?: unknown }).filename === "string"
        ? (item as { filename: string }).filename.trim()
        : "";
    const contentType =
      typeof (item as { content_type?: unknown }).content_type === "string"
        ? (item as { content_type: string }).content_type.trim()
        : "";

    parsed.push({
      path,
      filename: filename || undefined,
      contentType: contentType || undefined,
    });
  }

  return parsed;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }

  return out;
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  return parts[parts.length - 1] || "attachment.bin";
}

function sanitizeFilename(value: string): string {
  const sanitized = value.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").trim();

  return sanitized || "attachment.bin";
}

function guessMimeTypeFromFilename(filename: string): string | undefined {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".gif")) {
    return "image/gif";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return "text/plain";
  }

  return undefined;
}

async function resolveUniqueAttachmentPath(
  db: ShadowClawDatabase,
  groupId: string,
  directory: string,
  rawFilename: string,
): Promise<string> {
  const filename = sanitizeFilename(rawFilename);
  const idx = filename.lastIndexOf(".");
  const stem = idx > 0 ? filename.slice(0, idx) : filename;
  const ext = idx > 0 ? filename.slice(idx) : "";
  const baseDirectory = directory.trim().replace(/^\/+|\/+$/g, "");

  for (let i = 0; i < 1000; i++) {
    const candidateName = i === 0 ? filename : `${stem}-${i + 1}${ext}`;
    const candidatePath = baseDirectory
      ? `${baseDirectory}/${candidateName}`
      : candidateName;
    const exists = await groupFileExists(db, groupId, candidatePath);
    if (!exists) {
      return candidatePath;
    }
  }

  return baseDirectory
    ? `${baseDirectory}/${ulid()}-${filename}`
    : `${ulid()}-${filename}`;
}

async function resolveIntegrationEmailAuth(
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

export async function executeManageEmailTool(
  db: ShadowClawDatabase,
  input: Record<string, unknown>,
  groupId: string,
): Promise<string> {
  const action = typeof input.action === "string" ? input.action.trim() : "";

  if (!action) {
    return "Error: manage_email requires action.";
  }

  if (action === "list_plugins") {
    const manifests = listEmailPluginManifests();
    if (!manifests.length) {
      return "No integration plugins are available.";
    }

    return manifests
      .map(
        (manifest) =>
          `- ${manifest.id} (${manifest.protocol})\n` +
          `  Name: ${manifest.name}\n` +
          `  Actions: ${manifest.actions.join(", ")}\n` +
          `  Auth: ${manifest.authTypes.join(", ")}\n` +
          `  Fields: ${manifest.configurableFields.join(", ") || "(none)"}`,
      )
      .join("\n\n");
  }

  if (action === "list_connections") {
    const connections = await listEmailConnections(db);
    if (!connections.length) {
      return "No integration connections configured.";
    }

    return connections
      .map((connection) => {
        const manifest = getEmailPluginManifest(connection.pluginId);
        const configKeys = Object.keys(connection.config || {});

        return (
          `- ${connection.id} (${connection.label})\n` +
          `  Plugin: ${connection.pluginId}${manifest ? ` (${manifest.name})` : ""}\n` +
          `  Enabled: ${connection.enabled}\n` +
          `  Config keys: ${configKeys.join(", ") || "(none)"}`
        );
      })
      .join("\n\n");
  }

  if (action === "status") {
    const manifests = listEmailPluginManifests();
    const connections = await listEmailConnections(db);
    const remoteMcp = await listRemoteMcpConnections(db);

    const byPlugin = new Map<string, number>();
    for (const connection of connections) {
      byPlugin.set(
        connection.pluginId,
        (byPlugin.get(connection.pluginId) || 0) + 1,
      );
    }

    const lines: string[] = [];
    lines.push("Plugin catalog:");
    for (const manifest of manifests) {
      const count = byPlugin.get(manifest.id) || 0;
      lines.push(
        `- ${manifest.id}: ${count} connection${count === 1 ? "" : "s"} (${manifest.actions.join(", ")})`,
      );
    }

    lines.push("");
    lines.push(`Configured plugin connections: ${connections.length}`);
    lines.push(`Existing Remote MCP connections: ${remoteMcp.length}`);
    lines.push(
      "Remote MCP remains managed by the dedicated Remote MCP settings card and tools.",
    );

    return lines.join("\n");
  }

  if (action === "connect") {
    const pluginId =
      typeof input.plugin_id === "string" ? input.plugin_id.trim() : "imap";
    const label = typeof input.label === "string" ? input.label.trim() : "";

    if (!getEmailPluginManifest(pluginId)) {
      return `Error: Unknown plugin_id ${pluginId}. Use action=list_plugins.`;
    }

    if (!label) {
      return "Error: connect requires label.";
    }

    const config =
      input.config && typeof input.config === "object"
        ? (input.config as Record<string, unknown>)
        : {};
    const record = await upsertEmailConnection(db, {
      label,
      pluginId,
      enabled: input.enabled !== false,
      config,
    });

    const username =
      typeof input.username === "string" ? input.username.trim() : "";
    const password =
      typeof input.password === "string" ? input.password.trim() : "";
    if (username && password) {
      const encryptedSecret = await encryptValue(password);
      if (!encryptedSecret) {
        return "Error: Unable to encrypt integration credential.";
      }

      await bindEmailCredentialRef(db, record.id, {
        serviceType: "http_api",
        authType: "basic_userpass",
        username,
        encryptedSecret,
      });
    }

    return `Email connection created: ${record.id} (${record.label}) for plugin ${record.pluginId}.`;
  }

  if (action === "configure") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";

    if (!connectionRef) {
      return "Error: configure requires connection_id (id or label).";
    }

    const current = await getEmailConnection(db, connectionRef);
    if (!current) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    const config =
      input.config && typeof input.config === "object"
        ? (input.config as Record<string, unknown>)
        : current.config;
    const enabled =
      typeof input.enabled === "boolean" ? input.enabled : current.enabled;
    const label =
      typeof input.label === "string" && input.label.trim()
        ? input.label.trim()
        : current.label;

    const updated = await upsertEmailConnection(db, {
      id: current.id,
      label,
      pluginId: current.pluginId,
      enabled,
      config,
    });

    const username =
      typeof input.username === "string"
        ? input.username.trim()
        : (current.credentialRef?.username ?? "").trim();
    const password =
      typeof input.password === "string" ? input.password.trim() : "";

    if (username || password || current.credentialRef) {
      const encryptedSecret = password
        ? await encryptValue(password)
        : (current.credentialRef?.encryptedSecret ?? "");

      if (!username || !encryptedSecret) {
        return "Error: configure credential updates require both username and password (or an existing stored password).";
      }

      await bindEmailCredentialRef(db, updated.id, {
        serviceType: "http_api",
        authType: "basic_userpass",
        username,
        encryptedSecret,
      });
    }

    return `Integration connection updated: ${updated.id} (${updated.label}).`;
  }

  if (action === "enable" || action === "disable") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";

    if (!connectionRef) {
      return `${action} requires connection_id (id or label).`;
    }

    const current = await getEmailConnection(db, connectionRef);
    if (!current) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    const updated = await upsertEmailConnection(db, {
      id: current.id,
      label: current.label,
      pluginId: current.pluginId,
      enabled: action === "enable",
      config: current.config,
    });

    return `Integration connection ${updated.id} is now ${updated.enabled ? "enabled" : "disabled"}.`;
  }

  if (action === "delete") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";

    if (!connectionRef) {
      return "delete requires connection_id (id or label).";
    }

    const current = await getEmailConnection(db, connectionRef);
    if (!current) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    const deleted = await deleteEmailConnection(db, current.id);
    if (!deleted) {
      return `Error: Failed to delete integration connection ${current.id}.`;
    }

    return `Integration connection deleted: ${current.id} (${current.label}).`;
  }

  if (action === "test") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";

    if (!connectionRef) {
      return "test requires connection_id (id or label).";
    }

    const current = await getEmailConnection(db, connectionRef);
    if (!current) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    const manifest = getEmailPluginManifest(current.pluginId);
    const configKeys = Object.keys(current.config || {});

    return (
      `Integration test (structural) passed for ${current.id}.\n` +
      `Plugin: ${current.pluginId}${manifest ? ` (${manifest.name})` : ""}\n` +
      `Enabled: ${current.enabled}\n` +
      `Config keys: ${configKeys.join(", ") || "(none)"}\n` +
      "Note: network-level probes are plugin-specific and will be added with runtime implementations."
    );
  }

  if (action === "read_messages") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";
    let connection = connectionRef
      ? await getEmailConnection(db, connectionRef)
      : null;

    if (!connection) {
      const connections = await listEmailConnections(db);
      const candidates = connections.filter(
        (item) => item.enabled && item.pluginId === "imap",
      );
      if (candidates.length === 1) {
        connection = candidates[0];
      }
    }

    if (!connectionRef && !connection) {
      return "Error: manage_email read_messages requires connection_id when more than one enabled IMAP connection exists.";
    }

    if (!connection) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    if (!connection.enabled) {
      return `Error: Integration connection ${connection.id} is disabled.`;
    }

    const manifest = getEmailPluginManifest(connection.pluginId);
    if (!manifest?.actions.includes("messages.read")) {
      return `Error: Integration plugin ${connection.pluginId} does not support messages.read.`;
    }

    const auth = await resolveIntegrationEmailAuth(db, connection, input);
    if (typeof auth === "string") {
      return auth;
    }

    const host =
      (typeof input.host === "string" ? input.host.trim() : "") ||
      (typeof connection.config.host === "string"
        ? connection.config.host
        : "");
    const port = asNumber(input.port ?? connection.config.port, 993, {
      min: 1,
      max: 65535,
    });

    const secure =
      typeof input.secure === "boolean"
        ? input.secure
        : typeof connection.config.secure === "boolean"
          ? connection.config.secure
          : port === 993;
    const mailboxPath =
      (typeof input.mailbox_path === "string"
        ? input.mailbox_path.trim()
        : "") ||
      (typeof connection.config.mailboxPath === "string"
        ? connection.config.mailboxPath
        : "INBOX");
    const unreadOnly =
      typeof input.unread_only === "boolean"
        ? input.unread_only
        : Boolean(connection.config.unreadOnly);
    const limit = asNumber(input.limit, 10, { min: 1, max: 50 });

    if (!host) {
      return `Error: Integration connection ${connection.id} is missing IMAP host.`;
    }

    let response = await fetch("/integrations/email/read", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authType: auth.authType,
        host,
        port,
        secure,
        username: auth.username,
        password: auth.password,
        accessToken: auth.accessToken,
        mailboxPath,
        limit,
        unreadOnly,
      }),
    });

    if (response.status === 401 && auth.authType === "oauth") {
      const refreshedAuth = await resolveIntegrationEmailAuth(
        db,
        connection,
        input,
        true,
      );
      if (typeof refreshedAuth === "string") {
        return refreshedAuth;
      }

      response = await fetch("/integrations/email/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authType: refreshedAuth.authType,
          host,
          port,
          secure,
          username: refreshedAuth.username,
          password: refreshedAuth.password,
          accessToken: refreshedAuth.accessToken,
          mailboxPath,
          limit,
          unreadOnly,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return `Error: IMAP read failed (${response.status}): ${data.error || response.statusText}`;
    }

    return JSON.stringify(data, null, 2);
  }

  if (action === "send_message") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";
    let connection = connectionRef
      ? await getEmailConnection(db, connectionRef)
      : null;

    if (!connection) {
      const connections = await listEmailConnections(db);
      const candidates = connections.filter(
        (item) => item.enabled && item.pluginId === "imap",
      );
      if (candidates.length === 1) {
        connection = candidates[0];
      }
    }

    if (!connectionRef && !connection) {
      return "Error: manage_email send_message requires connection_id when more than one enabled IMAP connection exists.";
    }

    if (!connection) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    if (!connection.enabled) {
      return `Error: Integration connection ${connection.id} is disabled.`;
    }

    const manifest = getEmailPluginManifest(connection.pluginId);
    if (!manifest?.actions.includes("messages.send")) {
      return `Error: Integration plugin ${connection.pluginId} does not support messages.send.`;
    }

    const to = asStringArray(input.to);
    const cc = asStringArray(input.cc);
    const bcc = asStringArray(input.bcc);
    const attachmentInputs = asEmailAttachmentInputs(input.attachments);
    const subject =
      typeof input.subject === "string" ? input.subject.trim() : "";
    const text = typeof input.body === "string" ? input.body : "";
    const html = typeof input.html === "string" ? input.html : "";

    if (!to.length) {
      return "Error: manage_email send_message requires at least one recipient in to.";
    }

    if (!subject) {
      return "Error: manage_email send_message requires subject.";
    }

    if (!text && !html) {
      return "Error: manage_email send_message requires body or html content.";
    }

    const auth = await resolveIntegrationEmailAuth(db, connection, input);
    if (typeof auth === "string") {
      return auth;
    }

    const smtpHost =
      (typeof input.smtp_host === "string" ? input.smtp_host.trim() : "") ||
      (typeof connection.config.smtpHost === "string"
        ? connection.config.smtpHost
        : typeof connection.config.host === "string"
          ? connection.config.host
          : "");
    const smtpPort = asNumber(
      input.smtp_port ?? connection.config.smtpPort,
      587,
      {
        min: 1,
        max: 65535,
      },
    );

    const smtpSecure =
      typeof input.smtp_secure === "boolean"
        ? input.smtp_secure
        : typeof connection.config.smtpSecure === "boolean"
          ? connection.config.smtpSecure
          : smtpPort === 465;
    const from =
      (typeof input.from === "string" ? input.from.trim() : "") ||
      (typeof connection.config.fromAddress === "string"
        ? connection.config.fromAddress
        : auth.username);
    const replyTo =
      typeof input.reply_to === "string" ? input.reply_to.trim() : "";

    if (!smtpHost) {
      return `Error: Integration connection ${connection.id} is missing SMTP host.`;
    }

    const attachmentsPayload: Array<{
      filename: string;
      contentType?: string;
      contentBase64: string;
    }> = [];

    for (const attachment of attachmentInputs) {
      let bytes: Uint8Array;
      try {
        bytes = await readGroupFileBytes(db, groupId, attachment.path);
      } catch {
        return `Error: Attachment file not found or unreadable: ${attachment.path}`;
      }

      const filename = attachment.filename || basename(attachment.path);
      attachmentsPayload.push({
        filename,
        contentType:
          attachment.contentType || guessMimeTypeFromFilename(filename),
        contentBase64: bytesToBase64(bytes),
      });
    }

    let response = await fetch("/integrations/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authType: auth.authType,
        smtpHost,
        smtpPort,
        smtpSecure,
        username: auth.username,
        password: auth.password,
        accessToken: auth.accessToken,
        from,
        replyTo,
        to,
        cc,
        bcc,
        subject,
        text,
        html,
        attachments: attachmentsPayload,
      }),
    });

    if (response.status === 401 && auth.authType === "oauth") {
      const refreshedAuth = await resolveIntegrationEmailAuth(
        db,
        connection,
        input,
        true,
      );
      if (typeof refreshedAuth === "string") {
        return refreshedAuth;
      }

      response = await fetch("/integrations/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authType: refreshedAuth.authType,
          smtpHost,
          smtpPort,
          smtpSecure,
          username: refreshedAuth.username,
          password: refreshedAuth.password,
          accessToken: refreshedAuth.accessToken,
          from,
          replyTo,
          to,
          cc,
          bcc,
          subject,
          text,
          html,
          attachments: attachmentsPayload,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return `Error: SMTP send failed (${response.status}): ${data.error || response.statusText}`;
    }

    return JSON.stringify(data, null, 2);
  }

  if (action === "download_attachments") {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";
    let connection = connectionRef
      ? await getEmailConnection(db, connectionRef)
      : null;

    if (!connection) {
      const connections = await listEmailConnections(db);
      const candidates = connections.filter(
        (item) => item.enabled && item.pluginId === "imap",
      );
      if (candidates.length === 1) {
        connection = candidates[0];
      }
    }

    if (!connectionRef && !connection) {
      return "Error: manage_email download_attachments requires connection_id when more than one enabled IMAP connection exists.";
    }

    if (!connection) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    if (!connection.enabled) {
      return `Error: Integration connection ${connection.id} is disabled.`;
    }

    const messageUid = asNumber(input.message_uid, 0, { min: 1 });
    if (!messageUid) {
      return "Error: manage_email download_attachments requires message_uid.";
    }

    const auth = await resolveIntegrationEmailAuth(db, connection, input);
    if (typeof auth === "string") {
      return auth;
    }

    const host =
      (typeof input.host === "string" ? input.host.trim() : "") ||
      (typeof connection.config.host === "string"
        ? connection.config.host
        : "");
    const port = asNumber(input.port ?? connection.config.port, 993, {
      min: 1,
      max: 65535,
    });

    const secure =
      typeof input.secure === "boolean"
        ? input.secure
        : typeof connection.config.secure === "boolean"
          ? connection.config.secure
          : port === 993;
    const mailboxPath =
      (typeof input.mailbox_path === "string"
        ? input.mailbox_path.trim()
        : "") ||
      (typeof connection.config.mailboxPath === "string"
        ? connection.config.mailboxPath
        : "INBOX");
    const attachmentParts = asStringArray(input.attachment_parts);
    const saveDirectory =
      typeof input.save_directory === "string" && input.save_directory.trim()
        ? input.save_directory.trim()
        : "downloads/email";

    if (!host) {
      return `Error: Integration connection ${connection.id} is missing IMAP host.`;
    }

    let response = await fetch("/integrations/email/download-attachments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        authType: auth.authType,
        host,
        port,
        secure,
        username: auth.username,
        password: auth.password,
        accessToken: auth.accessToken,
        mailboxPath,
        messageUid,
        attachmentParts,
      }),
    });

    if (response.status === 401 && auth.authType === "oauth") {
      const refreshedAuth = await resolveIntegrationEmailAuth(
        db,
        connection,
        input,
        true,
      );
      if (typeof refreshedAuth === "string") {
        return refreshedAuth;
      }

      response = await fetch("/integrations/email/download-attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authType: refreshedAuth.authType,
          host,
          port,
          secure,
          username: refreshedAuth.username,
          password: refreshedAuth.password,
          accessToken: refreshedAuth.accessToken,
          mailboxPath,
          messageUid,
          attachmentParts,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return `Error: IMAP attachment download failed (${response.status}): ${data.error || response.statusText}`;
    }

    const attachments = Array.isArray(data.attachments) ? data.attachments : [];
    const saved: string[] = [];

    for (const item of attachments) {
      const filename =
        typeof item?.filename === "string" ? item.filename : "attachment.bin";
      const contentBase64 =
        typeof item?.contentBase64 === "string" ? item.contentBase64 : "";
      if (!contentBase64) {
        continue;
      }

      const bytes = base64ToBytes(contentBase64);
      const targetPath = await resolveUniqueAttachmentPath(
        db,
        groupId,
        saveDirectory,
        filename,
      );

      await writeGroupFileBytes(db, groupId, targetPath, bytes);
      saved.push(targetPath);
    }

    return JSON.stringify(
      {
        mailbox: data.mailbox || mailboxPath,
        message_uid: messageUid,
        downloaded_count: saved.length,
        saved_paths: saved,
      },
      null,
      2,
    );
  }

  if (
    action === "mark_as_read" ||
    action === "mark_as_unread" ||
    action === "delete_messages"
  ) {
    const connectionRef =
      typeof input.connection_id === "string" ? input.connection_id.trim() : "";
    let connection = connectionRef
      ? await getEmailConnection(db, connectionRef)
      : null;

    if (!connection) {
      const connections = await listEmailConnections(db);
      const candidates = connections.filter(
        (item) => item.enabled && item.pluginId === "imap",
      );
      if (candidates.length === 1) {
        connection = candidates[0];
      }
    }

    if (!connectionRef && !connection) {
      return `Error: manage_email ${action} requires connection_id when more than one enabled IMAP connection exists.`;
    }

    if (!connection) {
      return `Error: Integration connection not found: ${connectionRef}`;
    }

    if (!connection.enabled) {
      return `Error: Integration connection ${connection.id} is disabled.`;
    }

    const manifest = getEmailPluginManifest(connection.pluginId);
    if (!manifest?.actions.includes("messages.read")) {
      return `Error: Integration plugin ${connection.pluginId} does not support inbox message updates.`;
    }

    const messageUids = asUidArray(input.message_uids);
    if (!messageUids.length) {
      return `Error: manage_email ${action} requires message_uids (array of UID numbers).`;
    }

    const auth = await resolveIntegrationEmailAuth(db, connection, input);
    if (typeof auth === "string") {
      return auth;
    }

    const host =
      (typeof input.host === "string" ? input.host.trim() : "") ||
      (typeof connection.config.host === "string"
        ? connection.config.host
        : "");
    const port = asNumber(input.port ?? connection.config.port, 993, {
      min: 1,
      max: 65535,
    });

    const secure =
      typeof input.secure === "boolean"
        ? input.secure
        : typeof connection.config.secure === "boolean"
          ? connection.config.secure
          : port === 993;
    const mailboxPath =
      (typeof input.mailbox_path === "string"
        ? input.mailbox_path.trim()
        : "") ||
      (typeof connection.config.mailboxPath === "string"
        ? connection.config.mailboxPath
        : "INBOX");

    if (!host) {
      return `Error: Integration connection ${connection.id} is missing IMAP host.`;
    }

    let response = await fetch("/integrations/email/modify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        authType: auth.authType,
        host,
        port,
        secure,
        username: auth.username,
        password: auth.password,
        accessToken: auth.accessToken,
        mailboxPath,
        messageUids,
      }),
    });

    if (response.status === 401 && auth.authType === "oauth") {
      const refreshedAuth = await resolveIntegrationEmailAuth(
        db,
        connection,
        input,
        true,
      );
      if (typeof refreshedAuth === "string") {
        return refreshedAuth;
      }

      response = await fetch("/integrations/email/modify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          authType: refreshedAuth.authType,
          host,
          port,
          secure,
          username: refreshedAuth.username,
          password: refreshedAuth.password,
          accessToken: refreshedAuth.accessToken,
          mailboxPath,
          messageUids,
        }),
      });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return `Error: IMAP modify failed (${response.status}): ${data.error || response.statusText}`;
    }

    return JSON.stringify(data, null, 2);
  }

  return `Error: Unsupported manage_email action: ${action}`;
}
