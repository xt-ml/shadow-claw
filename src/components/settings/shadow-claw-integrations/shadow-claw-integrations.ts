import { CONFIG_KEYS } from "../../../config.js";
import { getDb } from "../../../db/db.js";
import { getConfig } from "../../../db/getConfig.js";
import { setConfig } from "../../../db/setConfig.js";
import {
  getEmailPluginManifest,
  listEmailPluginManifests,
  type EmailPluginManifest,
} from "../../../email/catalog.js";
import {
  deleteEmailConnection,
  bindEmailCredentialRef,
  listEmailConnections,
  upsertEmailConnection,
  type EmailConnectionRecord,
  type EmailCredentialRef,
} from "../../../email/connections.js";
import { encryptValue } from "../../../crypto.js";
import { showError, showSuccess } from "../../../toast.js";
import { ulid } from "../../../ulid.js";
import { resolveConnectionTestAuth } from "./connection-test-auth.js";

import type { ShadowClawDatabase } from "../../../types.js";
import type { ServiceAccount } from "../../../accounts/service-accounts.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-integrations";

interface ImapPreset {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

interface EmailOAuthProviderConfig {
  id: string;
  label: string;
  serviceName: string;
  hostPattern: string;
  defaultScopes: string[];
  scopePlaceholder: string;
  scopeHelpText: string;
  connectButtonLabel: string;
}

const EMAIL_OAUTH_PROVIDERS: Record<string, EmailOAuthProviderConfig> = {
  google: {
    id: "google",
    label: "Gmail (Google OAuth)",
    serviceName: "Google",
    hostPattern: "gmail.com",
    defaultScopes: ["https://mail.google.com/"],
    scopePlaceholder: "https://mail.google.com/",
    scopeHelpText: "Use https://mail.google.com/ for Gmail IMAP/SMTP access.",
    connectButtonLabel: "Connect Google OAuth",
  },
  microsoft_graph: {
    id: "microsoft_graph",
    label: "Microsoft (Outlook / M365 OAuth)",
    serviceName: "Microsoft",
    hostPattern: "outlook.office365.com",
    defaultScopes: [
      "offline_access",
      "https://outlook.office.com/IMAP.AccessAsUser.All",
      "https://outlook.office.com/SMTP.Send",
    ],
    scopePlaceholder:
      "offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send",
    scopeHelpText:
      "For Outlook/M365 IMAP+SMTP, include offline_access plus IMAP.AccessAsUser.All and SMTP.Send scopes.",
    connectButtonLabel: "Connect Microsoft OAuth",
  },
  yahoo_mail: {
    id: "yahoo_mail",
    label: "Yahoo Mail OAuth",
    serviceName: "Yahoo",
    hostPattern: "mail.yahoo.com",
    defaultScopes: ["mail-r", "mail-w"],
    scopePlaceholder: "mail-r mail-w",
    scopeHelpText:
      "Yahoo commonly uses mail-r and mail-w scopes for IMAP/SMTP style access.",
    connectButtonLabel: "Connect Yahoo OAuth",
  },
};

const IMAP_PRESETS: Record<string, ImapPreset> = {
  gmail: {
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  outlook: {
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  yahoo: {
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  icloud: {
    imapHost: "imap.mail.me.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  fastmail: {
    imapHost: "imap.fastmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
};

const IMAP_FIELD_LABELS: Record<string, string> = {
  host: "IMAP host",
  port: "IMAP port",
  secure: "IMAP TLS",
  mailboxPath: "Mailbox path",
  smtpHost: "SMTP host",
  smtpPort: "SMTP port",
  smtpSecure: "SMTP TLS",
  fromAddress: "From address",
  executionMode: "Execution mode",
  pollIntervalSec: "Poll interval (seconds)",
};

const IMAP_FIELD_PLACEHOLDERS: Record<string, string> = {
  host: "imap.example.com",
  port: "993",
  mailboxPath: "INBOX",
  smtpHost: "smtp.example.com",
  smtpPort: "465",
  fromAddress: "you@example.com",
  pollIntervalSec: "300",
};

export class ShadowClawIntegrations extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawIntegrations.componentPath}/${elementName}.css`;
  static template = `${ShadowClawIntegrations.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  manifests: EmailPluginManifest[] = [];
  connections: EmailConnectionRecord[] = [];
  accounts: ServiceAccount[] = [];
  editingConnectionId: string | null = null;
  pendingOauthResult: {
    providerId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    tokenType?: string;
  } | null = null;

  getEmailOAuthProvider(
    providerId: string | undefined,
  ): EmailOAuthProviderConfig {
    if (providerId && EMAIL_OAUTH_PROVIDERS[providerId]) {
      return EMAIL_OAUTH_PROVIDERS[providerId];
    }

    return EMAIL_OAUTH_PROVIDERS.google;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    this.db = await getDb();
    this.bindEventListeners();
    await this.reload();
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="add-connection"]')
      ?.addEventListener("click", () => this.showForm(null));
  }

  async reload() {
    if (!this.db) {
      return;
    }

    this.manifests = listEmailPluginManifests().filter(
      (manifest) => manifest.id === "imap",
    );
    this.connections = await listEmailConnections(this.db);
    const rawAccounts = await getConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS);
    this.accounts = Array.isArray(rawAccounts) ? rawAccounts : [];
    this.renderConnectionList();
  }

  renderConnectionList() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector('[data-region="connection-list"]');
    if (!list) {
      return;
    }

    list.replaceChildren();

    if (!this.connections.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent =
        "No email connections configured. Click Add Email Connection to start.";
      list.append(empty);

      return;
    }

    const fragment = document.createDocumentFragment();

    for (const connection of this.connections) {
      const manifest = getEmailPluginManifest(connection.pluginId);
      const card = document.createElement("article");
      card.className = "connection-card";

      const executionMode =
        typeof connection.config.executionMode === "string"
          ? connection.config.executionMode
          : "manual";
      const pollIntervalSec =
        typeof connection.config.pollIntervalSec === "number"
          ? connection.config.pollIntervalSec
          : null;
      const hasAuth =
        !!connection.credentialRef?.encryptedSecret ||
        (connection.credentialRef?.authType === "oauth" &&
          !!connection.credentialRef?.accountId);

      card.innerHTML = `
        <header>
          <div>
            <div class="connection-title">${this.escapeHtml(connection.label)}</div>
            <div class="connection-meta">
              ${this.escapeHtml(connection.pluginId)}${manifest ? ` · ${this.escapeHtml(manifest.name)}` : ""}
            </div>
          </div>
          <span class="connection-badge ${connection.enabled ? "enabled" : "disabled"}">
            ${connection.enabled ? "Enabled" : "Disabled"}
          </span>
        </header>
        <div class="connection-meta">Mode: ${this.escapeHtml(String(executionMode))}${pollIntervalSec ? ` · Poll: ${pollIntervalSec}s` : ""}${hasAuth ? " · Auth: configured" : " · Auth: missing"}</div>
        <div class="connection-actions">
          <button class="btn secondary" data-action="edit" data-id="${this.escapeHtml(connection.id)}">Edit</button>
          <button class="btn secondary" data-action="toggle" data-id="${this.escapeHtml(connection.id)}">${connection.enabled ? "Disable" : "Enable"}</button>
          <button class="btn secondary" data-action="delete" data-id="${this.escapeHtml(connection.id)}">Delete</button>
        </div>
      `;

      card
        .querySelectorAll<HTMLButtonElement>("button[data-action]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            const action = button.dataset.action;
            const id = button.dataset.id;
            if (!action || !id) {
              return;
            }

            if (action === "edit") {
              this.showForm(id);
            } else if (action === "toggle") {
              void this.toggleConnection(id);
            } else if (action === "delete") {
              void this.deleteConnection(id);
            }
          });
        });

      fragment.append(card);
    }

    list.append(fragment);
  }

  showForm(connectionId: string | null) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot = root.querySelector('[data-region="connection-form"]');
    if (!slot) {
      return;
    }

    this.editingConnectionId = connectionId;
    const existing = connectionId
      ? this.connections.find((item) => item.id === connectionId) || null
      : null;

    const pluginId = this.getInitialPluginId(existing);
    const manifest = getEmailPluginManifest(pluginId);

    const cfg = existing?.config || {};
    const linkedOauthAccount = existing?.credentialRef?.accountId
      ? this.accounts.find(
          (account) => account.id === existing.credentialRef?.accountId,
        ) || null
      : null;
    const executionMode =
      typeof cfg.executionMode === "string"
        ? String(cfg.executionMode)
        : "manual";
    const pollIntervalSec =
      typeof cfg.pollIntervalSec === "number" ? cfg.pollIntervalSec : 300;
    const authMode =
      existing?.credentialRef?.authType === "oauth"
        ? "oauth"
        : "basic_userpass";
    const oauthProviderId =
      existing?.credentialRef?.providerId ||
      linkedOauthAccount?.oauthProviderId ||
      "google";
    const oauthProvider = this.getEmailOAuthProvider(oauthProviderId);
    const oauthClientId = linkedOauthAccount?.oauthClientId || "";
    const oauthScope =
      linkedOauthAccount?.scopes?.join(" ") ||
      oauthProvider.defaultScopes.join(" ");
    const oauthStatus =
      authMode === "oauth"
        ? linkedOauthAccount?.oauthReauthRequired
          ? "Reconnect required"
          : linkedOauthAccount?.token
            ? "OAuth token already saved"
            : "Not connected"
        : "Not connected";

    const isImapPlugin = pluginId === "imap";
    slot.innerHTML = `
      <h4>${existing ? "Edit Email Connection" : "Add Email Connection"}</h4>
      <div class="form-row">
        <label for="int-label">Label</label>
        <input id="int-label" value="${this.escapeHtml(existing?.label || "")}" />
      </div>
      <div class="form-row">
        <label for="int-mode">Execution mode</label>
        <select id="int-mode">
          <option value="manual" ${executionMode === "manual" ? "selected" : ""}>manual</option>
          <option value="scheduled" ${executionMode === "scheduled" ? "selected" : ""}>scheduled</option>
          <option value="event-driven" ${executionMode === "event-driven" ? "selected" : ""}>event-driven</option>
        </select>
      </div>
      <div class="form-row">
        <label for="int-poll">Poll interval (seconds)</label>
        <input id="int-poll" type="number" min="5" value="${this.escapeHtml(String(pollIntervalSec))}" />
      </div>
      <div class="form-row checkbox-row">
        <label class="checkbox-inline" for="int-unread-only">
          <input id="int-unread-only" type="checkbox" ${cfg.unreadOnly === true ? "checked" : ""} />
          <span>Get unread email only</span>
        </label>
      </div>
      <div class="form-row">
        <label for="int-username">Auth username (email login)</label>
        <input id="int-username" value="${this.escapeHtml(existing?.credentialRef?.username || "")}" placeholder="user@example.com" />
      </div>
      <div class="form-row">
        <label for="int-auth-mode">Authentication</label>
        <select id="int-auth-mode">
          <option value="basic_userpass" ${authMode === "basic_userpass" ? "selected" : ""}>App password / password</option>
          <option value="oauth" ${authMode === "oauth" ? "selected" : ""}>OAuth</option>
        </select>
      </div>
      <div data-region="password-auth-fields">
      <div class="form-row">
        <label for="int-password">Auth password / app password</label>
        <input id="int-password" type="password" placeholder="${existing?.credentialRef?.encryptedSecret ? "•••••••••••• (Saved)" : "Enter password"}" />
      </div>
      </div>
      <div class="oauth-auth-card" data-region="oauth-auth-fields">
        <div class="imap-setup-title">Email OAuth</div>
        <div class="form-row">
          <label for="int-oauth-provider">OAuth provider</label>
          <select id="int-oauth-provider">
            ${Object.values(EMAIL_OAUTH_PROVIDERS)
              .map(
                (provider) =>
                  `<option value="${this.escapeHtml(provider.id)}" ${provider.id === oauthProvider.id ? "selected" : ""}>${this.escapeHtml(provider.label)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="form-row">
          <label for="int-oauth-client-id">OAuth client ID</label>
          <input id="int-oauth-client-id" value="${this.escapeHtml(oauthClientId)}" placeholder="Enter OAuth client ID" />
        </div>
        <div class="form-row">
          <label for="int-oauth-client-secret">OAuth client secret</label>
          <input id="int-oauth-client-secret" type="password" placeholder="${linkedOauthAccount?.oauthClientSecret ? "•••••••••••• (Saved)" : "Enter client secret if required"}" />
        </div>
        <div class="form-row">
          <label for="int-oauth-scope">OAuth scope</label>
          <input id="int-oauth-scope" value="${this.escapeHtml(oauthScope)}" placeholder="${this.escapeHtml(oauthProvider.scopePlaceholder)}" />
          <div class="imap-setup-help" data-region="oauth-scope-help">${this.escapeHtml(oauthProvider.scopeHelpText)}</div>
        </div>
        <div class="oauth-connect-row">
          <button class="btn secondary" type="button" data-action="connect-oauth">${this.escapeHtml(oauthProvider.connectButtonLabel)}</button>
          <span class="oauth-status" data-region="oauth-status">${this.escapeHtml(oauthStatus)}</span>
        </div>
      </div>
      ${
        isImapPlugin
          ? `<div class="imap-setup-card">
               <div class="imap-setup-title">Quick IMAP Setup</div>
               <div class="imap-setup-row">
                 <select id="int-imap-preset">
                   <option value="auto" selected>Auto-detect from login email</option>
                   <option value="gmail">Gmail / Google Workspace</option>
                   <option value="outlook">Outlook / Microsoft 365</option>
                   <option value="yahoo">Yahoo</option>
                   <option value="icloud">iCloud</option>
                   <option value="fastmail">Fastmail</option>
                 </select>
                 <button class="btn secondary" type="button" data-action="imap-autofill">Autofill</button>
               </div>
               <div class="imap-setup-help">Uses common provider defaults. You can still override any field below.</div>
             </div>`
          : ""
      }

      ${manifest ? this.renderConfigFieldRows(manifest, cfg) : ""}

      <div class="form-row">
        <label for="int-extra-config">Extra config JSON (optional)</label>
        <textarea id="int-extra-config" placeholder='{"mailboxPath":"INBOX"}'></textarea>
      </div>
      <div class="form-actions">
        <button class="btn secondary" data-action="cancel">Cancel</button>
        <button class="btn secondary" data-action="test-connection">Test Connection</button>
        <button class="btn" data-action="save">Save</button>
      </div>
    `;

    const formNode = slot as HTMLElement;
    formNode.hidden = false;

    this.pendingOauthResult = null;

    slot
      .querySelector("#int-auth-mode")
      ?.addEventListener("change", () => this.updateAuthModeVisibility(slot));

    slot
      .querySelector('[data-action="imap-autofill"]')
      ?.addEventListener("click", () => this.applyImapPreset(slot));
    slot
      .querySelector('[data-action="connect-oauth"]')
      ?.addEventListener("click", () => void this.connectOAuthFromForm(slot));
    slot
      .querySelector("#int-oauth-provider")
      ?.addEventListener("change", () => this.updateOAuthProviderHelp(slot));

    slot
      .querySelector('[data-action="cancel"]')
      ?.addEventListener("click", () => {
        formNode.hidden = true;
        formNode.replaceChildren();
        this.editingConnectionId = null;
      });

    slot
      .querySelector('[data-action="save"]')
      ?.addEventListener("click", () => {
        void this.saveForm();
      });

    slot
      .querySelector('[data-action="test-connection"]')
      ?.addEventListener("click", () => {
        void this.testConnectionFromForm(slot);
      });

    this.updateAuthModeVisibility(slot);
    this.updateOAuthProviderHelp(slot);
  }

  async testConnectionFromForm(slot: Element) {
    const testButton = slot.querySelector(
      '[data-action="test-connection"]',
    ) as HTMLButtonElement | null;
    if (testButton) {
      testButton.disabled = true;
    }

    try {
      const username = (
        slot.querySelector("#int-username") as HTMLInputElement | null
      )?.value.trim();
      const host = (
        slot.querySelector("#cfg-host") as HTMLInputElement | null
      )?.value.trim();
      const mailboxPath =
        (
          slot.querySelector("#cfg-mailboxPath") as HTMLInputElement | null
        )?.value.trim() || "INBOX";
      const portRaw = (
        slot.querySelector("#cfg-port") as HTMLInputElement | null
      )?.value.trim();
      const secureRaw = (
        slot.querySelector("#cfg-secure") as HTMLSelectElement | null
      )?.value;
      const unreadOnly = (
        slot.querySelector("#int-unread-only") as HTMLInputElement | null
      )?.checked;
      const authMode = (
        slot.querySelector("#int-auth-mode") as HTMLSelectElement | null
      )?.value;

      if (!username) {
        showError("Auth username (email login) is required.", 4000);

        return;
      }

      if (!host) {
        showError("IMAP host is required.", 4000);

        return;
      }

      const port = Number(portRaw);
      const resolvedPort = Number.isFinite(port) && port > 0 ? port : 993;
      const secure = secureRaw === "false" ? false : true;

      let authType: "basic_userpass" | "oauth" = "basic_userpass";
      let password: string | undefined;
      let accessToken: string | undefined;

      const existing = this.editingConnectionId
        ? this.connections.find((item) => item.id === this.editingConnectionId)
        : null;

      if (authMode === "oauth") {
        const providerId = (
          slot.querySelector("#int-oauth-provider") as HTMLSelectElement | null
        )?.value;
        const pendingOauthAccessToken =
          this.pendingOauthResult?.accessToken &&
          (!providerId || this.pendingOauthResult.providerId === providerId)
            ? this.pendingOauthResult.accessToken
            : "";

        const result = resolveConnectionTestAuth({
          authMode,
          pendingOauthAccessToken,
          hasStoredOauthCredential: Boolean(existing?.credentialRef?.accountId),
        });

        if ("error" in result) {
          showError(result.error, 6000);

          return;
        }

        authType = result.authType;
        if (result.authType === "oauth") {
          accessToken = result.accessToken;
        }
      } else {
        const passwordInput = (
          slot.querySelector("#int-password") as HTMLInputElement | null
        )?.value;

        const result = resolveConnectionTestAuth({
          authMode,
          passwordInput,
          hasStoredPasswordCredential: Boolean(
            existing?.credentialRef?.encryptedSecret,
          ),
        });

        if ("error" in result) {
          showError(result.error, 6000);

          return;
        }

        authType = result.authType;
        if (result.authType === "basic_userpass") {
          password = result.password;
        }
      }

      const response = await fetch("/integrations/email/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          authType,
          host,
          port: resolvedPort,
          secure,
          username,
          password,
          accessToken,
          mailboxPath,
          limit: 1,
          unreadOnly: unreadOnly === true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
      };

      if (!response.ok) {
        showError(
          `Connection test failed (${response.status}): ${payload.error || response.statusText}`,
          7000,
        );

        return;
      }

      showSuccess(
        `Connection test passed. IMAP login succeeded${typeof payload.count === "number" ? ` (${payload.count} messages returned).` : "."}`,
        4500,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Connection test failed: ${message}`, 7000);
    } finally {
      if (testButton) {
        testButton.disabled = false;
      }
    }
  }

  updateAuthModeVisibility(slot: Element) {
    const authMode = (
      slot.querySelector("#int-auth-mode") as HTMLSelectElement | null
    )?.value;

    const passwordFields = slot.querySelector(
      '[data-region="password-auth-fields"]',
    ) as HTMLElement | null;
    const oauthFields = slot.querySelector(
      '[data-region="oauth-auth-fields"]',
    ) as HTMLElement | null;

    if (passwordFields) {
      passwordFields.style.display = authMode === "oauth" ? "none" : "block";
    }

    if (oauthFields) {
      oauthFields.style.display = authMode === "oauth" ? "block" : "none";
    }
  }

  updateOAuthProviderHelp(slot: Element) {
    const providerId = (
      slot.querySelector("#int-oauth-provider") as HTMLSelectElement | null
    )?.value;
    const provider = this.getEmailOAuthProvider(providerId);

    const scopeInput = slot.querySelector(
      "#int-oauth-scope",
    ) as HTMLInputElement | null;
    const scopeHelp = slot.querySelector(
      '[data-region="oauth-scope-help"]',
    ) as HTMLElement | null;
    const connectBtn = slot.querySelector(
      '[data-action="connect-oauth"]',
    ) as HTMLButtonElement | null;

    if (scopeInput) {
      scopeInput.placeholder = provider.scopePlaceholder;
      if (!scopeInput.value.trim()) {
        scopeInput.value = provider.defaultScopes.join(" ");
      }
    }

    if (scopeHelp) {
      scopeHelp.textContent = provider.scopeHelpText;
    }

    if (connectBtn) {
      connectBtn.textContent = provider.connectButtonLabel;
    }
  }

  async connectOAuthFromForm(slot: Element) {
    const providerId = (
      slot.querySelector("#int-oauth-provider") as HTMLSelectElement | null
    )?.value;
    const provider = this.getEmailOAuthProvider(providerId);
    const clientId = (
      slot.querySelector("#int-oauth-client-id") as HTMLInputElement | null
    )?.value.trim();
    const clientSecret = (
      slot.querySelector("#int-oauth-client-secret") as HTMLInputElement | null
    )?.value.trim();
    const scopeRaw = (
      slot.querySelector("#int-oauth-scope") as HTMLInputElement | null
    )?.value.trim();
    const oauthStatus = slot.querySelector(
      '[data-region="oauth-status"]',
    ) as HTMLElement | null;
    const connectBtn = slot.querySelector(
      '[data-action="connect-oauth"]',
    ) as HTMLButtonElement | null;

    if (!clientId) {
      showError("OAuth client ID is required.", 4000);

      return;
    }

    if (oauthStatus) {
      oauthStatus.textContent = "Starting OAuth...";
    }

    if (connectBtn) {
      connectBtn.disabled = true;
    }

    try {
      const scope = scopeRaw
        ? scopeRaw
            .split(/[\s,]+/)
            .map((token) => token.trim())
            .filter(Boolean)
        : provider.defaultScopes;
      const redirectUri = `${window.location.origin}/oauth/callback`;

      const authorizeRes = await fetch("/oauth/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerId: provider.id,
          clientId,
          clientSecret: clientSecret || undefined,
          redirectUri,
          scope,
          extraAuthorizeParams: {
            access_type: "offline",
            prompt: "consent",
          },
        }),
      });

      const authorizePayload = (await authorizeRes.json()) as {
        state?: string;
        authorizeUrl?: string;
        error?: string;
      };

      if (
        !authorizeRes.ok ||
        !authorizePayload.state ||
        !authorizePayload.authorizeUrl
      ) {
        throw new Error(authorizePayload.error || "OAuth authorize failed");
      }

      window.open(
        authorizePayload.authorizeUrl,
        "shadowclaw-google-oauth",
        "popup=yes,width=540,height=720",
      );

      const state = authorizePayload.state;
      let status = "pending";
      for (let attempt = 0; attempt < 60; attempt++) {
        const sessionRes = await fetch(
          `/oauth/session/${encodeURIComponent(state)}`,
        );
        const sessionPayload = (await sessionRes.json()) as {
          status?: string;
          error?: string;
        };

        if (!sessionRes.ok) {
          throw new Error(sessionPayload.error || "OAuth session not found");
        }

        status = sessionPayload.status || "pending";
        if (status === "authorized") {
          break;
        }

        if (status === "error") {
          throw new Error(sessionPayload.error || "OAuth authorization failed");
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (status !== "authorized") {
        throw new Error("OAuth authorization timed out");
      }

      const tokenRes = await fetch("/oauth/token", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ state }),
      });

      const tokenPayload = (await tokenRes.json()) as {
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        scope?: string;
        tokenType?: string;
        error?: string;
      };

      if (!tokenRes.ok || !tokenPayload.accessToken) {
        throw new Error(tokenPayload.error || "OAuth token exchange failed");
      }

      this.pendingOauthResult = {
        providerId: provider.id,
        accessToken: tokenPayload.accessToken,
        refreshToken: tokenPayload.refreshToken,
        expiresAt: tokenPayload.expiresIn
          ? Date.now() + tokenPayload.expiresIn * 1000
          : undefined,
        scope: tokenPayload.scope,
        tokenType: tokenPayload.tokenType,
      };

      if (oauthStatus) {
        oauthStatus.textContent = "OAuth connected";
      }

      showSuccess(`${provider.label} connected`, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (oauthStatus) {
        oauthStatus.textContent = "OAuth failed";
      }

      showError(`${provider.label} connect failed: ${message}`, 6000);
    } finally {
      if (connectBtn) {
        connectBtn.disabled = false;
      }
    }
  }

  getInitialPluginId(existing: EmailConnectionRecord | null): string {
    if (existing?.pluginId) {
      return existing.pluginId;
    }

    if (this.manifests.some((item) => item.id === "imap")) {
      return "imap";
    }

    return this.manifests[0]?.id || "";
  }

  renderConfigFieldRows(
    manifest: EmailPluginManifest,
    cfg: Record<string, unknown>,
  ): string {
    return manifest.configurableFields
      .map((field) => {
        const value = cfg[field];
        const displayLabel =
          manifest.id === "imap" ? (IMAP_FIELD_LABELS[field] ?? field) : field;

        if (field === "secure" || field === "smtpSecure") {
          const selected = typeof value === "boolean" ? value : true;

          return `
            <div class="form-row">
              <label for="cfg-${this.escapeHtml(field)}">${this.escapeHtml(displayLabel)}</label>
              <select id="cfg-${this.escapeHtml(field)}" data-config-field="${this.escapeHtml(field)}">
                <option value="true" ${selected ? "selected" : ""}>enabled</option>
                <option value="false" ${selected ? "" : "selected"}>disabled</option>
              </select>
            </div>
          `;
        }

        const placeholder =
          manifest.id === "imap" ? (IMAP_FIELD_PLACEHOLDERS[field] ?? "") : "";

        return `
          <div class="form-row">
            <label for="cfg-${this.escapeHtml(field)}">${this.escapeHtml(displayLabel)}</label>
            <input
              id="cfg-${this.escapeHtml(field)}"
              data-config-field="${this.escapeHtml(field)}"
              value="${this.escapeHtml(typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "")}"
              placeholder="${this.escapeHtml(placeholder)}"
            />
          </div>
        `;
      })
      .join("");
  }

  applyImapPreset(slot: Element) {
    const presetSelect = slot.querySelector(
      "#int-imap-preset",
    ) as HTMLSelectElement | null;
    const usernameInput = slot.querySelector(
      "#int-username",
    ) as HTMLInputElement | null;

    const selectedPreset = presetSelect?.value || "auto";
    const preset = this.resolveImapPreset(
      selectedPreset,
      usernameInput?.value || "",
    );
    if (!preset) {
      showError(
        "Could not auto-detect IMAP settings from this email domain. Choose a preset or enter settings manually.",
        5000,
      );

      return;
    }

    this.setConfigFieldValue(slot, "host", preset.imapHost);
    this.setConfigFieldValue(slot, "port", String(preset.imapPort));
    this.setConfigFieldValue(slot, "secure", String(preset.imapSecure));
    this.setConfigFieldValue(slot, "smtpHost", preset.smtpHost);
    this.setConfigFieldValue(slot, "smtpPort", String(preset.smtpPort));
    this.setConfigFieldValue(slot, "smtpSecure", String(preset.smtpSecure));

    const fromAddress = (usernameInput?.value || "").trim();
    if (fromAddress) {
      this.setConfigFieldValue(slot, "fromAddress", fromAddress);
    }

    const mailboxInput = slot.querySelector(
      "#cfg-mailboxPath",
    ) as HTMLInputElement | null;
    if (mailboxInput && !mailboxInput.value.trim()) {
      mailboxInput.value = "INBOX";
    }

    showSuccess("Applied IMAP preset defaults", 2500);
  }

  setConfigFieldValue(slot: Element, field: string, value: string) {
    const node = slot.querySelector(`#cfg-${field}`) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (!node) {
      return;
    }

    node.value = value;
  }

  resolveImapPreset(selection: string, username: string): ImapPreset | null {
    if (selection !== "auto") {
      return IMAP_PRESETS[selection] || null;
    }

    const domain = username.split("@")[1]?.trim().toLowerCase() || "";
    if (!domain) {
      return null;
    }

    if (
      domain === "gmail.com" ||
      domain.endsWith(".gmail.com") ||
      domain.endsWith(".googlemail.com")
    ) {
      return IMAP_PRESETS.gmail;
    }

    if (
      domain === "outlook.com" ||
      domain === "hotmail.com" ||
      domain === "live.com" ||
      domain === "msn.com" ||
      domain.endsWith(".onmicrosoft.com")
    ) {
      return IMAP_PRESETS.outlook;
    }

    if (domain === "yahoo.com" || domain.endsWith(".yahoo.com")) {
      return IMAP_PRESETS.yahoo;
    }

    if (
      domain === "icloud.com" ||
      domain === "me.com" ||
      domain === "mac.com"
    ) {
      return IMAP_PRESETS.icloud;
    }

    if (domain === "fastmail.com" || domain.endsWith(".fastmail.com")) {
      return IMAP_PRESETS.fastmail;
    }

    return null;
  }

  async saveForm() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    const slot = root.querySelector('[data-region="connection-form"]');
    if (!slot) {
      return;
    }

    const labelInput = slot.querySelector(
      "#int-label",
    ) as HTMLInputElement | null;
    const modeInput = slot.querySelector(
      "#int-mode",
    ) as HTMLSelectElement | null;
    const pollInput = slot.querySelector(
      "#int-poll",
    ) as HTMLInputElement | null;
    const extraInput = slot.querySelector(
      "#int-extra-config",
    ) as HTMLTextAreaElement | null;

    if (!labelInput || !modeInput || !pollInput) {
      return;
    }

    const label = labelInput.value.trim();
    const pluginId = this.getInitialPluginId(null);

    if (!label || !pluginId) {
      showError("Label is required.", 4000);

      return;
    }

    const config: Record<string, unknown> = {
      executionMode: modeInput.value,
    };

    const pollSec = Number(pollInput.value);
    if (Number.isFinite(pollSec) && pollSec > 0) {
      config.pollIntervalSec = Math.floor(pollSec);
    }

    const unreadOnlyInput = slot.querySelector(
      "#int-unread-only",
    ) as HTMLInputElement | null;
    config.unreadOnly = unreadOnlyInput?.checked === true;

    slot
      .querySelectorAll<HTMLInputElement>("[data-config-field]")
      .forEach((input) => {
        const key = input.dataset.configField;
        if (!key) {
          return;
        }

        const value = input.value.trim();
        if (!value) {
          return;
        }

        if (/^\d+$/.test(value)) {
          config[key] = Number(value);
        } else if (value === "true" || value === "false") {
          config[key] = value === "true";
        } else {
          config[key] = value;
        }
      });

    const extraRaw = extraInput?.value.trim() || "";
    if (extraRaw) {
      try {
        const parsed = JSON.parse(extraRaw);
        if (parsed && typeof parsed === "object") {
          Object.assign(config, parsed as Record<string, unknown>);
        }
      } catch {
        showError("Extra config JSON is invalid.", 5000);

        return;
      }
    }

    try {
      const upserted = await upsertEmailConnection(this.db, {
        id: this.editingConnectionId || undefined,
        label,
        pluginId,
        config,
      });

      const credentialRef = await this.buildCredentialRef(slot, upserted);
      await bindEmailCredentialRef(this.db, upserted.id, credentialRef);

      showSuccess(
        this.editingConnectionId
          ? "Email connection updated"
          : "Email connection created",
        3000,
      );

      (slot as HTMLElement).hidden = true;
      slot.replaceChildren();
      this.editingConnectionId = null;
      await this.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to save email connection: ${message}`, 6000);
    }
  }

  async buildCredentialRef(
    slot: Element,
    savedConnection: EmailConnectionRecord,
  ): Promise<EmailCredentialRef | null> {
    const authMode = (
      slot.querySelector("#int-auth-mode") as HTMLSelectElement | null
    )?.value;
    const usernameInput = slot.querySelector(
      "#int-username",
    ) as HTMLInputElement | null;
    const passwordInput = slot.querySelector(
      "#int-password",
    ) as HTMLInputElement | null;

    const username = usernameInput?.value.trim() || "";
    const passwordRaw = passwordInput?.value.trim() || "";

    const existing = this.connections.find(
      (item) => item.id === savedConnection.id,
    );

    if (authMode === "oauth") {
      if (!username) {
        throw new Error(
          "Email login address is required for OAuth authentication.",
        );
      }

      const linkedAccount = await this.upsertLinkedOAuthAccount(
        slot,
        savedConnection,
      );

      return {
        serviceType: "http_api",
        authType: "oauth",
        providerId: linkedAccount.oauthProviderId || "google",
        accountId: linkedAccount.id,
        username,
      };
    }

    let encryptedSecret: string | undefined;
    if (passwordRaw) {
      encryptedSecret = (await encryptValue(passwordRaw)) || undefined;
      if (!encryptedSecret) {
        throw new Error("Could not encrypt email password.");
      }
    } else {
      encryptedSecret = existing?.credentialRef?.encryptedSecret;
    }

    if (!username && !encryptedSecret) {
      return null;
    }

    if (!username) {
      throw new Error(
        "Auth username is required when a password is configured.",
      );
    }

    if (!encryptedSecret) {
      throw new Error("Auth password is required when username is configured.");
    }

    return {
      serviceType: "http_api",
      authType: "basic_userpass",
      username,
      encryptedSecret,
    };
  }

  async upsertLinkedOAuthAccount(
    slot: Element,
    savedConnection: EmailConnectionRecord,
  ): Promise<ServiceAccount> {
    if (!this.db) {
      throw new Error("Database is not ready.");
    }

    const username = (
      slot.querySelector("#int-username") as HTMLInputElement | null
    )?.value.trim();
    const clientId = (
      slot.querySelector("#int-oauth-client-id") as HTMLInputElement | null
    )?.value.trim();
    const clientSecretRaw = (
      slot.querySelector("#int-oauth-client-secret") as HTMLInputElement | null
    )?.value.trim();
    const scopeRaw = (
      slot.querySelector("#int-oauth-scope") as HTMLInputElement | null
    )?.value.trim();
    const selectedProviderId = (
      slot.querySelector("#int-oauth-provider") as HTMLSelectElement | null
    )?.value;
    const oauthProvider = this.getEmailOAuthProvider(selectedProviderId);

    if (!username) {
      throw new Error(
        "Email login address is required for OAuth authentication.",
      );
    }

    if (!clientId) {
      throw new Error("OAuth client ID is required for OAuth authentication.");
    }

    const existingConnection = this.connections.find(
      (item) => item.id === savedConnection.id,
    );

    const existingAccountId = existingConnection?.credentialRef?.accountId;
    const existingAccount = existingAccountId
      ? this.accounts.find((account) => account.id === existingAccountId) ||
        null
      : null;

    let token = existingAccount?.token || "";
    let refreshToken = existingAccount?.refreshToken;
    let accessTokenExpiresAt = existingAccount?.accessTokenExpiresAt;
    let scopes = existingAccount?.scopes;
    let tokenType = existingAccount?.tokenType;
    let oauthClientSecret = existingAccount?.oauthClientSecret;
    let oauthRefreshFailureCount = existingAccount?.oauthRefreshFailureCount;
    let oauthReauthRequired = existingAccount?.oauthReauthRequired;
    let oauthReauthRequiredAt = existingAccount?.oauthReauthRequiredAt;

    if (clientSecretRaw) {
      const encryptedClientSecret = await encryptValue(clientSecretRaw);
      if (encryptedClientSecret) {
        oauthClientSecret = encryptedClientSecret;
      }
    }

    if (this.pendingOauthResult?.accessToken) {
      const encryptedAccessToken = await encryptValue(
        this.pendingOauthResult.accessToken,
      );
      if (!encryptedAccessToken) {
        throw new Error("Failed to encrypt OAuth access token.");
      }

      token = encryptedAccessToken;

      if (this.pendingOauthResult.refreshToken) {
        const encryptedRefreshToken = await encryptValue(
          this.pendingOauthResult.refreshToken,
        );
        if (encryptedRefreshToken) {
          refreshToken = encryptedRefreshToken;
        }
      }

      accessTokenExpiresAt = this.pendingOauthResult.expiresAt;
      scopes = this.pendingOauthResult.scope
        ? this.pendingOauthResult.scope
            .split(/[\s,]+/)
            .map((entry) => entry.trim())
            .filter(Boolean)
        : scopeRaw
          ? scopeRaw
              .split(/[\s,]+/)
              .map((entry) => entry.trim())
              .filter(Boolean)
          : oauthProvider.defaultScopes;
      tokenType = this.pendingOauthResult.tokenType;
      oauthRefreshFailureCount = 0;
      oauthReauthRequired = false;
      oauthReauthRequiredAt = undefined;
    }

    if (!token) {
      throw new Error("Connect OAuth first to obtain an access token.");
    }

    const accountId = existingAccount?.id || ulid();
    const account: ServiceAccount = {
      id: accountId,
      label: `${savedConnection.label} ${oauthProvider.label}`,
      service: oauthProvider.serviceName,
      hostPattern: oauthProvider.hostPattern,
      token,
      authMode: "oauth",
      oauthProviderId: oauthProvider.id,
      oauthClientId: clientId,
      oauthClientSecret,
      accessTokenExpiresAt,
      refreshToken,
      scopes: scopes || oauthProvider.defaultScopes,
      tokenType,
      oauthRefreshFailureCount,
      oauthReauthRequired,
      oauthReauthRequiredAt,
    };

    const accounts = [...this.accounts];
    const existingIdx = accounts.findIndex((item) => item.id === accountId);
    if (existingIdx === -1) {
      accounts.push(account);
    } else {
      accounts[existingIdx] = account;
    }

    await setConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS, accounts);
    this.accounts = accounts;

    return account;
  }

  async toggleConnection(id: string) {
    if (!this.db) {
      return;
    }

    const record = this.connections.find((item) => item.id === id);
    if (!record) {
      showError("Email connection not found.", 4000);

      return;
    }

    try {
      await upsertEmailConnection(this.db, {
        id: record.id,
        label: record.label,
        pluginId: record.pluginId,
        enabled: !record.enabled,
        config: record.config,
      });

      showSuccess(`Email ${!record.enabled ? "enabled" : "disabled"}`, 2500);
      await this.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to update email connection: ${message}`, 6000);
    }
  }

  async deleteConnection(id: string) {
    if (!this.db) {
      return;
    }

    const record = this.connections.find((item) => item.id === id);
    if (!record) {
      return;
    }

    if (!confirm(`Delete email connection \"${record.label}\"?`)) {
      return;
    }

    try {
      const ok = await deleteEmailConnection(this.db, id);
      if (!ok) {
        showError("Failed to delete email connection.", 5000);

        return;
      }

      showSuccess("Email connection deleted", 2500);
      await this.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showError(`Failed to delete email connection: ${message}`, 6000);
    }
  }

  escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

customElements.define(elementName, ShadowClawIntegrations);
