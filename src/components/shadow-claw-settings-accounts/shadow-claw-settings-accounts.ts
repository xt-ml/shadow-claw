import { CONFIG_KEYS, OAUTH_PROVIDER_DEFINITIONS } from "../../config.js";
import { getDb, type ShadowClawDatabase } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { showError, showSuccess } from "../../toast.js";
import { escapeHtml } from "../../utils.js";

import type { ServiceAccount } from "../../accounts/service-accounts.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings-accounts";

function resolveAccountAuthMode(
  account: ServiceAccount | null,
): "pat" | "oauth" {
  if (!account) {
    return "pat";
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

  return "pat";
}

export class ShadowClawSettingsAccounts extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettingsAccounts.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettingsAccounts.componentPath}/${elementName}.html`;

  accounts: ServiceAccount[] = [];
  db: ShadowClawDatabase | null = null;
  defaultAccountId = "";
  editingAccountId: string | null = null;
  pendingOauthResult: {
    providerId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    tokenType?: string;
  } | null = null;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();

    await this.render();

    this.bindEventListeners();
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="add-account"]')
      ?.addEventListener("click", () => this.showAccountForm("new"));
  }

  async render() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    try {
      const raw = await getConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS);
      this.accounts = Array.isArray(raw) ? raw : [];
      this.defaultAccountId =
        (await getConfig(this.db, CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT)) || "";

      this.renderAccountList();
    } catch (e) {
      console.warn("Could not load service accounts:", e);
    }
  }

  renderAccountList() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const listEl = root.querySelector('[data-region="account-list"]');
    if (!listEl) {
      return;
    }

    if (this.accounts.length === 0) {
      listEl.innerHTML = `
        <div class="no-accounts">
          No additional accounts configured. Click "+ Add Non-Git Account" to get started.
        </div>`;

      return;
    }

    listEl.innerHTML = this.accounts
      .map((acct) => {
        const isDefault = acct.id === this.defaultAccountId;
        const hasToken = !!acct.token;
        const authMode = resolveAccountAuthMode(acct);
        const needsReauth = authMode === "oauth" && !!acct.oauthReauthRequired;
        const authLabel =
          authMode === "oauth"
            ? `OAuth${acct.oauthProviderId ? ` (${acct.oauthProviderId})` : ""}`
            : "PAT";
        const credentialLabel = hasToken
          ? authMode === "oauth"
            ? needsReauth
              ? "Reconnect required"
              : "OAuth token saved"
            : "PAT saved"
          : "No token";

        return `
          <div class="account-card${isDefault ? " is-default" : ""}" data-account-id="${acct.id}">
            <div class="account-card-header">
              <span class="account-card-label">${escapeHtml(acct.label)}</span>
              ${isDefault ? '<span class="default-badge">Default</span>' : ""}
            </div>
            <div class="account-card-meta">
              ${escapeHtml(acct.service)} · ${escapeHtml(acct.hostPattern)} · ${escapeHtml(authLabel)} · ${escapeHtml(credentialLabel)}
            </div>
            <div class="account-card-actions">
              ${!isDefault ? `<button data-action="set-default" data-id="${acct.id}">Set Default</button>` : ""}
              <button data-action="edit-account" data-id="${acct.id}">Edit</button>
              <button class="delete-btn" data-action="delete-account" data-id="${acct.id}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-action]").forEach((btn) => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!id) {
        return;
      }

      btn.addEventListener("click", () => {
        if (action === "edit-account") {
          this.showAccountForm(id);
        } else if (action === "delete-account") {
          void this.deleteAccount(id);
        } else if (action === "set-default") {
          void this.setDefaultAccount(id);
        }
      });
    });
  }

  showAccountForm(accountId: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    this.editingAccountId = accountId;
    this.pendingOauthResult = null;
    const isNew = accountId === "new";
    const existing = isNew
      ? null
      : this.accounts.find((account) => account.id === accountId);
    const selectedAuthMode = resolveAccountAuthMode(existing || null);
    const oauthProviderId =
      existing?.oauthProviderId &&
      OAUTH_PROVIDER_DEFINITIONS[existing.oauthProviderId]
        ? existing.oauthProviderId
        : "github";
    const oauthScope = existing?.scopes?.join(" ") || "";
    const oauthProviderOptions = Object.values(OAUTH_PROVIDER_DEFINITIONS)
      .map(
        (provider) =>
          `<option value="${provider.id}"${provider.id === oauthProviderId ? " selected" : ""}>${escapeHtml(provider.name)}</option>`,
      )
      .join("");

    const slot = root.querySelector('[data-region="account-form-slot"]');
    if (!slot) {
      return;
    }

    slot.innerHTML = `
      <div class="account-form">
        <h4>${isNew ? "Add Account" : "Edit Account"}</h4>

        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-input" data-field="acct-label"
                 placeholder="e.g. Design Team Figma"
                 value="${escapeHtml(existing?.label || "")}" />
          <div class="form-helper">A friendly name to identify this account.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Service</label>
          <input type="text" class="form-input" data-field="acct-service"
                 placeholder="e.g. Figma"
                 value="${escapeHtml(existing?.service || "")}" />
          <div class="form-helper">The external service this token belongs to.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Host Pattern</label>
          <input type="text" class="form-input" data-field="acct-host"
                 placeholder="e.g. figma.com or api.figma.com"
                 value="${escapeHtml(existing?.hostPattern || "")}" />
          <div class="form-helper">Used to identify the service endpoint or host.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Auth Mode</label>
          <select class="form-input" data-field="acct-auth-mode">
            <option value="pat"${selectedAuthMode === "pat" ? " selected" : ""}>PAT</option>
            <option value="oauth"${selectedAuthMode === "oauth" ? " selected" : ""}>OAuth</option>
          </select>
          <div class="form-helper">Use PAT for manual tokens, or OAuth for provider-managed access tokens.</div>
        </div>

        <div class="oauth-fields" data-region="oauth-fields">
          <div class="form-group">
            <label class="form-label">OAuth Provider</label>
            <select class="form-input" data-field="acct-oauth-provider">${oauthProviderOptions}</select>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client ID</label>
            <input type="text" class="form-input" data-field="acct-oauth-client-id" value="${escapeHtml(existing?.oauthClientId || "")}" placeholder="Enter provider OAuth app client ID" />
            <div class="form-helper">Required for OAuth connect. Register an OAuth app with the selected provider first.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client Secret (if required)</label>
            <input type="password" class="form-input" data-field="acct-oauth-client-secret" placeholder="${existing?.oauthClientSecret ? "•••••••••••• (Saved)" : "Enter client secret if provider requires it"}" />
            <div class="form-helper">Stored encrypted locally. Needed by some providers for token exchange/refresh.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Scope (if required)</label>
            <input type="text" class="form-input" data-field="acct-oauth-scope" value="${escapeHtml(oauthScope)}" placeholder="space-separated scopes" />
            <div class="form-helper">Leave blank to use provider defaults.</div>
          </div>

          <div class="form-group oauth-connect-row">
            <button class="confirm-btn oauth-connect-btn" data-action="connect-oauth" type="button">Connect OAuth</button>
            <span class="oauth-status" data-region="oauth-status">${selectedAuthMode === "oauth" && existing?.oauthReauthRequired ? "Reconnect required" : selectedAuthMode === "oauth" && existing?.token ? "OAuth token already saved" : "Not connected"}</span>
          </div>
        </div>

        <div class="form-group" data-region="pat-fields">
          <label class="form-label">Personal Access Token</label>
          <input type="password" class="form-input" data-field="acct-token"
                 placeholder="${existing?.token ? "•••••••••••• (Saved)" : "Paste PAT"}" />
          <div class="form-helper">Stored encrypted locally. Leave blank to keep the existing token.</div>
        </div>

        <div class="account-form-actions">
          <button class="confirm-btn" data-action="save-account">
            ${isNew ? "Add Account" : "Update Account"}
          </button>
          <button class="cancel-btn" data-action="cancel-account-form">Cancel</button>
        </div>
      </div>`;

    slot
      .querySelector('[data-action="save-account"]')
      ?.addEventListener("click", () => void this.saveAccountForm());
    slot
      .querySelector('[data-action="cancel-account-form"]')
      ?.addEventListener("click", () => this.hideAccountForm());
    slot
      .querySelector('[data-field="acct-auth-mode"]')
      ?.addEventListener("change", () => this.updateAuthModeVisibility(slot));
    slot
      .querySelector('[data-action="connect-oauth"]')
      ?.addEventListener("click", () => void this.connectOAuthFromForm(slot));

    this.updateAuthModeVisibility(slot);
  }

  hideAccountForm() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot = root.querySelector('[data-region="account-form-slot"]');
    if (slot) {
      slot.innerHTML = "";
    }

    this.editingAccountId = null;
    this.pendingOauthResult = null;
  }

  updateAuthModeVisibility(slot: Element) {
    const mode = (
      slot.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    )?.value;
    const isOAuth = mode === "oauth";

    const oauthRegion = slot.querySelector('[data-region="oauth-fields"]');
    const patRegion = slot.querySelector('[data-region="pat-fields"]');

    if (oauthRegion instanceof HTMLElement) {
      oauthRegion.style.display = isOAuth ? "block" : "none";
    }

    if (patRegion instanceof HTMLElement) {
      patRegion.style.display = isOAuth ? "none" : "block";
    }
  }

  async connectOAuthFromForm(slot: Element) {
    const providerId = (
      slot.querySelector(
        '[data-field="acct-oauth-provider"]',
      ) as HTMLSelectElement
    )?.value;
    const clientId = (
      slot.querySelector(
        '[data-field="acct-oauth-client-id"]',
      ) as HTMLInputElement
    )?.value.trim();
    const clientSecret = (
      slot.querySelector(
        '[data-field="acct-oauth-client-secret"]',
      ) as HTMLInputElement
    )?.value.trim();
    const scopeRaw = (
      slot.querySelector('[data-field="acct-oauth-scope"]') as HTMLInputElement
    )?.value.trim();

    if (!providerId) {
      showError("OAuth provider is required.", 4000);

      return;
    }

    if (!clientId) {
      showError("OAuth client ID is required.", 4000);

      return;
    }

    const oauthStatus = slot.querySelector('[data-region="oauth-status"]');
    const connectBtn = slot.querySelector(
      '[data-action="connect-oauth"]',
    ) as HTMLButtonElement | null;

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
        : undefined;

      const authorizeRes = await fetch("/oauth/authorize", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          providerId,
          clientId,
          clientSecret: clientSecret || undefined,
          redirectUri: `${window.location.origin}/oauth/callback`,
          scope,
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
        "shadowclaw-oauth",
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
        providerId,
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

      showSuccess("OAuth connected", 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (oauthStatus) {
        oauthStatus.textContent = "OAuth failed";
      }

      showError(`OAuth connect failed: ${message}`, 6000);
    } finally {
      if (connectBtn) {
        connectBtn.disabled = false;
      }
    }
  }

  async saveAccountForm() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot = root.querySelector('[data-region="account-form-slot"]');
    if (!slot) {
      return;
    }

    const label = (
      slot.querySelector('[data-field="acct-label"]') as HTMLInputElement
    )?.value.trim();
    const service = (
      slot.querySelector('[data-field="acct-service"]') as HTMLInputElement
    )?.value.trim();
    const hostPattern = (
      slot.querySelector('[data-field="acct-host"]') as HTMLInputElement
    )?.value.trim();
    const authMode = (
      slot.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    )?.value as ServiceAccount["authMode"];

    if (!label || !service || !hostPattern) {
      showError("Label, Service, and Host Pattern are required.", 4000);

      return;
    }

    try {
      const { encryptValue } = await import("../../crypto.js");
      const { setConfig } = await import("../../db/setConfig.js");

      const tokenRaw = (
        slot.querySelector('[data-field="acct-token"]') as HTMLInputElement
      )?.value.trim();

      const isNew = this.editingAccountId === "new";
      const existing = isNew
        ? null
        : this.accounts.find((account) => account.id === this.editingAccountId);

      let token = existing?.token || "";
      let refreshToken = existing?.refreshToken;
      let accessTokenExpiresAt = existing?.accessTokenExpiresAt;
      let scopes = existing?.scopes;
      let tokenType = existing?.tokenType;
      let oauthProviderId = existing?.oauthProviderId;
      let oauthClientId = existing?.oauthClientId;
      let oauthClientSecret = existing?.oauthClientSecret;
      let oauthRefreshFailureCount = existing?.oauthRefreshFailureCount;
      let oauthReauthRequired = existing?.oauthReauthRequired;
      let oauthReauthRequiredAt = existing?.oauthReauthRequiredAt;

      if (authMode === "oauth") {
        oauthProviderId = (
          slot.querySelector(
            '[data-field="acct-oauth-provider"]',
          ) as HTMLSelectElement
        )?.value;
        oauthClientId = (
          slot.querySelector(
            '[data-field="acct-oauth-client-id"]',
          ) as HTMLInputElement
        )?.value.trim();
        const oauthClientSecretRaw = (
          slot.querySelector(
            '[data-field="acct-oauth-client-secret"]',
          ) as HTMLInputElement
        )?.value.trim();
        const oauthScopeRaw = (
          slot.querySelector(
            '[data-field="acct-oauth-scope"]',
          ) as HTMLInputElement
        )?.value.trim();
        const configuredScopes = oauthScopeRaw
          ? oauthScopeRaw
              .split(/[\s,]+/)
              .map((entry) => entry.trim())
              .filter(Boolean)
          : undefined;

        if (!oauthProviderId) {
          showError("OAuth provider is required for OAuth mode.", 4000);

          return;
        }

        if (!oauthClientId) {
          showError("OAuth client ID is required for OAuth mode.", 4000);

          return;
        }

        if (oauthClientSecretRaw) {
          const encryptedClientSecret =
            await encryptValue(oauthClientSecretRaw);
          if (encryptedClientSecret) {
            oauthClientSecret = encryptedClientSecret;
          }
        }

        if (this.pendingOauthResult?.accessToken) {
          const encryptedAccessToken = await encryptValue(
            this.pendingOauthResult.accessToken,
          );
          if (encryptedAccessToken) {
            token = encryptedAccessToken;
          }

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
            : configuredScopes || scopes;
          tokenType = this.pendingOauthResult.tokenType;
          oauthRefreshFailureCount = 0;
          oauthReauthRequired = false;
          oauthReauthRequiredAt = undefined;
        } else {
          scopes = configuredScopes || scopes;
        }

        if (!token) {
          showError(
            "Connect OAuth first to obtain an access token for this account.",
            5000,
          );

          return;
        }
      } else {
        if (tokenRaw) {
          const encrypted = await encryptValue(tokenRaw);
          if (encrypted) {
            token = encrypted;
          }
        }

        refreshToken = undefined;
        accessTokenExpiresAt = undefined;
        scopes = undefined;
        tokenType = undefined;
        oauthProviderId = undefined;
        oauthClientId = undefined;
        oauthClientSecret = undefined;
        oauthRefreshFailureCount = undefined;
        oauthReauthRequired = undefined;
        oauthReauthRequiredAt = undefined;
      }

      if (isNew) {
        const { ulid } = await import("../../ulid.js");
        const account: ServiceAccount = {
          id: ulid(),
          label,
          service,
          hostPattern,
          token,
          authMode: authMode || "pat",
          oauthProviderId,
          oauthClientId,
          oauthClientSecret,
          accessTokenExpiresAt,
          refreshToken,
          scopes,
          tokenType,
          oauthRefreshFailureCount,
          oauthReauthRequired,
          oauthReauthRequiredAt,
        };

        this.accounts.push(account);

        if (this.accounts.length === 1) {
          this.defaultAccountId = account.id;
          await setConfig(
            this.db,
            CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT,
            account.id,
          );
        }
      } else if (existing) {
        existing.label = label;
        existing.service = service;
        existing.hostPattern = hostPattern;
        existing.token = token;
        existing.authMode = authMode || "pat";
        existing.oauthProviderId = oauthProviderId;
        existing.oauthClientId = oauthClientId;
        existing.oauthClientSecret = oauthClientSecret;
        existing.accessTokenExpiresAt = accessTokenExpiresAt;
        existing.refreshToken = refreshToken;
        existing.scopes = scopes;
        existing.tokenType = tokenType;
        existing.oauthRefreshFailureCount = oauthRefreshFailureCount;
        existing.oauthReauthRequired = oauthReauthRequired;
        existing.oauthReauthRequiredAt = oauthReauthRequiredAt;
      }

      await setConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS, this.accounts);

      this.hideAccountForm();
      this.renderAccountList();

      showSuccess(isNew ? "Account added" : "Account updated", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving account: " + errorMsg, 6000);
    }
  }

  async deleteAccount(id: string) {
    if (!this.db) {
      return;
    }

    this.accounts = this.accounts.filter((account) => account.id !== id);

    if (this.defaultAccountId === id) {
      this.defaultAccountId = this.accounts[0]?.id || "";
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS, this.accounts);
      await setConfig(
        this.db,
        CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT,
        this.defaultAccountId,
      );
    } catch (err) {
      console.warn("Error persisting account deletion:", err);
    }

    this.renderAccountList();

    showSuccess("Account deleted", 3000);
  }

  async setDefaultAccount(id: string) {
    if (!this.db) {
      return;
    }

    this.defaultAccountId = id;

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(this.db, CONFIG_KEYS.SERVICE_DEFAULT_ACCOUNT, id);
    } catch (err) {
      console.warn("Error setting default account:", err);
    }

    this.renderAccountList();

    showSuccess("Default account updated", 3000);
  }
}

customElements.define(elementName, ShadowClawSettingsAccounts);
