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

jest.unstable_mockModule("../storage/writeGroupFile.mjs", () => ({
  writeGroupFile: jest.fn(),
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
    currentPath: ".",
    loadFiles: jest.fn(),
    db: {},
    triggerFilesRefresh: jest.fn(),
    orchestrator: {
      getVMStatus: jest.fn(() => ({
        ready: false,
        booting: false,
        bootAttempted: false,
        error: null,
        mode: null,
      })),
      events: { on: jest.fn(), off: jest.fn() },
    },
  },
}));

jest.unstable_mockModule("../db/db.mjs", () => ({
  getDb: jest.fn(() => ({})),
}));

const { ShadowClawFiles } = await import("./shadow-claw-files.mjs");
const { writeGroupFile } = await import("../storage/writeGroupFile.mjs");
const { showSuccess, showWarning } = await import("../toast.mjs");
const { orchestratorStore } = await import("../stores/orchestrator.mjs");

describe("shadow-claw-files", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-files")).toBe(ShadowClawFiles);
  });

  it("includes New button next to toolbar actions", () => {
    const template = ShadowClawFiles.getTemplate();

    expect(template).toContain("files__upload-btn");

    expect(template).toContain("files__new-btn");

    expect(template).toContain("files__new-dialog");

    expect(template).toContain("files__drop-hint");

    expect(template).toContain("files__upload-progress");
  });

  it("creates a file from New dialog input", async () => {
    const component = new ShadowClawFiles();
    component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new file input");
    }

    input.value = "notes.txt";
    await component.handleCreateNewFile({});

    expect(writeGroupFile).toHaveBeenCalledWith({}, "default", "notes.txt", "");

    expect(orchestratorStore.loadFiles).toHaveBeenCalledWith({});

    expect(showSuccess).toHaveBeenCalledWith("Created file: notes.txt", 3000);
  });

  it("rejects path-style file names in New dialog", async () => {
    const component = new ShadowClawFiles();
    component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new file input");
    }

    input.value = "docs/notes.txt";
    await component.handleCreateNewFile({});

    expect(writeGroupFile).not.toHaveBeenCalled();

    expect(showWarning).toHaveBeenCalledWith(
      "Use only a file name, not a path",
      3500,
    );
  });

  it("hides sync buttons when runtime mode is not 9p", () => {
    const component = new ShadowClawFiles();
    component.render();

    /** @type {any} */ (
      orchestratorStore.orchestrator
    ).getVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
      mode: "ext2",
    });

    component.updateSyncButtonsVisibility();

    const hostBtn = component.shadowRoot?.querySelector(
      ".files__sync-host-btn",
    );
    const vmBtn = component.shadowRoot?.querySelector(".files__sync-vm-btn");

    expect(hostBtn).toHaveProperty("hidden", true);
    expect(vmBtn).toHaveProperty("hidden", true);
  });

  it("shows sync buttons when runtime mode is 9p", () => {
    const component = new ShadowClawFiles();
    component.render();

    /** @type {any} */ (
      orchestratorStore.orchestrator
    ).getVMStatus.mockReturnValue({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
      mode: "9p",
    });

    component.updateSyncButtonsVisibility();

    const hostBtn = component.shadowRoot?.querySelector(
      ".files__sync-host-btn",
    );
    const vmBtn = component.shadowRoot?.querySelector(".files__sync-vm-btn");

    expect(hostBtn).toHaveProperty("hidden", false);
    expect(vmBtn).toHaveProperty("hidden", false);
  });
});
