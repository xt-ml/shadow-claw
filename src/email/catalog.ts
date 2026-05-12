import type { AuthType, ServiceType } from "../config.js";

export interface EmailPluginManifest {
  id: string;
  name: string;
  protocol: string;
  description: string;
  version: string;
  actions: string[];
  authTypes: AuthType[];
  serviceTypes: ServiceType[];
  configurableFields: string[];
}

export const EMAIL_PLUGIN_MANIFESTS: EmailPluginManifest[] = [
  {
    id: "imap",
    name: "IMAP Mail",
    protocol: "imap",
    description: "Read mailboxes and fetch message metadata/content.",
    version: "0.1.0",
    actions: ["messages.read", "messages.send"],
    authTypes: ["basic_userpass", "oauth"],
    serviceTypes: ["http_api"],
    configurableFields: [
      "host",
      "port",
      "secure",
      "mailboxPath",
      "smtpHost",
      "smtpPort",
      "smtpSecure",
      "fromAddress",
      "executionMode",
      "pollIntervalSec",
    ],
  },
];

export function listEmailPluginManifests(): EmailPluginManifest[] {
  return [...EMAIL_PLUGIN_MANIFESTS].sort((a, b) => a.id.localeCompare(b.id));
}

export function getEmailPluginManifest(id: string): EmailPluginManifest | null {
  if (!id) {
    return null;
  }

  return EMAIL_PLUGIN_MANIFESTS.find((item) => item.id === id) || null;
}
