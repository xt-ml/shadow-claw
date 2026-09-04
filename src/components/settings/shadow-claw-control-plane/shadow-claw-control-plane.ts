import { effect } from "../../../core/effect.js";
import { getDb } from "../../../db/db.js";
import { getConfig } from "../../../db/getConfig.js";
import { setConfig } from "../../../db/setConfig.js";
import {
  CONFIG_KEYS,
  DEFAULT_CONTROL_PLANE_ENABLED,
  DEFAULT_CONTROL_PLANE_TRANSPORT,
} from "../../../config/config.js";
import { orchestratorStore } from "../../../stores/orchestrator.js";
import { showError, showSuccess } from "../../../ui/toast.js";

import type { Orchestrator } from "../../../core/orchestrator/orchestrator.js";
import type { ShadowClawDatabase } from "../../../db/types.js";
import type { AppDialogOptions } from "../../../ui/types.js";

import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawControlPlaneStyles from "./shadow-claw-control-plane.css" with { type: "css" };
import shadowClawControlPlaneTemplate from "./shadow-claw-control-plane.html" with { type: "html" };

const elementName = "shadow-claw-control-plane";

/**
 * Computes Chromium targetAddressSpace for Private Network Access (PNA).
 */
export function getControlPlaneTargetAddressSpace(
  urlStr: string,
): "loopback" | "private" | undefined {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    const isLoopback =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]";
    if (isLoopback) {
      return "loopback";
    }
    const isPrivate =
      /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname) ||
      !hostname.includes(".") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".lan") ||
      hostname.endsWith(".home") ||
      hostname.endsWith(".internal");
    if (isPrivate) {
      return "private";
    }
  } catch (_) {}
  return undefined;
}

/**
 * Settings sub-component for Control Plane Client URL, enabled toggle, and transport configuration.
 */
export class ShadowClawControlPlane extends ShadowClawElement {
  static styles = shadowClawControlPlaneStyles;
  static template = shadowClawControlPlaneTemplate;

  db: ShadowClawDatabase | null;
  orchestrator: Orchestrator | null;

  constructor() {
    super();

    this.db = null;
    this.orchestrator = null;
  }

  async connectedCallback() {
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

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-action="save-control-plane-transport"]')
      ?.addEventListener("click", () => {
        void this.saveControlPlaneTransport();
      });

    root
      .querySelector('[data-action="save-control-plane-url"]')
      ?.addEventListener("click", () => {
        void this.saveControlPlaneUrl();
      });

    root
      .querySelector('[data-action="test-control-plane-connection"]')
      ?.addEventListener("click", () => {
        void this.testControlPlaneConnection();
      });

    root
      .querySelector('[data-setting="control-plane-enabled-toggle"]')
      ?.addEventListener("change", (e) => {
        const target = e.target as HTMLInputElement;
        void this.saveControlPlaneEnabled(target.checked);
      });
  }

  setupEffects() {
    effect(() => {
      if (orchestratorStore.ready) {
        this.orchestrator = orchestratorStore.orchestrator;
        this.render();
      }
    });
  }

  async render() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const cpEnabledToggle = root.querySelector(
      '[data-setting="control-plane-enabled-toggle"]',
    ) as HTMLInputElement | null;
    if (cpEnabledToggle && this.db) {
      try {
        const { isControlPlaneEnabled } =
          await import("../../../core/utils/initControlPlane.js");
        cpEnabledToggle.checked = await isControlPlaneEnabled(this.db);
      } catch (_) {
        cpEnabledToggle.checked = DEFAULT_CONTROL_PLANE_ENABLED;
      }
    }

    const cpUrlInput = root.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement | null;
    if (cpUrlInput && this.db) {
      try {
        const stored = await getConfig(this.db, CONFIG_KEYS.CONTROL_PLANE_URL);
        cpUrlInput.value = stored || "";
      } catch (_) {
        cpUrlInput.value = "";
      }
    }

    const transportSelect = root.querySelector(
      '[data-setting="control-plane-transport-select"]',
    ) as HTMLSelectElement | null;
    if (transportSelect && this.db) {
      try {
        const stored = await getConfig(
          this.db,
          CONFIG_KEYS.CONTROL_PLANE_TRANSPORT,
        );
        transportSelect.value = stored || DEFAULT_CONTROL_PLANE_TRANSPORT;
      } catch (_) {
        transportSelect.value = DEFAULT_CONTROL_PLANE_TRANSPORT;
      }
    }
  }

  async requestAppDialog(options: AppDialogOptions): Promise<boolean> {
    const el = document.querySelector("shadow-claw") as any;
    if (el && typeof el.requestDialog === "function") {
      return await el.requestDialog(options);
    }

    return false;
  }

  /**
   * Performs a direct fetch probe to the Control Plane server.
   * Executed during user gestures (e.g. Test Connection / Save URL) to trigger
   * Chromium's Local Network Access (LNA) / Private Network Access (PNA) permission prompt if needed.
   */
  async probeControlPlane(
    urlStr: string,
  ): Promise<{ success: boolean; error?: string }> {
    let targetUrl: URL;
    try {
      targetUrl = new URL(urlStr);
    } catch {
      return { success: false, error: `Invalid URL format: "${urlStr}"` };
    }

    const targetAddressSpace = getControlPlaneTargetAddressSpace(urlStr);
    const fetchOptions: any = {
      method: "GET",
      cache: "no-store",
      mode: "cors",
    };
    if (targetAddressSpace) {
      fetchOptions.targetAddressSpace = targetAddressSpace;
    }

    try {
      const healthUrl = new URL("/api/control/health", targetUrl).toString();
      let res = await fetch(healthUrl, fetchOptions);

      if (res.status === 404) {
        const fallbackUrl = new URL(
          "/api/control/messages",
          targetUrl,
        ).toString();
        res = await fetch(fallbackUrl, {
          ...fetchOptions,
          method: "OPTIONS",
        });
      }

      if (res.ok || res.status === 204 || res.status === 401) {
        return { success: true };
      }

      return {
        success: false,
        error: `Server responded with HTTP ${res.status} (${res.statusText || "Error"})`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Interactive handler to test connection and surface diagnostic modal if needed.
   */
  async testControlPlaneConnection(): Promise<boolean> {
    const root = this.shadowRoot;
    if (!root) {
      return false;
    }

    const input = root.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement | null;
    const testBtn = root.querySelector(
      '[data-action="test-control-plane-connection"]',
    ) as HTMLButtonElement | null;

    const rawUrl = input?.value.trim() || "http://127.0.0.1:8888";

    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = "⏳ Testing...";
    }

    try {
      const result = await this.probeControlPlane(rawUrl);

      if (result.success) {
        showSuccess(`Successfully reached Control Plane at ${rawUrl}`, 4000);
        return true;
      }

      const errorMsg = result.error || "Unknown connection error";
      showError(`Connection test failed: ${errorMsg}`, 6000);

      await this.requestAppDialog({
        title: "Control Plane Connection Failed",
        message: `Unable to connect to "${rawUrl}".\n\n• TLS / Certificate: If using HTTPS with a self-signed certificate, ensure the certificate is installed and trusted in Chrome (chrome://certificate-manager/localcerts/usercerts).\n• Chrome Permissions: In Site Settings, ensure "Local network access" is allowed.\n• Server Status: Verify the ShadowClaw dev server is running and listening on this host/port.`,
        confirmLabel: "OK",
      });

      return false;
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = "🔌 Test Connection";
      }
    }
  }

  async saveControlPlaneTransport() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const select = root.querySelector(
      '[data-setting="control-plane-transport-select"]',
    ) as HTMLSelectElement | null;
    if (!select) {
      return;
    }

    const transport = select.value === "websocket" ? "websocket" : "sse";

    try {
      await setConfig(this.db, CONFIG_KEYS.CONTROL_PLANE_TRANSPORT, transport);
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(CONFIG_KEYS.CONTROL_PLANE_TRANSPORT, transport);
        } catch (_) {}
      }

      const {
        isControlPlaneEnabled,
        createDefaultControlPlaneClient,
        shouldConnectControlPlane,
      } = await import("../../../core/utils/initControlPlane.js");

      if (
        (await isControlPlaneEnabled(this.db)) &&
        shouldConnectControlPlane()
      ) {
        createDefaultControlPlaneClient({
          orchestrator: this.orchestrator || undefined,
          transport,
        });
      }

      showSuccess(
        `Control Plane transport saved: ${transport.toUpperCase()}`,
        3000,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Control Plane transport: " + errorMsg, 6000);
    }
  }

  async saveControlPlaneUrl() {
    if (!this.db) {
      return;
    }

    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const input = root.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const url = input.value.trim();

    try {
      // Trigger probe within user gesture to elicit Chrome LNA prompt if needed
      if (url) {
        void this.probeControlPlane(url);
      }

      await setConfig(this.db, CONFIG_KEYS.CONTROL_PLANE_URL, url);
      if (typeof localStorage !== "undefined") {
        try {
          if (url) {
            localStorage.setItem(CONFIG_KEYS.CONTROL_PLANE_URL, url);
          } else {
            localStorage.removeItem(CONFIG_KEYS.CONTROL_PLANE_URL);
          }
        } catch (_) {}
      }

      const {
        isControlPlaneEnabled,
        createDefaultControlPlaneClient,
        shouldConnectControlPlane,
      } = await import("../../../core/utils/initControlPlane.js");

      if (
        (await isControlPlaneEnabled(this.db)) &&
        shouldConnectControlPlane()
      ) {
        createDefaultControlPlaneClient({
          orchestrator: this.orchestrator || undefined,
        });
      }

      showSuccess(
        url
          ? `Control Plane URL saved: ${url}`
          : "Control Plane URL reset to default",
        3000,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Control Plane URL: " + errorMsg, 6000);
    }
  }

  async saveControlPlaneEnabled(enabled: boolean) {
    if (!this.db) {
      return;
    }

    try {
      if (enabled) {
        const storedUrl =
          (await getConfig(this.db, CONFIG_KEYS.CONTROL_PLANE_URL)) ||
          "http://127.0.0.1:8888";
        void this.probeControlPlane(storedUrl);
      }

      await setConfig(
        this.db,
        CONFIG_KEYS.CONTROL_PLANE_ENABLED,
        enabled ? "true" : "false",
      );
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(
            CONFIG_KEYS.CONTROL_PLANE_ENABLED,
            enabled ? "true" : "false",
          );
        } catch (_) {}
      }

      const {
        createDefaultControlPlaneClient,
        stopControlPlaneClient,
        shouldConnectControlPlane,
      } = await import("../../../core/utils/initControlPlane.js");

      if (enabled) {
        if (shouldConnectControlPlane()) {
          createDefaultControlPlaneClient({
            orchestrator: this.orchestrator || undefined,
          });
        }
        showSuccess("Control plane client enabled and connected", 3000);
      } else {
        stopControlPlaneClient();
        showSuccess("Control plane client disabled", 3000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      showError("Error saving Control Plane setting: " + errorMsg, 6000);
    }
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawControlPlane);
}
