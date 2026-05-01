import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({}),
}));

jest.unstable_mockModule("../../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { orchestratorStore } = await import("../../../stores/orchestrator.js");
const { ShadowClawNetworking } = await import("./shadow-claw-networking.js");
const { showSuccess, showWarning } = await import("../../../toast.js");

function createOrchestratorStub(overrides = {}) {
  return {
    setUseProxy: jest.fn<any>().mockResolvedValue(undefined),
    setProxyUrl: jest.fn<any>().mockResolvedValue(undefined),
    getUseProxy: jest.fn<any>().mockReturnValue(false),
    getProxyUrl: jest.fn<any>().mockReturnValue("http://localhost:8888/proxy"),
    ...overrides,
  };
}

describe("shadow-claw-networking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-networking")).toBe(
      ShadowClawNetworking,
    );
  });

  it("loads proxy settings from orchestrator", async () => {
    const orch = createOrchestratorStub({
      getUseProxy: jest.fn<any>().mockReturnValue(true),
      getProxyUrl: jest.fn<any>().mockReturnValue("/proxy"),
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const proxyToggle = el.shadowRoot?.querySelector(
      '[data-setting="proxy-toggle"]',
    ) as HTMLInputElement | null;
    const proxyInput = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;

    expect(proxyToggle?.checked).toBe(true);
    expect(proxyInput?.value).toBe("/proxy");

    document.body.removeChild(el);
  });

  it("saves proxy URL", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const proxyInput = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;

    if (!proxyInput) {
      throw new Error("proxy url input not found");
    }

    proxyInput.value = "/proxy";
    await el.saveProxyUrl();

    expect(orch.setProxyUrl).toHaveBeenCalledWith(expect.anything(), "/proxy");
    expect(showSuccess).toHaveBeenCalledWith("Proxy URL saved", 3000);

    document.body.removeChild(el);
  });

  it("warns when saving an empty proxy URL", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await el.onTemplateReady;
    await new Promise((r) => setTimeout(r, 50));
    await el.render();

    const proxyInput = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;

    if (!proxyInput) {
      throw new Error("proxy url input not found");
    }

    proxyInput.value = "   ";
    await el.saveProxyUrl();

    expect(orch.setProxyUrl).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a proxy URL (e.g. /proxy)",
      3000,
    );

    document.body.removeChild(el);
  });
});
