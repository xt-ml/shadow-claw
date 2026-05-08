import { jest } from "@jest/globals";

jest.unstable_mockModule("../../storage/deleteAllGroupFiles.js", () => ({
  deleteAllGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../../storage/deleteGroupDirectory.js", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../../storage/deleteGroupFile.js", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/downloadAllGroupFilesAsZip.js", () => ({
  downloadAllGroupFilesAsZip: jest.fn(),
}));

jest.unstable_mockModule(
  "../../storage/downloadGroupDirectoryAsZip.js",
  () => ({
    downloadGroupDirectoryAsZip: jest.fn(),
  }),
);

jest.unstable_mockModule("../../storage/downloadGroupFile.js", () => ({
  downloadGroupFile: jest.fn(),
}));

jest.unstable_mockModule(
  "../../storage/restoreAllGroupFilesFromZip.js",
  () => ({
    restoreAllGroupFilesFromZip: jest.fn(),
  }),
);

jest.unstable_mockModule("../../storage/uploadGroupFile.js", () => ({
  uploadGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/writeGroupFile.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/renameGroupEntry.js", () => ({
  renameGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../effect.js", () => ({
  effect: jest.fn(() => () => {}),
}));
jest.unstable_mockModule("../../toast.js", () => ({
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
  showInfo: jest.fn(),
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: { file: null, closeFile: jest.fn(), openFile: jest.fn() },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
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

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

const { ShadowClawFiles } = await import("./shadow-claw-files.js");
const { renameGroupEntry } = await import("../../storage/renameGroupEntry.js");
const { writeGroupFile } = await import("../../storage/writeGroupFile.js");
const { showSuccess, showWarning, showError } = await import("../../toast.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");

describe("shadow-claw-files", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-files")).toBe(ShadowClawFiles);
  });

  it("includes New button next to toolbar actions", async () => {
    const template = await ShadowClawFiles.getTemplateSource();

    expect(template).toContain("files__upload-btn");

    expect(template).toContain("files__new-btn");

    expect(template).toContain("files__new-dialog");

    expect(template).toContain("files__rename-dialog");

    expect(template).toContain("files__drop-hint");

    expect(template).toContain("files__upload-progress");
  });

  it("creates a file from New dialog input", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new file input");
    }

    input.value = "notes.txt";
    await component.handleCreateNewFile({} as any);

    expect(writeGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "notes.txt",
      "",
    );

    expect(orchestratorStore.loadFiles).toHaveBeenCalledWith({} as any);

    expect(showSuccess).toHaveBeenCalledWith("Created file: notes.txt", 3000);
    document.body.removeChild(component);
  });

  it("rejects path-style file names in New dialog", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new file input");
    }

    input.value = "folder/notes.txt";
    await component.handleCreateNewFile({} as any);

    expect(writeGroupFile).not.toHaveBeenCalled();

    expect(showWarning).toHaveBeenCalledWith(
      "Use only a file name, not a path",
      3500,
    );
    document.body.removeChild(component);
  });

  it("hides sync buttons when runtime mode is not 9p", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    (orchestratorStore.orchestrator as any).getVMStatus.mockReturnValue({
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
    document.body.removeChild(component);
  });

  it("shows sync buttons when runtime mode is 9p", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    (orchestratorStore.orchestrator as any).getVMStatus.mockReturnValue({
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
    document.body.removeChild(component);
  });

  it("renames a file from the Rename dialog", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    (component as any)._pendingRenamePath = "notes.txt";
    (component as any)._pendingRenameName = "notes.txt";
    (component as any)._pendingRenameIsDirectory = false;

    const input = component.shadowRoot?.querySelector(".files__rename-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected rename input");
    }

    input.value = "notes-renamed.txt";
    await component.handleRenameEntry({} as any);

    expect(renameGroupEntry).toHaveBeenCalledWith(
      {} as any,
      "default",
      "notes.txt",
      "notes-renamed.txt",
    );

    expect(orchestratorStore.loadFiles).toHaveBeenCalledWith({} as any);

    expect(showSuccess).toHaveBeenCalledWith(
      "Renamed file: notes.txt -> notes-renamed.txt",
      3200,
    );

    document.body.removeChild(component);
  });

  it("rejects path-style names in Rename dialog", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    (component as any)._pendingRenamePath = "notes.txt";
    (component as any)._pendingRenameName = "notes.txt";
    (component as any)._pendingRenameIsDirectory = false;

    const input = component.shadowRoot?.querySelector(".files__rename-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected rename input");
    }

    input.value = "folder/notes.txt";
    await component.handleRenameEntry({} as any);

    expect(renameGroupEntry).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Use only a name, not a path",
      3500,
    );

    document.body.removeChild(component);
  });

  it("shows a toast when rename fails", async () => {
    (renameGroupEntry as any).mockRejectedValue(new Error("already exists"));

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.onTemplateReady;
    await component.render();

    (component as any)._pendingRenamePath = "notes.txt";
    (component as any)._pendingRenameName = "notes.txt";
    (component as any)._pendingRenameIsDirectory = false;

    const input = component.shadowRoot?.querySelector(".files__rename-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected rename input");
    }

    input.value = "taken.txt";
    await component.handleRenameEntry({} as any);

    expect(showError).toHaveBeenCalledWith(
      "Failed to rename notes.txt: already exists",
      6000,
    );

    document.body.removeChild(component);
  });
});
