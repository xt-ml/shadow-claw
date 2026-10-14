import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: null,
    ready: false,
  },
}));

const mockSetVMBashTimeout = jest.fn<any>().mockResolvedValue(undefined);
jest.unstable_mockModule(
  "../../../core/orchestrator/utils/settings.js",
  () => ({
    setVMBashTimeout: mockSetVMBashTimeout,
  }),
);

const mockSetVMBootMode = jest.fn<any>().mockResolvedValue(undefined);
const mockSetVMBootHost = jest.fn<any>().mockResolvedValue(undefined);
const mockSetVMNetworkRelayURL = jest.fn<any>().mockResolvedValue(undefined);
jest.unstable_mockModule(
  "../../../core/orchestrator/utils/operations/vm.js",
  () => ({
    setVMBootMode: mockSetVMBootMode,
    setVMBootHost: mockSetVMBootHost,
    setVMNetworkRelayURL: mockSetVMNetworkRelayURL,
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
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

const { orchestratorStore } = await import("../../../stores/orchestrator.js");
const { ShadowClawWebvm } = await import("./shadow-claw-webvm.js");
const { showSuccess } = await import("../../../ui/toast.js");

function createOrchestratorStub(overrides = {}) {
  return {
    ...overrides,
  };
}

describe("shadow-claw-webvm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-webvm")).toBe(ShadowClawWebvm);
  });

  it("renders correctly after connectedCallback", async () => {
    (orchestratorStore as any).orchestrator = createOrchestratorStub();
    (orchestratorStore as any).ready = true;
    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
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

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-vm-boot-mode"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetVMBootMode).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith("WebVM boot mode saved", 3000);

    document.body.removeChild(el);
  });

  it("saves VM bash timeout on button click", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="vm-bash-timeout-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "42";

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-vm-bash-timeout"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetVMBashTimeout).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      42,
    );
    expect(showSuccess).toHaveBeenCalledWith("WebVM bash timeout saved", 3000);

    document.body.removeChild(el);
  });

  it("saves VM boot host on button click", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="vm-boot-host-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "https://example.com/boot";

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-vm-boot-host"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetVMBootHost).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "https://example.com/boot",
    );
    expect(showSuccess).toHaveBeenCalledWith("WebVM boot host saved", 3000);

    document.body.removeChild(el);
  });

  it("saves VM network relay URL on button click", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="vm-network-relay-url-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "wss://relay.example.com";

    const btn = el.shadowRoot?.querySelector(
      '[data-action="save-vm-network-relay-url"]',
    );
    btn?.dispatchEvent(new Event("click"));

    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetVMNetworkRelayURL).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "wss://relay.example.com",
    );
    expect(showSuccess).toHaveBeenCalledWith("WebVM relay URL saved", 3000);

    document.body.removeChild(el);
  });

  it("handles validation warnings for invalid inputs", async () => {
    const { showWarning } = await import("../../../ui/toast.js");
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    // 1. Invalid bash timeout
    const timeoutInput = el.shadowRoot?.querySelector(
      '[data-setting="vm-bash-timeout-input"]',
    ) as HTMLInputElement;
    if (timeoutInput) {
      Object.defineProperty(timeoutInput, "value", {
        value: "invalid",
        configurable: true,
      });
    }
    await el.saveVMBashTimeout();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid timeout in seconds",
      3000,
    );

    // 2. Invalid boot host
    const bootHostInput = el.shadowRoot?.querySelector(
      '[data-setting="vm-boot-host-input"]',
    ) as HTMLInputElement;
    if (bootHostInput) bootHostInput.value = "ftp://invalid-protocol";
    await el.saveVMBootHost();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid HTTP(S) boot host URL",
      3500,
    );

    // 3. Invalid relay URL
    const relayInput = el.shadowRoot?.querySelector(
      '[data-setting="vm-network-relay-url-input"]',
    ) as HTMLInputElement;
    if (relayInput) relayInput.value = "ftp://invalid-relay";
    await el.saveVMNetworkRelayURL();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a valid ws:// or wss:// relay URL",
      3500,
    );

    document.body.removeChild(el);
  });

  it("handles errors during saving", async () => {
    const { showError } = await import("../../../ui/toast.js");
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;
    (orchestratorStore as any).ready = true;

    const el = new ShadowClawWebvm();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    mockSetVMBashTimeout.mockRejectedValueOnce(
      new Error("Timeout save failed"),
    );
    const timeoutInput = el.shadowRoot?.querySelector(
      '[data-setting="vm-bash-timeout-input"]',
    ) as HTMLInputElement;
    if (timeoutInput) timeoutInput.value = "30";
    await el.saveVMBashTimeout();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Timeout save failed"),
      6000,
    );

    mockSetVMBootHost.mockRejectedValueOnce(new Error("Boot host save failed"));
    await el.saveVMBootHost();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Boot host save failed"),
      6000,
    );

    mockSetVMNetworkRelayURL.mockRejectedValueOnce(
      new Error("Relay URL save failed"),
    );
    await el.saveVMNetworkRelayURL();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Relay URL save failed"),
      6000,
    );

    document.body.removeChild(el);
  });

  it("handles missing orchestrator early returns", async () => {
    const el = new ShadowClawWebvm();
    el.orchestrator = null;
    await el.saveVMBashTimeout();
    await el.saveVMBootHost();
    await el.saveVMBootMode();
    await el.saveVMNetworkRelayURL();
  });
});
