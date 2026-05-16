import { jest } from "@jest/globals";

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

jest.unstable_mockModule("../../db/saveTask.js", () => ({
  saveTask: jest.fn(),
}));
jest.unstable_mockModule("../../effect.js", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../../markdown.js", () => ({
  renderMarkdown: jest.fn((x) => x),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: {
    openFile: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: { activeGroupId: "default", db: {}, orchestrator: null },
}));

jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { ShadowClawTasks } = await import("./shadow-claw-tasks.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");

describe("shadow-claw-tasks", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-tasks")).toBe(ShadowClawTasks);
  });

  it("routes edit preview HTML through the Trusted Types helper", async () => {
    const component = new ShadowClawTasks();
    const dialog = document.createElement("dialog");
    dialog.showModal = jest.fn();

    const form = document.createElement("form");
    form.className = "tasks__dialog-form";
    const scheduleInput = document.createElement("input");
    scheduleInput.name = "schedule";
    const promptInput = document.createElement("textarea");
    promptInput.name = "prompt";
    form.append(scheduleInput, promptInput);

    const title = document.createElement("h2");
    title.className = "tasks__dialog-title";

    const submitBtn = document.createElement("button");
    submitBtn.className = "tasks__dialog-submit";

    const previewDiv = document.createElement("div");
    previewDiv.className = "tasks__preview";

    component.shadowRoot?.append(dialog, form, title, submitBtn, previewDiv);

    component.handleEdit({
      id: "task-1",
      schedule: "0 * * * *",
      prompt: "hello",
    } as any);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      previewDiv,
      '<div class="tasks__prompt">hello</div>',
    );
  });

  describe("workspace link resolution", () => {
    it("resolves workspace-relative links", () => {
      const component = new ShadowClawTasks();

      expect(
        component.resolveWorkspaceLinkPath("weather/archive/index.md"),
      ).toBe("weather/archive/index.md");
    });

    it("normalizes leading ./ or / and strips query/hash", () => {
      const component = new ShadowClawTasks();

      expect(
        component.resolveWorkspaceLinkPath("./weather/archive/index.md#top"),
      ).toBe("weather/archive/index.md");

      expect(
        component.resolveWorkspaceLinkPath("/weather/archive/index.md"),
      ).toBe("weather/archive/index.md");
    });

    it("rejects external links and parent traversal", () => {
      const component = new ShadowClawTasks();

      expect(
        component.resolveWorkspaceLinkPath("http://localhost:8888/foo/bar"),
      ).toBeNull();

      expect(component.resolveWorkspaceLinkPath("../secrets.txt")).toBeNull();
    });
  });
});
