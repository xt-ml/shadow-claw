import { jest } from "@jest/globals";

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn<any>().mockResolvedValue({} as any),
}));

jest.unstable_mockModule("../../db/save-task.js", () => ({
  saveTask: jest.fn(),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn(() => () => {}),
}));

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
    taskServerEnabled: false,
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

const mockGetCurrentSubscription = jest.fn<any>().mockResolvedValue(null);
jest.unstable_mockModule(
  "../../subsystems/notifications/push-client.js",
  () => ({
    getCurrentSubscription: mockGetCurrentSubscription,
  }),
);

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

const { ShadowClawTasks } = await import("./shadow-claw-tasks.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { showError, showInfo, showSuccess } = await import("../../ui/toast.js");
const { fileViewerStore } = await import("../../stores/file-viewer.js");
const { getCurrentSubscription } =
  await import("../../subsystems/notifications/push-client.js");

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

    it("resolves workspace links with spaces and percent-encoded spaces", () => {
      const component = new ShadowClawTasks();

      expect(
        component.resolveWorkspaceLinkPath(
          "My File With Spaces In The Name.md",
        ),
      ).toBe("My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "./My%20File%20With%20Spaces%20In%20The%20Name.md",
        ),
      ).toBe("My File With Spaces In The Name.md");

      expect(
        component.resolveWorkspaceLinkPath(
          "sub%20folder/My%20File%20With%20Spaces.md",
        ),
      ).toBe("sub folder/My File With Spaces.md");
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

  describe("push notifications opt-in checkbox", () => {
    it("disables push notifications checkbox by default", async () => {
      const component = new ShadowClawTasks();
      const pushInput = component.shadowRoot?.querySelector(
        "#tasksPushNotificationsInput",
      ) as HTMLInputElement;

      expect(pushInput).toBeDefined();
      expect(pushInput.disabled).toBe(true);
      expect(pushInput.checked).toBe(false);
    });

    it("enables push checkbox only when schedule, push subscription, and taskServerEnabled are all active", async () => {
      const component = new ShadowClawTasks();
      const pushInput = component.shadowRoot?.querySelector(
        "#tasksPushNotificationsInput",
      ) as HTMLInputElement;
      const scheduleInput = component.shadowRoot?.querySelector(
        "input[name='schedule']",
      ) as HTMLInputElement;

      // Case 1: no schedule
      (orchestratorStore as any).taskServerEnabled = true;
      mockGetCurrentSubscription.mockResolvedValue({
        endpoint: "https://push.example",
      });
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);

      // Case 2: schedule present, but no subscription
      scheduleInput.value = "*/5 * * * *";
      mockGetCurrentSubscription.mockResolvedValue(null);
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);

      // Case 3: schedule present, subscription present, but taskServerEnabled is false
      mockGetCurrentSubscription.mockResolvedValue({
        endpoint: "https://push.example",
      });
      (orchestratorStore as any).taskServerEnabled = false;
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);

      // Case 4: all three present -> enabled!
      (orchestratorStore as any).taskServerEnabled = true;
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(false);

      // Preserve checked state if specified
      await component.updatePushNotificationsCheckboxState(true);
      expect(pushInput.checked).toBe(true);

      // If schedule cleared -> disables and unchecks
      scheduleInput.value = "";
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);
      expect(pushInput.checked).toBe(false);
    });

    it("saves pushNotifications boolean upon form submit", async () => {
      const component = new ShadowClawTasks();
      const form = component.shadowRoot?.querySelector(
        ".tasks__dialog-form",
      ) as HTMLFormElement;
      const promptInput = component.shadowRoot?.querySelector(
        "textarea[name='prompt']",
      ) as HTMLTextAreaElement;
      const pushInput = component.shadowRoot?.querySelector(
        "#tasksPushNotificationsInput",
      ) as HTMLInputElement;

      promptInput.value = "Run my weather task";
      pushInput.disabled = false;
      pushInput.checked = true;

      await component.handleEditSubmit({} as any, form);

      expect(orchestratorStore.upsertTask).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          prompt: "Run my weather task",
          pushNotifications: true,
        }),
      );
    });

    it("renders Push badge when task has pushNotifications set to true", async () => {
      const component = new ShadowClawTasks();
      const list = component.shadowRoot?.querySelector(
        ".tasks__list",
      ) as HTMLElement;

      (orchestratorStore as any).tasks = [
        {
          id: "task-push-1",
          name: "Push Alert Task",
          schedule: "0 9 * * *",
          prompt: "Echo alert",
          pushNotifications: true,
          enabled: true,
        },
      ];

      await component.updateTaskList({} as any);

      expect(list.innerHTML).toContain("Push");
    });

    it("handles dialog close buttons and backdrop clicks", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const dialog = component.shadowRoot?.querySelector(
        "dialog",
      ) as HTMLDialogElement;
      dialog.close = jest.fn();

      const closeBtn = component.shadowRoot?.querySelector(
        ".tasks__dialog-close",
      ) as HTMLButtonElement;
      closeBtn?.dispatchEvent(new Event("click"));
      expect(dialog.close).toHaveBeenCalledTimes(1);

      const cancelBtn = component.shadowRoot?.querySelector(
        ".tasks__btn-cancel",
      ) as HTMLButtonElement;
      cancelBtn?.dispatchEvent(new Event("click"));
      expect(dialog.close).toHaveBeenCalledTimes(2);

      // Click on dialog backdrop
      Object.defineProperty(dialog, "target", { value: dialog });
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(dialog.close).toHaveBeenCalledTimes(3);

      document.body.removeChild(component);
    });

    it("handles restore button triggering file input click", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const restoreBtn = component.shadowRoot?.querySelector(
        ".tasks__restore-btn",
      ) as HTMLButtonElement;
      const restoreInput = component.shadowRoot?.querySelector(
        ".tasks__hidden-restore",
      ) as HTMLInputElement;

      const clickSpy = jest
        .spyOn(restoreInput, "click")
        .mockImplementation(() => {});
      restoreBtn?.dispatchEvent(new Event("click"));
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();

      document.body.removeChild(component);
    });

    it("handles task item action buttons and drag-and-drop lifecycle", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const editSpy = jest
        .spyOn(component, "handleEdit")
        .mockImplementation(() => {});
      const deleteSpy = jest
        .spyOn(component, "handleDelete")
        .mockImplementation(async () => {});
      const runSpy = jest
        .spyOn(component, "handleRun")
        .mockImplementation(async () => {});
      const reorderSpy = jest
        .spyOn(component, "handleReorder")
        .mockImplementation(async () => {});

      (orchestratorStore as any).tasks = [
        {
          id: "task-1",
          name: "Task 1",
          schedule: "0 9 * * *",
          prompt: "Echo 1",
          enabled: true,
        },
        {
          id: "task-2",
          name: "Task 2",
          schedule: "0 10 * * *",
          prompt: "Echo 2",
          enabled: true,
        },
      ];

      await component.updateTaskList({} as any);

      const items = component.shadowRoot?.querySelectorAll(".tasks__item");
      expect(items?.length).toBe(2);

      const firstItem = items![0] as HTMLElement;
      const secondItem = items![1] as HTMLElement;

      // Edit, delete, run clicks
      const runBtn = firstItem.querySelector(".tasks__run-btn");
      runBtn?.dispatchEvent(new Event("click"));
      expect(runSpy).toHaveBeenCalled();

      const editBtn = firstItem.querySelector(".tasks__edit-btn");
      editBtn?.dispatchEvent(new Event("click"));
      expect(editSpy).toHaveBeenCalled();

      const deleteBtn = firstItem.querySelector(".tasks__delete-btn");
      deleteBtn?.dispatchEvent(new Event("click"));
      expect(deleteSpy).toHaveBeenCalled();

      // Drag and drop events
      const handleEl = firstItem.querySelector(
        ".tasks__drag-handle",
      ) as HTMLElement;
      const dataTransfer = { setData: jest.fn() };
      const dragStartEvent = new Event("dragstart");
      Object.defineProperty(dragStartEvent, "dataTransfer", {
        value: dataTransfer,
      });
      handleEl?.dispatchEvent(dragStartEvent);
      expect(firstItem.classList.contains("dragging")).toBe(true);

      // Dragover on second item
      const dragOverEvent = new Event("dragover", { cancelable: true });
      secondItem.dispatchEvent(dragOverEvent);
      expect(secondItem.classList.contains("drag-over")).toBe(true);

      // Dragleave on second item
      secondItem.dispatchEvent(new Event("dragleave"));
      expect(secondItem.classList.contains("drag-over")).toBe(false);

      // Dragover again then drop
      secondItem.dispatchEvent(dragOverEvent);
      const dropEvent = new Event("drop", { cancelable: true });
      secondItem.dispatchEvent(dropEvent);
      expect(reorderSpy).toHaveBeenCalledWith("task-1", "task-2");

      // Dragend
      handleEl?.dispatchEvent(new Event("dragend"));
      expect(firstItem.classList.contains("dragging")).toBe(false);

      // Touch drag
      const touchStartEvent = new CustomEvent("touchstart", {
        cancelable: true,
      });
      Object.defineProperty(touchStartEvent, "touches", {
        value: [{ identifier: 1, clientX: 10, clientY: 20 }],
      });
      handleEl?.dispatchEvent(touchStartEvent);
      expect(firstItem.classList.contains("dragging")).toBe(true);

      document.body.removeChild(component);
    });

    it("updates auto scroll speed correctly", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const content = component.shadowRoot?.querySelector(
        ".tasks__content",
      ) as HTMLElement;
      if (content) {
        jest.spyOn(content, "getBoundingClientRect").mockReturnValue({
          top: 100,
          bottom: 500,
          left: 0,
          right: 300,
          height: 400,
          width: 300,
          x: 0,
          y: 100,
          toJSON: () => {},
        });
      }

      // Near top (top is 100, clientY = 110)
      (component as any)._updateAutoScrollSpeed(110);
      expect((component as any)._autoScrollSpeed).toBeLessThan(0);

      // Near bottom (bottom is 500, clientY = 490)
      (component as any)._updateAutoScrollSpeed(490);
      expect((component as any)._autoScrollSpeed).toBeGreaterThan(0);

      // Middle (clientY = 300)
      (component as any)._updateAutoScrollSpeed(300);
      expect((component as any)._autoScrollSpeed).toBe(0);

      // Stop auto scroll
      (component as any)._stopAutoScroll();
      expect((component as any)._autoScrollActive).toBe(false);
      expect((component as any)._autoScrollSpeed).toBe(0);

      document.body.removeChild(component);
    });

    it("handles switching task type radios between prompt and tools", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const typeRadios = component.shadowRoot?.querySelectorAll(
        "input[name='taskType']",
      );
      const toolsRadio = Array.from(typeRadios || []).find(
        (r: any) => r.value === "tools",
      ) as HTMLInputElement;
      const promptRadio = Array.from(typeRadios || []).find(
        (r: any) => r.value === "prompt",
      ) as HTMLInputElement;

      if (toolsRadio) {
        toolsRadio.checked = true;
        toolsRadio.dispatchEvent(new Event("change", { bubbles: true }));
        const promptGroup = component.shadowRoot?.querySelector(
          ".tasks__prompt-group",
        );
        expect(promptGroup?.getAttribute("style")).toContain("display: none");
      }

      if (promptRadio) {
        promptRadio.checked = true;
        promptRadio.dispatchEvent(new Event("change", { bubbles: true }));
        const toolsGroup = component.shadowRoot?.querySelector(
          ".tasks__tools-group",
        );
        expect(toolsGroup?.getAttribute("style")).toContain("display: none");
      }

      document.body.removeChild(component);
    });

    it("handles dialog controls: close, cancel, and outside clicks", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const root = component.shadowRoot;
      const dialog = root?.querySelector("dialog") as HTMLDialogElement;
      dialog.close = jest.fn();

      const closeBtn = root?.querySelector(
        ".tasks__dialog-close",
      ) as HTMLButtonElement;
      closeBtn?.click();
      expect(dialog.close).toHaveBeenCalledTimes(1);

      const cancelBtn = root?.querySelector(
        ".tasks__btn-cancel",
      ) as HTMLButtonElement;
      cancelBtn?.click();
      expect(dialog.close).toHaveBeenCalledTimes(2);

      // Outside click on dialog itself
      dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(dialog.close).toHaveBeenCalledTimes(3);

      // Inside click on form
      const form = root?.querySelector(
        ".tasks__dialog-form",
      ) as HTMLFormElement;
      form.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(dialog.close).toHaveBeenCalledTimes(3);

      document.body.removeChild(component);
    });

    it("handles handleAdd when root or form is missing vs present", () => {
      const component = new ShadowClawTasks();
      // Without root
      const detached = new ShadowClawTasks();
      Object.defineProperty(detached, "shadowRoot", { value: null });
      expect(() => detached.handleAdd()).not.toThrow();

      // With root
      document.body.appendChild(component);
      const dialog = component.shadowRoot?.querySelector(
        "dialog",
      ) as HTMLDialogElement;
      dialog.showModal = jest.fn();

      component.handleAdd();
      expect(dialog.showModal).toHaveBeenCalled();
      expect(component.editingTask).toBeNull();
      expect(component.editingTools).toEqual([]);

      document.body.removeChild(component);
    });

    it("handles handleEdit for tools-based and prompt-based tasks", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const dialog = component.shadowRoot?.querySelector(
        "dialog",
      ) as HTMLDialogElement;
      dialog.showModal = jest.fn();

      // 1. Prompt task with all flags
      const promptTask = {
        id: "task-1",
        name: "My Task",
        schedule: "*/5 * * * *",
        type: "prompt",
        prompt: "Run routine",
        freshContext: true,
        subagent: true,
        pushNotifications: true,
      };
      component.handleEdit(promptTask as any);
      expect(dialog.showModal).toHaveBeenCalled();
      expect(component.editingTask).toBe(promptTask);

      // 2. Tools task
      const toolsTask = {
        id: "task-2",
        type: "tools",
        tools: [{ name: "calc", input: { x: 1 } }],
      };
      component.handleEdit(toolsTask as any);
      expect(component.editingTools).toEqual([
        { name: "calc", input: { x: 1 } },
      ]);

      // 3. Detached component
      const detached = new ShadowClawTasks();
      Object.defineProperty(detached, "shadowRoot", { value: null });
      expect(() => detached.handleEdit(promptTask as any)).not.toThrow();

      document.body.removeChild(component);
    });

    it("handles handleRun calling orchestratorStore.runTask", () => {
      const component = new ShadowClawTasks();
      const task = { id: "task-1", prompt: "test" };
      component.handleRun(task as any);
      expect(orchestratorStore.runTask).toHaveBeenCalledWith(task, true);
    });

    it("handles renderToolsEditor events and input parsing", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const root = component.shadowRoot;

      component.editingTools = [
        {
          name: "tool1",
          input: { a: 1 },
          suppressOutput: false,
          suppressToast: false,
        },
        { name: "tool2", input: {}, suppressOutput: true, suppressToast: true },
      ];
      component.renderToolsEditor();

      const items = root?.querySelectorAll(".tasks__tool-item");
      expect(items?.length).toBe(2);

      // Change tool name
      const nameInput = items?.[0].querySelector(
        ".tasks__form-input",
      ) as HTMLInputElement;
      nameInput.value = "tool1-updated";
      nameInput.dispatchEvent(new Event("input"));
      expect(component.editingTools[0].name).toBe("tool1-updated");

      // Change params: empty string
      const textarea = items?.[0].querySelector(
        ".tasks__form-textarea",
      ) as HTMLTextAreaElement;
      textarea.value = "   ";
      textarea.dispatchEvent(new Event("change"));
      expect(component.editingTools[0].input).toEqual({});

      // Change params: valid JSON
      textarea.value = '{"foo": "bar"}';
      textarea.dispatchEvent(new Event("change"));
      expect(component.editingTools[0].input).toEqual({ foo: "bar" });
      expect(textarea.style.borderColor).toBe("");

      // Change params: invalid JSON
      textarea.value = "invalid-json";
      textarea.dispatchEvent(new Event("change"));
      expect(textarea.style.borderColor).not.toBe("");

      // Toggle suppress checkboxes
      const suppressCheckboxes = items?.[0].querySelectorAll(
        ".tasks__tool-suppress input",
      );
      const suppressOutput = suppressCheckboxes?.[0] as HTMLInputElement;
      const suppressToast = suppressCheckboxes?.[1] as HTMLInputElement;

      suppressOutput.checked = true;
      suppressOutput.dispatchEvent(new Event("change"));
      expect(component.editingTools[0].suppressOutput).toBe(true);

      suppressToast.checked = true;
      suppressToast.dispatchEvent(new Event("change"));
      expect(component.editingTools[0].suppressToast).toBe(true);

      // Remove tool
      const removeBtn = items?.[0].querySelector(
        ".tasks__tool-remove-btn",
      ) as HTMLButtonElement;
      removeBtn?.click();
      expect(component.editingTools.length).toBe(1);

      document.body.removeChild(component);
    });

    it("handles renderToolsPreview with empty, single, and multiple tools", () => {
      const component = new ShadowClawTasks();

      // Empty
      expect(component.renderToolsPreview([])).toContain("No tools configured");
      expect(component.renderToolsPreview(null as any)).toContain(
        "No tools configured",
      );

      // Circular JSON tool
      const circular: any = {};
      circular.self = circular;
      const circularTool = { name: "circ", input: circular };
      expect(component.renderToolsPreview([circularTool])).toContain(
        "Invalid JSON",
      );

      // > 2 tools with allowCollapse
      const tools = [
        { name: "t1", input: {} },
        { name: "t2", input: {} },
        { name: "t3", input: {} },
      ];
      const collapsedHtml = component.renderToolsPreview(tools, true);
      expect(collapsedHtml).toContain("<details");
      expect(collapsedHtml).toContain("3 Tools configured");

      // <= 2 tools or allowCollapse false
      const uncollapsedHtml = component.renderToolsPreview(
        tools.slice(0, 2),
        true,
      );
      expect(uncollapsedHtml).not.toContain("<details");
    });

    it("handles handleBackup success and error paths", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);

      (orchestratorStore.getTasksForBackup as jest.Mock).mockReturnValueOnce([
        { id: "t1" },
      ]);
      const clickSpy = jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      await component.handleBackup();
      expect(clickSpy).toHaveBeenCalled();

      // Error path
      (orchestratorStore.getTasksForBackup as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error("Backup failed");
        },
      );
      await component.handleBackup();
      expect(showError).toHaveBeenCalledWith(
        "Failed to create backup: Backup failed",
      );

      clickSpy.mockRestore();
      document.body.removeChild(component);
    });

    it("handles handleClearAll confirmation, execution, and error handling", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const db = {} as any;

      // Cancelled
      const confirmSpy = jest
        .spyOn(component, "requestConfirmation")
        .mockResolvedValueOnce(false);
      await component.handleClearAll(db);
      expect(orchestratorStore.clearAllTasks).not.toHaveBeenCalled();

      // Confirmed & success
      confirmSpy.mockResolvedValueOnce(true);
      (orchestratorStore.clearAllTasks as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      await component.handleClearAll(db);
      expect(orchestratorStore.clearAllTasks).toHaveBeenCalledWith(db);

      // Confirmed & throws Error
      confirmSpy.mockResolvedValueOnce(true);
      (orchestratorStore.clearAllTasks as jest.Mock).mockRejectedValueOnce(
        new Error("Clear error"),
      );
      await component.handleClearAll(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to clear tasks: Clear error",
      );

      // Confirmed & throws String
      confirmSpy.mockResolvedValueOnce(true);
      (orchestratorStore.clearAllTasks as jest.Mock).mockRejectedValueOnce(
        "Disk fault",
      );
      await component.handleClearAll(db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to clear tasks: Disk fault",
      );

      document.body.removeChild(component);
    });

    it("handles handleCopyId clipboard success and error", async () => {
      const component = new ShadowClawTasks();
      const writeTextMock = jest.fn();
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      // Success
      writeTextMock.mockResolvedValueOnce(undefined);
      await component.handleCopyId("task-123");
      expect(showSuccess).toHaveBeenCalledWith("Task ID copied to clipboard!");

      // Error
      writeTextMock.mockRejectedValueOnce(new Error("Clipboard denied"));
      await component.handleCopyId("task-123");
      expect(showError).toHaveBeenCalledWith("Failed to copy task ID.");
    });

    it("handles handleDelete confirmation and deletion", async () => {
      const component = new ShadowClawTasks();
      const db = {} as any;
      (orchestratorStore.deleteTask as jest.Mock).mockClear();

      // Cancelled
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(false);
      await component.handleDelete(db, "t-1");
      expect(orchestratorStore.deleteTask).not.toHaveBeenCalled();

      // Confirmed & success
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(true);
      (orchestratorStore.deleteTask as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      await component.handleDelete(db, "t-1");
      expect(orchestratorStore.deleteTask).toHaveBeenCalledWith(db, "t-1");

      // Confirmed & throws
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(true);
      (orchestratorStore.deleteTask as jest.Mock).mockRejectedValueOnce(
        new Error("Delete failed"),
      );
      await component.handleDelete(db, "t-1");
    });

    it("handles handleEditSubmit validation, update existing, create new, and error", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const root = component.shadowRoot;
      const form = root?.querySelector(
        ".tasks__dialog-form",
      ) as HTMLFormElement;
      const dialog = root?.querySelector("dialog") as HTMLDialogElement;
      dialog.close = jest.fn();
      const db = {} as any;

      // 1. Validation failure: prompt type with empty prompt
      const typeRadio = form.querySelector(
        "input[name='taskType'][value='prompt']",
      ) as HTMLInputElement;
      typeRadio.checked = true;
      const promptTextarea = form.querySelector(
        "textarea[name='prompt']",
      ) as HTMLTextAreaElement;
      promptTextarea.value = "";
      await component.handleEditSubmit(db, form);
      expect(showInfo).toHaveBeenCalledWith("Please provide a task prompt.");

      // 2. Update existing task
      component.editingTask = { id: "existing-task", name: "Old Name" };
      promptTextarea.value = "Updated prompt";
      (orchestratorStore.upsertTask as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      await component.handleEditSubmit(db, form);
      expect(orchestratorStore.upsertTask).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          id: "existing-task",
          prompt: "Updated prompt",
        }),
      );
      expect(dialog.close).toHaveBeenCalled();
      expect(component.editingTask).toBeNull();

      // 3. Create new task
      component.editingTask = null;
      promptTextarea.value = "New prompt";
      (orchestratorStore.upsertTask as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      await component.handleEditSubmit(db, form);
      expect(orchestratorStore.upsertTask).toHaveBeenCalledWith(
        db,
        expect.objectContaining({ prompt: "New prompt", enabled: true }),
      );

      // 4. Upsert throws Error
      (orchestratorStore.upsertTask as jest.Mock).mockRejectedValueOnce(
        new Error("DB locked"),
      );
      await component.handleEditSubmit(db, form);
      expect(showError).toHaveBeenCalledWith("Failed to save task: DB locked");

      // 5. Upsert throws String
      (orchestratorStore.upsertTask as jest.Mock).mockRejectedValueOnce(
        "Lock timeout",
      );
      await component.handleEditSubmit(db, form);
      expect(showError).toHaveBeenCalledWith(
        "Failed to save task: Lock timeout",
      );

      document.body.removeChild(component);
    });

    it("handles handlePreviewLinkClick navigation and candidate resolution", async () => {
      const component = new ShadowClawTasks();
      const db = {} as any;

      // 1. Prevented or modifier keys
      const preventedEvent = { defaultPrevented: true, button: 0 } as any;
      await component.handlePreviewLinkClick(preventedEvent, db);

      const rightClickEvent = { defaultPrevented: false, button: 2 } as any;
      await component.handlePreviewLinkClick(rightClickEvent, db);

      const metaClickEvent = {
        defaultPrevented: false,
        button: 0,
        metaKey: true,
      } as any;
      await component.handlePreviewLinkClick(metaClickEvent, db);

      // 2. Not on anchor
      const notAnchorEvent = {
        defaultPrevented: false,
        button: 0,
        target: document.createElement("div"),
      } as any;
      await component.handlePreviewLinkClick(notAnchorEvent, db);

      // 3. Anchor with link that resolves and opens successfully
      const anchor = document.createElement("a");
      anchor.setAttribute("href", "docs/guide.md");
      const clickEvent = {
        defaultPrevented: false,
        button: 0,
        target: anchor,
        preventDefault: jest.fn(),
      } as any;

      (fileViewerStore.openFile as jest.Mock).mockClear();
      (fileViewerStore.openFile as jest.Mock).mockResolvedValueOnce(undefined);
      await component.handlePreviewLinkClick(clickEvent, db);
      expect(fileViewerStore.openFile).toHaveBeenCalledWith(
        db,
        "docs/guide.md",
        orchestratorStore.activeGroupId,
      );
      expect(clickEvent.preventDefault).toHaveBeenCalled();

      // 4. Anchor without extension tries .md and /index.md fallback
      const anchorNoExt = document.createElement("a");
      anchorNoExt.setAttribute("href", "docs/readme");
      const clickEvent2 = {
        defaultPrevented: false,
        button: 0,
        target: anchorNoExt,
        preventDefault: jest.fn(),
      } as any;

      // First attempt fails, second (.md) succeeds
      (fileViewerStore.openFile as jest.Mock).mockClear();
      (fileViewerStore.openFile as jest.Mock)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce(undefined);

      await component.handlePreviewLinkClick(clickEvent2, db);
      expect(fileViewerStore.openFile).toHaveBeenNthCalledWith(
        1,
        db,
        "docs/readme",
        orchestratorStore.activeGroupId,
      );
      expect(fileViewerStore.openFile).toHaveBeenNthCalledWith(
        2,
        db,
        "docs/readme.md",
        orchestratorStore.activeGroupId,
      );

      // 5. All attempts fail -> showError
      const anchorFail = document.createElement("a");
      anchorFail.setAttribute("href", "missing/file");
      const clickEvent3 = {
        defaultPrevented: false,
        button: 0,
        target: anchorFail,
        preventDefault: jest.fn(),
      } as any;

      (fileViewerStore.openFile as jest.Mock).mockRejectedValue(
        new Error("not found"),
      );
      await component.handlePreviewLinkClick(clickEvent3, db);
      expect(showError).toHaveBeenCalledWith(
        "Failed to open linked file: missing/file",
        5000,
      );
    });

    it("handles handleReorder with precomputedIds and index lookups", async () => {
      const component = new ShadowClawTasks();
      (orchestratorStore as any).tasks = [
        { id: "t1" },
        { id: "t2" },
        { id: "t3" },
      ];

      // With precomputedIds
      await component.handleReorder("t1", "t3", ["t2", "t3", "t1"]);
      expect(orchestratorStore.reorderTasks).toHaveBeenCalledWith(
        expect.anything(),
        orchestratorStore.activeGroupId,
        ["t2", "t3", "t1"],
      );

      // Without precomputedIds: valid swap
      await component.handleReorder("t1", "t3");
      expect(orchestratorStore.reorderTasks).toHaveBeenCalledWith(
        expect.anything(),
        orchestratorStore.activeGroupId,
        ["t2", "t3", "t1"],
      );

      // Unknown id -> returns early
      (orchestratorStore.reorderTasks as jest.Mock).mockClear();
      await component.handleReorder("unknown", "t3");
      expect(orchestratorStore.reorderTasks).not.toHaveBeenCalled();
    });

    it("handles handleRestore validation, cancellation, success, and errors", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const db = {} as any;
      const input = document.createElement("input");
      input.type = "file";
      (orchestratorStore.restoreTasksFromBackup as jest.Mock).mockClear();

      // 1. No files
      await component.handleRestore(db, input);

      // 2. Non-JSON file
      const textFile = new File(["hello"], "backup.txt", {
        type: "text/plain",
      });
      Object.defineProperty(input, "files", {
        value: [textFile],
        configurable: true,
      });
      await component.handleRestore(db, input);
      expect(showInfo).toHaveBeenCalledWith("Please select a .json file");

      // 3. Cancelled confirmation
      const jsonFile = new File(['[{"id":"t1"}]'], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(input, "files", {
        value: [jsonFile],
        configurable: true,
      });
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(false);
      await component.handleRestore(db, input);
      expect(orchestratorStore.restoreTasksFromBackup).not.toHaveBeenCalled();

      // 4. Confirmed & valid JSON array
      const jsonFile2 = new File(['[{"id":"t1"}]'], "backup.json", {
        type: "application/json",
      });
      jsonFile2.text = jest.fn<any>().mockResolvedValue('[{"id":"t1"}]');
      Object.defineProperty(input, "files", {
        value: [jsonFile2],
        configurable: true,
      });
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(true);
      (
        orchestratorStore.restoreTasksFromBackup as jest.Mock
      ).mockResolvedValueOnce(undefined);
      await component.handleRestore(db, input);
      expect(orchestratorStore.restoreTasksFromBackup).toHaveBeenCalledWith(
        db,
        [{ id: "t1" }],
      );
      expect(showSuccess).toHaveBeenCalledWith("Tasks restored successfully!");

      // 5. Confirmed & non-array JSON
      const badJsonFile = new File(['{"id":"t1"}'], "backup.json", {
        type: "application/json",
      });
      badJsonFile.text = jest.fn<any>().mockResolvedValue('{"id":"t1"}');
      Object.defineProperty(input, "files", {
        value: [badJsonFile],
        configurable: true,
      });
      jest.spyOn(component, "requestConfirmation").mockResolvedValueOnce(true);
      await component.handleRestore(db, input);
      expect(showError).toHaveBeenCalledWith(
        "Failed to restore from backup: Invalid backup file format",
      );

      document.body.removeChild(component);
    });

    it("handles renderPreview with empty, short, and long markdown", async () => {
      const component = new ShadowClawTasks();

      // Empty
      expect(await component.renderPreview("   ")).toContain("No content");

      // Short prompt
      const short = await component.renderPreview("Short note");
      expect(short).not.toContain("<details");

      // Long prompt with allowCollapse = true
      const longText = "A".repeat(150);
      const long = await component.renderPreview(longText, true);
      expect(long).toContain("<details");
      expect(long).toContain("<summary");
    });

    it("handles requestConfirmation with app shell and fallback", async () => {
      const component = new ShadowClawTasks();

      // 1. Without app shell
      const result1 = await component.requestConfirmation({
        title: "Test",
        message: "Are you sure?",
      });
      expect(result1).toBe(false);
      expect(showInfo).toHaveBeenCalledWith("Are you sure?", 4000);

      // 2. With app shell
      const appShell = document.createElement("shadow-claw");
      (appShell as any).requestDialog = jest.fn().mockResolvedValue(true);
      document.body.appendChild(appShell);

      const result2 = await component.requestConfirmation({
        title: "Test",
        message: "Are you sure?",
      });
      expect(result2).toBe(true);
      expect((appShell as any).requestDialog).toHaveBeenCalled();

      document.body.removeChild(appShell);
    });

    it("handles updatePushNotificationsCheckboxState conditions and exceptions", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const root = component.shadowRoot;
      const pushInput = root?.querySelector(
        "#tasksPushNotificationsInput",
      ) as HTMLInputElement;
      const scheduleInput = root?.querySelector(
        "input[name='schedule']",
      ) as HTMLInputElement;

      // Schedule empty -> disabled
      scheduleInput.value = "";
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);
      expect(pushInput.checked).toBe(false);

      // Schedule set + taskServerEnabled + hasSubscription
      scheduleInput.value = "0 * * * *";
      (orchestratorStore as any).taskServerEnabled = true;
      (getCurrentSubscription as jest.Mock).mockResolvedValueOnce({
        endpoint: "https://push",
      });
      await component.updatePushNotificationsCheckboxState(true);
      expect(pushInput.disabled).toBe(false);
      expect(pushInput.checked).toBe(true);

      // Subscription check throws -> disabled
      (getCurrentSubscription as jest.Mock).mockRejectedValueOnce(
        new Error("Push error"),
      );
      await component.updatePushNotificationsCheckboxState();
      expect(pushInput.disabled).toBe(true);

      document.body.removeChild(component);
    });

    it("handles updateTaskList empty state, item actions, and drag/keyboard events", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const db = {} as any;
      const root = component.shadowRoot;

      // 1. Empty tasks
      (orchestratorStore as any).tasks = [];
      await component.updateTaskList(db);
      expect(root?.querySelector("shadow-claw-empty-state")).not.toBeNull();

      // 2. Populated tasks
      const task1 = {
        id: "task-1",
        name: "Backup Run",
        schedule: "0 0 * * *",
        type: "prompt",
        prompt: "Run daily backup",
        enabled: true,
        lastRun: Date.now(),
        freshContext: true,
        subagent: true,
        pushNotifications: true,
      };
      const task2 = {
        id: "task-2",
        type: "tools",
        tools: [{ name: "toolA" }],
        enabled: false,
        lastRun: null,
      };
      (orchestratorStore as any).tasks = [task1, task2];
      await component.updateTaskList(db);

      const items = root?.querySelectorAll(".tasks__item");
      expect(items?.length).toBe(2);

      // Toggle input change
      const toggle = items?.[0].querySelector(
        ".tasks__toggle-input",
      ) as HTMLInputElement;
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change"));
      expect(orchestratorStore.toggleTask).toHaveBeenCalledWith(
        db,
        task1,
        false,
      );

      // Copy ID button click
      const copyBtn = items?.[0].querySelector(
        ".tasks__copy-id-btn",
      ) as HTMLButtonElement;
      const copySpy = jest
        .spyOn(component, "handleCopyId")
        .mockImplementation(async () => {});
      copyBtn?.click();
      expect(copySpy).toHaveBeenCalledWith("task-1");

      // Run button click
      const runBtn = items?.[0].querySelector(
        ".tasks__run-btn",
      ) as HTMLButtonElement;
      runBtn?.click();
      expect(orchestratorStore.runTask).toHaveBeenCalledWith(task1, true);

      // Edit button click
      const editBtn = items?.[0].querySelector(
        ".tasks__edit-btn",
      ) as HTMLButtonElement;
      const editSpy = jest
        .spyOn(component, "handleEdit")
        .mockImplementation(() => {});
      editBtn?.click();
      expect(editSpy).toHaveBeenCalledWith(task1);

      // Delete button click
      const deleteBtn = items?.[0].querySelector(
        ".tasks__delete-btn",
      ) as HTMLButtonElement;
      const deleteSpy = jest
        .spyOn(component, "handleDelete")
        .mockImplementation(async () => {});
      deleteBtn?.click();
      expect(deleteSpy).toHaveBeenCalledWith(db, "task-1");

      // Drag handle events
      const handleEl = items?.[0].querySelector(
        ".tasks__drag-handle",
      ) as HTMLElement;
      const dragStartEvent = new Event("dragstart") as any;
      dragStartEvent.dataTransfer = { setData: jest.fn() };
      handleEl?.dispatchEvent(dragStartEvent);
      expect((component as any)._draggedTaskId).toBe("task-1");

      // Dragover on item 2
      const dragOverEvent = new Event("dragover") as any;
      dragOverEvent.preventDefault = jest.fn();
      items?.[1].dispatchEvent(dragOverEvent);
      expect(items?.[1].classList.contains("drag-over")).toBe(true);

      // Dragleave on item 2
      items?.[1].dispatchEvent(new Event("dragleave"));
      expect(items?.[1].classList.contains("drag-over")).toBe(false);

      // Drop on item 2
      const dropEvent = new Event("drop") as any;
      dropEvent.preventDefault = jest.fn();
      const reorderSpy = jest
        .spyOn(component, "handleReorder")
        .mockImplementation(async () => {});
      items?.[1].dispatchEvent(dropEvent);
      expect(reorderSpy).toHaveBeenCalledWith("task-1", "task-2");

      // Dragend on handle
      handleEl?.dispatchEvent(new Event("dragend"));
      expect((component as any)._draggedTaskId).toBeNull();

      document.body.removeChild(component);
    });

    it("handles touch move, end, and cancel interactions in list", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const db = {} as any;
      (orchestratorStore as any).tasks = [
        { id: "t1", prompt: "first" },
        { id: "t2", prompt: "second" },
      ];
      await component.updateTaskList(db);
      const list = component.shadowRoot?.querySelector(
        ".tasks__list",
      ) as HTMLElement;

      // Start touch drag
      (component as any)._touchId = 5;
      (component as any)._touchDraggedTaskId = "t1";

      // Mock itemAtPoint
      const item2 = list.children[1] as HTMLElement;
      jest.spyOn(component as any, "_itemAtPoint").mockReturnValue(item2);

      // touchmove
      const touchMoveEvent = new Event("touchmove") as any;
      touchMoveEvent.preventDefault = jest.fn();
      touchMoveEvent.touches = [{ identifier: 5, clientX: 50, clientY: 200 }];
      list.dispatchEvent(touchMoveEvent);
      expect(item2.classList.contains("drag-over")).toBe(true);

      // touchend
      item2.classList.add("dragging");
      item2.classList.add("drag-over");
      const touchEndEvent = new Event("touchend") as any;
      touchEndEvent.changedTouches = [
        { identifier: 5, clientX: 50, clientY: 200 },
      ];
      const reorderSpy = jest
        .spyOn(component, "handleReorder")
        .mockImplementation(async () => {});
      list.dispatchEvent(touchEndEvent);
      expect(reorderSpy).toHaveBeenCalledWith("t1", "t2");
      expect((component as any)._touchDraggedTaskId).toBeNull();
      expect(item2.classList.contains("dragging")).toBe(false);

      // touchmove guards: null dragged task id
      (component as any)._touchDraggedTaskId = null;
      list.dispatchEvent(touchMoveEvent);

      // touchmove guards: unmatched touch id
      (component as any)._touchDraggedTaskId = "t1";
      const unmatchedTouchMove = new Event("touchmove") as any;
      unmatchedTouchMove.touches = [
        { identifier: 99, clientX: 50, clientY: 200 },
      ];
      unmatchedTouchMove.preventDefault = jest.fn();
      list.dispatchEvent(unmatchedTouchMove);

      // touchmove when target has same id as dragged task id
      jest
        .spyOn(component as any, "_itemAtPoint")
        .mockReturnValueOnce(list.children[0] as HTMLElement);
      list.dispatchEvent(touchMoveEvent);

      // touchend guard: null dragged task id
      (component as any)._touchDraggedTaskId = null;
      list.dispatchEvent(touchEndEvent);

      // touchend guard: unmatched changed touch id
      (component as any)._touchDraggedTaskId = "t1";
      const unmatchedTouchEnd = new Event("touchend") as any;
      unmatchedTouchEnd.changedTouches = [
        { identifier: 99, clientX: 50, clientY: 200 },
      ];
      list.dispatchEvent(unmatchedTouchEnd);

      // _bindTouchListEvents when already bound
      (component as any)._bindTouchListEvents(list);

      document.body.removeChild(component);
    });

    it("handles promptTextarea and schedule input events in dialog", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const root = component.shadowRoot;

      const promptTextarea = root?.querySelector(
        "textarea[name='prompt']",
      ) as HTMLTextAreaElement;
      const scheduleInput = root?.querySelector(
        "input[name='schedule']",
      ) as HTMLInputElement;

      const updatePushSpy = jest
        .spyOn(component, "updatePushNotificationsCheckboxState")
        .mockImplementation(async () => {});
      scheduleInput.dispatchEvent(new Event("input"));
      expect(updatePushSpy).toHaveBeenCalled();

      // promptTextarea input when prompt radio checked
      promptTextarea.value = "New prompt text";
      promptTextarea.dispatchEvent(new Event("input"));

      // promptTextarea input when tools radio checked
      const toolsRadio = root?.querySelector(
        "input[name='taskType'][value='tools']",
      ) as HTMLInputElement;
      if (toolsRadio) {
        toolsRadio.checked = true;
        promptTextarea.dispatchEvent(new Event("input"));
      }

      document.body.removeChild(component);
    });

    it("handles full keyboard navigation and reordering lifecycle", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const db = {} as any;
      (orchestratorStore as any).tasks = [
        { id: "t1", name: "Task 1", prompt: "p1" },
        { id: "t2", name: "Task 2", prompt: "p2" },
      ];
      await component.updateTaskList(db);
      const items = component.shadowRoot?.querySelectorAll(
        ".tasks__item",
      ) as NodeListOf<HTMLElement>;

      // Arrow navigation when not grabbed
      const nextItemSpy = jest
        .spyOn(component as any, "_focusNextItem")
        .mockImplementation(() => {});
      const prevItemSpy = jest
        .spyOn(component as any, "_focusPrevItem")
        .mockImplementation(() => {});
      const nextFocusSpy = jest
        .spyOn(component as any, "_focusNext")
        .mockImplementation(() => {});
      const prevFocusSpy = jest
        .spyOn(component as any, "_focusPrev")
        .mockImplementation(() => {});

      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
      expect(nextItemSpy).toHaveBeenCalled();

      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      expect(prevItemSpy).toHaveBeenCalled();

      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight" }),
      );
      expect(nextFocusSpy).toHaveBeenCalled();

      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft" }),
      );
      expect(prevFocusSpy).toHaveBeenCalled();

      // Grab with 'm'
      const announceSpy = jest
        .spyOn(component as any, "_announce")
        .mockImplementation(() => {});
      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
      expect((component as any)._keyboardGrabbedId).toBe("t1");
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("Task 1 grabbed"),
      );

      // ArrowDown while grabbed (swap position)
      const reorderSpy = jest
        .spyOn(component, "handleReorder")
        .mockImplementation(async () => {});
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown" }),
      );
      expect(reorderSpy).toHaveBeenCalled();

      // ArrowUp out of bounds (at top position 0)
      reorderSpy.mockClear();
      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      expect(reorderSpy).not.toHaveBeenCalled();

      // Cancel with Escape
      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect((component as any)._keyboardGrabbedId).toBeNull();
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("Reorder cancelled"),
      );

      // Grab again and drop with Space
      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
      expect((component as any)._keyboardGrabbedId).toBe("t1");
      items[0].dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      expect((component as any)._keyboardGrabbedId).toBeNull();
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("dropped at position"),
      );

      document.body.removeChild(component);
    });

    it("handles helper methods: escapeHtml, dispatchTerminalSlotReady, focus and item lookups", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);

      // escapeHtml
      expect(component.escapeHtml("<b>test</b>")).toBe(
        "&lt;b&gt;test&lt;/b&gt;",
      );

      // dispatchTerminalSlotReady
      const eventSpy = jest.fn();
      component.addEventListener("shadow-claw-terminal-slot-ready", eventSpy);
      component.dispatchTerminalSlotReady();
      expect(eventSpy).toHaveBeenCalled();

      // _itemAtPoint without root
      const detached = new ShadowClawTasks();
      Object.defineProperty(detached, "shadowRoot", { value: null });
      expect((detached as any)._itemAtPoint(0, 0)).toBeNull();
      expect(
        (detached as any)._focusNext(document.createElement("div")),
      ).toBeUndefined();
      expect(
        (detached as any)._focusPrev(document.createElement("div")),
      ).toBeUndefined();
      expect(
        (detached as any)._focusNextItem(document.createElement("div")),
      ).toBeUndefined();
      expect(
        (detached as any)._focusPrevItem(document.createElement("div")),
      ).toBeUndefined();

      // _findTouch and _findChangedTouch with unmatched identifier
      const fakeTouchEvent = {
        touches: [{ identifier: 99 }],
        changedTouches: [{ identifier: 99 }],
      } as any;
      (component as any)._touchId = 1;
      expect((component as any)._findTouch(fakeTouchEvent)).toBeUndefined();
      expect(
        (component as any)._findChangedTouch(fakeTouchEvent),
      ).toBeUndefined();

      // _updateAutoScrollSpeed without content element
      const detached2 = new ShadowClawTasks();
      Object.defineProperty(detached2, "shadowRoot", {
        value: document.createElement("div"),
      });
      (detached2 as any)._updateAutoScrollSpeed(100);
      expect((detached2 as any)._autoScrollSpeed).toBe(0);

      document.body.removeChild(component);
    });

    it("handles _announce with live-region element", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const region = component.shadowRoot?.querySelector(
        "#live-region",
      ) as HTMLElement;
      expect(region).not.toBeNull();

      jest
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb: any) => {
          cb(0);
          return 0;
        });

      (component as any)._announce("Test announcement");
      expect(region.textContent).toBe("Test announcement");

      document.body.removeChild(component);
    });

    it("handles _startAutoScroll loop execution and guards", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const content = component.shadowRoot?.querySelector(
        ".tasks__content",
      ) as HTMLElement;

      let rafCallback: any = null;
      jest
        .spyOn(window, "requestAnimationFrame")
        .mockImplementation((cb: any) => {
          rafCallback = cb;
          return 1;
        });

      // Start scroll with speed
      (component as any)._autoScrollSpeed = 5;
      (component as any)._startAutoScroll();
      expect((component as any)._autoScrollActive).toBe(true);

      // Calling start again while active is no-op
      (component as any)._startAutoScroll();

      // Run scrollLoop step
      const initialScroll = content.scrollTop;
      rafCallback();
      expect(content.scrollTop).toBe(initialScroll + 5);

      // Stop auto scroll
      (component as any)._stopAutoScroll();
      expect((component as any)._autoScrollActive).toBe(false);

      // Step while inactive
      rafCallback();

      document.body.removeChild(component);
    });

    it("handles touchcancel event resetting drag classes and state", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);
      const list = component.shadowRoot?.querySelector(
        ".tasks__list",
      ) as HTMLElement;
      expect(list).not.toBeNull();

      const item1 = document.createElement("div");
      item1.className = "tasks__item dragging";
      const item2 = document.createElement("div");
      item2.className = "tasks__item drag-over";
      list.append(item1, item2);

      (component as any)._bindTouchListEvents(list);
      (component as any)._touchDraggedTaskId = "task-1";
      (component as any)._touchId = 123;
      (component as any)._autoScrollActive = true;

      const cancelEvent = new Event("touchcancel");
      list.dispatchEvent(cancelEvent);

      expect(item1.classList.contains("dragging")).toBe(false);
      expect(item2.classList.contains("drag-over")).toBe(false);
      expect((component as any)._touchDraggedTaskId).toBeNull();
      expect((component as any)._touchId).toBeNull();
      expect((component as any)._autoScrollActive).toBe(false);

      document.body.removeChild(component);
    });

    it("handles _focusNext, _focusPrev, _focusNextItem, _focusPrevItem across focusable boundaries", () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);

      const item1 = document.createElement("div");
      item1.className = "tasks__item";
      item1.setAttribute("tabindex", "0");

      const btn1 = document.createElement("button");
      item1.appendChild(btn1);

      const item2 = document.createElement("div");
      item2.className = "tasks__item";
      item2.setAttribute("tabindex", "0");

      const input2 = document.createElement("input");
      item2.appendChild(input2);

      component.shadowRoot?.append(item1, item2);

      const focusSpy1 = jest.spyOn(item1, "focus");
      const focusSpy2 = jest.spyOn(item2, "focus");
      const focusSpyBtn = jest.spyOn(btn1, "focus");
      jest.spyOn(input2, "focus");

      // _focusNext on item1 should focus next focusable (btn1)
      (component as any)._focusNext(item1);
      expect(focusSpyBtn).toHaveBeenCalled();

      // _focusNext on the last focusable (input2) should not focus anything beyond
      (component as any)._focusNext(input2);

      // _focusPrev on item1 (first focusable) should not focus anything before
      (component as any)._focusPrev(item1);

      // _focusPrev on input2 should focus item2
      (component as any)._focusPrev(input2);
      expect(focusSpy2).toHaveBeenCalled();

      // _focusNextItem on item1 should focus item2
      (component as any)._focusNextItem(item1);
      expect(focusSpy2).toHaveBeenCalled();

      // _focusNextItem on item2 (last item) should not throw or change
      (component as any)._focusNextItem(item2);

      // _focusPrevItem on item2 should focus item1
      (component as any)._focusPrevItem(item2);
      expect(focusSpy1).toHaveBeenCalled();

      // _focusPrevItem on item1 (first item) should not throw
      (component as any)._focusPrevItem(item1);

      // Boundary tests where element is not part of list
      const outsider = document.createElement("div");
      (component as any)._focusNext(outsider);
      (component as any)._focusPrev(outsider);
      (component as any)._focusNextItem(outsider);
      (component as any)._focusPrevItem(outsider);

      document.body.removeChild(component);
    });

    it("handles keyboard events for navigation and item reordering", async () => {
      const component = new ShadowClawTasks();
      document.body.appendChild(component);

      (orchestratorStore as any).tasks = [
        {
          id: "task-1",
          name: "Task 1",
          enabled: true,
          schedule: "* * * * *",
        } as any,
        {
          id: "task-2",
          name: "Task 2",
          enabled: true,
          schedule: "* * * * *",
        } as any,
        {
          id: "task-3",
          name: "Task 3",
          enabled: true,
          schedule: "* * * * *",
        } as any,
      ];

      const item1 = document.createElement("div");
      item1.className = "tasks__item";
      item1.setAttribute("tabindex", "0");
      component.shadowRoot?.appendChild(item1);

      const focusNextItemSpy = jest
        .spyOn(component as any, "_focusNextItem")
        .mockImplementation(() => {});
      const focusPrevItemSpy = jest
        .spyOn(component as any, "_focusPrevItem")
        .mockImplementation(() => {});
      const focusNextSpy = jest
        .spyOn(component as any, "_focusNext")
        .mockImplementation(() => {});
      const focusPrevSpy = jest
        .spyOn(component as any, "_focusPrev")
        .mockImplementation(() => {});
      const announceSpy = jest
        .spyOn(component as any, "_announce")
        .mockImplementation(() => {});
      const handleReorderSpy = jest
        .spyOn(component, "handleReorder")
        .mockImplementation(() => {});

      // ArrowDown
      const eventDown = new KeyboardEvent("keydown", { key: "ArrowDown" });
      Object.defineProperty(eventDown, "target", { value: item1 });
      (component as any)._handleKeyboard(eventDown, "task-1", "Task 1");
      expect(focusNextItemSpy).toHaveBeenCalledWith(item1);

      // ArrowUp
      const eventUp = new KeyboardEvent("keydown", { key: "ArrowUp" });
      Object.defineProperty(eventUp, "target", { value: item1 });
      (component as any)._handleKeyboard(eventUp, "task-1", "Task 1");
      expect(focusPrevItemSpy).toHaveBeenCalledWith(item1);

      // ArrowRight
      const eventRight = new KeyboardEvent("keydown", { key: "ArrowRight" });
      Object.defineProperty(eventRight, "target", { value: item1 });
      (component as any)._handleKeyboard(eventRight, "task-1", "Task 1");
      expect(focusNextSpy).toHaveBeenCalledWith(item1);

      // ArrowLeft
      const eventLeft = new KeyboardEvent("keydown", { key: "ArrowLeft" });
      Object.defineProperty(eventLeft, "target", { value: item1 });
      (component as any)._handleKeyboard(eventLeft, "task-1", "Task 1");
      expect(focusPrevSpy).toHaveBeenCalledWith(item1);

      // Grab with 'm'
      const eventGrab = new KeyboardEvent("keydown", { key: "m" });
      (component as any)._handleKeyboard(eventGrab, "task-1", "Task 1");
      expect((component as any)._keyboardGrabbedId).toBe("task-1");
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("grabbed"),
      );

      // ArrowUp at top boundary (idx 0 -> -1)
      const eventReorderUpBound = new KeyboardEvent("keydown", {
        key: "ArrowUp",
      });
      (component as any)._handleKeyboard(
        eventReorderUpBound,
        "task-1",
        "Task 1",
      );
      expect(handleReorderSpy).not.toHaveBeenCalled();

      // ArrowDown to move to idx 1
      const eventReorderDown = new KeyboardEvent("keydown", {
        key: "ArrowDown",
      });
      (component as any)._handleKeyboard(eventReorderDown, "task-1", "Task 1");
      expect(handleReorderSpy).toHaveBeenCalledWith("task-1", "task-2", [
        "task-2",
        "task-1",
        "task-3",
      ]);

      // Drop with Space
      const eventDrop = new KeyboardEvent("keydown", { key: " " });
      (component as any)._handleKeyboard(eventDrop, "task-1", "Task 1");
      expect((component as any)._keyboardGrabbedId).toBeNull();
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("dropped"),
      );

      // Grab again with 'M' and cancel with Escape
      const eventGrabCap = new KeyboardEvent("keydown", { key: "M" });
      (component as any)._handleKeyboard(eventGrabCap, "task-2", "Task 2");
      expect((component as any)._keyboardGrabbedId).toBe("task-2");

      const eventCancel = new KeyboardEvent("keydown", { key: "Escape" });
      (component as any)._handleKeyboard(eventCancel, "task-2", "Task 2");
      expect((component as any)._keyboardGrabbedId).toBeNull();
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringContaining("cancelled"),
      );

      // Unhandled key while not grabbed
      const eventIgnored = new KeyboardEvent("keydown", { key: "Tab" });
      (component as any)._handleKeyboard(eventIgnored, "task-1", "Task 1");

      document.body.removeChild(component);
    });
  });
});
