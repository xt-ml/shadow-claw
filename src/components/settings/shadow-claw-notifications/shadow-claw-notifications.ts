import {
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  getPushUrl,
} from "../../../notifications/push-client.js";

import { CONFIG_KEYS } from "../../../config.js";
import { getDb } from "../../../db/db.js";
import { getConfig } from "../../../db/getConfig.js";
import { setConfig } from "../../../db/setConfig.js";
import { showError, showSuccess } from "../../../toast.js";

import "../../common/shadow-claw-empty-state/shadow-claw-empty-state.js";

import ShadowClawElement from "../../shadow-claw-element.js";

const elementName = "shadow-claw-notifications";

/**
 * Settings sub-component for Web Push Notification management:
 * subscribe/unsubscribe toggle, subscription list, send test notification.
 */
export class ShadowClawNotifications extends ShadowClawElement {
  static componentPath = `components/settings/${elementName}`;
  static styles = `${ShadowClawNotifications.componentPath}/${elementName}.css`;
  static template = `${ShadowClawNotifications.componentPath}/${elementName}.html`;

  public _subscribed: boolean = false;
  public _subscriptions: Array<{
    id: number;
    endpoint: string;
    created_at: string;
  }> = [];

  public _selectedId: number | null = null;
  public _backendAvailable: boolean = true;

  constructor() {
    super();
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    await this.refreshState();
    await this.loadProxyConfig();
    await this.loadSubscriptions();

    this.bindEventListeners();
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="toggle-push"]')
      ?.addEventListener("click", () => this.handleToggle());

    root
      .querySelector('[data-action="send-notification"]')
      ?.addEventListener("click", () => this.handleSendNotification());

    root
      .querySelector('[data-action="delete-subscription"]')
      ?.addEventListener("click", () => this.handleDeleteSubscription());

    root
      .querySelector('[data-action="refresh-subscriptions"]')
      ?.addEventListener("click", () => this.loadSubscriptions());

    root
      .querySelector('[data-input="push-proxy-url"]')
      ?.addEventListener("change", (e) => this.handleProxyUrlChange(e));
  }

  async loadProxyConfig() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const db = await getDb();
    const proxyUrl = await getConfig(db, CONFIG_KEYS.PUSH_PROXY_URL);
    const input = root.querySelector(
      '[data-input="push-proxy-url"]',
    ) as HTMLInputElement | null;

    if (input) {
      input.value = proxyUrl || "";
    }
  }

  async handleProxyUrlChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();

    try {
      const db = await getDb();
      await setConfig(db, CONFIG_KEYS.PUSH_PROXY_URL, value);
      showSuccess("Push proxy URL updated.");
      await this.loadSubscriptions();
    } catch (err) {
      showError(`Failed to save proxy URL: ${(err as Error).message}`);
    }
  }

  /**
   * Check current subscription state and update the toggle.
   */
  async refreshState() {
    try {
      const sub = await getCurrentSubscription();
      this._subscribed = !!sub;
      this.updateToggle();
    } catch {
      // Service worker may not be ready
      this._subscribed = false;
      this.updateToggle();
    }
  }

  updateToggle() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const toggle = root.querySelector('[data-action="toggle-push"]');
    const status = root.querySelector('[data-info="subscription-status"]');

    if (toggle) {
      toggle.setAttribute("aria-checked", String(this._subscribed));
    }

    if (status) {
      status.textContent = this._subscribed ? "Enabled" : "Disabled";
    }
  }

  async handleToggle() {
    try {
      if (this._subscribed) {
        await unsubscribeFromPush();
        this._subscribed = false;
        showSuccess("Push notifications disabled.");
      } else {
        await subscribeToPush();
        this._subscribed = true;
        showSuccess("Push notifications enabled!");
      }

      this.updateToggle();
      await this.loadSubscriptions();
    } catch (err) {
      showError(`Push notification error: ${(err as Error).message}`);
    }
  }

  /**
   * Load all stored subscriptions from the server.
   */
  async loadSubscriptions() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    try {
      const url = await getPushUrl("/push/subscriptions");
      const res = await fetch(url);

      if (!res.ok) {
        return;
      }

      this._subscriptions = await res.json();
      this._backendAvailable = true;
    } catch {
      this._subscriptions = [];
      this._backendAvailable = false;
    }

    this._selectedId = null;
    this.renderSubscriptionList();
    this.updateActionButtons();
  }

  renderSubscriptionList() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector('[data-info="subscription-list"]');
    if (!list) {
      return;
    }

    list.replaceChildren();

    if (this._subscriptions.length === 0) {
      const message = this._backendAvailable
        ? "No subscriptions stored."
        : "⚠️ Backend services unavailable (push notification server is not running).";

      const emptyState = document.createElement("shadow-claw-empty-state");
      emptyState.setAttribute("compact", "");
      emptyState.setAttribute("message", message);
      list.append(emptyState);

      return;
    }

    this._subscriptions.forEach((sub) => {
      const shortId = `#${sub.id}`;
      const endpointShort =
        sub.endpoint.length > 60 ? `…${sub.endpoint.slice(-56)}` : sub.endpoint;
      const date = sub.created_at || "";

      const item = document.createElement("div");
      item.className = `subscription-item${this._selectedId === sub.id ? " selected" : ""}`;
      item.setAttribute("data-sub-id", String(sub.id));
      item.setAttribute("data-endpoint", sub.endpoint);

      const idEl = document.createElement("span");
      idEl.className = "subscription-id";
      idEl.title = sub.endpoint;
      idEl.textContent = `${shortId} ${endpointShort}`;

      const dateEl = document.createElement("span");
      dateEl.className = "subscription-date";
      dateEl.textContent = date;

      item.append(idEl, dateEl);

      item.addEventListener("click", () => {
        this._selectedId = sub.id;
        this.renderSubscriptionList();
        this.updateActionButtons();
      });

      list.append(item);
    });
  }

  updateActionButtons() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const hasSelection = this._selectedId != null;
    const sendBtn = root.querySelector(
      '[data-action="send-notification"]',
    ) as HTMLButtonElement | null;
    const deleteBtn = root.querySelector(
      '[data-action="delete-subscription"]',
    ) as HTMLButtonElement | null;

    if (sendBtn) {
      sendBtn.disabled = !hasSelection;
    }

    if (deleteBtn) {
      deleteBtn.disabled = !hasSelection;
    }
  }

  async handleSendNotification() {
    if (this._selectedId == null) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-input="notification-text"]',
    ) as HTMLInputElement | null;
    const payload = input?.value?.trim() || "Test notification from ShadowClaw";

    const sub = this._subscriptions.find((s) => s.id === this._selectedId);
    if (!sub) {
      return;
    }

    try {
      const url = await getPushUrl("/push/send");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, payload }),
      });

      if (res.ok) {
        showSuccess("Notification sent!");
      } else if (res.status === 410) {
        showError("Subscription expired and was removed.");
        await this.loadSubscriptions();
      } else {
        const data = await res.json().catch(() => ({}));
        showError(`Failed to send: ${data.error || res.statusText}`);
      }
    } catch (err) {
      showError(`Send failed: ${(err as Error).message}`);
    }
  }

  async handleDeleteSubscription() {
    if (this._selectedId == null) {
      return;
    }

    try {
      const url = await getPushUrl(`/push/subscription/${this._selectedId}`);
      const res = await fetch(url, {
        method: "DELETE",
      });

      if (res.ok) {
        showSuccess("Subscription deleted.");
        await this.loadSubscriptions();
      } else {
        showError("Failed to delete subscription.");
      }
    } catch (err) {
      showError(`Delete failed: ${(err as Error).message}`);
    }
  }
}

/**
 * Encode a string safe for use as an HTML attribute value.
 */
customElements.define(elementName, ShadowClawNotifications);
