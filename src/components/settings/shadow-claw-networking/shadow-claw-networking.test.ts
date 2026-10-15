import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({}),
}));

jest.unstable_mockModule(
  "../../../core/orchestrator/utils/settings.js",
  () => ({
    setProxyUrl: jest.fn<any>().mockResolvedValue(undefined),
    setUseProxy: jest.fn<any>().mockResolvedValue(undefined),
    setGitProxyUrl: jest.fn<any>().mockResolvedValue(undefined),
    setVMBashFullInternetAccess: jest.fn<any>().mockResolvedValue(undefined),
  }),
);

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showToast: jest.fn(),
}));

const { orchestratorStore } = await import("../../../stores/orchestrator.js");
const { ShadowClawNetworking } = await import("./shadow-claw-networking.js");
const { showSuccess, showWarning } = await import("../../../ui/toast.js");
const { setProxyUrl } =
  await import("../../../core/orchestrator/utils/settings.js");

async function waitForNetworkingReady(el: any): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    if (el.db && el.orchestrator) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error("shadow-claw-networking did not finish async initialization");
}

function createOrchestratorStub(overrides = {}) {
  return {
    getUseProxy: jest.fn<any>().mockReturnValue(false),
    getProxyUrl: jest.fn<any>().mockReturnValue("http://localhost:8888/proxy"),
    useProxy: false,
    proxyUrl: "http://localhost:8888/proxy",
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
      useProxy: true,
      proxyUrl: "/proxy",
    });
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await waitForNetworkingReady(el);
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
    await waitForNetworkingReady(el);
    await el.render();

    const proxyInput = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;

    if (!proxyInput) {
      throw new Error("proxy url input not found");
    }

    proxyInput.value = "/proxy";
    await el.saveProxyUrl();

    expect(setProxyUrl).toHaveBeenCalledWith(orch, expect.anything(), "/proxy");
    expect(showSuccess).toHaveBeenCalledWith("Proxy URL saved", 3000);

    document.body.removeChild(el);
  });

  it("warns when saving an empty proxy URL", async () => {
    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await waitForNetworkingReady(el);
    await el.render();

    const proxyInput = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement | null;

    if (!proxyInput) {
      throw new Error("proxy url input not found");
    }

    proxyInput.value = "   ";
    await el.saveProxyUrl();

    expect(setProxyUrl).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Please enter a proxy URL (e.g. /proxy)",
      3000,
    );

    document.body.removeChild(el);
  });

  it("handles onProxyToggle success and error", async () => {
    const { showError, showSuccess } = await import("../../../ui/toast.js");
    const { setUseProxy } =
      await import("../../../core/orchestrator/utils/settings.js");

    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await waitForNetworkingReady(el);

    // Toggle enabled
    await el.onProxyToggle(true);
    expect(setUseProxy).toHaveBeenCalledWith(orch, expect.anything(), true);
    expect(showSuccess).toHaveBeenCalledWith("CORS Proxy enabled", 2500);

    // Toggle disabled
    await el.onProxyToggle(false);
    expect(setUseProxy).toHaveBeenCalledWith(orch, expect.anything(), false);
    expect(showSuccess).toHaveBeenCalledWith("CORS Proxy disabled", 2500);

    // Error
    (setUseProxy as any).mockRejectedValueOnce(new Error("Failed to write DB"));
    await el.onProxyToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving proxy setting: Failed to write DB",
      6000,
    );

    // Early return without orchestrator
    el.orchestrator = null;
    await el.onProxyToggle(true);

    document.body.removeChild(el);
  });

  it("handles saveProxyUrl error, event listener click, and early returns", async () => {
    const { showError } = await import("../../../ui/toast.js");
    const { setProxyUrl } =
      await import("../../../core/orchestrator/utils/settings.js");

    const orch = createOrchestratorStub();
    (orchestratorStore as any).orchestrator = orch;

    const el = new ShadowClawNetworking();
    document.body.appendChild(el);
    await waitForNetworkingReady(el);

    const input = el.shadowRoot?.querySelector(
      '[data-setting="proxy-url-input"]',
    ) as HTMLInputElement;
    input.value = "https://proxy.example.com";

    // Error saving
    (setProxyUrl as any).mockRejectedValueOnce(
      new Error("Network config error"),
    );
    await el.saveProxyUrl();
    expect(showError).toHaveBeenCalledWith(
      "Error saving proxy URL: Network config error",
      6000,
    );

    // Trigger save via button click
    const saveBtn = el.shadowRoot?.querySelector(
      '[data-action="save-proxy-url"]',
    ) as HTMLButtonElement;
    input.value = "https://new-proxy.com";
    saveBtn.click();

    // Trigger toggle via checkbox change
    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="proxy-toggle"]',
    ) as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    // Early returns in saveProxyUrl
    el.orchestrator = null;
    await el.saveProxyUrl();

    // Render early return when orchestrator is null
    await el.render();

    document.body.removeChild(el);
  });

  it("covers missing shadowRoot, missing db, non-Error exceptions, and null element guards", async () => {
    const { showError } = await import("../../../ui/toast.js");
    const { setUseProxy, setProxyUrl } =
      await import("../../../core/orchestrator/utils/settings.js");

    const el = new ShadowClawNetworking();

    // connectedCallback throws if no shadowRoot
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );

    // bindEventListeners with null shadowRoot
    el.bindEventListeners();

    // render with null shadowRoot
    el.orchestrator = createOrchestratorStub() as any;
    await el.render();

    // saveProxyUrl with null shadowRoot
    el.db = {} as any;
    await el.saveProxyUrl();

    // Restore shadowRoot stub
    const fakeRoot = document.createElement("div");
    Object.defineProperty(el, "shadowRoot", {
      value: fakeRoot,
      configurable: true,
    });

    // saveProxyUrl with missing input element
    await el.saveProxyUrl();

    // Missing db guards
    el.db = null;
    await el.onProxyToggle(true);
    await el.saveProxyUrl();

    // Non-error rejections
    el.db = {} as any;
    (setUseProxy as any).mockRejectedValueOnce("string failure");
    await el.onProxyToggle(true);
    expect(showError).toHaveBeenCalledWith(
      "Error saving proxy setting: string failure",
      6000,
    );

    const fakeInput = document.createElement("input");
    fakeInput.setAttribute("data-setting", "proxy-url-input");
    fakeInput.value = "http://example.com";
    fakeRoot.appendChild(fakeInput);

    (setProxyUrl as any).mockRejectedValueOnce("string error url");
    await el.saveProxyUrl();
    expect(showError).toHaveBeenCalledWith(
      "Error saving proxy URL: string error url",
      6000,
    );
  });
});
