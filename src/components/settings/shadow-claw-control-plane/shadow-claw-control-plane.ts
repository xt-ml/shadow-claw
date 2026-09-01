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

import ShadowClawElement from "../../shadow-claw-element.js";
import shadowClawControlPlaneStyles from "./shadow-claw-control-plane.css" with { type: "css" };
import shadowClawControlPlaneTemplate from "./shadow-claw-control-plane.html" with { type: "html" };

const elementName = "shadow-claw-control-plane";

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
