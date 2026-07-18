import { jest } from "@jest/globals";

const mockAddPage = jest.fn();
const mockRemovePage = jest.fn();

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

jest.unstable_mockModule("../../storage/createGroupDirectory.js", () => ({
  createGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../../storage/renameGroupEntry.js", () => ({
  renameGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../storage/copyGroupEntry.js", () => ({
  copyGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../storage/moveGroupEntry.js", () => ({
  moveGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn(() => () => {}),
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
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
    files: [] as string[],
    pages: [] as Array<{ groupId: string; path: string }>,
    addPage: mockAddPage,
    removePage: mockRemovePage,
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
const { deleteGroupFile } = await import("../../storage/deleteGroupFile.js");
const { renameGroupEntry } = await import("../../storage/renameGroupEntry.js");
const { writeGroupFile } = await import("../../storage/writeGroupFile.js");
const { createGroupDirectory } =
  await import("../../storage/createGroupDirectory.js");
const { copyGroupEntry } = await import("../../storage/copyGroupEntry.js");
const { moveGroupEntry } = await import("../../storage/moveGroupEntry.js");
const { showSuccess, showWarning, showError } =
  await import("../../ui/toast.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { filesUiStore } = await import("../../stores/files-ui.js");

describe("shadow-claw-files", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    filesUiStore.clearClipboard();
    (orchestratorStore as any).pages = [];
    (orchestratorStore as any).files = [];
    (mockAddPage as any).mockResolvedValue(undefined);
    (mockRemovePage as any).mockResolvedValue(undefined);
  });

  it("registers custom element", () => {
    expect(customElements.get("shadow-claw-files")).toBe(ShadowClawFiles);
  });

  it("includes New button next to toolbar actions", async () => {
    const template = await Promise.resolve(
      ShadowClawFiles.template.map((e: Element) => e.outerHTML).join(""),
    );

    expect(template).toContain("files__upload-btn");

    expect(template).toContain("files__new-btn");

    expect(template).toContain("files__new-dialog");
    expect(template).toContain("files__new-is-folder");

    expect(template).toContain("files__rename-dialog");

    expect(template).toContain("files__drop-hint");

    expect(template).toContain("files__upload-progress");
  });

  it("creates a file from New dialog input", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
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

  it("creates a folder from New dialog when folder checkbox is enabled", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new item input");
    }

    const isFolder = component.shadowRoot?.querySelector(
      ".files__new-is-folder",
    );
    if (!(isFolder instanceof HTMLInputElement)) {
      throw new Error("Expected new folder checkbox");
    }

    input.value = "it works";
    isFolder.checked = true;

    await component.handleCreateNewFile({} as any);

    expect(createGroupDirectory).toHaveBeenCalledWith(
      {} as any,
      "default",
      "it works",
    );

    expect(writeGroupFile).not.toHaveBeenCalled();

    expect(orchestratorStore.loadFiles).toHaveBeenCalledWith({} as any);

    expect(showSuccess).toHaveBeenCalledWith("Created folder: it works", 3000);
    document.body.removeChild(component);
  });

  it("rejects path-style file names in New dialog", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
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

  it("disables Rename dialog action buttons while rename is in progress", async () => {
    let resolveRename: (() => void) | undefined;
    (renameGroupEntry as any).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve;
        }),
    );

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (component as any)._pendingRenamePath = "docs";
    (component as any)._pendingRenameName = "docs";
    (component as any)._pendingRenameIsDirectory = true;

    const input = component.shadowRoot?.querySelector(".files__rename-input");
    const cancelBtn = component.shadowRoot?.querySelector(
      ".files__rename-cancel",
    );
    const okBtn = component.shadowRoot?.querySelector(".files__rename-ok");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected rename input");
    }

    if (!(cancelBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected rename cancel button");
    }

    if (!(okBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected rename ok button");
    }

    input.value = "docs-archive";

    const pending = component.handleRenameEntry({} as any);

    expect(cancelBtn.disabled).toBe(true);
    expect(okBtn.disabled).toBe(true);
    expect(input.disabled).toBe(true);

    resolveRename?.();
    await pending;

    expect(cancelBtn.disabled).toBe(false);
    expect(okBtn.disabled).toBe(false);
    expect(input.disabled).toBe(false);

    document.body.removeChild(component);
  });

  it("ignores duplicate Rename submissions while rename is in progress", async () => {
    let resolveRename: (() => void) | undefined;
    (renameGroupEntry as any).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve;
        }),
    );

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (component as any)._pendingRenamePath = "big-dir";
    (component as any)._pendingRenameName = "big-dir";
    (component as any)._pendingRenameIsDirectory = true;

    const input = component.shadowRoot?.querySelector(".files__rename-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected rename input");
    }

    input.value = "big-dir-renamed";

    const first = component.handleRenameEntry({} as any);
    const second = component.handleRenameEntry({} as any);

    expect(renameGroupEntry).toHaveBeenCalledTimes(1);

    resolveRename?.();
    await Promise.all([first, second]);

    document.body.removeChild(component);
  });

  it("disables New dialog action buttons while create is in progress", async () => {
    let resolveWrite: (() => void) | undefined;
    (writeGroupFile as any).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    const isFolderInput = component.shadowRoot?.querySelector(
      ".files__new-is-folder",
    );
    const cancelBtn = component.shadowRoot?.querySelector(".files__new-cancel");
    const okBtn = component.shadowRoot?.querySelector(".files__new-ok");

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new input");
    }

    if (!(isFolderInput instanceof HTMLInputElement)) {
      throw new Error("Expected new folder checkbox");
    }

    if (!(cancelBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected new cancel button");
    }

    if (!(okBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected new ok button");
    }

    input.value = "long-create.txt";

    const pending = component.handleCreateNewFile({} as any);

    expect(cancelBtn.disabled).toBe(true);
    expect(okBtn.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    expect(isFolderInput.disabled).toBe(true);

    resolveWrite?.();
    await pending;

    expect(cancelBtn.disabled).toBe(false);
    expect(okBtn.disabled).toBe(false);
    expect(input.disabled).toBe(false);
    expect(isFolderInput.disabled).toBe(false);

    document.body.removeChild(component);
  });

  it("ignores duplicate New submissions while create is in progress", async () => {
    let resolveWrite: (() => void) | undefined;
    (writeGroupFile as any).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    const input = component.shadowRoot?.querySelector(".files__new-input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected new input");
    }

    input.value = "long-create.txt";

    const first = component.handleCreateNewFile({} as any);
    const second = component.handleCreateNewFile({} as any);

    expect(writeGroupFile).toHaveBeenCalledTimes(1);

    resolveWrite?.();
    await Promise.all([first, second]);

    document.body.removeChild(component);
  });

  it("adds markdown files to Pages from file actions", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);

    (orchestratorStore as any).files = ["README.md"];
    (orchestratorStore as any).currentPath = ".";
    component.updateFileList({} as any);

    const setPageBtn = component.shadowRoot?.querySelector(
      ".files__page-toggle",
    );
    if (!(setPageBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected Set as Page action button");
    }

    setPageBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockAddPage).toHaveBeenCalledWith({} as any, "README.md", "default");
    expect(showSuccess).toHaveBeenCalledWith("Added README.md to Pages", 2600);
    document.body.removeChild(component);
  });

  it("removes a file from Pages before deleting it", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);

    jest.spyOn(component, "requestConfirmation").mockResolvedValue(true);
    (orchestratorStore as any).files = ["README.md"];
    (orchestratorStore as any).pages = [
      { groupId: "default", path: "README.md" },
    ];

    component.updateFileList({} as any);

    const deleteBtn = component.shadowRoot?.querySelector(".files__delete");
    if (!(deleteBtn instanceof HTMLButtonElement)) {
      throw new Error("Expected delete action button");
    }

    deleteBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRemovePage).toHaveBeenCalledWith(
      {} as any,
      "README.md",
      "default",
    );
    expect(deleteGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "README.md",
    );
    expect((mockRemovePage as any).mock.invocationCallOrder[0]).toBeLessThan(
      (deleteGroupFile as any).mock.invocationCallOrder[0],
    );

    document.body.removeChild(component);
  });

  it("updates clipboard state on Cut or Copy click", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    // Mock orchestrator files to render list items
    (orchestratorStore as any).files = ["test-file.txt"];
    component.updateFileList({} as any);

    const list = component.shadowRoot?.querySelector(".files__list");
    const item = list?.querySelector(".files__item");
    const cutBtn = item?.querySelector(".files__cut");
    const copyBtn = item?.querySelector(".files__copy");

    if (
      !(cutBtn instanceof HTMLButtonElement) ||
      !(copyBtn instanceof HTMLButtonElement)
    ) {
      throw new Error("Expected Cut and Copy buttons");
    }

    cutBtn.click();
    expect(filesUiStore.clipboard).toEqual({
      sourcePath: "test-file.txt",
      type: "cut",
      isDirectory: false,
      sourceGroupId: "default",
    });
    expect(showSuccess).toHaveBeenCalledWith(
      "Cut test-file.txt (ready to move)",
      2500,
    );

    copyBtn.click();
    expect(filesUiStore.clipboard).toEqual({
      sourcePath: "test-file.txt",
      type: "copy",
      isDirectory: false,
      sourceGroupId: "default",
    });
    expect(showSuccess).toHaveBeenCalledWith(
      "Copied test-file.txt to clipboard",
      2500,
    );

    document.body.removeChild(component);
  });

  it("hides and disables Paste button when clipboard is empty", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    filesUiStore.clearClipboard();
    component.updatePasteButtonVisibility();

    const pasteBtn = component.shadowRoot?.querySelector(".files__paste-btn");
    if (!(pasteBtn instanceof HTMLElement)) {
      throw new Error("Expected Paste button");
    }

    expect(pasteBtn.hasAttribute("hidden")).toBe(true);
    expect(pasteBtn.hasAttribute("disabled")).toBe(true);

    document.body.removeChild(component);
  });

  it("shows and enables Paste button when clipboard has an entry", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    filesUiStore.setClipboard("test-file.txt", "copy", false, "default");
    component.updatePasteButtonVisibility();

    const pasteBtn = component.shadowRoot?.querySelector(".files__paste-btn");
    if (!(pasteBtn instanceof HTMLElement)) {
      throw new Error("Expected Paste button");
    }

    expect(pasteBtn.hasAttribute("hidden")).toBe(false);
    expect(pasteBtn.hasAttribute("disabled")).toBe(false);

    document.body.removeChild(component);
  });

  it("renders more actions toggle before actions container in the DOM to ensure correct tab focus order", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    // Mock orchestrator files to render list items
    (orchestratorStore as any).files = ["test-file.txt"];
    component.updateFileList({} as any);

    const list = component.shadowRoot?.querySelector(".files__list");
    const item = list?.querySelector(".files__item");
    expect(item).toBeDefined();

    // Find indices of toggle button and actions container in parent children list
    const children = Array.from(item!.children);
    const toggleIndex = children.findIndex((el) =>
      el.classList.contains("files__actions-toggle"),
    );
    const actionsIndex = children.findIndex((el) =>
      el.classList.contains("files__actions"),
    );

    expect(toggleIndex).toBeGreaterThan(-1);
    expect(actionsIndex).toBeGreaterThan(-1);
    // Toggle button MUST come before actions container for correct tab focus flow
    expect(toggleIndex).toBeLessThan(actionsIndex);

    document.body.removeChild(component);
  });

  it("opens paste confirmation dialog and triggers handlePasteEntry on submit for copy type", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    filesUiStore.setClipboard("test-file.txt", "copy", false, "default");

    const pasteDialog = component.shadowRoot?.querySelector(
      ".files__paste-dialog",
    );
    const pasteMsg = component.shadowRoot?.querySelector(
      ".files__paste-message",
    );

    if (!(pasteDialog as any)) {
      throw new Error("Expected paste dialog");
    }

    // Stub native showModal on mock dialog
    (pasteDialog as any).showModal = jest.fn();
    (pasteDialog as any).close = jest.fn();

    component.openPasteDialog();

    expect((pasteDialog as any).showModal).toHaveBeenCalled();
    expect(pasteMsg?.textContent).toContain(
      'Are you sure you want to copy "test-file.txt"',
    );

    // Trigger form submit or handlePasteEntry
    await component.handlePasteEntry({} as any, false);

    expect(copyGroupEntry).toHaveBeenCalledWith(
      {} as any,
      "default",
      "default",
      "test-file.txt",
      "test-file.txt",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      'Copied "test-file.txt" successfully',
      3000,
    );
    expect((pasteDialog as any).close).toHaveBeenCalled();

    document.body.removeChild(component);
  });

  it("opens paste confirmation dialog and triggers handlePasteEntry on submit for cut type", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    filesUiStore.setClipboard("test-folder/", "cut", true, "default");

    const pasteDialog = component.shadowRoot?.querySelector(
      ".files__paste-dialog",
    );
    const pasteMsg = component.shadowRoot?.querySelector(
      ".files__paste-message",
    );

    if (!(pasteDialog as any)) {
      throw new Error("Expected paste dialog");
    }

    // Stub native showModal on mock dialog
    (pasteDialog as any).showModal = jest.fn();
    (pasteDialog as any).close = jest.fn();

    component.openPasteDialog();

    expect((pasteDialog as any).showModal).toHaveBeenCalled();
    expect(pasteMsg?.textContent).toContain(
      'Are you sure you want to move "test-folder"',
    );

    // Trigger form submit or handlePasteEntry
    await component.handlePasteEntry({} as any, false);

    expect(moveGroupEntry).toHaveBeenCalledWith(
      {} as any,
      "default",
      "default",
      "test-folder/",
      "test-folder/",
    );
    expect(showSuccess).toHaveBeenCalledWith(
      'Moved "test-folder" successfully',
      3000,
    );
    expect(filesUiStore.clipboard).toBeNull();
    expect((pasteDialog as any).close).toHaveBeenCalled();

    document.body.removeChild(component);
  });

  it("disables dialog buttons during Paste execution", async () => {
    let resolvePaste: (() => void) | undefined;
    (copyGroupEntry as any).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePaste = resolve;
        }),
    );

    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    filesUiStore.setClipboard("test.txt", "copy", false, "default");

    const cancelBtn = component.shadowRoot?.querySelector(
      ".files__paste-cancel",
    );
    const okBtn = component.shadowRoot?.querySelector(".files__paste-ok");

    if (
      !(cancelBtn instanceof HTMLButtonElement) ||
      !(okBtn instanceof HTMLButtonElement)
    ) {
      throw new Error("Expected paste action buttons");
    }

    const pending = component.handlePasteEntry({} as any, false);

    expect(cancelBtn.disabled).toBe(true);
    expect(okBtn.disabled).toBe(true);

    resolvePaste?.();
    await pending;

    expect(cancelBtn.disabled).toBe(false);
    expect(okBtn.disabled).toBe(false);

    document.body.removeChild(component);
  });

  it("does not open paste dialog when target folder is the clipboard source folder", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (orchestratorStore as any).currentPath = "project";
    filesUiStore.setClipboard("project/", "copy", true, "default");

    const pasteDialog = component.shadowRoot?.querySelector(
      ".files__paste-dialog",
    );

    if (!(pasteDialog as any)) {
      throw new Error("Expected paste dialog");
    }

    (pasteDialog as any).showModal = jest.fn();

    component.openPasteDialog();

    expect((pasteDialog as any).showModal).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Cannot paste a folder into itself or one of its subfolders",
      4500,
    );

    document.body.removeChild(component);
  });

  it("blocks paste execution when target folder is inside source folder", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (orchestratorStore as any).currentPath = "project/nested";
    filesUiStore.setClipboard("project/", "cut", true, "default");

    await component.handlePasteEntry({} as any, false);

    expect(moveGroupEntry).not.toHaveBeenCalled();
    expect(copyGroupEntry).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledWith(
      "Cannot paste a folder into itself or one of its subfolders",
      4500,
    );

    document.body.removeChild(component);
  });
});
