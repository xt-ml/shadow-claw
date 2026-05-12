import { CONFIG_KEYS } from "../../../config.js";
import { getDb, type ShadowClawDatabase } from "../../../db/db.js";
import { getConfig } from "../../../db/getConfig.js";
import { encryptValue } from "../../../crypto.js";

import { testRemoteMcpConnection } from "../../../remote-mcp-client.js";
import { reconnectMcpOAuth } from "../../../mcp-reconnect.js";

import {
  bindRemoteMcpCredentialRef,
  deleteRemoteMcpConnection,
  listRemoteMcpConnections,
  upsertRemoteMcpConnection,
} from "../../../mcp-connections.js";

import { showError, showSuccess } from "../../../toast.js";
import { escapeHtml } from "../../../utils.js";

import type { ServiceAccount } from "../../../accounts/service-accounts.js";
import type { GitAccount } from "../../../git/credentials.js";
import type { McpConnectionTestResult } from "../../../remote-mcp-client.js";

import type {
  RemoteMcpConnectionRecord,
  RemoteMcpCredentialRef,
  RemoteMcpTransport,
} from "../../../mcp-connections.js";

import ShadowClawElement from "../../shadow-claw-element.js";
import "../../common/shadow-claw-empty-state/shadow-claw-empty-state.js";
import "../../common/shadow-claw-actions/shadow-claw-actions.js";
import "../../common/shadow-claw-card/shadow-claw-card.js";

const elementName = "shadow-claw-mcp-remote";

type AuthSelection =
  | "none"
  | "service_pat"
  | "service_oauth"
  | "git_pat"
  | "git_oauth"
  | "custom_header";

export class ShadowClawMcpRemote extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawMcpRemote.componentPath}/${elementName}.css`;
  static template = `${ShadowClawMcpRemote.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  connections: RemoteMcpConnectionRecord[] = [];
  serviceAccounts: ServiceAccount[] = [];
  gitAccounts: GitAccount[] = [];
  editingConnectionId: string | null = null;

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
      .querySelector('[data-action="add-connection"]')
      ?.addEventListener("click", () => this.showConnectionForm("new"));

    root
      .querySelector('[data-region="connection-list"]')
      ?.addEventListener("settings-action", (event) => {
        const detail = (event as CustomEvent<{ action: string; id: string }>)
          .detail;
        const { action, id } = detail || { action: "", id: "" };

        if (!id) {
          return;
        }

        if (action === "edit-connection") {
          this.showConnectionForm(id);
        } else if (action === "delete-connection") {
          void this.deleteConnection(id);
        } else if (action === "test-connection") {
          void this.testConnection(id);
        }
      });

    root
      .querySelector('[data-region="connection-list"]')
      ?.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const connectionId = target.dataset.reconnectConnection;
        if (connectionId) {
          void this.reconnectOAuth(connectionId);
        }
      });
  }

  async render() {
    const root = this.shadowRoot;
    if (!root || !this.db) {
      return;
    }

    try {
      this.connections = await listRemoteMcpConnections(this.db);
      const serviceRaw = await getConfig(this.db, CONFIG_KEYS.SERVICE_ACCOUNTS);
      this.serviceAccounts = Array.isArray(serviceRaw) ? serviceRaw : [];
      const gitRaw = await getConfig(this.db, CONFIG_KEYS.GIT_ACCOUNTS);
      this.gitAccounts = Array.isArray(gitRaw) ? gitRaw : [];

      this.renderConnectionList();
    } catch (err) {
      console.warn("Could not load remote MCP connections:", err);
    }
  }

  renderConnectionList() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const listEl = root.querySelector('[data-region="connection-list"]');
    if (!listEl) {
      return;
    }

    listEl.replaceChildren();

    if (this.connections.length === 0) {
      const emptyState = document.createElement("shadow-claw-empty-state");
      emptyState.setAttribute(
        "message",
        "No remote MCP connections configured.",
      );
      emptyState.setAttribute(
        "hint",
        "Click '+ Add Remote MCP Connection' to get started.",
      );
      listEl.append(emptyState);

      return;
    }

    const fragment = document.createDocumentFragment();

    this.connections.forEach((connection) => {
      const authLabel = this.describeCredentialRef(connection.credentialRef);
      const enabledLabel = connection.enabled ? "Enabled" : "Disabled";
      const cardMeta = `${connection.serverUrl} · ${connection.transport} · ${authLabel}`;

      const card = document.createElement("shadow-claw-card");
      card.setAttribute("data-connection-id", connection.id);
      card.setAttribute("label", connection.label);
      card.setAttribute("meta", cardMeta);
      card.setAttribute("badge", enabledLabel);
      if (!connection.enabled) {
        card.setAttribute("muted", "");
      }

      const actions = document.createElement("shadow-claw-actions");
      actions.setAttribute("slot", "actions");
      actions.setAttribute("kind", "connection");
      actions.setAttribute("item-id", connection.id);

      card.append(actions);

      const isOAuth = this.isOAuthConnection(connection);
      if (isOAuth) {
        const reconnectBtn = document.createElement("button");
        reconnectBtn.className = "reconnect-btn";
        reconnectBtn.textContent = "🔑 Reconnect OAuth";
        reconnectBtn.setAttribute("data-reconnect-connection", connection.id);
        card.append(reconnectBtn);
      }

      fragment.append(card);
    });

    listEl.append(fragment);
  }

  describeCredentialRef(ref: RemoteMcpCredentialRef | null): string {
    if (!ref || ref.authType === "none") {
      return "No auth";
    }

    if (ref.authType === "custom_header") {
      return `Custom header${ref.headerName ? ` (${ref.headerName})` : ""}`;
    }

    if (ref.accountId) {
      return `Service account (${ref.authType.toUpperCase()})`;
    }

    if (ref.gitAccountId) {
      return `Git account (${ref.authType.toUpperCase()})`;
    }

    return ref.authType.toUpperCase();
  }

  isOAuthConnection(connection: RemoteMcpConnectionRecord): boolean {
    const ref = connection.credentialRef;
    if (!ref) {
      return false;
    }

    return ref.authType === "oauth" && !!(ref.accountId || ref.gitAccountId);
  }

  async reconnectOAuth(connectionId: string) {
    if (!this.db) {
      return;
    }

    const connection = this.connections.find(
      (item) => item.id === connectionId,
    );

    const label = connection?.label || connectionId;

    const result = await reconnectMcpOAuth(this.db, connectionId);

    if (result.success) {
      showSuccess(`OAuth reconnected for "${label}"`, 4000);
    } else {
      showError(`OAuth reconnect failed: ${result.error}`, 6000);
    }
  }

  getAuthSelectionFromCredentialRef(
    ref: RemoteMcpCredentialRef | null,
  ): AuthSelection {
    if (!ref || ref.authType === "none") {
      return "none";
    }

    if (ref.authType === "custom_header") {
      return "custom_header";
    }

    if (ref.accountId) {
      return ref.authType === "oauth" ? "service_oauth" : "service_pat";
    }

    if (ref.gitAccountId) {
      return ref.authType === "oauth" ? "git_oauth" : "git_pat";
    }

    return "none";
  }

  showConnectionForm(connectionId: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    this.editingConnectionId = connectionId;
    const isNew = connectionId === "new";
    const existing = isNew
      ? null
      : this.connections.find((item) => item.id === connectionId) || null;

    const transport = existing?.transport || "streamable_http";
    const authSelection = this.getAuthSelectionFromCredentialRef(
      existing?.credentialRef || null,
    );

    const slot = root.querySelector('[data-region="connection-form-slot"]');
    if (!slot) {
      return;
    }

    slot.innerHTML = `
      <div class="connection-form">
        <h4>${isNew ? "Add Remote MCP Connection" : "Edit Remote MCP Connection"}</h4>

        <div class="form-group">
          <label class="form-label">Connection Label</label>
          <input
            type="text"
            class="form-input"
            data-field="connection-label"
            placeholder="e.g. Figma MCP, Jira MCP"
            value="${escapeHtml(existing?.label || "")}"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Server URL</label>
          <input
            type="text"
            class="form-input"
            data-field="connection-url"
            placeholder="https://mcp.example.com/rpc"
            value="${escapeHtml(existing?.serverUrl || "")}"
          />
          <div class="form-helper">Must be an absolute http(s) URL.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Transport</label>
          <select class="form-input" data-field="connection-transport">
            <option value="streamable_http"${transport === "streamable_http" ? " selected" : ""}>streamable_http</option>
            <option value="sse"${transport === "sse" ? " selected" : ""}>sse</option>
            <option value="websocket"${transport === "websocket" ? " selected" : ""}>websocket</option>
          </select>
          <div class="form-helper">
            Current runtime support is streamable_http. Other transports can be saved for future support.
          </div>
        </div>

        <div class="form-group connection-form-row">
          <input type="checkbox" data-field="connection-enabled"${existing?.enabled === false ? "" : " checked"} />
          <label class="form-label">Enabled</label>
        </div>

        <div class="form-group connection-form-row" data-region="auto-reconnect-region">
          <input type="checkbox" data-field="connection-auto-reconnect"${existing?.autoReconnectOAuth ? " checked" : ""} />
          <label class="form-label">Auto-reconnect OAuth on 401</label>
          <div class="form-helper" style="margin-left: 0.25rem;">When enabled, a 401 error will automatically open the OAuth popup to re-authenticate.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Authentication</label>
          <select class="form-input" data-field="auth-selection">
            <option value="none"${authSelection === "none" ? " selected" : ""}>None</option>
            <option value="service_pat"${authSelection === "service_pat" ? " selected" : ""}>Service Account (PAT)</option>
            <option value="service_oauth"${authSelection === "service_oauth" ? " selected" : ""}>Service Account (OAuth)</option>
            <option value="git_pat"${authSelection === "git_pat" ? " selected" : ""}>Git Account (PAT)</option>
            <option value="git_oauth"${authSelection === "git_oauth" ? " selected" : ""}>Git Account (OAuth)</option>
            <option value="custom_header"${authSelection === "custom_header" ? " selected" : ""}>Custom Header</option>
          </select>
        </div>

        <div class="form-group" data-region="service-account-region">
          <label class="form-label">Service Account</label>
          <select class="form-input" data-field="service-account-id">
            ${this.renderServiceAccountOptions(existing?.credentialRef?.accountId)}
          </select>
        </div>

        <div class="form-group" data-region="git-account-region">
          <label class="form-label">Git Account</label>
          <select class="form-input" data-field="git-account-id">
            ${this.renderGitAccountOptions(existing?.credentialRef?.gitAccountId)}
          </select>
        </div>

        <div data-region="custom-header-region">
          <div class="form-group">
            <label class="form-label">Header Name</label>
            <input
              type="text"
              class="form-input"
              data-field="custom-header-name"
              placeholder="e.g. Authorization or X-API-Key"
              value="${escapeHtml(existing?.credentialRef?.headerName || "")}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Header Value</label>
            <input
              type="password"
              class="form-input"
              data-field="custom-header-value"
              placeholder="${existing?.credentialRef?.authType === "custom_header" ? "•••••••••••• (Saved)" : "Enter secret value"}"
            />
            <div class="auth-note">Stored encrypted locally. Leave blank to keep existing value.</div>
          </div>
        </div>

        <div class="connection-form-actions">
          <button class="confirm-btn" data-action="save-connection">
            ${isNew ? "Add Connection" : "Update Connection"}
          </button>
          <button class="cancel-btn" data-action="cancel-connection-form">Cancel</button>
        </div>
      </div>
    `;

    slot
      .querySelector('[data-action="save-connection"]')
      ?.addEventListener("click", () => void this.saveConnectionForm());
    slot
      .querySelector('[data-action="cancel-connection-form"]')
      ?.addEventListener("click", () => this.hideConnectionForm());
    slot
      .querySelector('[data-field="auth-selection"]')
      ?.addEventListener("change", () => this.updateAuthFieldsVisibility(slot));

    this.updateAuthFieldsVisibility(slot);
  }

  renderServiceAccountOptions(selectedId?: string): string {
    if (this.serviceAccounts.length === 0) {
      return '<option value="">No service accounts configured</option>';
    }

    return this.serviceAccounts
      .map((account) => {
        const selected = account.id === selectedId ? " selected" : "";

        return `<option value="${account.id}"${selected}>${escapeHtml(account.label)} · ${escapeHtml(account.hostPattern)}</option>`;
      })
      .join("");
  }

  renderGitAccountOptions(selectedId?: string): string {
    if (this.gitAccounts.length === 0) {
      return '<option value="">No git accounts configured</option>';
    }

    return this.gitAccounts
      .map((account) => {
        const selected = account.id === selectedId ? " selected" : "";

        return `<option value="${account.id}"${selected}>${escapeHtml(account.label)} · ${escapeHtml(account.hostPattern)}</option>`;
      })
      .join("");
  }

  hideConnectionForm() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot = root.querySelector('[data-region="connection-form-slot"]');
    if (slot) {
      slot.innerHTML = "";
    }

    this.editingConnectionId = null;
  }

  updateAuthFieldsVisibility(slot: Element) {
    const authSelection = (
      slot.querySelector('[data-field="auth-selection"]') as HTMLSelectElement
    )?.value as AuthSelection;

    const serviceRegion = slot.querySelector(
      '[data-region="service-account-region"]',
    );

    const gitRegion = slot.querySelector('[data-region="git-account-region"]');
    const customHeaderRegion = slot.querySelector(
      '[data-region="custom-header-region"]',
    );

    const autoReconnectRegion = slot.querySelector(
      '[data-region="auto-reconnect-region"]',
    );

    const showService =
      authSelection === "service_pat" || authSelection === "service_oauth";
    const showGit =
      authSelection === "git_pat" || authSelection === "git_oauth";
    const showCustom = authSelection === "custom_header";
    const showAutoReconnect =
      authSelection === "service_oauth" || authSelection === "git_oauth";

    if (serviceRegion instanceof HTMLElement) {
      serviceRegion.style.display = showService ? "block" : "none";
    }

    if (gitRegion instanceof HTMLElement) {
      gitRegion.style.display = showGit ? "block" : "none";
    }

    if (customHeaderRegion instanceof HTMLElement) {
      customHeaderRegion.style.display = showCustom ? "block" : "none";
    }

    if (autoReconnectRegion instanceof HTMLElement) {
      autoReconnectRegion.style.display = showAutoReconnect ? "flex" : "none";
    }
  }

  async saveConnectionForm() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const slot = root.querySelector('[data-region="connection-form-slot"]');
    if (!slot) {
      return;
    }

    const label = (
      slot.querySelector('[data-field="connection-label"]') as HTMLInputElement
    )?.value.trim();
    const serverUrl = (
      slot.querySelector('[data-field="connection-url"]') as HTMLInputElement
    )?.value.trim();
    const transport = (
      slot.querySelector(
        '[data-field="connection-transport"]',
      ) as HTMLSelectElement
    )?.value as RemoteMcpTransport;
    const enabled = (
      slot.querySelector(
        '[data-field="connection-enabled"]',
      ) as HTMLInputElement
    )?.checked;
    const autoReconnectOAuth = (
      slot.querySelector(
        '[data-field="connection-auto-reconnect"]',
      ) as HTMLInputElement
    )?.checked;
    const authSelection = (
      slot.querySelector('[data-field="auth-selection"]') as HTMLSelectElement
    )?.value as AuthSelection;

    if (!label || !serverUrl) {
      showError("Connection label and server URL are required.", 4000);

      return;
    }

    const isNew = this.editingConnectionId === "new";
    const existing = isNew
      ? null
      : this.connections.find((item) => item.id === this.editingConnectionId) ||
        null;

    try {
      const connection = await upsertRemoteMcpConnection(this.db, {
        id: isNew ? undefined : existing?.id,
        label,
        serviceType: "mcp_remote",
        serverUrl,
        transport,
        enabled,
        autoReconnectOAuth,
      });

      const credentialRef = await this.buildCredentialRef(
        slot,
        authSelection,
        existing,
      );

      await bindRemoteMcpCredentialRef(this.db, connection.id, credentialRef);
      await this.render();
      this.hideConnectionForm();

      showSuccess(
        isNew ? "Remote MCP connection added" : "Remote MCP connection updated",
        3000,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to save remote MCP connection: ${message}`, 6000);
    }
  }

  async buildCredentialRef(
    slot: Element,
    authSelection: AuthSelection,
    existing: RemoteMcpConnectionRecord | null,
  ): Promise<RemoteMcpCredentialRef | null> {
    if (authSelection === "none") {
      return null;
    }

    if (authSelection === "service_pat" || authSelection === "service_oauth") {
      const accountId = (
        slot.querySelector(
          '[data-field="service-account-id"]',
        ) as HTMLSelectElement
      )?.value;
      if (!accountId) {
        throw new Error(
          "Select a service account for this authentication mode.",
        );
      }

      return {
        serviceType: "mcp_remote",
        authType: authSelection === "service_oauth" ? "oauth" : "pat",
        providerId: "custom_mcp",
        accountId,
      };
    }

    if (authSelection === "git_pat" || authSelection === "git_oauth") {
      const gitAccountId = (
        slot.querySelector('[data-field="git-account-id"]') as HTMLSelectElement
      )?.value;
      if (!gitAccountId) {
        throw new Error("Select a git account for this authentication mode.");
      }

      return {
        serviceType: "mcp_remote",
        authType: authSelection === "git_oauth" ? "oauth" : "pat",
        providerId: "custom_mcp",
        gitAccountId,
      };
    }

    const headerName = (
      slot.querySelector(
        '[data-field="custom-header-name"]',
      ) as HTMLInputElement
    )?.value.trim();
    const headerValueRaw = (
      slot.querySelector(
        '[data-field="custom-header-value"]',
      ) as HTMLInputElement
    )?.value.trim();

    if (!headerName) {
      throw new Error(
        "Header name is required for custom header authentication.",
      );
    }

    let encryptedValue: string | undefined;
    if (headerValueRaw) {
      encryptedValue = (await encryptValue(headerValueRaw)) || undefined;
    }

    if (!encryptedValue) {
      if (
        existing?.credentialRef?.authType === "custom_header" &&
        existing.credentialRef.encryptedValue
      ) {
        encryptedValue = existing.credentialRef.encryptedValue;
      } else {
        throw new Error(
          "Header value is required for custom header authentication.",
        );
      }
    }

    return {
      serviceType: "mcp_remote",
      authType: "custom_header",
      providerId: "custom_mcp",
      headerName,
      encryptedValue,
    };
  }

  async deleteConnection(connectionId: string) {
    if (!this.db) {
      return;
    }

    try {
      const deleted = await deleteRemoteMcpConnection(this.db, connectionId);
      if (!deleted) {
        showError("Remote MCP connection not found.", 4000);

        return;
      }

      await this.render();
      if (this.editingConnectionId === connectionId) {
        this.hideConnectionForm();
      }

      showSuccess("Remote MCP connection deleted", 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Failed to delete remote MCP connection: ${message}`, 6000);
    }
  }

  async testConnection(connectionId: string) {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Show loading state in the card
    const card = root.querySelector(
      `.connection-card[data-connection-id="${connectionId}"]`,
    );

    const existingDiag = card?.querySelector(".connection-diagnostic");
    if (existingDiag) {
      existingDiag.remove();
    }

    const diagEl = document.createElement("div");
    diagEl.className = "connection-diagnostic";
    diagEl.innerHTML = `<div class="diagnostic-loading">Testing connection\u2026</div>`;
    card?.appendChild(diagEl);

    const result = await testRemoteMcpConnection(this.db, connectionId);
    this.renderDiagnostic(diagEl, result);
  }

  renderDiagnostic(container: HTMLElement, result: McpConnectionTestResult) {
    const stepsHtml = result.steps
      .map((step) => {
        const icon =
          step.status === "ok"
            ? "\u2713"
            : step.status === "error"
              ? "\u2717"
              : "\u2014";
        const cls = `diagnostic-step diagnostic-${step.status}`;

        return `
          <div class="${cls}">
            <span class="diagnostic-icon">${icon}</span>
            <span class="diagnostic-label">${escapeHtml(step.step)}</span>
            ${step.detail ? `<span class="diagnostic-detail">${escapeHtml(step.detail)}</span>` : ""}
          </div>`;
      })
      .join("");

    const toolsHtml =
      result.success && result.toolNames.length > 0
        ? `<details class="diagnostic-tools"><summary>${result.toolCount} tool${result.toolCount === 1 ? "" : "s"} available</summary><ul>${result.toolNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul></details>`
        : "";

    container.innerHTML = `
      <div class="diagnostic-header diagnostic-${result.success ? "ok" : "error"}">
        ${result.success ? "\u2713 Connection OK" : "\u2717 Connection Failed"}
        <button class="diagnostic-close" data-action="close-diagnostic" title="Dismiss">\u00d7</button>
      </div>
      <div class="diagnostic-steps">${stepsHtml}</div>
      ${toolsHtml}
    `;

    container
      .querySelector('[data-action="close-diagnostic"]')
      ?.addEventListener("click", () => container.remove());
  }
}

customElements.define(elementName, ShadowClawMcpRemote);
