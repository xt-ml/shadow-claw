import QRCode from "qrcode";

import { getDb } from "../../../db/db.js";
import { effect } from "../../../effect.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess } from "../../../toast.js";
import { ulid } from "../../../utils/ulid.js";

import type { Orchestrator } from "../../../orchestrator.js";
import type { ShadowClawDatabase } from "../../../types.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-peerjs";

/**
 * Settings component for the PeerJS channel.
 *
 * - Generates / displays the local Peer ID
 * - Renders a QR code of a shareable connection URL
 * - Manages trusted peer IDs and optional custom signaling server settings
 */
export class ShadowClawPeerJs extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawPeerJs.componentPath}/${elementName}.css`;
  static template = `${ShadowClawPeerJs.componentPath}/${elementName}.html`;

  db: ShadowClawDatabase | null = null;
  orchestrator: Orchestrator | null = null;

  /** Most recently rendered peer URL, kept in sync for "copy URL" action */
  private _currentPeerUrl: string = "";

  constructor() {
    super();
  }

  getOrchestrator(): Orchestrator | null {
    const current = orchestratorStore.orchestrator;
    if (current) {
      this.orchestrator = current;
    }

    return this.orchestrator;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();
    this.orchestrator = orchestratorStore.orchestrator;

    this.bindEventListeners();
    this.setupEffects();
    await this.render();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  setupEffects() {
    this.addCleanup(
      effect(() => {
        const ready = orchestratorStore.ready;
        if (!ready) {
          return;
        }

        const orchestrator = this.getOrchestrator();
        if (orchestrator) {
          // Track connected peers so that this effect re-runs when connections change
          orchestrator.peerjs?.connectedPeersSignal?.get();
        }

        void this.render();
      }),
    );
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="save-peerjs-config"]')
      ?.addEventListener("click", () => this.savePeerJsConfig());

    root
      .querySelector('[data-action="generate-peer-id"]')
      ?.addEventListener("click", () => this.generatePeerId());

    root
      .querySelector('[data-action="copy-peer-id"]')
      ?.addEventListener("click", () => this.copyPeerId());

    root
      .querySelector('[data-action="copy-peer-url"]')
      ?.addEventListener("click", () => this.copyPeerUrl());

    root
      .querySelector('[data-action="add-trusted-peer"]')
      ?.addEventListener("click", () => {
        const idInput = root.querySelector(
          '[data-setting="peerjs-new-trusted-id-input"]',
        ) as HTMLInputElement | null;
        const aliasInput = root.querySelector(
          '[data-setting="peerjs-new-trusted-alias-input"]',
        ) as HTMLInputElement | null;

        const id = idInput?.value?.trim();
        const alias = aliasInput?.value?.trim();

        if (id) {
          this._appendTrustedPeerRow(id, alias || "");
          if (idInput) {
            idInput.value = "";
          }

          if (aliasInput) {
            aliasInput.value = "";
          }
        }
      });

    // Live-update QR when peer ID is typed
    root
      .querySelector('[data-setting="peerjs-my-peer-id-input"]')
      ?.addEventListener("input", () => this.updateQrCode());
  }

  private _appendTrustedPeerRow(id: string, alias: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector('[data-info="peerjs-trusted-peers-list"]');
    if (!list) {
      return;
    }

    // Check if ID already exists
    const existing = list.querySelector(`input[data-id="${id}"]`);
    if (existing) {
      return;
    }

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "0.5rem";
    row.style.alignItems = "center";
    row.className = "peerjs-trusted-peer-row";

    row.innerHTML = `
      <input type="text" class="form-input" style="margin-bottom: 0" value="${id}" data-id="${id}" disabled />
      <input type="text" class="form-input alias-input" style="margin-bottom: 0" value="${alias}" placeholder="Alias (optional)" />
      <button type="button" class="save-btn save-btn--danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; white-space: nowrap; height: 38px;">Remove</button>
    `;

    row.querySelector("button")?.addEventListener("click", () => {
      row.remove();
    });

    list.appendChild(row);
  }

  async render() {
    const orchestrator = this.getOrchestrator();
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    if (!orchestrator) {
      return;
    }

    const cfg = orchestrator.getPeerJsConfig();

    // Enabled toggle
    const enabledToggle = root.querySelector(
      '[data-setting="peerjs-enabled-toggle"]',
    ) as HTMLInputElement | null;
    if (enabledToggle) {
      enabledToggle.checked = cfg.enabled;
    }

    // Channel status
    const channelStatus = root.querySelector(
      '[data-info="peerjs-channel-status"]',
    );
    if (channelStatus) {
      channelStatus.textContent = cfg.enabled
        ? "PeerJS channel is enabled."
        : "PeerJS channel is disabled. Saved settings are retained.";
    }

    // Peer ID
    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement | null;
    if (myPeerIdInput) {
      myPeerIdInput.value = cfg.myPeerId;
    }

    // My Alias
    const myAliasInput = root.querySelector(
      '[data-setting="peerjs-my-alias-input"]',
    ) as HTMLInputElement | null;
    if (myAliasInput) {
      myAliasInput.value = cfg.myAlias;
    }

    // Trusted Peer IDs & Aliases List
    const trustedListEl = root.querySelector(
      '[data-info="peerjs-trusted-peers-list"]',
    );
    if (
      trustedListEl &&
      trustedListEl.children.length === 0 &&
      cfg.trustedPeerIds.length > 0
    ) {
      cfg.trustedPeerIds.forEach((id) => {
        let alias = "";
        if (cfg.peerAliases) {
          for (const [a, i] of Object.entries(cfg.peerAliases)) {
            if (i === id) {
              alias = a;

              break;
            }
          }
        }

        this._appendTrustedPeerRow(id, alias);
      });
    }

    const trustedStatus = root.querySelector(
      '[data-info="peerjs-trusted-ids-status"]',
    );
    if (trustedStatus) {
      trustedStatus.innerHTML = "";
      if (cfg.trustedPeerIds.length) {
        trustedStatus.appendChild(
          document.createTextNode("Connect to Trusted Peers: "),
        );
        cfg.trustedPeerIds.forEach((id) => {
          let btnText = id;
          if (cfg.peerAliases) {
            for (const [a, i] of Object.entries(cfg.peerAliases)) {
              if (i === id) {
                btnText = a;

                break;
              }
            }
          }

          const btn = document.createElement("button");
          btn.className = "save-btn save-btn--secondary";
          btn.style.padding = "0.25rem 0.5rem";
          btn.style.fontSize = "0.75rem";
          btn.style.margin = "0.25rem 0.25rem 0.25rem 0";
          btn.textContent = btnText;
          btn.addEventListener("click", () => {
            document.dispatchEvent(
              new CustomEvent("shadow-claw-navigate", {
                detail: {
                  page: "chat",
                  groupId: `peer:${id}`,
                },
                bubbles: true,
                composed: true,
              }),
            );
          });
          trustedStatus.appendChild(btn);
        });
      } else {
        trustedStatus.textContent = "Accepting connections from any peer.";
      }
    }

    // Custom signaling server
    const serverHostInput = root.querySelector(
      '[data-setting="peerjs-server-host-input"]',
    ) as HTMLInputElement | null;
    if (serverHostInput) {
      serverHostInput.value = cfg.serverHost;
    }

    const serverPortInput = root.querySelector(
      '[data-setting="peerjs-server-port-input"]',
    ) as HTMLInputElement | null;
    if (serverPortInput) {
      serverPortInput.value = cfg.serverPort ? String(cfg.serverPort) : "";
    }

    const serverPathInput = root.querySelector(
      '[data-setting="peerjs-server-path-input"]',
    ) as HTMLInputElement | null;
    if (serverPathInput) {
      serverPathInput.value = cfg.serverPath;
    }

    const serverSecureToggle = root.querySelector(
      '[data-setting="peerjs-server-secure-toggle"]',
    ) as HTMLInputElement | null;
    if (serverSecureToggle) {
      serverSecureToggle.checked = cfg.serverSecure;
    }

    // Connection status
    await this.updateConnectionStatus();

    // QR code
    await this.updateQrCode();
  }

  async updateQrCode() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement | null;

    const peerId = myPeerIdInput?.value?.trim() || "";

    const qrGroup = root.querySelector(
      '[data-info="peerjs-qr-group"]',
    ) as HTMLElement | null;

    const canvas = root.querySelector(
      '[data-info="peerjs-qr-canvas"]',
    ) as HTMLCanvasElement | null;

    const qrUrlEl = root.querySelector('[data-info="peerjs-qr-url"]');

    if (!peerId) {
      if (qrGroup) {
        qrGroup.hidden = true;
      }

      this._currentPeerUrl = "";

      return;
    }

    // Build shareable URL: current origin + ?peer=<id>
    const peerUrl = `${window.location.origin}${window.location.pathname}?peer=${encodeURIComponent(peerId)}`;
    this._currentPeerUrl = peerUrl;

    if (qrGroup) {
      qrGroup.hidden = false;
    }

    if (qrUrlEl) {
      qrUrlEl.textContent = peerUrl;
    }

    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, peerUrl, {
          width: 180,
          margin: 1,
          color: { dark: "#000000", light: "#ffffff" },
        });
      } catch (err) {
        console.error("PeerJS QR code render error:", err);
      }
    }
  }

  async updateConnectionStatus() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const orchestrator = this.getOrchestrator();
    const statusEl = root.querySelector(
      '[data-info="peerjs-connection-status"]',
    );
    if (!statusEl) {
      return;
    }

    if (!orchestrator) {
      statusEl.textContent = "Not connected.";

      return;
    }

    const connectedPeers =
      orchestrator.peerjs?.connectedPeersSignal?.get() || [];
    if (connectedPeers.length === 0) {
      statusEl.textContent = "Not connected.";
    } else {
      const peers = connectedPeers.join(", ");
      statusEl.textContent = `Connected to: ${peers}`;
    }
  }

  generatePeerId() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // Generate a URL-friendly random ID (lowercase ulid)
    const newId = ulid().toLowerCase();

    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement | null;

    if (myPeerIdInput) {
      myPeerIdInput.value = newId;
    }

    void this.updateQrCode();
  }

  async copyPeerId() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement | null;

    const peerId = myPeerIdInput?.value?.trim() || "";
    if (!peerId) {
      showError("No Peer ID to copy.", 3000);

      return;
    }

    try {
      await navigator.clipboard.writeText(peerId);
      showSuccess("Peer ID copied to clipboard", 2500);
    } catch {
      showError("Failed to copy Peer ID.", 3000);
    }
  }

  async copyPeerUrl() {
    if (!this._currentPeerUrl) {
      showError("No connection URL available. Enter a Peer ID first.", 3000);

      return;
    }

    try {
      await navigator.clipboard.writeText(this._currentPeerUrl);
      showSuccess("Connection URL copied to clipboard", 2500);
    } catch {
      showError("Failed to copy connection URL.", 3000);
    }
  }

  async savePeerJsConfig() {
    const orchestrator = this.getOrchestrator();
    if (!orchestrator || !this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    // ── Snapshot all form values before any awaits ──────────────────────────
    // Reactive effects triggered by configurePeerJs() → peerjs.start() can
    // re-render the component while we are mid-save, replacing DOM nodes and
    // causing later queries to return stale/empty values. Read everything now.

    const myPeerIdInput = root.querySelector(
      '[data-setting="peerjs-my-peer-id-input"]',
    ) as HTMLInputElement | null;

    const myAliasInput = root.querySelector(
      '[data-setting="peerjs-my-alias-input"]',
    ) as HTMLInputElement | null;

    const serverHostInput = root.querySelector(
      '[data-setting="peerjs-server-host-input"]',
    ) as HTMLInputElement | null;

    const serverPortInput = root.querySelector(
      '[data-setting="peerjs-server-port-input"]',
    ) as HTMLInputElement | null;

    const serverPathInput = root.querySelector(
      '[data-setting="peerjs-server-path-input"]',
    ) as HTMLInputElement | null;

    const serverSecureToggle = root.querySelector(
      '[data-setting="peerjs-server-secure-toggle"]',
    ) as HTMLInputElement | null;

    const enabledToggle = root.querySelector(
      '[data-setting="peerjs-enabled-toggle"]',
    ) as HTMLInputElement | null;

    let myPeerId = (myPeerIdInput?.value || "").trim();

    // Auto-generate a Peer ID if the field is empty
    if (!myPeerId) {
      myPeerId = ulid().toLowerCase();
      if (myPeerIdInput) {
        myPeerIdInput.value = myPeerId;
      }
    }

    const myAlias = (myAliasInput?.value || "").trim();

    const trustedPeerIds: string[] = [];
    const peerAliases: Record<string, string> = {};

    const rows = root.querySelectorAll(".peerjs-trusted-peer-row");
    rows.forEach((row) => {
      const idInput = row.querySelector("input[data-id]") as HTMLInputElement;
      const aliasInput = row.querySelector(".alias-input") as HTMLInputElement;
      if (idInput && idInput.value) {
        const id = idInput.value.trim();
        trustedPeerIds.push(id);
        if (aliasInput && aliasInput.value.trim()) {
          peerAliases[aliasInput.value.trim()] = id;
        }
      }
    });

    const serverHost = (serverHostInput?.value || "").trim();
    const serverPort = parseInt(serverPortInput?.value || "0", 10) || 0;
    const serverPath = (serverPathInput?.value || "").trim();
    const serverSecure = !!serverSecureToggle?.checked;
    const enabled = !!enabledToggle?.checked;

    // ── Persist ─────────────────────────────────────────────────────────────
    try {
      await orchestrator.configurePeerJs(
        this.db,
        myPeerId,
        trustedPeerIds,
        serverHost,
        serverPort,
        serverPath,
        serverSecure,
      );

      if (orchestrator.setPeerjsMyAlias) {
        await orchestrator.setPeerjsMyAlias(this.db, myAlias);
      }

      if (orchestrator.setPeerjsPeerAliases) {
        await orchestrator.setPeerjsPeerAliases(this.db, peerAliases);
      }

      await orchestrator.setChannelEnabled(this.db, "peerjs", enabled);
      await this.render();
      showSuccess("PeerJS settings saved", 3000);
    } catch (error) {
      showError(
        `Error saving PeerJS settings: ${error instanceof Error ? error.message : String(error)}`,
        6000,
      );
    }
  }
}

customElements.define(elementName, ShadowClawPeerJs);
