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
jest.unstable_mockModule("../../../db/setConfig.js", () => ({
  setConfig: mockSetConfig,
}));
jest.unstable_mockModule("../../../db/getConfig.js", () => ({
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
});
