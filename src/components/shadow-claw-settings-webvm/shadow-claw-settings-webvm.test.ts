import { jest } from "@jest/globals";
import path from "node:path";
import fs from "node:fs";

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: null,
    ready: false,
  },
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockImplementation(() => {
    const request: any = {
      onsuccess: null as any,
      onerror: null as any,
      result: {
        transaction: jest.fn(() => ({
          objectStore: jest.fn(() => ({
            get: jest.fn(() => ({
              onsuccess: null,
              onerror: null,
            })),
          })),
        })),
      },
    };
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess();
      }
    }, 0);

    return Promise.resolve(request.result);
  }),
}));

const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { ShadowClawSettingsWebvm } =
  await import("./shadow-claw-settings-webvm.js");
const { showSuccess } = await import("../../toast.js");

function createOrchestratorStub(overrides = {}) {
  return {
    setVMBootMode: jest.fn<any>().mockResolvedValue(undefined),
    setVMBashTimeout: jest.fn<any>().mockResolvedValue(undefined),
    setVMBootHost: jest.fn<any>().mockResolvedValue(undefined),
    setVMNetworkRelayURL: jest.fn<any>().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("shadow-claw-settings-webvm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-settings-webvm")).toBe(
      ShadowClawSettingsWebvm,
    );
  });

  it("renders correctly after connectedCallback", async () => {
    (orchestratorStore as any).orchestrator = createOrchestratorStub();
    (orchestratorStore as any).ready = true;
    const el = new ShadowClawSettingsWebvm();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    expect(
      el.shadowRoot?.querySelector('[data-setting="vm-boot-mode-select"]'),
    ).not.toBeNull();
    expect(
      el.shadowRoot?.querySelector('[data-setting="vm-bash-timeout-input"]'),
    ).not.toBeNull();

    document.body.removeChild(el);
  });

  it("saves VM boot mode on button click", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawSettingsWebvm();
    document.body.appendChild(el);
    await Promise.all([el.onStylesReady, el.onTemplateReady]);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-vm-boot-mode"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(orch.setVMBootMode).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("WebVM boot mode saved", 3000);

    document.body.removeChild(el);
  });
});
