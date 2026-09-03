import type { OpenApiPathItem } from "../types.js";

export const integrationPaths: Record<string, OpenApiPathItem> = {
  "/integrations/email/download-attachments": {
    post: {
      tags: ["Email Integration"],
      summary: "Download Email Attachments",
      description:
        "Fetches and downloads email attachment payloads from IMAP mailboxes.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["host", "username", "messageUid"],
              properties: {
                host: { type: "string" },
                port: { type: "number" },
                secure: { type: "boolean" },
                username: { type: "string" },
                password: { type: "string" },
                accessToken: { type: "string" },
                authType: { type: "string", enum: ["basic_userpass", "oauth"] },
                messageUid: { type: "number" },
                attachmentParts: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Attachments downloaded",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  attachments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        part: { type: "string" },
                        filename: { type: "string" },
                        contentType: { type: "string" },
                        contentBase64: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "400": { description: "Missing or invalid parameters" },
        "500": { description: "IMAP fetch error" },
      },
    },
  },
  "/integrations/email/modify": {
    post: {
      tags: ["Email Integration"],
      summary: "Modify Email Flags or Mailbox",
      description:
        "Updates email flags (read, flagged, deleted) or moves messages between folders.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["host", "username", "messageUids"],
              properties: {
                host: { type: "string" },
                port: { type: "number" },
                username: { type: "string" },
                password: { type: "string" },
                accessToken: { type: "string" },
                authType: { type: "string", enum: ["basic_userpass", "oauth"] },
                messageUids: { type: "array", items: { type: "number" } },
                addFlags: { type: "array", items: { type: "string" } },
                removeFlags: { type: "array", items: { type: "string" } },
                moveToMailbox: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Modifications applied",
          content: { "application/json": { schema: { type: "object" } } },
        },
        "400": { description: "Missing or invalid parameters" },
        "500": { description: "IMAP modify error" },
      },
    },
  },
  "/integrations/email/read": {
    post: {
      tags: ["Email Integration"],
      summary: "Read Emails from Mailbox",
      description: "Searches and reads messages from an IMAP mailbox.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["host", "username"],
              properties: {
                host: { type: "string" },
                port: { type: "number" },
                username: { type: "string" },
                password: { type: "string" },
                accessToken: { type: "string" },
                authType: { type: "string", enum: ["basic_userpass", "oauth"] },
                mailbox: { type: "string", default: "INBOX" },
                limit: { type: "number", default: 10 },
                searchCriteria: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Messages retrieved",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  messages: { type: "array", items: { type: "object" } },
                },
              },
            },
          },
        },
        "400": { description: "Missing or invalid parameters" },
        "500": { description: "IMAP read error" },
      },
    },
  },
  "/integrations/email/send": {
    post: {
      tags: ["Email Integration"],
      summary: "Send Outbound Email",
      description: "Sends an email message via SMTP transport.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["host", "username", "to", "subject"],
              properties: {
                host: { type: "string" },
                port: { type: "number" },
                username: { type: "string" },
                password: { type: "string" },
                accessToken: { type: "string" },
                authType: { type: "string", enum: ["basic_userpass", "oauth"] },
                from: { type: "string" },
                to: { type: "array", items: { type: "string" } },
                cc: { type: "array", items: { type: "string" } },
                bcc: { type: "array", items: { type: "string" } },
                subject: { type: "string" },
                text: { type: "string" },
                html: { type: "string" },
                attachments: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Email sent successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  messageId: { type: "string" },
                },
              },
            },
          },
        },
        "400": { description: "Missing required send parameters" },
        "500": { description: "SMTP delivery error" },
      },
    },
  },
};
