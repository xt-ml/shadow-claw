import { jest } from "@jest/globals";

const mockAddPage = jest.fn();
const mockRemovePage = jest.fn();
const mockSendFileToPeer = jest.fn<any>().mockResolvedValue(undefined);

jest.unstable_mockModule("../../storage/delete-all-group-files.js", () => ({
  deleteAllGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../../storage/delete-group-directory.js", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../../storage/delete-group-file.js", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule(
  "../../storage/download-all-group-files-as-zip.js",
  () => ({
    downloadAllGroupFilesAsZip: jest.fn(),
  }),
);

jest.unstable_mockModule(
  "../../storage/download-group-directory-as-zip.js",
  () => ({
    downloadGroupDirectoryAsZip: jest.fn(),
  }),
);

jest.unstable_mockModule("../../storage/download-group-file.js", () => ({
  downloadGroupFile: jest.fn(),
}));

jest.unstable_mockModule(
  "../../storage/restore-all-group-files-from-zip.js",
  () => ({
    restoreAllGroupFilesFromZip: jest.fn(),
  }),
);

jest.unstable_mockModule("../../storage/upload-group-file.js", () => ({
  uploadGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../db/get-config.js", () => ({
  getConfig: jest.fn<any>().mockResolvedValue(undefined),
}));

jest.unstable_mockModule("../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ulid"),
}));

jest.unstable_mockModule("../../storage/write-group-file.js", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/create-group-directory.js", () => ({
  createGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../../storage/rename-group-entry.js", () => ({
  renameGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../storage/copy-group-entry.js", () => ({
  copyGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../storage/move-group-entry.js", () => ({
  moveGroupEntry: jest.fn(),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((cb: any) => {
    try {
      const cleanup = cb();
      return () => {
        if (typeof cleanup === "function") cleanup();
      };
    } catch {
      return () => {};
    }
  }),
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
    sendFileToPeer: mockSendFileToPeer,
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
const { getConfig } = await import("../../db/get-config.js");
const { uploadGroupFile } = await import("../../storage/upload-group-file.js");
const { ShadowClawFiles } = await import("./shadow-claw-files.js");
const { deleteGroupFile } = await import("../../storage/delete-group-file.js");
const { renameGroupEntry } =
  await import("../../storage/rename-group-entry.js");
const { writeGroupFile } = await import("../../storage/write-group-file.js");
const { createGroupDirectory } =
  await import("../../storage/create-group-directory.js");
const { copyGroupEntry } = await import("../../storage/copy-group-entry.js");
const { moveGroupEntry } = await import("../../storage/move-group-entry.js");
const { showSuccess, showWarning, showError } =
  await import("../../ui/toast.js");
const { downloadGroupDirectoryAsZip } =
  await import("../../storage/download-group-directory-as-zip.js");
const { downloadGroupFile } =
  await import("../../storage/download-group-file.js");
const { deleteGroupDirectory } =
  await import("../../storage/delete-group-directory.js");
const { downloadAllGroupFilesAsZip } =
  await import("../../storage/download-all-group-files-as-zip.js");
const { deleteAllGroupFiles } =
  await import("../../storage/delete-all-group-files.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { restoreAllGroupFilesFromZip } =
  await import("../../storage/restore-all-group-files-from-zip.js");
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
        await import("../../storage/download-all-group-files-as-zip.js");
      const { deleteAllGroupFiles } =
        await import("../../storage/delete-all-group-files.js");

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
        await import("../../storage/write-group-file.js");
      const { createGroupDirectory } =
        await import("../../storage/create-group-directory.js");

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
        await import("../../storage/rename-group-entry.js");

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
        await import("../../storage/restore-all-group-files-from-zip.js");
      const { uploadGroupFile } =
        await import("../../storage/upload-group-file.js");

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
        await import("../../storage/rename-group-entry.js");
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

  describe("peer file sharing actions", () => {
    it("does not render send-peer action button when in default/main group", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "main";
      (orchestratorStore as any).files = ["notes.txt"];
      component.updateFileList({} as any);

      const sendPeerBtn =
        component.shadowRoot?.querySelector(".files__send-peer");
      expect(sendPeerBtn).toBeNull();

      document.body.removeChild(component);
    });

    it("renders send-peer action button for files in a peer: conversation and invokes sendFileToPeer on click", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "peer:peer-123";
      (orchestratorStore as any).currentPath = ".";
      (orchestratorStore as any).files = ["shared-doc.pdf", "subfolder/"];
      component.updateFileList({} as any);

      const items = component.shadowRoot?.querySelectorAll(".files__item");
      expect(items?.length).toBe(2);

      // File item: should have send-peer button with "Send to peer"
      const fileItem = items?.[0];
      const sendPeerBtn = fileItem?.querySelector(".files__send-peer");
      expect(sendPeerBtn).not.toBeNull();
      expect(sendPeerBtn?.getAttribute("title")).toBe("Send to peer");

      // Folder item: should NOT have send-peer button
      const folderItem = items?.[1];
      expect(folderItem?.querySelector(".files__send-peer")).toBeNull();

      // Click the send to peer button
      (sendPeerBtn as HTMLButtonElement).click();
      expect(mockSendFileToPeer).toHaveBeenCalledWith("shared-doc.pdf");

      document.body.removeChild(component);
    });

    it("renders send-peer action button with 'Send to room peers' for files in a room: conversation", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "room:room-456";
      (orchestratorStore as any).currentPath = "docs";
      (orchestratorStore as any).files = ["guide.md"];
      component.updateFileList({} as any);

      const sendPeerBtn =
        component.shadowRoot?.querySelector(".files__send-peer");
      expect(sendPeerBtn).not.toBeNull();
      expect(sendPeerBtn?.getAttribute("title")).toBe("Send to room peers");

      (sendPeerBtn as HTMLButtonElement).click();
      expect(mockSendFileToPeer).toHaveBeenCalledWith("docs/guide.md");

      document.body.removeChild(component);
    });
  });

  describe("drag and drop handling", () => {
    it("handles drag enter, over, leave, and drop events", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const content = component.shadowRoot?.querySelector(
        ".files__content",
      ) as HTMLElement;

      // Drag enter without files does nothing
      const noFilesDragEvent = {
        dataTransfer: { types: ["text/plain"] },
        preventDefault: jest.fn(),
      } as any;
      component.handleDragEnter(noFilesDragEvent, content);
      expect(filesUiStore.isDragActive).toBe(false);

      // Drag enter with Files
      const filesDragEvent = {
        dataTransfer: { types: ["Files"] },
        preventDefault: jest.fn(),
      } as any;
      component.handleDragEnter(filesDragEvent, content);
      expect(filesUiStore.isDragActive).toBe(true);

      // Drag over sets dropEffect
      const dragOverEvent = {
        dataTransfer: { types: ["Files"], dropEffect: "" },
        preventDefault: jest.fn(),
      } as any;
      component.handleDragOver(dragOverEvent, content);
      expect(dragOverEvent.dataTransfer.dropEffect).toBe("copy");

      // Drag leave outside content
      const dragLeaveEvent = {
        relatedTarget: document.body,
      } as any;
      component.handleDragLeave(dragLeaveEvent, content);
      expect(filesUiStore.isDragActive).toBe(false);

      // Handle drop with files
      const dropUploadSpy = jest
        .spyOn(component, "uploadFileList")
        .mockResolvedValue(undefined as any);
      const mockFile = new File(["test content"], "dropped.txt", {
        type: "text/plain",
      });
      const dropEvent = {
        dataTransfer: { types: ["Files"], files: [mockFile] },
        preventDefault: jest.fn(),
      } as any;
      await component.handleDrop(dropEvent, {} as any, content);
      expect(dropUploadSpy).toHaveBeenCalledWith({}, [mockFile]);

      document.body.removeChild(component);
    });
  });

  describe("sync host to VM handling", () => {
    it("handles sync host to VM success and error", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).syncHostWorkspaceToVM = jest.fn();
      component.handleSyncHostToVM();
      expect(orchestratorStore.syncHostWorkspaceToVM).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Requested host"),
        expect.any(Number),
      );

      (orchestratorStore as any).syncHostWorkspaceToVM = jest.fn(() => {
        throw new Error("VM not running");
      });
      component.handleSyncHostToVM();
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to request host → VM sync: VM not running",
        ),
        expect.any(Number),
      );

      document.body.removeChild(component);
    });
  });

  describe("dialog cancellation and cancel buttons", () => {
    it("handles cancel events and cancel buttons respecting busy flags", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const newDialog = component.shadowRoot?.querySelector(
        ".files__new-dialog",
      ) as HTMLDialogElement;
      const newCancelBtn = component.shadowRoot?.querySelector(
        ".files__new-cancel",
      ) as HTMLButtonElement;
      const renameDialog = component.shadowRoot?.querySelector(
        ".files__rename-dialog",
      ) as HTMLDialogElement;
      const renameCancelBtn = component.shadowRoot?.querySelector(
        ".files__rename-cancel",
      ) as HTMLButtonElement;
      const pasteDialog = component.shadowRoot?.querySelector(
        ".files__paste-dialog",
      ) as HTMLDialogElement;
      const pasteCancelBtn = component.shadowRoot?.querySelector(
        ".files__paste-cancel",
      ) as HTMLButtonElement;

      // newDialog cancel event when busy vs not busy
      const cancelEvt1 = new Event("cancel", { cancelable: true });
      (component as any)._isCreatingNewItem = true;
      newDialog.dispatchEvent(cancelEvt1);
      expect(cancelEvt1.defaultPrevented).toBe(true);

      (component as any)._isCreatingNewItem = true;
      newCancelBtn.click(); // does not close

      (component as any)._isCreatingNewItem = false;
      newCancelBtn.click(); // closes

      // renameDialog cancel event when busy vs not busy
      const cancelEvt2 = new Event("cancel", { cancelable: true });
      (component as any)._isRenamingEntry = true;
      renameDialog.dispatchEvent(cancelEvt2);
      expect(cancelEvt2.defaultPrevented).toBe(true);

      (component as any)._isRenamingEntry = true;
      renameCancelBtn.click();

      (component as any)._isRenamingEntry = false;
      renameCancelBtn.click();

      // pasteDialog cancel event when busy vs not busy
      const cancelEvt3 = new Event("cancel", { cancelable: true });
      (component as any)._isPastingEntry = true;
      pasteDialog.dispatchEvent(cancelEvt3);
      expect(cancelEvt3.defaultPrevented).toBe(true);

      (component as any)._isPastingEntry = true;
      pasteCancelBtn.click();

      (component as any)._isPastingEntry = false;
      pasteCancelBtn.click();

      document.body.removeChild(component);
    });
  });

  describe("paste dialog edge cases and validations", () => {
    it("handles openPasteDialog edge cases", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      // No clipboard
      filesUiStore.clearClipboard();
      component.openPasteDialog();
      expect(showWarning).toHaveBeenCalledWith(
        "Nothing in clipboard to paste",
        expect.any(Number),
      );

      // Invalid folder paste target
      (orchestratorStore as any).currentPath = "my-folder/sub";
      filesUiStore.setClipboard("my-folder/", "copy", true, "default");
      component.openPasteDialog();
      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("Cannot paste a folder into itself"),
        expect.any(Number),
      );

      // Already exists case in openPasteDialog
      (orchestratorStore as any).currentPath = ".";
      (orchestratorStore as any).files = ["file.txt"];
      filesUiStore.setClipboard("file.txt", "copy", false, "default");
      component.openPasteDialog();
      const msg = component.shadowRoot?.querySelector(
        ".files__paste-message",
      )?.textContent;
      expect(msg).toContain("already exists");

      document.body.removeChild(component);
    });

    it("handles handlePasteEntry validation and overwrite branches", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;

      // When already pasting
      (component as any)._isPastingEntry = true;
      await component.handlePasteEntry(db, false);
      (component as any)._isPastingEntry = false;

      // When clipboard is null
      filesUiStore.clearClipboard();
      await component.handlePasteEntry(db, false);

      // Invalid folder paste target
      (orchestratorStore as any).currentPath = "target-folder/sub";
      filesUiStore.setClipboard("target-folder/", "copy", true, "default");
      await component.handlePasteEntry(db, false);
      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("Cannot paste a folder into itself"),
        expect.any(Number),
      );

      // Rename input empty
      (orchestratorStore as any).currentPath = ".";
      (orchestratorStore as any).files = ["test.txt"];
      filesUiStore.setClipboard("test.txt", "copy", false, "default");
      component.openPasteDialog();
      const renameInput = component.shadowRoot?.querySelector(
        ".files__paste-rename-input",
      ) as HTMLInputElement;
      renameInput.value = "   ";
      await component.handlePasteEntry(db, false);
      expect(showWarning).toHaveBeenCalledWith(
        "Please enter a name",
        expect.any(Number),
      );

      // Rename input contains slash
      renameInput.value = "invalid/name";
      await component.handlePasteEntry(db, false);
      expect(showWarning).toHaveBeenCalledWith(
        "Use only a name, not a path",
        expect.any(Number),
      );

      // Target already exists and not overwrite
      renameInput.value = "test.txt";
      await component.handlePasteEntry(db, false);
      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("already exists"),
        expect.any(Number),
      );

      // Overwrite folder
      filesUiStore.setClipboard("old-dir/", "copy", true, "default");
      (orchestratorStore as any).files = ["old-dir/"];
      (copyGroupEntry as any).mockResolvedValue(undefined);
      await component.handlePasteEntry(db, true);
      expect(deleteGroupDirectory).toHaveBeenCalled();

      // Overwrite file
      filesUiStore.setClipboard("old-file.txt", "copy", false, "default");
      (orchestratorStore as any).files = ["old-file.txt"];
      await component.handlePasteEntry(db, true);
      expect(deleteGroupFile).toHaveBeenCalled();

      document.body.removeChild(component);
    });
  });

  describe("download buttons in file and directory items", () => {
    it("handles file and directory download button clicks", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "default";
      (orchestratorStore as any).currentPath = ".";
      (orchestratorStore as any).files = ["doc.txt", "assets/"];
      component.updateFileList({} as any);

      const items = component.shadowRoot?.querySelectorAll(".files__item");
      const fileDownloadBtn = items?.[0]?.querySelector(
        ".files__download",
      ) as HTMLButtonElement;
      const dirDownloadBtn = items?.[1]?.querySelector(
        ".files__download",
      ) as HTMLButtonElement;

      // File download success
      (downloadGroupFile as any).mockResolvedValue(undefined);
      fileDownloadBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(downloadGroupFile).toHaveBeenCalledWith({}, "default", "doc.txt");
      expect(showSuccess).toHaveBeenCalledWith(
        "Downloaded file: doc.txt",
        2500,
      );

      // Dir download success
      (downloadGroupDirectoryAsZip as any).mockResolvedValue(undefined);
      dirDownloadBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(downloadGroupDirectoryAsZip).toHaveBeenCalledWith(
        {},
        "default",
        "assets/",
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Downloaded folder: assets",
        2500,
      );

      // Download failure
      (downloadGroupFile as any).mockRejectedValueOnce(
        new Error("Network fail"),
      );
      fileDownloadBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      expect(showError).toHaveBeenCalledWith(
        "Failed to download doc.txt: Network fail",
        6000,
      );

      document.body.removeChild(component);
    });
  });

  describe("restore and form events", () => {
    it("handles restore button and form submission events", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const restoreBtn = component.shadowRoot?.querySelector(
        ".files__restore-btn",
      ) as HTMLButtonElement;
      const restoreInput = component.shadowRoot?.querySelector(
        ".files__hidden-restore",
      ) as HTMLInputElement;
      const inputClickSpy = jest.spyOn(restoreInput, "click");
      restoreBtn.click();
      expect(inputClickSpy).toHaveBeenCalled();

      const handleRestoreSpy = jest
        .spyOn(component, "handleRestore")
        .mockImplementation(() => {});
      restoreInput.dispatchEvent(new Event("change"));
      expect(handleRestoreSpy).toHaveBeenCalled();

      // Form submit handlers
      const newForm = component.shadowRoot?.querySelector(".files__new-form");
      const handleCreateSpy = jest
        .spyOn(component, "handleCreateNewFile")
        .mockResolvedValue();
      newForm?.dispatchEvent(new Event("submit", { cancelable: true }));
      expect(handleCreateSpy).toHaveBeenCalled();

      const renameForm = component.shadowRoot?.querySelector(
        ".files__rename-form",
      );
      const handleRenameSpy = jest
        .spyOn(component, "handleRenameEntry")
        .mockResolvedValue();
      renameForm?.dispatchEvent(new Event("submit", { cancelable: true }));
      expect(handleRenameSpy).toHaveBeenCalled();

      const pasteForm =
        component.shadowRoot?.querySelector(".files__paste-form");
      const handlePasteSpy = jest
        .spyOn(component, "handlePasteEntry")
        .mockResolvedValue();
      pasteForm?.dispatchEvent(new Event("submit", { cancelable: true }));
      expect(handlePasteSpy).toHaveBeenCalledWith(expect.anything(), false);

      const pasteOverwriteBtn = component.shadowRoot?.querySelector(
        ".files__paste-overwrite",
      ) as HTMLButtonElement;
      pasteOverwriteBtn.dispatchEvent(
        new MouseEvent("click", { cancelable: true }),
      );
      expect(handlePasteSpy).toHaveBeenCalledWith(expect.anything(), true);

      document.body.removeChild(component);
    });
  });

  describe("additional branch coverage tests", () => {
    it("handles upload button and disabled paste button in bindEventListeners", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const uploadBtn = component.shadowRoot?.querySelector(
        ".files__upload-btn",
      ) as HTMLButtonElement;
      const uploadInput = component.shadowRoot?.querySelector(
        ".files__hidden-upload",
      ) as HTMLInputElement;

      const clickSpy = jest.spyOn(uploadInput, "click");
      uploadBtn.click();
      expect(clickSpy).toHaveBeenCalled();

      const handleUploadSpy = jest
        .spyOn(component, "handleUpload")
        .mockImplementation(async () => {});
      uploadInput.dispatchEvent(new Event("change"));
      expect(handleUploadSpy).toHaveBeenCalled();

      // Disabled paste button does not open paste dialog
      const pasteBtn = component.shadowRoot?.querySelector(
        ".files__paste-btn",
      ) as HTMLButtonElement;
      pasteBtn.setAttribute("disabled", "true");
      const openPasteSpy = jest.spyOn(component, "openPasteDialog");
      pasteBtn.click();
      expect(openPasteSpy).not.toHaveBeenCalled();

      document.body.removeChild(component);
    });

    it("handles drag leave, enter, and drop edge cases", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const content = component.shadowRoot?.querySelector(
        ".files__content",
      ) as HTMLElement;

      // 1. handleDragLeave when isDragActive is false -> early return
      filesUiStore.setDragActive(false);
      component.handleDragLeave({ relatedTarget: null } as any, content);
      expect(filesUiStore.isDragActive).toBe(false);

      // 2. handleDragLeave when relatedTarget is inside content -> remains active
      filesUiStore.setDragActive(true);
      const child = document.createElement("div");
      content.appendChild(child);
      component.handleDragLeave({ relatedTarget: child } as any, content);
      expect(filesUiStore.isDragActive).toBe(true);

      // 3. handleDragEnter with event.dataTransfer missing
      const enterWithoutDt = {
        dataTransfer: null,
        preventDefault: jest.fn(),
      } as any;
      component.handleDragEnter(enterWithoutDt, content);

      // 4. handleDrop without drag files -> early return
      const dropWithoutFiles = {
        dataTransfer: { types: ["text/plain"], files: [] },
        preventDefault: jest.fn(),
      } as any;
      const uploadListSpy = jest.spyOn(component, "uploadFileList");
      await component.handleDrop(dropWithoutFiles, {} as any, content);
      expect(uploadListSpy).not.toHaveBeenCalled();

      // 5. handleDrop with empty dropped array
      const dropWithEmptyFiles = {
        dataTransfer: { types: ["Files"], files: [] },
        preventDefault: jest.fn(),
      } as any;
      await component.handleDrop(dropWithEmptyFiles, {} as any, content);
      expect(uploadListSpy).not.toHaveBeenCalled();

      document.body.removeChild(component);
    });

    it("handles handleSyncVMToHost success and error paths", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      // 1. Invalid button element -> early return
      const mockShadow = document.createElement("div");
      Object.defineProperty(component, "shadowRoot", {
        value: mockShadow,
        configurable: true,
      });
      await component.handleSyncVMToHost({} as any);

      // Restore shadowRoot
      delete (component as any).shadowRoot;
      (orchestratorStore as any).syncVMWorkspaceToHost = jest.fn();
      (orchestratorStore as any).loadFiles = jest
        .fn<any>()
        .mockResolvedValue(undefined);

      // 2. Sync succeeds
      await component.handleSyncVMToHost({} as any);
      expect(orchestratorStore.syncVMWorkspaceToHost).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Requested VM → host workspace sync"),
        expect.any(Number),
      );

      // 3. syncVMWorkspaceToHost throws Error
      (orchestratorStore as any).syncVMWorkspaceToHost = jest.fn(() => {
        throw new Error("VM sync failed");
      });
      await component.handleSyncVMToHost({} as any);
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to request VM → host sync: VM sync failed",
        ),
        expect.any(Number),
      );

      // 4. syncVMWorkspaceToHost throws string error
      (orchestratorStore as any).syncVMWorkspaceToHost = jest.fn(() => {
        throw "String VM fail";
      });
      await component.handleSyncVMToHost({} as any);
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to request VM → host sync: String VM fail",
        ),
        expect.any(Number),
      );

      document.body.removeChild(component);
    });

    it("handles updateBreadcrumbs click navigation and error handling", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).currentPath = "folderA/subB";
      (orchestratorStore as any).resetToRootFolder = jest.fn();
      (orchestratorStore as any).setCurrentPath = jest.fn();
      component.updateBreadcrumbs({} as any);

      const breadcrumbBtns = component.shadowRoot?.querySelectorAll(
        ".files__breadcrumb-btn",
      );
      expect(breadcrumbBtns?.length).toBe(3); // Root, folderA, subB

      // Click root breadcrumb (index === 0)
      (breadcrumbBtns?.[0] as HTMLButtonElement).click();
      expect(orchestratorStore.resetToRootFolder).toHaveBeenCalled();

      // Click folderA breadcrumb (index > 0)
      (breadcrumbBtns?.[1] as HTMLButtonElement).click();
      expect(orchestratorStore.setCurrentPath).toHaveBeenCalledWith(
        expect.anything(),
        "folderA",
      );

      // setCurrentPath throws Error
      (orchestratorStore as any).setCurrentPath = jest
        .fn()
        .mockRejectedValueOnce(new Error("Nav failed"));
      (breadcrumbBtns?.[1] as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to navigate to folder: Nav failed",
        4500,
      );

      // setCurrentPath throws string
      (orchestratorStore as any).setCurrentPath = jest
        .fn()
        .mockRejectedValueOnce("Nav string error");
      (breadcrumbBtns?.[1] as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to navigate to folder: Nav string error",
        4500,
      );

      document.body.removeChild(component);
    });

    it("handles folder click, pages toggle, and delete actions in file list", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).activeGroupId = "default";
      (orchestratorStore as any).currentPath = "root_dir";
      (orchestratorStore as any).files = ["sub_dir/", "preview.html"];
      (orchestratorStore as any).navigateIntoFolder = jest.fn();
      (orchestratorStore as any).addPage = jest.fn();
      (orchestratorStore as any).removePage = jest.fn();
      (orchestratorStore as any).pages = [];

      component.updateFileList({} as any);

      const items = component.shadowRoot?.querySelectorAll(".files__item");
      const folderMain = items?.[0]?.querySelector(
        ".files__item-main",
      ) as HTMLElement;

      // Click on folder in subpath
      folderMain.click();
      expect(orchestratorStore.navigateIntoFolder).toHaveBeenCalledWith(
        expect.anything(),
        "sub_dir/",
      );

      // Add page toggle button click
      const pageToggleBtn = items?.[1]?.querySelector(
        ".files__page-toggle",
      ) as HTMLButtonElement;
      pageToggleBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(orchestratorStore.addPage).toHaveBeenCalledWith(
        expect.anything(),
        "root_dir/preview.html",
        "default",
      );

      // Remove page toggle button click when isSavedPage is true
      (orchestratorStore as any).pages = [
        { groupId: "default", path: "root_dir/preview.html" },
      ];
      component.updateFileList({} as any);
      const items2 = component.shadowRoot?.querySelectorAll(".files__item");
      const pageToggleBtn2 = items2?.[1]?.querySelector(
        ".files__page-toggle",
      ) as HTMLButtonElement;
      pageToggleBtn2.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(orchestratorStore.removePage).toHaveBeenCalledWith(
        expect.anything(),
        "root_dir/preview.html",
        "default",
      );

      // Page toggle error
      (orchestratorStore as any).removePage = jest
        .fn()
        .mockRejectedValueOnce(new Error("Page remove error"));
      pageToggleBtn2.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to update Pages: Page remove error"),
        expect.any(Number),
      );

      // 4. Delete folder cancelled
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(false);
      const dirDeleteBtn = items2?.[0]?.querySelector(
        ".files__delete",
      ) as HTMLButtonElement;
      dirDeleteBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(deleteGroupDirectory).not.toHaveBeenCalled();

      // 5. Delete folder confirmed
      component.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      (deleteGroupDirectory as any).mockResolvedValueOnce(undefined);
      dirDeleteBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(deleteGroupDirectory).toHaveBeenCalledWith(
        expect.anything(),
        "default",
        "root_dir/sub_dir/",
      );
      expect(showSuccess).toHaveBeenCalledWith("Deleted folder: sub_dir", 3000);

      // 6. Delete file confirmed
      const fileDeleteBtn = items2?.[1]?.querySelector(
        ".files__delete",
      ) as HTMLButtonElement;
      (deleteGroupFile as any).mockResolvedValueOnce(undefined);
      fileDeleteBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(deleteGroupFile).toHaveBeenCalledWith(
        expect.anything(),
        "default",
        "root_dir/preview.html",
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Deleted file: preview.html",
        3000,
      );

      // 7. Delete throws Error
      (deleteGroupFile as any).mockRejectedValueOnce(
        new Error("Delete denied"),
      );
      fileDeleteBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to delete preview.html: Delete denied",
        6000,
      );

      // 8. Delete throws string
      (deleteGroupFile as any).mockRejectedValueOnce("String delete error");
      fileDeleteBtn.click();
      await new Promise((r) => setTimeout(r, 10));
      expect(showError).toHaveBeenCalledWith(
        "Failed to delete preview.html: String delete error",
        6000,
      );

      document.body.removeChild(component);
    });

    it("handles rename button click and cut clipboard styling in file list", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      (orchestratorStore as any).currentPath = "deep/path";
      (orchestratorStore as any).files = ["file.txt"];
      filesUiStore.setClipboard("deep/path/file.txt", "cut", false, "default");
      component.updateFileList({} as any);

      const item = component.shadowRoot?.querySelector(".files__item");
      expect(item?.classList.contains("files__item--cut")).toBe(true);

      const renameBtn = component.shadowRoot?.querySelector(
        ".files__rename",
      ) as HTMLButtonElement;
      const openRenameSpy = jest.spyOn(component, "openRenameDialog");
      renameBtn.click();
      expect(openRenameSpy).toHaveBeenCalledWith(
        "deep/path/file.txt",
        "file.txt",
        false,
      );

      document.body.removeChild(component);
    });

    it("handles updateUploadProgressUI with various values and sync button visibility", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      // Progress with total = 0
      component.updateUploadProgressUI(true, 0, 0);
      const label = component.shadowRoot?.querySelector(
        ".files__upload-progress-label",
      );
      expect(label?.textContent).toContain("Uploading files...");

      // Progress with total > 0
      component.updateUploadProgressUI(true, 50, 100);
      expect(label?.textContent).toContain("Uploading 50/100 files (50%)");

      // Sync button visibility with VM enabled (9p mode)
      (orchestratorStore as any).orchestrator.vmStatus.mode = "9p";
      component.updateSyncButtonsVisibility();
      const hostBtn = component.shadowRoot?.querySelector(
        ".files__sync-host-btn",
      ) as HTMLButtonElement;
      expect(hostBtn?.hidden).toBe(false);

      // Sync button visibility with VM disabled
      (orchestratorStore as any).orchestrator.vmStatus.mode = null;
      component.updateSyncButtonsVisibility();
      expect(hostBtn?.hidden).toBe(true);

      document.body.removeChild(component);
    });

    it("handles uploadFileList conflict resolution overwrite, multiple files, and errors", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;
      (orchestratorStore as any).activeGroupId = "default";
      (orchestratorStore as any).currentPath = "upload_folder";
      (orchestratorStore as any).files = ["exists.txt"];

      // 1. Empty fileList -> early return
      await component.uploadFileList(db, []);
      expect(uploadGroupFile).not.toHaveBeenCalled();

      // 2. Overwrite conflict resolution
      const mockConflictFile = new File(["new data"], "exists.txt", {
        type: "text/plain",
      });
      const resolveConflictSpy = jest
        .spyOn(component, "promptUploadConflict")
        .mockResolvedValueOnce({ action: "overwrite" });
      (uploadGroupFile as any).mockResolvedValue(undefined);

      await component.uploadFileList(db, [mockConflictFile]);
      expect(resolveConflictSpy).toHaveBeenCalled();
      expect(uploadGroupFile).toHaveBeenCalledWith(
        db,
        "default",
        "upload_folder/exists.txt",
        mockConflictFile,
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Uploaded 1 file",
        expect.any(Number),
      );

      // 3. Rename conflict resolution and cancelled conflict resolution
      resolveConflictSpy.mockResolvedValueOnce({
        action: "rename",
        name: "renamed.txt",
      });
      await component.uploadFileList(db, [mockConflictFile]);
      expect(uploadGroupFile).toHaveBeenCalledWith(
        db,
        "default",
        "upload_folder/renamed.txt",
        mockConflictFile,
      );

      resolveConflictSpy.mockResolvedValueOnce(null); // Cancel conflict
      (uploadGroupFile as any).mockClear();
      await component.uploadFileList(db, [mockConflictFile]);
      expect(uploadGroupFile).not.toHaveBeenCalled();

      // 4. Multiple files uploaded
      const file1 = new File(["d1"], "f1.txt", { type: "text/plain" });
      const file2 = new File(["d2"], "f2.txt", { type: "text/plain" });
      await component.uploadFileList(db, [file1, file2]);
      expect(showSuccess).toHaveBeenCalledWith(
        "Uploaded 2 files",
        expect.any(Number),
      );

      // 5. Upload with appendUlid = true
      (getConfig as any).mockResolvedValueOnce("true");
      await component.uploadFileList(db, [file1]);
      expect(uploadGroupFile).toHaveBeenCalledWith(
        db,
        "default",
        expect.stringContaining("mock-ulid-f1.txt"),
        file1,
      );

      // 6. Upload throws Error
      (uploadGroupFile as any).mockRejectedValueOnce(new Error("Disk full"));
      await component.uploadFileList(db, [file1]);
      expect(showError).toHaveBeenCalledWith(
        "Failed to upload files: Disk full",
        6000,
      );

      // 7. Upload throws string error
      (uploadGroupFile as any).mockRejectedValueOnce("String upload error");
      await component.uploadFileList(db, [file1]);
      expect(showError).toHaveBeenCalledWith(
        "Failed to upload files: String upload error",
        6000,
      );

      document.body.removeChild(component);
    });

    it("handles handleBackup and handleClearAll success and failure paths", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;

      // 1. handleBackup success
      (downloadAllGroupFilesAsZip as any).mockResolvedValueOnce(undefined);
      await component.handleBackup(db);
      expect(downloadAllGroupFilesAsZip).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith(
        "Backup created successfully",
        3000,
      );

      // 2. handleBackup failure with Error and string
      (downloadAllGroupFilesAsZip as any).mockRejectedValueOnce(
        new Error("Zip fail"),
      );
      await component.handleBackup(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to create backup: Zip fail",
        6000,
      );

      (downloadAllGroupFilesAsZip as any).mockRejectedValueOnce(
        "String zip fail",
      );
      await component.handleBackup(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to create backup: String zip fail",
        6000,
      );

      // 3. handleClearAll cancelled
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(false);
      await component.handleClearAll(db);
      expect(deleteAllGroupFiles).not.toHaveBeenCalled();

      // 4. handleClearAll confirmed and succeeds
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (deleteAllGroupFiles as any).mockResolvedValueOnce(undefined);
      await component.handleClearAll(db);
      expect(deleteAllGroupFiles).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith("All files deleted", 3500);

      // 5. handleClearAll confirmed and fails (Error and string)
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (deleteAllGroupFiles as any).mockRejectedValueOnce(
        new Error("Clear fail"),
      );
      await component.handleClearAll(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to clear files: Clear fail",
        6000,
      );

      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (deleteAllGroupFiles as any).mockRejectedValueOnce("String clear fail");
      await component.handleClearAll(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to clear files: String clear fail",
        6000,
      );

      document.body.removeChild(component);
    });

    it("handles requestConfirmation and file opening in viewer", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;

      // 1. requestConfirmation without shadow-claw shell element (falls back to warning)
      const resWithoutShell = await component.requestConfirmation({
        title: "Test",
        message: "Test message",
      });
      expect(resWithoutShell).toBe(false);
      expect(showWarning).toHaveBeenCalledWith("Test message", 4500);

      // 2. requestConfirmation with shadow-claw element
      const mockShell = document.createElement("shadow-claw") as any;
      mockShell.requestDialog = jest.fn().mockResolvedValue(true);
      document.body.appendChild(mockShell);

      const resWithShell = await component.requestConfirmation({
        title: "Test 2",
        message: "Test message 2",
      });
      expect(resWithShell).toBe(true);
      expect(mockShell.requestDialog).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "confirm", title: "Test 2" }),
      );

      document.body.removeChild(mockShell);

      // 3. Open non-directory file in viewer when currentPath is "." vs subpath
      (orchestratorStore as any).currentPath = ".";
      (orchestratorStore as any).files = ["notes.txt"];
      component.updateFileList(db);
      const fileItem = component.shadowRoot?.querySelector(
        ".files__item-main",
      ) as HTMLElement;
      fileItem.click();
      await Promise.resolve();
      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        db,
        "notes.txt",
        "default",
      );

      (orchestratorStore as any).currentPath = "nested/dir";
      component.updateFileList(db);
      const nestedFileItem = component.shadowRoot?.querySelector(
        ".files__item-main",
      ) as HTMLElement;
      nestedFileItem.click();
      await Promise.resolve();
      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        db,
        "nested/dir/notes.txt",
        "default",
      );

      // 4. openNewFileDialog on rendered component resets input values
      component.openNewFileDialog();
      const newInput = component.shadowRoot?.querySelector(
        ".files__new-input",
      ) as HTMLInputElement;
      const isFolderInput = component.shadowRoot?.querySelector(
        ".files__new-is-folder",
      ) as HTMLInputElement;
      expect(newInput.value).toBe("");
      expect(isFolderInput.checked).toBe(false);

      // 5. openPasteDialog when currentPath !== "."
      (orchestratorStore as any).currentPath = "custom/dest";
      filesUiStore.setClipboard("source.txt", "copy", false, "default");
      component.openPasteDialog();
      const pasteMsg = component.shadowRoot?.querySelector(
        ".files__paste-message",
      );
      expect(pasteMsg?.textContent).toContain("custom/dest");

      document.body.removeChild(component);
    });

    it("handles promptUploadConflict branches and handleRenameEntry validations", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;

      // 1. promptUploadConflict: overwrite button
      const conflictPromise1 = component.promptUploadConflict(
        "test.txt",
        new Set(),
      );
      const overwriteBtn = component.shadowRoot?.querySelector(
        ".files__upload-conflict-overwrite",
      ) as HTMLButtonElement;
      overwriteBtn.click();
      const decision1 = await conflictPromise1;
      expect(decision1).toEqual({ action: "overwrite" });

      // 2. promptUploadConflict: cancel button
      const conflictPromise2 = component.promptUploadConflict(
        "test2.txt",
        new Set(),
      );
      const cancelBtn = component.shadowRoot?.querySelector(
        ".files__upload-conflict-cancel",
      ) as HTMLButtonElement;
      cancelBtn.click();
      const decision2 = await conflictPromise2;
      expect(decision2).toBeNull();

      // 3. promptUploadConflict: rename form submit (empty -> warning, path -> warning, collision -> warning, valid -> rename)
      const conflictPromise3 = component.promptUploadConflict(
        "test3.txt",
        new Set(["taken.txt"]),
      );
      const conflictForm = component.shadowRoot?.querySelector(
        ".files__upload-conflict-form",
      ) as HTMLFormElement;
      const renameInput = component.shadowRoot?.querySelector(
        ".files__upload-conflict-rename-input",
      ) as HTMLInputElement;

      // Empty name
      renameInput.value = "   ";
      conflictForm.dispatchEvent(new Event("submit"));
      expect(showWarning).toHaveBeenCalledWith("Please enter a name", 3000);

      // Path slash
      renameInput.value = "invalid/name";
      conflictForm.dispatchEvent(new Event("submit"));
      expect(showWarning).toHaveBeenCalledWith(
        "Use only a name, not a path",
        3500,
      );

      // Collision
      renameInput.value = "taken.txt";
      conflictForm.dispatchEvent(new Event("submit"));
      expect(showWarning).toHaveBeenCalledWith(
        expect.stringContaining("already exists"),
        4000,
      );

      // Valid rename
      renameInput.value = "valid_unique.txt";
      conflictForm.dispatchEvent(new Event("submit"));
      const decision3 = await conflictPromise3;
      expect(decision3).toEqual({ action: "rename", name: "valid_unique.txt" });

      // 4. handleRenameEntry when _pendingRenamePath is missing
      (component as any)._pendingRenamePath = null;
      (component as any)._pendingRenameName = null;
      await component.handleRenameEntry(db);

      // 5. handleRenameEntry with renameGroupEntry throwing Error and string
      (component as any)._pendingRenamePath = "orig.txt";
      (component as any)._pendingRenameName = "orig.txt";
      const renameFormInput = component.shadowRoot?.querySelector(
        ".files__rename-input",
      ) as HTMLInputElement;
      renameFormInput.value = "new_name.txt";

      (renameGroupEntry as any).mockRejectedValueOnce(
        new Error("Rename locked"),
      );
      await component.handleRenameEntry(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to rename orig.txt: Rename locked",
        expect.any(Number),
      );

      (renameGroupEntry as any).mockRejectedValueOnce("String rename fail");
      await component.handleRenameEntry(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to rename orig.txt: String rename fail",
        expect.any(Number),
      );

      document.body.removeChild(component);
    });

    it("handles handleRestore and handleUpload validations and error handling", async () => {
      const component = new ShadowClawFiles();
      document.body.appendChild(component);
      await component.render();

      const db = {} as any;

      // 1. handleRestore with no files
      const inputNoFiles = { files: [] } as any;
      await component.handleRestore(db, inputNoFiles);
      expect(restoreAllGroupFilesFromZip).not.toHaveBeenCalled();

      // 2. handleRestore with non-zip file
      const nonZipFile = new File(["test"], "data.txt", { type: "text/plain" });
      const inputNonZip = { files: [nonZipFile], value: "data.txt" } as any;
      await component.handleRestore(db, inputNonZip);
      expect(showWarning).toHaveBeenCalledWith(
        "Please select a .zip file",
        3500,
      );

      // 3. handleRestore with zip cancelled
      const zipFile = new File(["zip data"], "backup.zip", {
        type: "application/zip",
      });
      const inputZip = { files: [zipFile], value: "backup.zip" } as any;
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(false);
      await component.handleRestore(db, inputZip);
      expect(inputZip.value).toBe("");
      expect(restoreAllGroupFilesFromZip).not.toHaveBeenCalled();

      // 4. handleRestore confirmed and succeeds
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (restoreAllGroupFilesFromZip as any).mockResolvedValueOnce(undefined);
      await component.handleRestore(db, inputZip);
      expect(restoreAllGroupFilesFromZip).toHaveBeenCalledWith(
        db,
        "default",
        zipFile,
      );
      expect(showSuccess).toHaveBeenCalledWith(
        "Files restored successfully",
        3500,
      );

      // 5. handleRestore confirmed and fails with Error and string
      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (restoreAllGroupFilesFromZip as any).mockRejectedValueOnce(
        new Error("Corrupt zip"),
      );
      await component.handleRestore(db, inputZip);
      expect(showError).toHaveBeenCalledWith(
        "Failed to restore from backup: Corrupt zip",
        6000,
      );

      component.requestConfirmation = jest
        .fn<any>()
        .mockResolvedValueOnce(true);
      (restoreAllGroupFilesFromZip as any).mockRejectedValueOnce(
        "String corrupt zip",
      );
      await component.handleRestore(db, inputZip);
      expect(showError).toHaveBeenCalledWith(
        "Failed to restore from backup: String corrupt zip",
        6000,
      );

      // 6. handleUpload with no files
      await component.handleUpload(db, { files: [] } as any);
      const uploadListSpy = jest.spyOn(component, "uploadFileList");
      expect(uploadListSpy).not.toHaveBeenCalled();

      // 7. handleUpload with files
      const validFile = new File(["hello"], "hello.txt", {
        type: "text/plain",
      });
      uploadListSpy.mockResolvedValueOnce(undefined as any);
      const validUploadInput = {
        files: [validFile],
        value: "hello.txt",
      } as any;
      await component.handleUpload(db, validUploadInput);
      expect(uploadListSpy).toHaveBeenCalledWith(db, [validFile]);
      expect(validUploadInput.value).toBe("");

      document.body.removeChild(component);
    });

    it("handles missing shadowRoot and missing dialog element guards", async () => {
      const component = new ShadowClawFiles() as any;
      const db = {} as any;

      // 1. shadowRoot is null
      Object.defineProperty(component, "shadowRoot", {
        value: null,
        configurable: true,
      });
      component.openNewFileDialog();
      component.openRenameDialog("file.txt", "file.txt", false);
      component.openPasteDialog();
      component.updateBreadcrumbs(db);
      component.updateFileList(db);
      component.updatePasteButtonVisibility();
      component.updateSyncButtonsVisibility();
      component.updateUploadProgressUI(true, 1, 2);
      await component.promptUploadConflict("a", new Set());
      await component.handleRenameEntry(db);

      // 2. Dialog elements missing in shadowRoot
      const emptyRoot = document.createElement("div");
      Object.defineProperty(component, "shadowRoot", {
        value: emptyRoot,
        configurable: true,
      });
      component.openNewFileDialog();
      component.openRenameDialog("file.txt", "file.txt", false);
      component.openPasteDialog();
      expect(component._pendingRenamePath).toBeNull();
    });
  });
});
