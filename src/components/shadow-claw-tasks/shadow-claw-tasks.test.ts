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

describe("shadow-claw-tasks", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-tasks")).toBe(ShadowClawTasks);
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
