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

  it("handles event listeners for save button and toggle", async () => {
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    const input = el.shadowRoot?.querySelector(
      '[data-setting="task-server-url-input"]',
    ) as HTMLInputElement;
    input.value = "";

    const saveBtn = el.shadowRoot?.querySelector(
      '[data-action="save-task-server-url"]',
    );
    saveBtn?.dispatchEvent(new Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    expect(mockSetTaskServerUrl).toHaveBeenCalledWith(
      orchestratorStore.orchestrator,
      expect.anything(),
      "/schedule",
    );

    const toggle = el.shadowRoot?.querySelector(
      '[data-setting="task-server-enabled-toggle"]',
    ) as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSetTaskServerEnabled).toHaveBeenCalled();
  });

  it("handles errors during save", async () => {
    const { showError } = (await import("../../../ui/toast.js")) as any;
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    mockSetTaskServerEnabled.mockRejectedValueOnce(
      new Error("Save enabled fail"),
    );
    await el.saveTaskServerEnabled(true);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Save enabled fail"),
      6000,
    );

    mockSetTaskServerUrl.mockRejectedValueOnce(new Error("Save url fail"));
    await el.saveTaskServerUrl();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("Save url fail"),
      6000,
    );
  });

  it("handles early returns when orchestrator is missing", async () => {
    const el = new ShadowClawTaskServer();
    el.orchestrator = null;
    await el.saveTaskServerEnabled(true);
    await el.saveTaskServerUrl();
    await el.render();
  });

  it("handles missing db, missing root, missing input, and non-Error rejections", async () => {
    const el = new ShadowClawTaskServer();
    document.body.appendChild(el);
    await el.connectedCallback();

    // Missing db
    el.db = null;
    await el.saveTaskServerEnabled(true);
    await el.saveTaskServerUrl();

    // Restore db
    el.db = {} as any;

    // Missing input in shadowRoot
    el.shadowRoot
      ?.querySelector('[data-setting="task-server-url-input"]')
      ?.remove();
    await el.saveTaskServerUrl();

    // Rejections with non-Error string
    const { showError } = (await import("../../../ui/toast.js")) as any;
    mockSetTaskServerEnabled.mockRejectedValueOnce("String error failure");
    await el.saveTaskServerEnabled(false);
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("String error failure"),
      6000,
    );

    mockSetTaskServerUrl.mockRejectedValueOnce("String url error");
    const testInput = document.createElement("input");
    testInput.setAttribute("data-setting", "task-server-url-input");
    testInput.value = "http://test.com";
    el.shadowRoot?.appendChild(testInput);
    await el.saveTaskServerUrl();
    expect(showError).toHaveBeenCalledWith(
      expect.stringContaining("String url error"),
      6000,
    );

    // Missing shadowRoot in methods
    const noRootEl = new ShadowClawTaskServer();
    Object.defineProperty(noRootEl, "shadowRoot", {
      value: null,
      configurable: true,
    });
    await expect(noRootEl.connectedCallback()).rejects.toThrow(
      "shadowRoot not found",
    );
    expect(() => noRootEl.bindEventListeners()).not.toThrow();
    await expect(noRootEl.render()).resolves.toBeUndefined();
    await expect(noRootEl.saveTaskServerUrl()).resolves.toBeUndefined();

    // orchestrator without ensureAllConnections
    el.orchestrator = {
      taskServerUrl: "/test",
      taskServerEnabled: false,
    } as any;
    await el.saveTaskServerEnabled(true);
    await el.saveTaskServerUrl();
  });
});
