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

jest.unstable_mockModule("../../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    orchestrator: {
      getTaskServerUrl: jest.fn(() => "/test-schedule"),
      setTaskServerUrl: jest.fn(() => Promise.resolve()),
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

    expect(
      orchestratorStore.orchestrator.setTaskServerUrl,
    ).toHaveBeenCalledWith(expect.anything(), "https://new-server.com");
    expect(showSuccess).toHaveBeenCalled();
  });
});
