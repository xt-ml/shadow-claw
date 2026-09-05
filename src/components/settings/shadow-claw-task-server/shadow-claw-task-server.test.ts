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

const mockSetTaskServerUrl = jest.fn(() => Promise.resolve());
const mockSetTaskServerEnabled = jest.fn(() => Promise.resolve());
jest.unstable_mockModule(
  "../../../core/orchestrator/utils/settings.js",
  () => ({
    setTaskServerUrl: mockSetTaskServerUrl,
    setTaskServerEnabled: mockSetTaskServerEnabled,
  }),
);

const mockEnsureAllConnections = jest
  .fn()
  .mockResolvedValue(undefined as never);
jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: {
      taskServerUrl: "/test-schedule",
      taskServerEnabled: true,
      ensureAllConnections: mockEnsureAllConnections,
    },
    ready: true,
  },
}));

jest.unstable_mockModule("../../../ui/toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
}));

const { ShadowClawTaskServer } = await import("./shadow-claw-task-server.js");
const { orchestratorStore } =
  (await import("../../../stores/orchestrator.js")) as any;
const { showSuccess } = (await import("../../../ui/toast.js")) as any;

describe("shadow-claw-task-server", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("should render correctly", async () => {
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    expect(el.shadowRoot).toBeTruthy();
    const input = el.shadowRoot?.querySelector(
      '[data-setting="task-server-url-input"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("/test-schedule");
    const enabledToggle = el.shadowRoot?.querySelector(
      '[data-setting="task-server-enabled-toggle"]',
    ) as HTMLInputElement;
    expect(enabledToggle.checked).toBe(true);
  });

  it("should save task server url", async () => {
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="task-server-url-input"]',
    ) as HTMLInputElement;
    if (input) input.value = "https://new-server.com";

    await el.saveTaskServerUrl();

    expect(mockSetTaskServerUrl).toHaveBeenCalledWith(
      orchestratorStore.orchestrator,
      expect.anything(),
      "https://new-server.com",
    );
    expect(showSuccess).toHaveBeenCalled();
    expect(mockEnsureAllConnections).toHaveBeenCalled();
  });

  it("should save task server enabled toggle", async () => {
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    await el.saveTaskServerEnabled(false);

    expect(mockSetTaskServerEnabled).toHaveBeenCalledWith(
      orchestratorStore.orchestrator,
      expect.anything(),
      false,
    );

    mockEnsureAllConnections.mockClear();
    await el.saveTaskServerEnabled(true);
    expect(mockSetTaskServerEnabled).toHaveBeenCalledWith(
      orchestratorStore.orchestrator,
      expect.anything(),
      true,
    );
    expect(mockEnsureAllConnections).toHaveBeenCalled();
  });
});
