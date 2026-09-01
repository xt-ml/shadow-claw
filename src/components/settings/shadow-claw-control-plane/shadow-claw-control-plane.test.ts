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

const { ShadowClawControlPlane } =
  await import("./shadow-claw-control-plane.js");
const { showSuccess } = (await import("../../../ui/toast.js")) as any;

describe("shadow-claw-control-plane", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("should render correctly", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

    expect(el.shadowRoot).toBeTruthy();
    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="control-plane-enabled-toggle"]',
    ) as HTMLInputElement;
    expect(toggle).toBeTruthy();
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

  it("should save control plane enabled state", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

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

  it("should save control plane url", async () => {
    const el = new ShadowClawControlPlane();
    document.body.appendChild(el);
    await el.connectedCallback();

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
  });
});
