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

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ulid"),
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
    loadFiles: jest.fn<any>().mockResolvedValue(undefined),
    db: {},
    triggerFilesRefresh: jest.fn(),
    orchestrator: {
      vmStatus: {
        ready: false,
        booting: false,
        bootAttempted: false,
        error: null,
        mode: null,
      },
      events: { on: jest.fn(), off: jest.fn() },
    },
  },
}));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

const { CONFIG_KEYS } = await import("../../config/config.js");
const { getConfig } = await import("../../db/getConfig.js");
const { uploadGroupFile } = await import("../../storage/uploadGroupFile.js");
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
    (writeGroupFile as any).mockResolvedValue(undefined);
    (createGroupDirectory as any).mockResolvedValue(undefined);
    (renameGroupEntry as any).mockResolvedValue(undefined);
    (copyGroupEntry as any).mockResolvedValue(undefined);
    (moveGroupEntry as any).mockResolvedValue(undefined);
    (uploadGroupFile as any).mockResolvedValue(undefined);
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

    expect(template).toContain("files__upload-conflict-dialog");

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

    (orchestratorStore.orchestrator as any).vmStatus = {
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
      mode: "ext2",
    };

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

    (orchestratorStore.orchestrator as any).vmStatus = {
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
      mode: "9p",
    };

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

  it("uploads files without ULID prefix by default", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (getConfig as any).mockResolvedValue(undefined);
    (orchestratorStore as any).currentPath = ".";
    (orchestratorStore as any).files = [];

    const file = new File(["content"], "document.pdf", {
      type: "application/pdf",
    });
    await component.uploadFileList({} as any, [file]);

    expect(uploadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "document.pdf",
      file,
    );
    expect(showSuccess).toHaveBeenCalledWith("Uploaded 1 file", 3000);

    document.body.removeChild(component);
  });

  it("uploads files with ULID prefix when setting is enabled", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (getConfig as any).mockImplementation((_db: any, key: string) => {
      if (key === CONFIG_KEYS.FILES_UPLOAD_APPEND_ULID) {
        return Promise.resolve("true");
      }
      return Promise.resolve(undefined);
    });
    (orchestratorStore as any).currentPath = "subfolder";
    (orchestratorStore as any).files = [];

    const file = new File(["content"], "image.png", {
      type: "image/png",
    });
    await component.uploadFileList({} as any, [file]);

    expect(uploadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "subfolder/mock-ulid-image.png",
      file,
    );
    expect(showSuccess).toHaveBeenCalledWith("Uploaded 1 file", 3000);

    document.body.removeChild(component);
  });

  it("prompts conflict dialog and overwrites existing file when selected", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (getConfig as any).mockResolvedValue(undefined);
    (orchestratorStore as any).currentPath = ".";
    (orchestratorStore as any).files = ["existing.txt"];
    (orchestratorStore as any).pages = [
      { groupId: "default", path: "existing.txt" },
    ];

    jest.spyOn(component, "promptUploadConflict").mockResolvedValue({
      action: "overwrite",
    });

    const file = new File(["new content"], "existing.txt", {
      type: "text/plain",
    });
    await component.uploadFileList({} as any, [file]);

    expect(component.promptUploadConflict).toHaveBeenCalledWith(
      "existing.txt",
      expect.any(Set),
    );
    expect(mockRemovePage).toHaveBeenCalledWith(
      {} as any,
      "existing.txt",
      "default",
    );
    expect(uploadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "existing.txt",
      file,
    );
    expect(showSuccess).toHaveBeenCalledWith("Uploaded 1 file", 3000);

    document.body.removeChild(component);
  });

  it("prompts conflict dialog and renames file when new name is chosen", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (getConfig as any).mockResolvedValue(undefined);
    (orchestratorStore as any).currentPath = "docs";
    (orchestratorStore as any).files = ["existing.txt"];

    jest.spyOn(component, "promptUploadConflict").mockResolvedValue({
      action: "rename",
      name: "existing-renamed.txt",
    });

    const file = new File(["content"], "existing.txt", {
      type: "text/plain",
    });
    await component.uploadFileList({} as any, [file]);

    expect(component.promptUploadConflict).toHaveBeenCalledWith(
      "existing.txt",
      expect.any(Set),
    );
    expect(uploadGroupFile).toHaveBeenCalledWith(
      {} as any,
      "default",
      "docs/existing-renamed.txt",
      file,
    );
    expect(showSuccess).toHaveBeenCalledWith("Uploaded 1 file", 3000);

    document.body.removeChild(component);
  });

  it("prompts conflict dialog and skips upload when user cancels", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    (getConfig as any).mockResolvedValue(undefined);
    (orchestratorStore as any).currentPath = ".";
    (orchestratorStore as any).files = ["existing.txt"];

    jest.spyOn(component, "promptUploadConflict").mockResolvedValue(null);

    const file = new File(["content"], "existing.txt", {
      type: "text/plain",
    });
    await component.uploadFileList({} as any, [file]);

    expect(component.promptUploadConflict).toHaveBeenCalledWith(
      "existing.txt",
      expect.any(Set),
    );
    expect(uploadGroupFile).not.toHaveBeenCalled();

    document.body.removeChild(component);
  });

  it("handles conflict dialog UI submission and validation", async () => {
    const component = new ShadowClawFiles();
    document.body.appendChild(component);
    await component.render();

    const existingNames = new Set(["existing.txt", "taken.txt"]);
    const conflictPromise = component.promptUploadConflict(
      "existing.txt",
      existingNames,
    );

    const input = component.shadowRoot?.querySelector(
      ".files__upload-conflict-rename-input",
    ) as HTMLInputElement;
    const form = component.shadowRoot?.querySelector(
      ".files__upload-conflict-form",
    ) as HTMLFormElement;

    expect(input.value).toBe("existing.txt");

    // 1. Try empty name
    input.value = "   ";
    form.dispatchEvent(new Event("submit"));
    expect(showWarning).toHaveBeenCalledWith("Please enter a name", 3000);

    // 2. Try path name
    input.value = "folder/name.txt";
    form.dispatchEvent(new Event("submit"));
    expect(showWarning).toHaveBeenCalledWith(
      "Use only a name, not a path",
      3500,
    );

    // 3. Try already taken name
    input.value = "taken.txt";
    form.dispatchEvent(new Event("submit"));
    expect(showWarning).toHaveBeenCalledWith(
      '"taken.txt" already exists. Please choose a different name.',
      4000,
    );

    // 4. Valid new name
    input.value = "brand-new.txt";
    form.dispatchEvent(new Event("submit"));

    const result = await conflictPromise;
    expect(result).toEqual({ action: "rename", name: "brand-new.txt" });

    document.body.removeChild(component);
  });

  describe("files component helpers and operations", () => {
    it("escapes html text", () => {
      const component = new ShadowClawFiles();
      expect(component.escapeHtml("<tag>")).toBe("&lt;tag&gt;");
    });

    it("identifies page candidate files correctly", () => {
      const component = new ShadowClawFiles();
      expect(component.isPageCandidateFile("index.md", false)).toBe(true);
      expect(component.isPageCandidateFile("index.html", false)).toBe(true);
      expect(component.isPageCandidateFile("index.htm", false)).toBe(true);
      expect(component.isPageCandidateFile("index.xhtml", false)).toBe(true);
      expect(component.isPageCandidateFile("index.markdown", false)).toBe(true);
      expect(component.isPageCandidateFile("script.js", false)).toBe(false);
      expect(component.isPageCandidateFile("folder.md", true)).toBe(false);
    });

    it("detects invalid folder paste targets", () => {
      const component = new ShadowClawFiles();
      expect(
        component.isInvalidFolderPasteTarget(
          { sourcePath: "docs", isDirectory: false },
          "docs/sub",
        ),
      ).toBe(false);
      expect(
        component.isInvalidFolderPasteTarget(
          { sourcePath: "docs", isDirectory: true },
          ".",
        ),
      ).toBe(false);
      expect(
        component.isInvalidFolderPasteTarget(
          { sourcePath: "docs", isDirectory: true },
          "docs",
        ),
      ).toBe(true);
      expect(
        component.isInvalidFolderPasteTarget(
          { sourcePath: "docs", isDirectory: true },
          "docs/nested",
        ),
      ).toBe(true);
      expect(
        component.isInvalidFolderPasteTarget(
          { sourcePath: "docs", isDirectory: true },
          "other-dir",
        ),
      ).toBe(false);
    });

    it("detects drag files in DragEvent", () => {
      const component = new ShadowClawFiles();
      expect(component.hasDragFiles({ dataTransfer: null } as any)).toBe(false);
      expect(
        component.hasDragFiles({
          dataTransfer: { types: ["text/plain"] },
        } as any),
      ).toBe(false);
      expect(
        component.hasDragFiles({ dataTransfer: { types: ["Files"] } } as any),
      ).toBe(true);
    });

    it("handles syncHostToVM action", () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);

      const button = document.createElement("button");
      button.className = "files__sync-host-btn";
      component.shadowRoot?.appendChild(button);

      (orchestratorStore as any).syncHostWorkspaceToVM = jest.fn();

      component.handleSyncHostToVM();

      expect(
        (orchestratorStore as any).syncHostWorkspaceToVM,
      ).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith(
        "Requested host → VM workspace sync",
        2200,
      );

      document.body.removeChild(component);
    });

    it("handles syncVMToHost action", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);

      const button = document.createElement("button");
      button.className = "files__sync-vm-btn";
      component.shadowRoot?.appendChild(button);

      (orchestratorStore as any).syncVMWorkspaceToHost = jest.fn();

      await component.handleSyncVMToHost({} as any);

      expect(
        (orchestratorStore as any).syncVMWorkspaceToHost,
      ).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith(
        "Requested VM → host workspace sync",
        2200,
      );

      document.body.removeChild(component);
    });

    it("handles backup (download all zip) and clear all files", async () => {
      const component = new ShadowClawFiles();
      const db = {} as any;

      const { downloadAllGroupFilesAsZip } =
        await import("../../storage/downloadAllGroupFilesAsZip.js");
      const { deleteAllGroupFiles } =
        await import("../../storage/deleteAllGroupFiles.js");

      // 1. Backup
      await component.handleBackup(db);
      expect(downloadAllGroupFilesAsZip).toHaveBeenCalledWith(db, "default");
      expect(showSuccess).toHaveBeenCalledWith(
        "Backup created successfully",
        3000,
      );

      // 2. Clear all
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      (orchestratorStore as any).resetToRootFolder = jest.fn();

      await component.handleClearAll(db);
      expect(deleteAllGroupFiles).toHaveBeenCalledWith(db, "default");
      expect(showSuccess).toHaveBeenCalledWith("All files deleted", 3500);
    });

    it("handles create new file and folder flows with validation", async () => {
      const component = new ShadowClawFiles() as any;
      document.body.appendChild(component);
      const db = {} as any;

      const { writeGroupFile } =
        await import("../../storage/writeGroupFile.js");
      const { createGroupDirectory } =
        await import("../../storage/createGroupDirectory.js");

      const dialog = component.shadowRoot?.querySelector(".files__new-dialog");
      if (dialog) (dialog as any).close = jest.fn();

      const input = component.shadowRoot?.querySelector(
        ".files__new-input",
      ) as HTMLInputElement;
      const isFolderInput = component.shadowRoot?.querySelector(
        ".files__new-is-folder",
      ) as HTMLInputElement;

      // 1. Validation: empty name
      if (input) input.value = "";
      await component.handleCreateNewFile(db);
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a file name",
        3000,
      );

      // 2. Validation: slashes in name
      if (input) input.value = "folder/file.txt";
      await component.handleCreateNewFile(db);
      expect(showWarning).toHaveBeenCalledWith(
        "Use only a file name, not a path",
        3500,
      );

      // 3. Create file successfully
      if (input) input.value = "test.txt";
      if (isFolderInput) isFolderInput.checked = false;
      await component.handleCreateNewFile(db);
      expect(writeGroupFile).toHaveBeenCalledWith(
        db,
        "default",
        "test.txt",
        "",
      );
      expect(showSuccess).toHaveBeenCalledWith("Created file: test.txt", 3000);

      // 4. Create folder successfully
      if (input) input.value = "docs";
      if (isFolderInput) isFolderInput.checked = true;
      await component.handleCreateNewFile(db);
      expect(createGroupDirectory).toHaveBeenCalledWith(db, "default", "docs");
      expect(showSuccess).toHaveBeenCalledWith("Created folder: docs", 3000);

      document.body.removeChild(component);
    });

    it("handles rename entry flow for files and folders", async () => {
      const component = new ShadowClawFiles() as any;
      document.body.appendChild(component);
      const db = {} as any;

      const { renameGroupEntry } =
        await import("../../storage/renameGroupEntry.js");

      const dialog = component.shadowRoot?.querySelector(
        ".files__rename-dialog",
      );
      if (dialog) (dialog as any).close = jest.fn();

      const input = component.shadowRoot?.querySelector(
        ".files__rename-input",
      ) as HTMLInputElement;

      component._pendingRenamePath = "old.txt";
      component._pendingRenameName = "old.txt";
      component._pendingRenameIsDirectory = false;

      // 1. Validation: empty name
      if (input) input.value = "";
      await component.handleRenameEntry(db);
      expect(showWarning).toHaveBeenCalledWith("Please enter a name", 3000);

      // 2. Validation: path with slashes
      if (input) input.value = "sub/new.txt";
      await component.handleRenameEntry(db);
      expect(showWarning).toHaveBeenCalledWith(
        "Use only a name, not a path",
        3500,
      );

      // 3. Same name closes dialog without calling renameGroupEntry
      if (input) input.value = "old.txt";
      await component.handleRenameEntry(db);
      expect(renameGroupEntry).not.toHaveBeenCalled();

      // 4. Successful file rename
      component._pendingRenamePath = "old.txt";
      component._pendingRenameName = "old.txt";
      component._pendingRenameIsDirectory = false;
      if (input) input.value = "new.txt";
      await component.handleRenameEntry(db);
      expect(renameGroupEntry).toHaveBeenCalledWith(
        db,
        "default",
        "old.txt",
        "new.txt",
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Renamed file: old.txt -> new.txt",
        3200,
      );

      // 5. Successful folder rename
      component._pendingRenamePath = "old-folder";
      component._pendingRenameName = "old-folder";
      component._pendingRenameIsDirectory = true;
      if (input) input.value = "new-folder";
      await component.handleRenameEntry(db);
      expect(renameGroupEntry).toHaveBeenCalledWith(
        db,
        "default",
        "old-folder",
        "new-folder",
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Renamed folder: old-folder -> new-folder",
        3200,
      );

      document.body.removeChild(component);
    });

    it("handles restore and upload file actions", async () => {
      const component = new ShadowClawFiles() as any;
      document.body.appendChild(component);
      const db = {} as any;

      const { restoreAllGroupFilesFromZip } =
        await import("../../storage/restoreAllGroupFilesFromZip.js");
      const { uploadGroupFile } =
        await import("../../storage/uploadGroupFile.js");

      // 1. Restore non-zip warning
      const nonZipInput = {
        files: [{ name: "test.txt" }],
        value: "test.txt",
      } as any;
      await component.handleRestore(db, nonZipInput);
      expect(showWarning).toHaveBeenCalledWith(
        "Please select a .zip file",
        3500,
      );

      // 2. Restore cancelled confirmation
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(false);
      const zipFile = new File(["zipcontent"], "backup.zip", {
        type: "application/zip",
      });
      const zipInput = {
        files: [zipFile],
        value: "backup.zip",
      } as any;
      await component.handleRestore(db, zipInput);
      expect(restoreAllGroupFilesFromZip).not.toHaveBeenCalled();

      // 3. Restore confirmed
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      await component.handleRestore(db, zipInput);
      expect(restoreAllGroupFilesFromZip).toHaveBeenCalledWith(
        db,
        "default",
        zipFile,
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Files restored successfully",
        3500,
      );

      // 4. Upload file
      const uploadFile = new File(["content"], "upload.txt", {
        type: "text/plain",
      });
      const uploadInput = {
        files: [uploadFile],
        value: "upload.txt",
      } as any;
      await component.handleUpload(db, uploadInput);
      expect(uploadGroupFile).toHaveBeenCalledWith(
        db,
        "default",
        "upload.txt",
        uploadFile,
      );
      expect(showSuccess).toHaveBeenCalledWith("Uploaded 1 file", 3000);

      // 5. handleSyncVMToHost
      const syncBtn = document.createElement("button");
      syncBtn.className = "files__sync-vm-btn";
      component.shadowRoot?.appendChild(syncBtn);
      await component.handleSyncVMToHost(db);
      expect(orchestratorStore.syncVMWorkspaceToHost).toHaveBeenCalled();

      // 6. handleRenameEntry
      const { renameGroupEntry } =
        await import("../../storage/renameGroupEntry.js");
      component._pendingRenamePath = "docs/old.txt";
      component._pendingRenameName = "old.txt";

      const renameInput = component.shadowRoot?.querySelector(
        ".files__rename-input",
      ) as HTMLInputElement;
      if (renameInput) renameInput.value = "new.txt";

      await component.handleRenameEntry(db);
      expect(renameGroupEntry).toHaveBeenCalledWith(
        db,
        "default",
        "docs/old.txt",
        "new.txt",
      );

      // 7. updateBreadcrumbs
      (orchestratorStore as any).currentPath = "docs/guides";
      let breadcrumbsContainer = component.shadowRoot?.querySelector(
        "[data-breadcrumb-path]",
      );
      if (!breadcrumbsContainer) {
        breadcrumbsContainer = document.createElement("div");
        breadcrumbsContainer.setAttribute("data-breadcrumb-path", "");
        component.shadowRoot?.appendChild(breadcrumbsContainer);
      }
      component.updateBreadcrumbs(db);

      const breadcrumbButtons = breadcrumbsContainer.querySelectorAll(
        ".files__breadcrumb-btn",
      );
      expect(breadcrumbButtons.length).toBeGreaterThan(0);
      // Click root
      (breadcrumbButtons[0] as HTMLButtonElement).click();
      expect(orchestratorStore.resetToRootFolder).toHaveBeenCalled();

      // 8. updateFileList
      let listContainer = component.shadowRoot?.querySelector(".files__list");
      if (!listContainer) {
        listContainer = document.createElement("div");
        listContainer.className = "files__list";
        component.shadowRoot?.appendChild(listContainer);
      }
      (orchestratorStore as any).files = ["readme.md", "src/"];
      component.updateFileList(db);
      expect(listContainer.children.length).toBe(2);

      // empty files
      (orchestratorStore as any).files = [];
      component.updateFileList(db);
      expect(
        listContainer.querySelector("shadow-claw-empty-state"),
      ).not.toBeNull();

      document.body.removeChild(component);
    });
  });
});
