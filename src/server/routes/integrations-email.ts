import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";

import type { Express } from "express";

interface ReadEmailRequestBody {
  authType?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  accessToken?: string;
  mailboxPath?: string;
  limit?: number;
  unreadOnly?: boolean;
}

interface SendEmailRequestBody {
  authType?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username?: string;
  password?: string;
  accessToken?: string;
  from?: string;
  replyTo?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    contentBase64?: string;
  }>;
}

interface ModifyEmailRequestBody {
  action?: string;
  authType?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  accessToken?: string;
  mailboxPath?: string;
  messageUids?: number[];
}

interface DownloadAttachmentsRequestBody {
  authType?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  accessToken?: string;
  mailboxPath?: string;
  messageUid?: number;
  attachmentParts?: string[];
}

interface EmailAuthErrorLike {
  authenticationFailed?: boolean;
  responseText?: string;
  serverResponseCode?: string;
  message?: string;
}

interface AttachmentInfo {
  part: string;
  filename: string;
  contentType: string;
  size?: number;
  disposition?: string;
}

function collectAttachmentInfo(
  node: any,
  out: AttachmentInfo[],
  fallbackPart = "1",
): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const part = typeof node.part === "string" ? node.part : fallbackPart;
  const disposition =
    typeof node.disposition === "string"
      ? node.disposition.toLowerCase()
      : typeof node.disposition?.type === "string"
        ? node.disposition.type.toLowerCase()
        : "";
  const hasFilename =
    typeof node.dispositionParameters?.filename === "string" ||
    typeof node.parameters?.name === "string";

  if (disposition === "attachment" || hasFilename) {
    out.push({
      part,
      filename:
        (typeof node.dispositionParameters?.filename === "string"
          ? node.dispositionParameters.filename
          : "") ||
        (typeof node.parameters?.name === "string"
          ? node.parameters.name
          : "") ||
        `attachment-${part}.bin`,
      contentType:
        typeof node.type === "string" && typeof node.subtype === "string"
          ? `${node.type.toLowerCase()}/${node.subtype.toLowerCase()}`
          : "application/octet-stream",
      size: typeof node.size === "number" ? node.size : undefined,
      disposition: disposition || undefined,
    });
  }

  const children = Array.isArray(node.childNodes) ? node.childNodes : [];
  children.forEach((child: any, index: number) => {
    const childPart =
      typeof child?.part === "string" ? child.part : `${part}.${index + 1}`;
    collectAttachmentInfo(child, out, childPart);
  });
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

function isAuthenticationError(error: unknown): error is EmailAuthErrorLike {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as EmailAuthErrorLike;

  return (
    candidate.authenticationFailed === true ||
    candidate.serverResponseCode === "AUTHENTICATIONFAILED" ||
    /authenticationfailed|invalid credentials/i.test(
      `${candidate.responseText || ""} ${candidate.message || ""}`,
    )
  );
}

function buildAuthFailureMessage(
  host: string,
  protocol: "imap" | "smtp",
  authType: "basic_userpass" | "oauth",
): string {
  const service = protocol === "imap" ? "mailbox" : "SMTP";
  const gmailHost = /gmail\.com$/i.test(host);

  if (authType === "oauth") {
    if (gmailHost) {
      return (
        `Authentication failed while connecting to ${service}. ` +
        "The Google OAuth token was rejected or expired. Reconnect Google OAuth in Email Integrations and try again."
      );
    }

    return `Authentication failed while connecting to ${service}. Reconnect the OAuth account for ${host} and try again.`;
  }

  if (gmailHost) {
    return (
      `Authentication failed while connecting to ${service}. ` +
      "Gmail rejected the username/password. Use a Google App Password, not your normal account password, and make sure IMAP access is enabled for the account."
    );
  }

  return `Authentication failed while connecting to ${service}. Verify the username/password and any app-password requirement for ${host}.`;
}

export function registerIntegrationEmailRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  app.post("/integrations/email/download-attachments", async (req, res) => {
    const body: DownloadAttachmentsRequestBody = req.body || {};
    const authType = body.authType === "oauth" ? "oauth" : "basic_userpass";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const messageUid = asNumber(body.messageUid, 0, { min: 1 });
    const requestedParts = Array.isArray(body.attachmentParts)
      ? body.attachmentParts
          .filter((part): part is string => typeof part === "string")
          .map((part) => part.trim())
          .filter(Boolean)
      : [];

    if (
      !host ||
      !username ||
      (authType === "oauth" ? !accessToken : !password)
    ) {
      return res.status(400).json({
        error:
          authType === "oauth"
            ? "Missing required fields: host, username, accessToken."
            : "Missing required fields: host, username, password.",
      });
    }

    if (!messageUid) {
      return res.status(400).json({
        error: "Missing required field: messageUid.",
      });
    }

    const port = asNumber(body.port, 993, { min: 1, max: 65535 });
    const secure =
      typeof body.secure === "boolean" ? body.secure : port === 993;
    const mailboxPath =
      typeof body.mailboxPath === "string" && body.mailboxPath.trim()
        ? body.mailboxPath.trim()
        : "INBOX";

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth:
        authType === "oauth"
          ? {
              user: username,
              accessToken,
            }
          : {
              user: username,
              pass: password,
            },
    });

    try {
      await client.connect();
      await client.mailboxOpen(mailboxPath);

      const message = await client.fetchOne(
        messageUid,
        {
          uid: true,
          bodyStructure: true,
        },
        {
          uid: true,
        },
      );

      const attachments: AttachmentInfo[] = [];
      collectAttachmentInfo((message as any)?.bodyStructure, attachments);

      const selected = requestedParts.length
        ? attachments.filter((entry) => requestedParts.includes(entry.part))
        : attachments;

      const downloaded: Array<AttachmentInfo & { contentBase64: string }> = [];

      for (const attachment of selected) {
        const result: any = await client.download(messageUid, attachment.part, {
          uid: true,
        });

        const chunks: Buffer[] = [];
        for await (const chunk of result.content) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        downloaded.push({
          ...attachment,
          contentBase64: Buffer.concat(chunks).toString("base64"),
        });
      }

      return res.json({
        mailbox: mailboxPath,
        messageUid,
        count: downloaded.length,
        attachments: downloaded,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.error(
          "[Integrations] IMAP attachment download failed:",
          message,
        );
      }

      if (isAuthenticationError(error)) {
        return res.status(401).json({
          error: buildAuthFailureMessage(host, "imap", authType),
        });
      }

      return res.status(502).json({
        error: `Failed to download attachments: ${message}`,
      });
    } finally {
      try {
        if (client.usable) {
          await client.logout();
        }
      } catch {
        // Best effort cleanup.
      }
    }
  });

  app.post("/integrations/email/modify", async (req, res) => {
    const body: ModifyEmailRequestBody = req.body || {};
    const action =
      body.action === "mark_as_read" ||
      body.action === "mark_as_unread" ||
      body.action === "delete_messages"
        ? body.action
        : "";
    const authType = body.authType === "oauth" ? "oauth" : "basic_userpass";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const messageUids = Array.isArray(body.messageUids)
      ? body.messageUids
          .map((uid) => (typeof uid === "number" ? uid : Number(uid)))
          .filter((uid) => Number.isFinite(uid) && uid > 0)
          .map((uid) => Math.floor(uid))
      : [];

    if (!action) {
      return res.status(400).json({
        error:
          "Missing or invalid action. Expected one of: mark_as_read, mark_as_unread, delete_messages.",
      });
    }

    if (
      !host ||
      !username ||
      (authType === "oauth" ? !accessToken : !password)
    ) {
      return res.status(400).json({
        error:
          authType === "oauth"
            ? "Missing required fields: host, username, accessToken."
            : "Missing required fields: host, username, password.",
      });
    }

    if (!messageUids.length) {
      return res.status(400).json({
        error: "Missing required field: messageUids (array of UID numbers).",
      });
    }

    const port = asNumber(body.port, 993, { min: 1, max: 65535 });
    const secure =
      typeof body.secure === "boolean" ? body.secure : port === 993;
    const mailboxPath =
      typeof body.mailboxPath === "string" && body.mailboxPath.trim()
        ? body.mailboxPath.trim()
        : "INBOX";

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth:
        authType === "oauth"
          ? {
              user: username,
              accessToken,
            }
          : {
              user: username,
              pass: password,
            },
    });

    try {
      if (verbose) {
        console.log(
          `[Integrations] IMAP modify action=${action} mailbox=${mailboxPath} count=${messageUids.length} host=${host} user=${username}`,
        );
      }

      await client.connect();
      await client.mailboxOpen(mailboxPath);

      if (action === "mark_as_read") {
        await client.messageFlagsAdd(messageUids, ["\\Seen"], { uid: true });
      } else if (action === "mark_as_unread") {
        await client.messageFlagsRemove(messageUids, ["\\Seen"], {
          uid: true,
        });
      } else {
        await client.messageDelete(messageUids, { uid: true });
      }

      return res.json({
        mailbox: mailboxPath,
        action,
        count: messageUids.length,
        messageUids,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.error("[Integrations] IMAP modify failed:", message);
      }

      if (isAuthenticationError(error)) {
        return res.status(401).json({
          error: buildAuthFailureMessage(host, "imap", authType),
        });
      }

      return res.status(502).json({
        error: `Failed to modify mailbox messages: ${message}`,
      });
    } finally {
      try {
        if (client.usable) {
          await client.logout();
        }
      } catch {
        // Best effort cleanup.
      }
    }
  });

  app.post("/integrations/email/read", async (req, res) => {
    const body: ReadEmailRequestBody = req.body || {};
    const authType = body.authType === "oauth" ? "oauth" : "basic_userpass";
    const host = typeof body.host === "string" ? body.host.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : "";

    if (
      !host ||
      !username ||
      (authType === "oauth" ? !accessToken : !password)
    ) {
      return res.status(400).json({
        error:
          authType === "oauth"
            ? "Missing required fields: host, username, accessToken."
            : "Missing required fields: host, username, password.",
      });
    }

    const port = asNumber(body.port, 993, { min: 1, max: 65535 });
    const secure =
      typeof body.secure === "boolean" ? body.secure : port === 993;
    const mailboxPath =
      typeof body.mailboxPath === "string" && body.mailboxPath.trim()
        ? body.mailboxPath.trim()
        : "INBOX";
    const limit = asNumber(body.limit, 10, { min: 1, max: 50 });
    const unreadOnly = body.unreadOnly === true;

    const client = new ImapFlow({
      host,
      port,
      secure,
      auth:
        authType === "oauth"
          ? {
              user: username,
              accessToken,
            }
          : {
              user: username,
              pass: password,
            },
    });

    try {
      if (verbose) {
        console.log(
          `[Integrations] IMAP read mailbox=${mailboxPath} host=${host} user=${username}`,
        );
      }

      await client.connect();
      await client.mailboxOpen(mailboxPath);

      const criteria = unreadOnly ? { seen: false } : { all: true };
      const searchResult = await client.search(criteria, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const selectedUids = uids.slice(-limit).reverse();

      const messages: Array<Record<string, unknown>> = [];
      for (const uid of selectedUids) {
        const message = await client.fetchOne(
          uid,
          {
            uid: true,
            envelope: true,
            internalDate: true,
            flags: true,
            bodyStructure: true,
          },
          {
            uid: true,
          },
        );

        if (!message || !message.envelope) {
          continue;
        }

        const attachments: AttachmentInfo[] = [];
        collectAttachmentInfo((message as any).bodyStructure, attachments);

        messages.push({
          uid: message.uid,
          subject: message.envelope.subject || "",
          date: (() => {
            if (message.envelope.date) {
              return new Date(message.envelope.date).toISOString();
            }

            if (message.internalDate) {
              return new Date(message.internalDate).toISOString();
            }

            return null;
          })(),
          from: (message.envelope.from || []).map((entry) => ({
            name: entry.name || "",
            address: entry.address || "",
          })),
          to: (message.envelope.to || []).map((entry) => ({
            name: entry.name || "",
            address: entry.address || "",
          })),
          flags: Array.from(message.flags || []),
          attachments,
        });
      }

      return res.json({
        mailbox: mailboxPath,
        unreadOnly,
        count: messages.length,
        messages,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.error("[Integrations] IMAP read failed:", message);
      }

      if (isAuthenticationError(error)) {
        return res.status(401).json({
          error: buildAuthFailureMessage(host, "imap", authType),
        });
      }

      return res.status(502).json({
        error: `Failed to read mailbox: ${message}`,
      });
    } finally {
      try {
        if (client.usable) {
          await client.logout();
        }
      } catch {
        // Best effort cleanup.
      }
    }
  });

  app.post("/integrations/email/send", async (req, res) => {
    const body: SendEmailRequestBody = req.body || {};
    const authType = body.authType === "oauth" ? "oauth" : "basic_userpass";
    const smtpHost =
      typeof body.smtpHost === "string" ? body.smtpHost.trim() : "";
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const to = asStringArray(body.to);
    const cc = asStringArray(body.cc);
    const bcc = asStringArray(body.bcc);
    const subject = typeof body.subject === "string" ? body.subject : "";
    const text = typeof body.text === "string" ? body.text : "";
    const html = typeof body.html === "string" ? body.html : "";
    const attachmentsInput = Array.isArray(body.attachments)
      ? body.attachments
      : [];

    if (
      !smtpHost ||
      !username ||
      (authType === "oauth" ? !accessToken : !password)
    ) {
      return res.status(400).json({
        error:
          authType === "oauth"
            ? "Missing required fields: smtpHost, username, accessToken."
            : "Missing required fields: smtpHost, username, password.",
      });
    }

    if (!to.length) {
      return res.status(400).json({
        error: "Missing required field: to.",
      });
    }

    if (!subject.trim()) {
      return res.status(400).json({
        error: "Missing required field: subject.",
      });
    }

    if (!text && !html) {
      return res.status(400).json({
        error: "Provide text or html content.",
      });
    }

    const attachments: Array<{
      filename: string;
      contentType: string | undefined;
      content: Buffer;
    }> = [];
    for (const item of attachmentsInput) {
      const filename =
        typeof item?.filename === "string" ? item.filename.trim() : "";
      const contentBase64 =
        typeof item?.contentBase64 === "string"
          ? item.contentBase64.trim()
          : "";
      const contentType =
        typeof item?.contentType === "string" ? item.contentType.trim() : "";

      if (!filename || !contentBase64) {
        continue;
      }

      attachments.push({
        filename,
        contentType: contentType || undefined,
        content: Buffer.from(contentBase64, "base64"),
      });
    }

    const smtpPort = asNumber(body.smtpPort, 587, { min: 1, max: 65535 });
    const smtpSecure =
      typeof body.smtpSecure === "boolean" ? body.smtpSecure : smtpPort === 465;
    const from =
      typeof body.from === "string" && body.from.trim()
        ? body.from.trim()
        : username;
    const replyTo = typeof body.replyTo === "string" ? body.replyTo.trim() : "";

    try {
      if (verbose) {
        console.log(
          `[Integrations] SMTP send host=${smtpHost} from=${from} recipients=${to.length}`,
        );
      }

      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth:
          authType === "oauth"
            ? {
                type: "OAuth2",
                user: username,
                accessToken,
              }
            : {
                user: username,
                pass: password,
              },
      });

      const result = await transport.sendMail({
        from,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        replyTo: replyTo || undefined,
        subject,
        text: text || undefined,
        html: html || undefined,
        attachments: attachments.length ? attachments : undefined,
      });

      return res.json({
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (verbose) {
        console.error("[Integrations] SMTP send failed:", message);
      }

      if (isAuthenticationError(error)) {
        return res.status(401).json({
          error: buildAuthFailureMessage(smtpHost, "smtp", authType),
        });
      }

      return res.status(502).json({
        error: `Failed to send message: ${message}`,
      });
    }
  });
}
