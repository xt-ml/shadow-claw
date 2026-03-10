import { jest } from "@jest/globals";

jest.unstable_mockModule("../storage/deleteAllGroupFiles.mjs", () => ({
  deleteAllGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../storage/deleteGroupDirectory.mjs", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../storage/deleteGroupFile.mjs", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/downloadAllGroupFilesAsZip.mjs", () => ({
  downloadAllGroupFilesAsZip: jest.fn(),
}));

jest.unstable_mockModule("../storage/downloadGroupDirectoryAsZip.mjs", () => ({
  downloadGroupDirectoryAsZip: jest.fn(),
}));

jest.unstable_mockModule("../storage/downloadGroupFile.mjs", () => ({
  downloadGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../storage/restoreAllGroupFilesFromZip.mjs", () => ({
  restoreAllGroupFilesFromZip: jest.fn(),
}));

jest.unstable_mockModule("../storage/uploadGroupFile.mjs", () => ({
  uploadGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../effect.mjs", () => ({ effect: jest.fn() }));
jest.unstable_mockModule("../toast.mjs", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../stores/file-viewer.mjs", () => ({
  fileViewerStore: { file: null, closeFile: jest.fn(), openFile: jest.fn() },
}));

jest.unstable_mockModule("../stores/orchestrator.mjs", () => ({
  orchestratorStore: {
    activeGroupId: "default",
    db: {},
    triggerFilesRefresh: jest.fn(),
  },
}));

jest.unstable_mockModule("../db/db.mjs", () => ({
  getDb: jest.fn(() => ({})),
}));

const { ShadowClawFiles } = await import("./shadow-claw-files.mjs");

describe("shadow-claw-files", () => {
  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-files")).toBe(ShadowClawFiles);
  });
});
