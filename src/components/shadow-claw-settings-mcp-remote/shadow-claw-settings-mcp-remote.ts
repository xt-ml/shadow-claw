import { CONFIG_KEYS } from "../../config.js";
import { getDb, type ShadowClawDatabase } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { encryptValue } from "../../crypto.js";
import {
  bindRemoteMcpCredentialRef,
  deleteRemoteMcpConnection,
  listRemoteMcpConnections,
  upsertRemoteMcpConnection,
} from "../../mcp-connections.js";
import { listRemoteMcpTools } from "../../remote-mcp-client.js";
import { showError, showSuccess } from "../../toast.js";
import { escapeHtml } from "../../utils.js";

import type { ServiceAccount } from "../../accounts/service-accounts.js";
import type { GitAccount } from "../../git/credentials.js";
import type {
  RemoteMcpConnectionRecord,
  RemoteMcpCredentialRef,
  RemoteMcpTransport,
} from "../../mcp-connections.js";

import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-settings-mcp-remote";

type AuthSelection =
  | "none"
  | "service_pat"
  | "service_oauth"
  | "git_pat"
  | "git_oauth"
  | "custom_header";

export class ShadowClawSettingsMcpRemote extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawSettingsMcpRemote.componentPath}/${elementName}.css`;
  static template = `${ShadowClawSettingsMcpRemote.componentPath}/${elementName}.html`;

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

    if (this.connections.length === 0) {
      listEl.innerHTML = `
        <div class="no-connections">
          No remote MCP connections configured. Click "+ Add Remote MCP Connection" to get started.
        </div>`;

      return;
    }

    listEl.innerHTML = this.connections
      .map((connection) => {
        const authLabel = this.describeCredentialRef(connection.credentialRef);
        const enabledLabel = connection.enabled ? "Enabled" : "Disabled";

        return `
          <div class="connection-card${connection.enabled ? "" : " connection-disabled"}" data-connection-id="${connection.id}">
            <div class="connection-card-header">
              <span class="connection-card-label">${escapeHtml(connection.label)}</span>
              <span class="connection-badge">${escapeHtml(enabledLabel)}</span>
            </div>
            <div class="connection-card-meta">
              ${escapeHtml(connection.serverUrl)} · ${escapeHtml(connection.transport)} · ${escapeHtml(authLabel)}
            </div>
            <div class="connection-card-actions">
              <button data-action="test-connection" data-id="${connection.id}">Test</button>
              <button data-action="edit-connection" data-id="${connection.id}">Edit</button>
              <button class="delete-btn" data-action="delete-connection" data-id="${connection.id}">Delete</button>
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
        if (action === "edit-connection") {
          this.showConnectionForm(id);
        } else if (action === "delete-connection") {
          void this.deleteConnection(id);
        } else if (action === "test-connection") {
          void this.testConnection(id);
        }
      });
    });
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

    const showService =
      authSelection === "service_pat" || authSelection === "service_oauth";
    const showGit =
      authSelection === "git_pat" || authSelection === "git_oauth";
    const showCustom = authSelection === "custom_header";

    if (serviceRegion instanceof HTMLElement) {
      serviceRegion.style.display = showService ? "block" : "none";
    }

    if (gitRegion instanceof HTMLElement) {
      gitRegion.style.display = showGit ? "block" : "none";
    }

    if (customHeaderRegion instanceof HTMLElement) {
      customHeaderRegion.style.display = showCustom ? "block" : "none";
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

    try {
      const tools = await listRemoteMcpTools(this.db, connectionId);
      showSuccess(
        `Connection successful. ${tools.length} tool${tools.length === 1 ? "" : "s"} discovered.`,
        4000,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Remote MCP test failed: ${message}`, 6000);
    }
  }
}

customElements.define(elementName, ShadowClawSettingsMcpRemote);
