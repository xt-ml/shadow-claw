import { CONFIG_KEYS, OAUTH_PROVIDER_DEFINITIONS } from "../../config.js";
import { getConfig } from "../../db/getConfig.js";
import { showError, showSuccess } from "../../toast.js";
import { escapeHtml } from "../../utils.js";
import {
  resolveStoredCredentialAuthMode,
  type PendingOAuthResult,
} from "../../accounts/stored-credentials.js";

import { getDb, type ShadowClawDatabase } from "../../db/db.js";
import { detectProvider, type GitAccount } from "../../git/credentials.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings-git";
const GIT_OAUTH_PROVIDER_IDS = ["github", "gitlab", "azure_devops"];

function mapDetectedProviderToOAuthProviderId(
  provider: ReturnType<typeof detectProvider>,
): string | undefined {
  if (provider === "azure-devops") {
    return "azure_devops";
  }

  if (provider === "github" || provider === "gitlab") {
    return provider;
  }

  return undefined;
}

function resolveGitAccountAuthMode(
  account: GitAccount | null,
): "pat" | "oauth" {
  return resolveStoredCredentialAuthMode(account);
}

export class ShadowClawSettingsGit extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettingsGit.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettingsGit.componentPath}/${elementName}.html`;

  accounts: GitAccount[] = [];
  db: ShadowClawDatabase | null = null;
  defaultAccountId: string = "";
  editingAccountId: string | null = null;
  pendingOauthResult: PendingOAuthResult | null = null;

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
      .querySelector('[data-action="save-git-settings"]')
      ?.addEventListener("click", () => this.saveGitSettings());

    root.querySelectorAll('input[name="git-proxy"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        this.updateGitWarning();
        this.updateCustomProxyVisibility();
      });
    });

    root
      .querySelector('[data-action="add-account"]')
      ?.addEventListener("click", () => this.showAccountForm("new"));
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    console.log(
      `[ShadowClawSettingsGit] Rendering... DB present: ${!!this.db}`,
    );
    try {
      console.log("[ShadowClawSettingsGit] Fetching proxy pref...");
      const proxyPref =
        (await getConfig(this.db, CONFIG_KEYS.GIT_CORS_PROXY)) || "local";
      console.log(`[ShadowClawSettingsGit] Proxy pref: ${proxyPref}`);

      const localRadio: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-local"]',
      );

      const publicRadio: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-public"]',
      );

      const customRadio: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-custom"]',
      );

      const customUrlInput: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-url-input"]',
      );

      if (localRadio && publicRadio && customRadio) {
        localRadio.checked = proxyPref === "local";
        publicRadio.checked = proxyPref === "public";
        customRadio.checked = proxyPref === "custom";
      }

      const { orchestratorStore } =
        await import("../../stores/orchestrator.js");
      if (customUrlInput) {
        customUrlInput.value = orchestratorStore.gitProxyUrl || "/git-proxy";
      }

      this.updateCustomProxyVisibility();

      const authorNameInput: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-author-name-input"]',
      );

      if (authorNameInput) {
        authorNameInput.value =
          (await getConfig(this.db, CONFIG_KEYS.GIT_AUTHOR_NAME)) ||
          "ShadowClaw";
      }

      const authorEmailInput: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-author-email-input"]',
      );

      if (authorEmailInput) {
        authorEmailInput.value =
          (await getConfig(this.db, CONFIG_KEYS.GIT_AUTHOR_EMAIL)) ||
          "k9@shadowclaw.local";
      }

      // Load accounts
      const raw = await getConfig(this.db, CONFIG_KEYS.GIT_ACCOUNTS);
      this.accounts = Array.isArray(raw) ? raw : [];
      this.defaultAccountId =
        (await getConfig(this.db, CONFIG_KEYS.GIT_DEFAULT_ACCOUNT)) || "";

      // Migrate legacy single-account if no accounts exist
      if (this.accounts.length === 0) {
        await this.migrateLegacyAccount();
      }

      this.renderAccountList();
      this.updateGitWarning();
    } catch (e) {
      console.warn("Could not load git settings:", e);
    }
  }

  /**
   * Migrate legacy single-key config into an account entry.
   * Only runs when no accounts exist and a legacy token or username is present.
   */
  async migrateLegacyAccount() {
    if (!this.db) {
      return;
    }

    const encToken = await getConfig(this.db, CONFIG_KEYS.GIT_TOKEN);
    const username = await getConfig(this.db, CONFIG_KEYS.GIT_USERNAME);

    if (!encToken && !username) {
      return;
    }

    const encPassword =
      (await getConfig(this.db, CONFIG_KEYS.GIT_PASSWORD)) || "";

    const legacy: GitAccount = {
      id: "legacy-migrated",
      label: "GitHub",
      hostPattern: "github.com",
      token: encToken || "",
      username: username || "",
      password: encPassword,
      authorName: "",
      authorEmail: "",
    };

    this.accounts = [legacy];
    this.defaultAccountId = legacy.id;

    const { setConfig } = await import("../../db/setConfig.js");
    await setConfig(this.db, CONFIG_KEYS.GIT_ACCOUNTS, this.accounts);
    await setConfig(this.db, CONFIG_KEYS.GIT_DEFAULT_ACCOUNT, legacy.id);
  }

  /**
   * Render the account card list.
   */
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
          No Git accounts configured. Click "+ Add Git Account" to get started.
        </div>`;

      return;
    }

    listEl.innerHTML = this.accounts
      .map((acct) => {
        const isDefault = acct.id === this.defaultAccountId;
        const hasToken = !!acct.token;
        const hasUser = !!acct.username;
        const authMode = resolveGitAccountAuthMode(acct);
        const authLabel = hasToken
          ? authMode === "oauth"
            ? acct.oauthReauthRequired
              ? "Reconnect required"
              : `OAuth token saved${acct.oauthProviderId ? ` (${acct.oauthProviderId})` : ""}`
            : "Token (PAT)"
          : hasUser
            ? `Username: ${acct.username}`
            : "No credentials";

        return `
          <div class="account-card${isDefault ? " is-default" : ""}" data-account-id="${acct.id}">
            <div class="account-card-header">
              <span class="account-card-label">${escapeHtml(acct.label)}</span>
              ${isDefault ? '<span class="default-badge">Default</span>' : ""}
            </div>
            <div class="account-card-meta">
              ${escapeHtml(acct.hostPattern)} · ${authLabel}
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
          this.deleteAccount(id);
        } else if (action === "set-default") {
          this.setDefaultAccount(id);
        }
      });
    });
  }

  /**
   * Show the inline account form for adding or editing.
   */
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
      : this.accounts.find((a) => a.id === accountId);
    const selectedAuthMode = resolveGitAccountAuthMode(existing || null);
    const inferredProviderId = existing?.oauthProviderId
      ? existing.oauthProviderId
      : mapDetectedProviderToOAuthProviderId(
          detectProvider(existing?.hostPattern || ""),
        );
    const oauthProviderId =
      inferredProviderId && OAUTH_PROVIDER_DEFINITIONS[inferredProviderId]
        ? inferredProviderId
        : "github";
    const oauthScope = existing?.scopes?.join(" ") || "";
    const oauthProviderOptions = GIT_OAUTH_PROVIDER_IDS.filter(
      (providerId) => !!OAUTH_PROVIDER_DEFINITIONS[providerId],
    )
      .map((providerId) => {
        const provider = OAUTH_PROVIDER_DEFINITIONS[providerId];

        return `<option value="${provider.id}"${provider.id === oauthProviderId ? " selected" : ""}>${escapeHtml(provider.name)}</option>`;
      })
      .join("");

    const slot = root.querySelector('[data-region="account-form-slot"]');
    if (!slot) {
      return;
    }

    slot.innerHTML = `
      <div class="account-form">
        <h4>${isNew ? "Add Git Account" : "Edit Account"}</h4>

        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-input" data-field="acct-label"
                 placeholder="e.g. GitHub, Azure DevOps"
                 value="${escapeHtml(existing?.label || "")}" />
          <div class="form-helper">A friendly name to identify this account.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Host Pattern</label>
          <input type="text" class="form-input" data-field="acct-host"
                 placeholder="e.g. github.com, dev.azure.com"
                 value="${escapeHtml(existing?.hostPattern || "")}" />
          <div class="form-helper">
            Matched against remote URLs to auto-select credentials.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Auth Mode</label>
          <select class="form-input" data-field="acct-auth-mode">
            <option value="pat"${selectedAuthMode === "pat" ? " selected" : ""}>PAT / Username</option>
            <option value="oauth"${selectedAuthMode === "oauth" ? " selected" : ""}>OAuth</option>
          </select>
          <div class="form-helper">Use OAuth for provider-managed access tokens or PAT for manual Git credentials.</div>
        </div>

        <div class="oauth-fields" data-region="oauth-fields">
          <div class="form-group">
            <label class="form-label">OAuth Provider</label>
            <select class="form-input" data-field="acct-oauth-provider">${oauthProviderOptions}</select>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client ID</label>
            <input type="text" class="form-input" data-field="acct-oauth-client-id"
                   value="${escapeHtml(existing?.oauthClientId || "")}"
                   placeholder="Enter provider OAuth app client ID" />
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client Secret (if required)</label>
            <input type="password" class="form-input" data-field="acct-oauth-client-secret"
                   placeholder="${existing?.oauthClientSecret ? "•••••••••••• (Saved)" : "Enter client secret if provider requires it"}" />
            <div class="form-helper">Stored encrypted locally. Needed by some providers for token exchange/refresh.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Scope (if required)</label>
            <input type="text" class="form-input" data-field="acct-oauth-scope"
                   value="${escapeHtml(oauthScope)}"
                   placeholder="space-separated scopes" />
            <div class="form-helper">Leave blank to use provider defaults.</div>
          </div>

          <div class="form-group oauth-connect-row">
            <button class="confirm-btn oauth-connect-btn" data-action="connect-oauth" type="button">Connect OAuth</button>
            <span class="oauth-status" data-region="oauth-status">${selectedAuthMode === "oauth" && existing?.oauthReauthRequired ? "Reconnect required" : selectedAuthMode === "oauth" && existing?.token ? "OAuth token already saved" : "Not connected"}</span>
          </div>
        </div>

        <div data-region="pat-fields">
          <div class="form-group">
            <label class="form-label">Token (PAT)</label>
            <input type="password" class="form-input" data-field="acct-token"
                   placeholder="${existing?.token ? "•••••••••••• (Saved)" : "ghp_xxxx or Azure PAT"}" />
            <div class="form-helper">
              Stored encrypted locally. Leave blank to keep existing.
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" data-field="acct-username"
                   placeholder="Optional — alternative to PAT"
                   value="${escapeHtml(existing?.username || "")}" />
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" data-field="acct-password"
                   placeholder="${existing?.password ? "•••••••••••• (Saved)" : "Optional — used with username"}" />
            <div class="form-helper">Stored encrypted locally. Leave blank to keep existing.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Author Name (optional)</label>
          <input type="text" class="form-input" data-field="acct-author-name"
                 placeholder="Override default author for this account"
                 value="${escapeHtml(existing?.authorName || "")}" />
        </div>

        <div class="form-group">
          <label class="form-label">Author Email (optional)</label>
          <input type="text" class="form-input" data-field="acct-author-email"
                 placeholder="Override default author email for this account"
                 value="${escapeHtml(existing?.authorEmail || "")}" />
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
      ?.addEventListener("click", () => this.saveAccountForm());
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

  /**
   * Hide the account form.
   */
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

  /**
   * Save the current account form (add or update).
   */
  async saveAccountForm() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot: HTMLInputElement | null = root.querySelector(
      '[data-region="account-form-slot"]',
    );
    if (!slot) {
      return;
    }

    const label = (
      slot.querySelector('[data-field="acct-label"]') as HTMLInputElement
    )?.value.trim();
    const hostPattern = (
      slot.querySelector('[data-field="acct-host"]') as HTMLInputElement
    )?.value.trim();
    const authMode = (
      slot.querySelector('[data-field="acct-auth-mode"]') as HTMLSelectElement
    )?.value as GitAccount["authMode"];

    if (!label || !hostPattern) {
      showError("Label and Host Pattern are required.", 4000);

      return;
    }

    try {
      const { encryptValue } = await import("../../crypto.js");
      const { setConfig } = await import("../../db/setConfig.js");

      const tokenRaw = (
        slot.querySelector('[data-field="acct-token"]') as HTMLInputElement
      )?.value.trim();

      const passwordRaw = (
        slot.querySelector('[data-field="acct-password"]') as HTMLInputElement
      )?.value.trim();

      const username =
        (
          slot.querySelector('[data-field="acct-username"]') as HTMLInputElement
        )?.value.trim() || "";

      const authorName =
        (
          slot.querySelector(
            '[data-field="acct-author-name"]',
          ) as HTMLInputElement
        )?.value.trim() || "";

      const authorEmail =
        (
          slot.querySelector(
            '[data-field="acct-author-email"]',
          ) as HTMLInputElement
        )?.value.trim() || "";

      const isNew = this.editingAccountId === "new";
      const existing = isNew
        ? null
        : this.accounts.find((a) => a.id === this.editingAccountId);

      let token = existing?.token || "";
      let password = existing?.password || "";
      let oauthProviderId = existing?.oauthProviderId;
      let oauthClientId = existing?.oauthClientId;
      let oauthClientSecret = existing?.oauthClientSecret;
      let accessTokenExpiresAt = existing?.accessTokenExpiresAt;
      let refreshToken = existing?.refreshToken;
      let scopes = existing?.scopes;
      let tokenType = existing?.tokenType;
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

        password = "";
      } else {
        if (tokenRaw) {
          const enc = await encryptValue(tokenRaw);
          if (enc) {
            token = enc;
          }
        }

        if (passwordRaw) {
          const enc = await encryptValue(passwordRaw);
          if (enc) {
            password = enc;
          }
        }

        oauthProviderId = undefined;
        oauthClientId = undefined;
        oauthClientSecret = undefined;
        accessTokenExpiresAt = undefined;
        refreshToken = undefined;
        scopes = undefined;
        tokenType = undefined;
        oauthRefreshFailureCount = undefined;
        oauthReauthRequired = undefined;
        oauthReauthRequiredAt = undefined;
      }

      if (isNew) {
        const { ulid } = await import("../../ulid.js");
        const acct: GitAccount = {
          id: ulid(),
          label,
          hostPattern,
          token,
          username: authMode === "oauth" ? "" : username,
          password,
          authorName,
          authorEmail,
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

        this.accounts.push(acct);

        // First account becomes default automatically
        if (this.accounts.length === 1) {
          this.defaultAccountId = acct.id;

          await setConfig(this.db, CONFIG_KEYS.GIT_DEFAULT_ACCOUNT, acct.id);
        }
      } else if (existing) {
        existing.label = label;
        existing.hostPattern = hostPattern;
        existing.token = token;
        existing.username = authMode === "oauth" ? "" : username;
        existing.password = password;
        existing.authorName = authorName;
        existing.authorEmail = authorEmail;
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

      await setConfig(this.db, CONFIG_KEYS.GIT_ACCOUNTS, this.accounts);

      this.hideAccountForm();
      this.renderAccountList();
      this.updateGitWarning();

      showSuccess(isNew ? "Account added" : "Account updated", 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving account: " + errorMsg, 6000);
    }
  }

  /**
   * Delete an account by id.
   */
  async deleteAccount(id: string) {
    if (!this.db) {
      return;
    }

    this.accounts = this.accounts.filter((a) => a.id !== id);

    // If we deleted the default, pick a new default
    if (this.defaultAccountId === id) {
      this.defaultAccountId = this.accounts[0]?.id || "";
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(this.db, CONFIG_KEYS.GIT_ACCOUNTS, this.accounts);
      await setConfig(
        this.db,
        CONFIG_KEYS.GIT_DEFAULT_ACCOUNT,
        this.defaultAccountId,
      );
    } catch (err) {
      console.warn("Error persisting account deletion:", err);
    }

    this.renderAccountList();
    this.updateGitWarning();

    showSuccess("Account deleted", 3000);
  }

  /**
   * Set an account as the default.
   */
  async setDefaultAccount(id: string) {
    if (!this.db) {
      return;
    }

    this.defaultAccountId = id;

    try {
      const { setConfig } = await import("../../db/setConfig.js");
      await setConfig(this.db, CONFIG_KEYS.GIT_DEFAULT_ACCOUNT, id);
    } catch (err) {
      console.warn("Error setting default account:", err);
    }

    this.renderAccountList();

    showSuccess("Default account updated", 3000);
  }

  /**
   * Update the Git security warning visibility.
   */
  async updateGitWarning() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const warningEl: HTMLElement | null = root.querySelector(
      '[data-setting="git-proxy-warning"]',
    );

    if (!warningEl) {
      return;
    }

    const publicRadio: HTMLInputElement | null = root.querySelector(
      '[data-setting="git-proxy-public"]',
    );

    const hasToken = this.accounts.some((a) => !!a.token);

    warningEl.style.display =
      publicRadio?.checked && hasToken ? "block" : "none";
  }

  /**
   * Save global Git settings (proxy, default author).
   */
  async saveGitSettings() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      const { setConfig } = await import("../../db/setConfig.js");

      // Proxy preference
      const publicRadio: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-public"]',
      );

      const customRadio: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-proxy-custom"]',
      );

      const proxyPref = publicRadio?.checked
        ? "public"
        : customRadio?.checked
          ? "custom"
          : "local";

      await setConfig(this.db, CONFIG_KEYS.GIT_CORS_PROXY, proxyPref);

      if (proxyPref === "custom") {
        const customUrlInput: HTMLInputElement | null = root.querySelector(
          '[data-setting="git-proxy-url-input"]',
        );

        const url = customUrlInput?.value.trim() || "/git-proxy";
        const { orchestratorStore } =
          await import("../../stores/orchestrator.js");

        await orchestratorStore.setGitProxyUrl(this.db, url);
      }

      // Author info
      const nameInput: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-author-name-input"]',
      );

      if (nameInput) {
        await setConfig(
          this.db,
          CONFIG_KEYS.GIT_AUTHOR_NAME,
          nameInput.value.trim() || "ShadowClaw",
        );
      }

      const emailInput: HTMLInputElement | null = root.querySelector(
        '[data-setting="git-author-email-input"]',
      );
      if (emailInput) {
        await setConfig(
          this.db,
          CONFIG_KEYS.GIT_AUTHOR_EMAIL,
          emailInput.value.trim() || "k9@shadowclaw.local",
        );
      }

      showSuccess("Git settings saved", 3000);

      this.updateGitWarning();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Git settings: " + errorMsg, 6000);
    }
  }

  /**
   * Show/hide the custom proxy URL input based on current radio selection.
   */
  updateCustomProxyVisibility() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const customRadio: HTMLInputElement | null = root.querySelector(
      '[data-setting="git-proxy-custom"]',
    );
    const field: HTMLElement | null = root.querySelector(
      '[data-region="git-custom-proxy-field"]',
    );
    if (field instanceof HTMLElement) {
      field.style.display = customRadio?.checked ? "block" : "none";
    }
  }
}

customElements.define(elementName, ShadowClawSettingsGit);
