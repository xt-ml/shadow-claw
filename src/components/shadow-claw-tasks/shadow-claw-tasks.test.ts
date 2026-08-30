import { jest } from "@jest/globals";

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

jest.unstable_mockModule("../../db/saveTask.js", () => ({
  saveTask: jest.fn(),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({ effect: jest.fn() }));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn((x) => x),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
  toTrustedScriptUrl: jest.fn((url: string) => url),
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: {
    openFile: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    activeGroupId: "default",
    db: {},
    orchestrator: null,
    tasks: [],
    runTask: jest.fn(),
    getTasksForBackup: jest.fn(() => []),
    clearAllTasks: jest.fn(),
    deleteTask: jest.fn(),
    upsertTask: jest.fn(),
    toggleTask: jest.fn(),
    getTasksByGroupId: jest.fn(() => []),
    getTaskServerTerminalInstance: jest.fn(() => null),
    reorderTasks: jest.fn(),
    restoreTasksFromBackup: jest.fn(),
  },
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { ShadowClawTasks } = await import("./shadow-claw-tasks.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");

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
    const freshContextInput = document.createElement("input");
    freshContextInput.name = "freshContext";
    freshContextInput.type = "checkbox";
    const subagentInput = document.createElement("input");
    subagentInput.name = "subagent";
    subagentInput.type = "checkbox";
    form.append(scheduleInput, promptInput, freshContextInput, subagentInput);

    const title = document.createElement("h2");
    title.className = "tasks__dialog-title";

    const submitBtn = document.createElement("button");
    submitBtn.className = "tasks__dialog-submit";

    const previewDiv = document.createElement("div");
    previewDiv.className = "tasks__preview";

    component.shadowRoot?.replaceChildren(
      dialog,
      form,
      title,
      submitBtn,
      previewDiv,
    );

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

    it("escapes html correctly", () => {
      const el = new ShadowClawTasks();
      expect(el.escapeHtml("<div>")).toBe("&lt;div&gt;");
    });

    it("runs a task", () => {
      const el = new ShadowClawTasks();
      const task = { id: "1" } as any;
      el.handleRun(task);
      expect(orchestratorStore.runTask).toHaveBeenCalledWith(task, true);
    });

    it("copies task id", async () => {
      const el = new ShadowClawTasks();
      const mockClipboard = {
        writeText: jest.fn<any>().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });
      await el.handleCopyId("test-id");
      expect(mockClipboard.writeText).toHaveBeenCalledWith("test-id");
    });

    it("renders tools preview", () => {
      const el = new ShadowClawTasks();
      const tools = [{ name: "my_tool", input: { key: "val" } }];
      const html = el.renderToolsPreview(tools, false);
      expect(html).toContain("my_tool");
      expect(html).toContain("key");
      expect(html).toContain("val");
    });

    it("handles add mode", () => {
      const el = new ShadowClawTasks();
      document.body.appendChild(el);
      const dialog = document.createElement("dialog");
      dialog.showModal = jest.fn();
      const form = document.createElement("form");
      form.className = "tasks__dialog-form";
      const typeRadio = document.createElement("input");
      typeRadio.type = "radio";
      typeRadio.name = "taskType";
      typeRadio.value = "prompt";
      form.appendChild(typeRadio);

      el.shadowRoot?.replaceChildren(dialog, form);

      el.handleAdd();
      expect(el.editingTask).toBeNull();
      expect(dialog.showModal).toHaveBeenCalled();
      document.body.removeChild(el);
    });

    it("handles backup", async () => {
      const el = new ShadowClawTasks();
      const mockRevoke = jest.fn();
      const mockCreateObjectURL = jest.fn(() => "blob:url");
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevoke;

      await el.handleBackup();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevoke).toHaveBeenCalled();
    });

    it("handles clear all when confirmed", async () => {
      const el = new ShadowClawTasks();
      el.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      await el.handleClearAll({} as any);
      expect(orchestratorStore.clearAllTasks).toHaveBeenCalled();
    });

    it("handles delete when confirmed", async () => {
      const el = new ShadowClawTasks();
      el.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      await el.handleDelete({} as any, "task-1");
      expect(orchestratorStore.deleteTask).toHaveBeenCalledWith(
        expect.anything(),
        "task-1",
      );
    });

    it("saves freshContext and subagent task properties on submit", async () => {
      const el = new ShadowClawTasks();
      const form = document.createElement("form");
      form.className = "tasks__dialog-form";
      const scheduleInput = document.createElement("input");
      scheduleInput.name = "schedule";
      scheduleInput.value = "0 * * * *";
      const promptInput = document.createElement("textarea");
      promptInput.name = "prompt";
      promptInput.value = "my prompt";

      const freshContextInput = document.createElement("input");
      freshContextInput.name = "freshContext";
      freshContextInput.type = "checkbox";
      freshContextInput.checked = true;

      const subagentInput = document.createElement("input");
      subagentInput.name = "subagent";
      subagentInput.type = "checkbox";
      subagentInput.checked = true;

      form.append(scheduleInput, promptInput, freshContextInput, subagentInput);

      await el.handleEditSubmit({} as any, form);

      expect(orchestratorStore.upsertTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          schedule: "0 * * * *",
          prompt: "my prompt",
          freshContext: true,
          subagent: true,
        }),
      );
    });

    it("manages tools editor UI interactions (remove, modify, suppress)", () => {
      const el = new ShadowClawTasks();
      document.body.appendChild(el);

      el.editingTools = [
        {
          name: "test_tool",
          input: { a: 1 },
          suppressOutput: false,
          suppressToast: false,
        },
      ];

      el.renderToolsEditor();
      const toolsList = el.shadowRoot?.querySelector(
        ".tasks__tools-list",
      ) as HTMLElement;
      expect(toolsList.querySelectorAll(".tasks__tool-item").length).toBe(1);

      // Modify tool name
      const nameInput = toolsList.querySelector(
        ".tasks__form-input",
      ) as HTMLInputElement;
      nameInput.value = "updated_tool";
      nameInput.dispatchEvent(new Event("input"));
      expect(el.editingTools[0].name).toBe("updated_tool");

      // Modify textarea params
      const textarea = toolsList.querySelector(
        ".tasks__form-textarea",
      ) as HTMLTextAreaElement;
      textarea.value = '{"foo": "bar"}';
      textarea.dispatchEvent(new Event("change"));
      expect(el.editingTools[0].input).toEqual({ foo: "bar" });

      // Toggle suppress
      const suppressCheckbox = toolsList.querySelector(
        ".tasks__tool-suppress input",
      ) as HTMLInputElement;
      suppressCheckbox.checked = true;
      suppressCheckbox.dispatchEvent(new Event("change"));
      expect(el.editingTools[0].suppressOutput).toBe(true);

      // Remove tool
      const removeBtn = toolsList.querySelector(
        ".tasks__tool-remove-btn",
      ) as HTMLButtonElement;
      removeBtn.click();
      expect(el.editingTools.length).toBe(0);

      document.body.removeChild(el);
    });

    it("renders tasks and binds action buttons (toggle, copy, run, edit, delete)", async () => {
      const el = new ShadowClawTasks();
      const container = document.createElement("div");
      container.className = "tasks__list";
      const countEl = document.createElement("span");
      countEl.className = "tasks__count";
      el.shadowRoot?.replaceChildren(countEl, container);

      const db = {} as any;
      const tasks = [
        {
          id: "task-1",
          name: "Daily Job",
          schedule: "0 0 * * *",
          prompt: "check status",
          enabled: true,
          type: "prompt",
          freshContext: true,
        },
      ];
      (orchestratorStore as any).tasks = tasks;

      await el.updateTaskList(db);
      expect(container.querySelectorAll(".tasks__item").length).toBe(1);

      const item = container.querySelector(".tasks__item") as HTMLElement;
      const toggleInput = item.querySelector(
        ".tasks__toggle-input",
      ) as HTMLInputElement;
      toggleInput.checked = false;
      toggleInput.dispatchEvent(new Event("change"));
      expect(orchestratorStore.toggleTask).toHaveBeenCalledWith(
        db,
        tasks[0],
        false,
      );

      const runBtn = item.querySelector(".tasks__run-btn") as HTMLButtonElement;
      runBtn.click();
      expect(orchestratorStore.runTask).toHaveBeenCalledWith(tasks[0], true);
    });

    it("handles restore with valid and invalid files", async () => {
      const el = new ShadowClawTasks();
      const db = {} as any;

      // 1. No file selected
      const emptyInput = document.createElement("input");
      emptyInput.type = "file";
      await el.handleRestore(db, emptyInput);

      // 2. Valid JSON file
      const backupData = [
        {
          id: "restored-1",
          schedule: "0 0 * * *",
          prompt: "daily report",
          enabled: true,
        },
      ];
      const validFile = new File([JSON.stringify(backupData)], "backup.json", {
        type: "application/json",
      });
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      Object.defineProperty(fileInput, "files", { value: [validFile] });

      await el.handleRestore(db, fileInput);
      expect(orchestratorStore.upsertTask).toHaveBeenCalled();
    });

    it("handles preview link clicks and opens in file viewer", async () => {
      const el = new ShadowClawTasks();
      const db = {} as any;

      const link = document.createElement("a");
      link.setAttribute("href", "docs/spec.md");
      const targetDiv = document.createElement("div");
      targetDiv.appendChild(link);

      const event = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "target", { value: link });
      Object.defineProperty(event, "button", { value: 0 });

      const fileViewerMod = await import("../../stores/file-viewer.js");
      await el.handlePreviewLinkClick(event, db);
      expect(fileViewerMod.fileViewerStore.openFile).toHaveBeenCalledWith(
        db,
        "docs/spec.md",
        "default",
      );
    });

    it("cleans up on disconnectedCallback", () => {
      const el = new ShadowClawTasks();
      const cleanupMock = jest.fn();
      el.cleanup = cleanupMock;
      el.disconnectedCallback();
      expect(cleanupMock).toHaveBeenCalledTimes(1);
    });

    it("renders tools preview for tool task chains", () => {
      const el = new ShadowClawTasks();
      const tools = [
        { name: "read_file", input: { path: "hello.txt" } },
        { name: "write_file", input: { path: "out.txt", content: "$pipe" } },
      ];
      const previewHtml = el.renderToolsPreview(tools);
      expect(previewHtml).toContain("read_file");
      expect(previewHtml).toContain("write_file");
      expect(previewHtml).toContain("hello.txt");
    });

    it("handles clear all tasks when confirmed", async () => {
      const el = new ShadowClawTasks();
      const db = {} as any;
      window.confirm = jest.fn(() => true);

      await el.handleClearAll(db);
      expect(orchestratorStore.clearAllTasks).toHaveBeenCalledWith(db);

      window.confirm = jest.fn(() => false);
      (orchestratorStore.clearAllTasks as any).mockClear();
      await el.handleClearAll(db);
      expect(orchestratorStore.clearAllTasks).not.toHaveBeenCalled();
    });

    it("handles edit submission for prompt and tool tasks", async () => {
      const el = new ShadowClawTasks();
      const db = {} as any;

      const form = document.createElement("form");
      const scheduleInput = document.createElement("input");
      scheduleInput.name = "schedule";
      scheduleInput.value = "*/15 * * * *";

      const promptInput = document.createElement("textarea");
      promptInput.name = "prompt";
      promptInput.value = "Run automated scan";

      const freshContextInput = document.createElement("input");
      freshContextInput.name = "freshContext";
      freshContextInput.type = "checkbox";
      freshContextInput.checked = true;

      const subagentInput = document.createElement("input");
      subagentInput.name = "subagent";
      subagentInput.type = "checkbox";
      subagentInput.checked = false;

      const promptRadio = document.createElement("input");
      promptRadio.name = "taskType";
      promptRadio.value = "prompt";
      promptRadio.checked = true;

      form.append(
        scheduleInput,
        promptInput,
        freshContextInput,
        subagentInput,
        promptRadio,
      );

      const dialog = document.createElement("dialog");
      dialog.close = jest.fn();
      el.shadowRoot?.appendChild(dialog);

      await el.handleEditSubmit(db, form);
      expect(orchestratorStore.upsertTask).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          schedule: "*/15 * * * *",
          prompt: "Run automated scan",
          freshContext: true,
          type: "prompt",
        }),
      );
    });

    it("handles copyId, delete, reorder, restore, and renderPreview", async () => {
      const el = new ShadowClawTasks() as any;
      const db = {} as any;

      // 1. Copy ID
      const mockClipboard = {
        writeText: jest.fn<any>().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });
      await el.handleCopyId("task-123");
      expect(mockClipboard.writeText).toHaveBeenCalledWith("task-123");

      // 2. Delete task with confirmation
      el.requestConfirmation = jest.fn<any>().mockResolvedValue(true);
      await el.handleDelete(db, "task-123");
      expect(orchestratorStore.deleteTask).toHaveBeenCalledWith(db, "task-123");

      // 3. Reorder tasks
      await el.handleReorder("t1", "t2", ["t2", "t1"]);
      expect(orchestratorStore.reorderTasks).toHaveBeenCalledWith(
        expect.anything(),
        "default",
        ["t2", "t1"],
      );

      // 4. Restore tasks from JSON
      const restoreFile = {
        name: "tasks-backup.json",
        text: jest
          .fn<() => Promise<string>>()
          .mockResolvedValue(JSON.stringify([{ id: "t1" }])),
      };
      const restoreInput = {
        files: [restoreFile],
        value: "tasks-backup.json",
      } as any;
      await el.handleRestore(db, restoreInput);
      expect(orchestratorStore.restoreTasksFromBackup).toHaveBeenCalledWith(
        db,
        [{ id: "t1" }],
      );

      // 5. Render preview
      const emptyPreview = await el.renderPreview("");
      expect(emptyPreview).toContain("No content");

      const shortPreview = await el.renderPreview("Short prompt");
      expect(shortPreview).toContain("tasks__prompt");

      const longPreview = await el.renderPreview(
        "Long\nmulti-line\nprompt",
        true,
      );
      expect(longPreview).toContain("tasks__content-details");
    });

    it("handles keyboard navigation, announcement, and autoscroll", async () => {
      const el = new ShadowClawTasks() as any;
      document.body.appendChild(el);

      // 1. _announce
      const liveRegion = document.createElement("div");
      liveRegion.id = "live-region";
      el.shadowRoot?.appendChild(liveRegion);
      el._announce("Task test announcement");

      // 2. Keyboard grab and navigation
      (orchestratorStore as any).tasks = [
        { id: "t1", name: "Task 1", prompt: "Hello 1" },
        { id: "t2", name: "Task 2", prompt: "Hello 2" },
      ];

      // Grab with 'm'
      const keyM = new KeyboardEvent("keydown", { key: "m", cancelable: true });
      el._handleKeyboard(keyM, "t1", "Task 1");
      expect(el._keyboardGrabbedId).toBe("t1");

      // Move down with ArrowDown
      const keyDown = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        cancelable: true,
      });
      el._handleKeyboard(keyDown, "t1", "Task 1");

      // Drop with Space
      const keySpace = new KeyboardEvent("keydown", {
        key: " ",
        cancelable: true,
      });
      el._handleKeyboard(keySpace, "t1", "Task 1");
      expect(el._keyboardGrabbedId).toBeNull();

      // Cancel with Escape
      el._keyboardGrabbedId = "t1";
      const keyEsc = new KeyboardEvent("keydown", {
        key: "Escape",
        cancelable: true,
      });
      el._handleKeyboard(keyEsc, "t1", "Task 1");
      expect(el._keyboardGrabbedId).toBeNull();

      // Navigation when not grabbed
      const item1 = document.createElement("div");
      item1.className = "tasks__item";
      item1.setAttribute("tabindex", "0");
      const item2 = document.createElement("div");
      item2.className = "tasks__item";
      item2.setAttribute("tabindex", "0");
      el.shadowRoot?.appendChild(item1);
      el.shadowRoot?.appendChild(item2);

      const navDown = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        cancelable: true,
      });
      Object.defineProperty(navDown, "target", { value: item1 });
      el._handleKeyboard(navDown, "t1", "Task 1");

      // 3. Autoscroll
      let content = el.shadowRoot?.querySelector(
        ".tasks__content",
      ) as HTMLElement;
      if (!content) {
        content = document.createElement("div");
        content.className = "tasks__content";
        el.shadowRoot?.appendChild(content);
      }
      content.getBoundingClientRect = () =>
        ({ top: 100, bottom: 500, height: 400 }) as any;

      el._updateAutoScrollSpeed(110); // Near top
      expect(el._autoScrollActive).toBe(true);
      el._stopAutoScroll();
      expect(el._autoScrollActive).toBe(false);

      // 4. Focus navigation
      el._focusNext(item1);
      el._focusPrev(item2);
      el._focusNextItem(item1);
      el._focusPrevItem(item2);

      // 5. Touch events and findTouch
      if (el.shadowRoot) {
        (el.shadowRoot as any).elementFromPoint = jest.fn(() => item1);
      }
      const listEl = document.createElement("div");
      listEl.className = "tasks__list";
      el.shadowRoot?.appendChild(listEl);
      el._bindTouchListEvents(listEl);

      el._touchId = 123;
      el._touchDraggedTaskId = "t1";
      const fakeTouch = { identifier: 123, clientX: 50, clientY: 150 };
      const touchMoveEvt = new Event("touchmove") as any;
      touchMoveEvt.touches = [fakeTouch];
      touchMoveEvt.changedTouches = [fakeTouch];
      listEl.dispatchEvent(touchMoveEvt);

      const touchEndEvt = new Event("touchend") as any;
      touchEndEvt.touches = [];
      touchEndEvt.changedTouches = [fakeTouch];
      listEl.dispatchEvent(touchEndEvt);

      const touchCancelEvt = new Event("touchcancel") as any;
      listEl.dispatchEvent(touchCancelEvt);

      el.cleanup = jest.fn();
      document.body.removeChild(el);
    });
  });
});
