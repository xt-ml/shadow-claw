import { jest } from "@jest/globals";

jest.unstable_mockModule("../db/db.mjs", () => ({
  getDb: jest.fn(() => ({})),
}));

jest.unstable_mockModule("../db/saveTask.mjs", () => ({ saveTask: jest.fn() }));
jest.unstable_mockModule("../effect.mjs", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../markdown.mjs", () => ({
  renderMarkdown: jest.fn((x) => x),
}));

jest.unstable_mockModule("../stores/orchestrator.mjs", () => ({
  orchestratorStore: { activeGroupId: "default", db: {}, orchestrator: null },
}));

jest.unstable_mockModule("../toast.mjs", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
}));

const { ShadowClawTasks } = await import("./shadow-claw-tasks.mjs");

describe("shadow-claw-tasks", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-tasks")).toBe(ShadowClawTasks);
  });
});
