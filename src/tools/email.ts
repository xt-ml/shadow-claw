import type { ToolDefinition } from "./types.js";

export const manage_email: ToolDefinition = {
  name: "manage_email",
  description:
    "Manage email connection settings for IMAP/SMTP workflows. " +
    "Supports status, connect/configure, enable/disable, delete, read_messages, send_message, mark_as_read, mark_as_unread, delete_messages, download_attachments, list available connection types, and lightweight test actions.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "status",
          "list_plugins",
          "list_connections",
          "connect",
          "configure",
          "enable",
          "disable",
          "delete",
          "test",
          "read_messages",
          "send_message",
          "mark_as_read",
          "mark_as_unread",
          "delete_messages",
          "download_attachments",
        ],
        description: "Email management action to perform.",
      },
      plugin_id: {
        type: "string",
        description:
          "Optional connection type ID for connect operations (default: imap).",
      },
      connection_id: {
        type: "string",
        description:
          "Connection ID or label for configure, enable, disable, delete, and test actions. For read_messages/send_message, it may be omitted when there is exactly one enabled IMAP connection.",
      },
      label: {
        type: "string",
        description: "Human-readable connection label for new connections.",
      },
      enabled: {
        type: "boolean",
        description:
          "Optional enabled flag used during connect/configure actions.",
      },
      config: {
        type: "object",
        properties: {},
        description:
          "Email config object (host, port, secure, mailboxPath, smtpHost, smtpPort, smtpSecure, etc.).",
      },
      mailbox_path: {
        type: "string",
        description:
          "Optional mailbox path override for read_messages (default: INBOX).",
      },
      limit: {
        type: "number",
        description:
          "Optional max messages to fetch for read_messages (default 10, range 1-50).",
      },
      unread_only: {
        type: "boolean",
        description: "If true, read_messages returns only unread messages.",
      },
      message_uids: {
        type: "array",
        items: { type: "number" },
        description:
          "Message UIDs for mark_as_read, mark_as_unread, and delete_messages actions.",
      },
      message_uid: {
        type: "number",
        description: "Single message UID used by download_attachments action.",
      },
      attachment_parts: {
        type: "array",
        items: { type: "string" },
        description:
          "Optional IMAP MIME part IDs to download (for example: 2, 3.1). If omitted, all attachments in the message are downloaded.",
      },
      save_directory: {
        type: "string",
        description:
          "Optional workspace directory for downloaded attachments (default: downloads/email).",
      },
      attachments: {
        type: "array",
        items: {
          anyOf: [
            { type: "string" },
            {
              type: "object",
              properties: {
                path: { type: "string" },
                filename: { type: "string" },
                content_type: { type: "string" },
              },
              required: ["path"],
            },
          ],
        },
        description:
          "Optional workspace file attachments for send_message. Provide paths or objects with path/filename/content_type.",
      },
      to: {
        type: "array",
        items: { type: "string" },
        description: "Recipient email addresses for send_message.",
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "Optional CC recipient addresses for send_message.",
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "Optional BCC recipient addresses for send_message.",
      },
      subject: {
        type: "string",
        description: "Message subject for send_message.",
      },
      body: {
        type: "string",
        description: "Plaintext message body for send_message.",
      },
      html: {
        type: "string",
        description: "Optional HTML body for send_message.",
      },
      from: {
        type: "string",
        description: "Optional from address override for send_message.",
      },
      reply_to: {
        type: "string",
        description: "Optional reply-to address for send_message.",
      },
      username: {
        type: "string",
        description:
          "Optional username override for connect/configure/read_messages/send_message.",
      },
      password: {
        type: "string",
        description:
          "Optional password override for connect/configure/read_messages/send_message.",
      },
    },
    required: ["action"],
  },
};

export const email_read_messages: ToolDefinition = {
  name: "email_read_messages",
  description:
    "Read recent messages from a configured email connection (IMAP). " +
    "Use this to check inbox mail from an agent workflow. Results include attachment metadata when available.",
  input_schema: {
    type: "object",
    properties: {
      connection_id: {
        type: "string",
        description: "Email connection ID or label.",
      },
      mailbox_path: {
        type: "string",
        description: "Optional mailbox path override (default: INBOX).",
      },
      limit: {
        type: "number",
        description: "Optional max messages to fetch (default 10, range 1-50).",
      },
      unread_only: {
        type: "boolean",
        description: "If true, only unread messages are returned.",
      },
    },
    required: ["connection_id"],
  },
};

export const email_send_message: ToolDefinition = {
  name: "email_send_message",
  description:
    "Send an email message through a configured email connection (SMTP).",
  input_schema: {
    type: "object",
    properties: {
      connection_id: {
        type: "string",
        description: "Email connection ID or label.",
      },
      to: {
        type: "array",
        items: { type: "string" },
        description: "Recipient email addresses.",
      },
      cc: {
        type: "array",
        items: { type: "string" },
        description: "Optional CC recipient addresses.",
      },
      bcc: {
        type: "array",
        items: { type: "string" },
        description: "Optional BCC recipient addresses.",
      },
      subject: {
        type: "string",
        description: "Message subject.",
      },
      body: {
        type: "string",
        description: "Plaintext message body.",
      },
      html: {
        type: "string",
        description: "Optional HTML message body.",
      },
      from: {
        type: "string",
        description: "Optional from address override.",
      },
      reply_to: {
        type: "string",
        description: "Optional reply-to address.",
      },
    },
    required: ["connection_id", "to", "subject"],
  },
};
