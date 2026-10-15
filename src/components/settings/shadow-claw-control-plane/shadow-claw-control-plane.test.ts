import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../core/effect.js", () => ({
  effect: jest.fn((cb: any) => {
    cb();
    return () => {};
  }),
}));

jest.unstable_mockModule("../../../db/db.js", () => ({
  getDb: jest.fn(() => Promise.resolve({})),
}));

const mockSetConfig = jest.fn(() => Promise.resolve());
const mockGetConfig = jest.fn(() => Promise.resolve("sse"));
jest.unstable_mockModule("../../../db/set-config.js", () => ({
  setConfig: mockSetConfig,
}));
jest.unstable_mockModule("../../../db/get-config.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: {},
    ready: true,
  },
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

export const mockIsControlPlaneEnabled = jest.fn(() => Promise.resolve(true));
export const mockEnsureControlPlaneConnected = jest.fn(() => Promise.resolve());
export const mockStopControlPlaneClient = jest.fn();
export const mockShouldConnectControlPlane = jest.fn(() => true);

jest.unstable_mockModule("../../../core/utils/init-control-plane.js", () => ({
  isControlPlaneEnabled: mockIsControlPlaneEnabled,
  ensureControlPlaneConnected: mockEnsureControlPlaneConnected,
  stopControlPlaneClient: mockStopControlPlaneClient,
  shouldConnectControlPlane: mockShouldConnectControlPlane,
}));

const { ShadowClawControlPlane, getControlPlaneTargetAddressSpace } =
  await import("./shadow-claw-control-plane.js");
const { showSuccess, showError } =
  (await import("../../../ui/toast.js")) as any;

describe("shadow-claw-control-plane", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
    (globalThis as any).fetch = jest.fn();
  });

  it("should calculate targetAddressSpace correctly", () => {
    expect(getControlPlaneTargetAddressSpace("http://localhost:8888")).toBe(
      "loopback",
    );
    expect(getControlPlaneTargetAddressSpace("http://127.0.0.1:8888")).toBe(
      "loopback",
    );
    expect(getControlPlaneTargetAddressSpace("https://10.9.8.226:8888")).toBe(
      "private",
    );
    expect(
      getControlPlaneTargetAddressSpace("https://192.168.1.100:8888"),
    ).toBe("private");
    expect(getControlPlaneTargetAddressSpace("https://172.20.0.1:8888")).toBe(
      "private",
    );
    expect(getControlPlaneTargetAddressSpace("https://hostname:8888")).toBe(
      "private",
    );
    expect(
      getControlPlaneTargetAddressSpace("https://hostname.local:8888"),
    ).toBe("private");
    expect(
      getControlPlaneTargetAddressSpace("https://my-server.example.com"),
    ).toBeUndefined();
    expect(getControlPlaneTargetAddressSpace("invalid-url")).toBeUndefined();
  });

  it("should render correctly with Test Connection button", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    expect(el.shadowRoot).toBeTruthy();
    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-enabled-toggle"]',
    ) as HTMLInputElement;
    expect(toggle).toBeTruthy();

    const testBtn = el.shadowRoot?.querySelector(
      '[data-action="test-control-plane-connection"]',
    ) as HTMLButtonElement;
    expect(testBtn).toBeTruthy();
  });

  it("should save control plane transport", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    const select = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-transport-select"]',
    ) as HTMLSelectElement;
    if (select) select.value = "websocket";

    await el.saveControlPlaneTransport();

    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("WEBSOCKET"),
      expect.any(Number),
    );
  });

  it("should save control plane enabled state and trigger probe", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    const probeSpy = jest
      .spyOn(el, "probeControlPlane")
      .mockResolvedValue({ success: true });

    await el.saveControlPlaneEnabled(true);

    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "control_plane_enabled",
      "true",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("enabled"),
      expect.any(Number),
    );
    expect(probeSpy).toHaveBeenCalled();

    await el.saveControlPlaneEnabled(false);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "control_plane_enabled",
      "false",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("disabled"),
      expect.any(Number),
    );
  });

  it("should save control plane url and trigger probe", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    const probeSpy = jest
      .spyOn(el, "probeControlPlane")
      .mockResolvedValue({ success: true });

    const input = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "https://custom-control.example.com";

    await el.saveControlPlaneUrl();

    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.anything(),
      "control_plane_url",
      "https://custom-control.example.com",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("https://custom-control.example.com"),
      expect.any(Number),
    );
    expect(probeSpy).toHaveBeenCalledWith("https://custom-control.example.com");
  });

  it("should probe control plane successfully", async () => {
    const el = new ShadowClawControlPlane();
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValue({
      ok: true,
      status: 200,
    });

    const result = await el.probeControlPlane("https://10.9.8.226:8888");

    expect(result.success).toBe(true);
    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      "https://10.9.8.226:8888/api/control/health",
      expect.objectContaining({
        targetAddressSpace: "private",
        cache: "no-store",
      }),
    );
  });

  it("should test connection and show success toast when probe succeeds", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    jest.spyOn(el, "probeControlPlane").mockResolvedValue({ success: true });

    const input = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement;
    input.value = "https://10.9.8.226:8888";

    const ok = await el.testControlPlaneConnection();

    expect(ok).toBe(true);
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining("https://10.9.8.226:8888"),
      expect.any(Number),
    );
  });

  it("should test connection and request dialog when probe fails", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    jest.spyOn(el, "probeControlPlane").mockResolvedValue({
      success: false,
      error: "Failed to fetch",
    });

    const dialogSpy = jest
      .spyOn(el, "requestAppDialog")
      .mockResolvedValue(true);

    const input = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement;
    input.value = "https://10.9.8.226:8888";

    const ok = await el.testControlPlaneConnection();

    expect(ok).toBe(false);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch"),
      expect.any(Number),
    );
    expect(dialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Control Plane Connection Failed",
        message: expect.stringContaining("chrome://certificate-manager"),
      }),
    );
  });

  it("handles errors when saving Control Plane URL or setting", async () => {
    const el = new ShadowClawControlPlane();
    // Test with no db for saveControlPlaneEnabled
    el.db = null as any;
    await el.saveControlPlaneEnabled(true);
    expect(showError).not.toHaveBeenCalled();

    await el.connectedCallback();
    const input = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement;
    input.value = "http://localhost:8888";

    // Test error throwing in saveControlPlaneUrl
    mockSetConfig.mockRejectedValueOnce(new Error("DB error saving URL"));
    await el.saveControlPlaneUrl();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("DB error saving URL"),
      expect.any(Number),
    );

    // Test error throwing in saveControlPlaneEnabled
    mockSetConfig.mockRejectedValueOnce(new Error("DB error saving setting"));
    await el.saveControlPlaneEnabled(false);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("DB error saving setting"),
      expect.any(Number),
    );
  });

  it("covers probeControlPlane status branches (404 fallback, 204, 401, 500, invalid URL, and fetch rejection)", async () => {
    const el = new ShadowClawControlPlane();

    // Invalid URL
    const invalidRes = await el.probeControlPlane(":::invalid-url:::");
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain("Invalid URL format");

    // 404 with OPTIONS fallback success
    (globalThis as any).fetch = (jest.fn() as any)
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    const fallbackRes = await el.probeControlPlane("http://localhost:8888");
    expect(fallbackRes.success).toBe(true);

    // 401 Unauthorized success
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    const authRes = await el.probeControlPlane("http://localhost:8888");
    expect(authRes.success).toBe(true);

    // 500 failure
    (globalThis as any).fetch = (jest.fn() as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });
    const errRes = await el.probeControlPlane("http://localhost:8888");
    expect(errRes.success).toBe(false);
    expect(errRes.error).toContain("HTTP 500");

    // fetch rejects with Error
    (globalThis as any).fetch = (jest.fn() as any).mockRejectedValueOnce(
      new Error("Network disconnect"),
    );
    const rejRes = await el.probeControlPlane("http://localhost:8888");
    expect(rejRes.success).toBe(false);
    expect(rejRes.error).toBe("Network disconnect");

    // fetch rejects with non-Error
    (globalThis as any).fetch = (jest.fn() as any).mockRejectedValueOnce(
      "String error",
    );
    const nonErrRes = await el.probeControlPlane("http://localhost:8888");
    expect(nonErrRes.success).toBe(false);
    expect(nonErrRes.error).toBe("String error");
  });

  it("covers getControlPlaneTargetAddressSpace additional hostnames", () => {
    expect(getControlPlaneTargetAddressSpace("http://[::1]:8888")).toBe(
      "loopback",
    );
    expect(getControlPlaneTargetAddressSpace("http://server.lan:8888")).toBe(
      "private",
    );
    expect(getControlPlaneTargetAddressSpace("http://server.home:8888")).toBe(
      "private",
    );
    expect(
      getControlPlaneTargetAddressSpace("http://server.internal:8888"),
    ).toBe("private");
    expect(getControlPlaneTargetAddressSpace("http://172.31.0.1:8888")).toBe(
      "private",
    );
  });

  it("covers render error fallbacks and null shadowRoot guards", async () => {
    const el = new ShadowClawControlPlane();

    // Throw in connectedCallback when shadowRoot is null
    Object.defineProperty(el, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(el.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );

    el.bindEventListeners();
    await el.render();
    expect(await el.testControlPlaneConnection()).toBe(false);

    // Test render with error fallbacks
    const el2 = new ShadowClawControlPlane();
    document.body.appendChild(el2);
    await el2.connectedCallback();

    mockIsControlPlaneEnabled.mockRejectedValueOnce(new Error("check fail"));
    mockGetConfig.mockRejectedValueOnce(new Error("url fail"));
    mockGetConfig.mockRejectedValueOnce(new Error("transport fail"));
    await el2.render();

    // Test saveControlPlaneTransport and saveControlPlaneUrl with missing root and missing elements
    const fakeRoot = document.createElement("div");
    Object.defineProperty(el2, "shadowRoot", {
      value: fakeRoot,
      configurable: true,
    });
    // missing select and input
    await el2.saveControlPlaneTransport();
    await el2.saveControlPlaneUrl();

    // null shadowRoot
    Object.defineProperty(el2, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await el2.saveControlPlaneTransport();
    await el2.saveControlPlaneUrl();

    document.body.removeChild(el2);

    // Missing db guards
    el.db = null;
    await el.saveControlPlaneTransport();
    await el.saveControlPlaneUrl();
  });

  it("covers shouldConnectControlPlane false branches and localStorage failure", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    mockShouldConnectControlPlane.mockReturnValueOnce(false);
    await el.saveControlPlaneEnabled(true);

    mockShouldConnectControlPlane.mockReturnValueOnce(false);
    await el.saveControlPlaneTransport();

    mockShouldConnectControlPlane.mockReturnValueOnce(false);
    await el.saveControlPlaneUrl();

    // localStorage throws
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = jest.fn(() => {
      throw new Error("QuotaExceeded");
    }) as any;

    try {
      await el.saveControlPlaneEnabled(true);
      await el.saveControlPlaneTransport();
      await el.saveControlPlaneUrl();
    } finally {
      localStorage.setItem = originalSetItem;
      document.body.removeChild(el);
    }
  });

  it("covers saveControlPlaneUrl reset to default (empty string) and non-Error catches", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-url-input"]',
    ) as HTMLInputElement;
    input.value = "   "; // empty/whitespace
    await el.saveControlPlaneUrl();

    expect(showSuccess).toHaveBeenCalledWith(
      "Control Plane URL reset to default",
      3000,
    );

    // Non-Error exception in saveControlPlaneUrl
    mockSetConfig.mockRejectedValueOnce("raw string failure");
    input.value = "http://test-url.com";
    await el.saveControlPlaneUrl();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Control Plane URL: raw string failure",
      6000,
    );

    // Non-Error exception in saveControlPlaneTransport
    mockSetConfig.mockRejectedValueOnce("raw string transport failure");
    await el.saveControlPlaneTransport();
    expect(showError).toHaveBeenCalledWith(
      "Error saving Control Plane transport: raw string transport failure",
      6000,
    );

    // Non-Error exception in saveControlPlaneEnabled
    mockSetConfig.mockRejectedValueOnce("raw string enabled failure");
    await el.saveControlPlaneEnabled(false);
    expect(showError).toHaveBeenCalledWith(
      "Error saving Control Plane setting: raw string enabled failure",
      6000,
    );

    // Click and change events in DOM
    const transportBtn = el.shadowRoot?.querySelector(
      '[data-action="save-control-plane-transport"]',
    ) as HTMLElement;
    transportBtn?.click();

    const urlBtn = el.shadowRoot?.querySelector(
      '[data-action="save-control-plane-url"]',
    ) as HTMLElement;
    urlBtn?.click();

    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-enabled-toggle"]',
    ) as HTMLInputElement;
    toggle?.dispatchEvent(new Event("change"));

    // requestAppDialog
    const appShell = document.createElement("shadow-claw") as any;
    appShell.requestDialog = jest.fn().mockResolvedValue(true);
    document.body.appendChild(appShell);

    const dialogRes = await el.requestAppDialog({ title: "T", message: "M" });
    expect(dialogRes).toBe(true);

    document.body.removeChild(appShell);
    document.body.removeChild(el);
  });
});
