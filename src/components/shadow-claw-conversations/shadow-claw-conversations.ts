import { ChannelRegistry } from "../../channels/channel-registry.js";
import { CONFIG_KEYS } from "../../config.js";
import { getConfig } from "../../db/getConfig.js";
import { orchestratorStore } from "../../stores/orchestrator.js";

import { effect } from "../../effect.js";
import { setConfig } from "../../db/setConfig.js";
import { getDb, ShadowClawDatabase } from "../../db/db.js";
import "../shadow-claw-dialog/shadow-claw-dialog.js";
import ShadowClawElement from "../shadow-claw-element.js";

const elementName = "shadow-claw-conversations";
export class ShadowClawConversations extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawConversations.componentPath}/${elementName}.css`;
  static template = `${ShadowClawConversations.componentPath}/${elementName}.html`;

  public channelRegistry: ChannelRegistry | null = null;
  public db: ShadowClawDatabase | null = null;

  private _draggedGroupId: string | null = null;
  private _effectCleanup: (() => void) | null = null;
  private _keyboardGrabbedId: string | null = null;
  private _resizing: boolean = false;
  private _touchDraggedGroupId: string | null = null;
  private _touchId: number | null = null;
  private _pendingRenameGroupId: string | null = null;
  private _pendingRenameName: string | null = null;
  private _pendingDeleteGroupId: string | null = null;
  private _pendingCloneGroupId: string | null = null;

  getChannelRegistry(): ChannelRegistry | null {
    const current = orchestratorStore.orchestrator?.channelRegistry || null;
    if (current) {
      this.channelRegistry = current;
    }

    return this.channelRegistry;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    this.db = await getDb();

    // Restore persisted height
    const saved = await getConfig(this.db, CONFIG_KEYS.CONVERSATIONS_HEIGHT);
    if (saved && typeof saved === "number" && saved > 0) {
      this.style.flex = "none";
      this.style.height = `${saved}px`;
    }

    this.channelRegistry =
      orchestratorStore.orchestrator?.channelRegistry || null;

    (this.shadowRoot as ShadowRoot)
      .querySelector("[data-action='create']")
      ?.addEventListener("click", () => this.handleCreate());

    // Dialog event listeners
    this._setupDialogListeners();

    this._initResizeHandle();
    this.render();

    // Re-render when store state changes
    this._effectCleanup = effect(() => {
      // Access signals to establish tracking
      orchestratorStore.groups;
      orchestratorStore.activeGroupId;
      orchestratorStore.unreadGroupIds;

      this.render();
    });
  }

  _initResizeHandle() {
    const handle = (this.shadowRoot as ShadowRoot).querySelector(
      ".resize-handle",
    );

    if (!handle) {
      return;
    }

    let activePointerId: number | null = null;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) {
        return;
      }

      const parentRect = this.parentElement?.getBoundingClientRect();
      if (!parentRect) {
        return;
      }

      const rect = this.getBoundingClientRect();
      const newHeight = rect.bottom - e.clientY;
      const minHeight = 80;
      const maxHeight = parentRect.height - 60;
      const clamped = Math.max(minHeight, Math.min(maxHeight, newHeight));

      this.style.flex = "none";
      this.style.height = `${clamped}px`;
    };

    const stopResize = () => {
      if (activePointerId === null) {
        return;
      }

      activePointerId = null;
      handle.classList.remove("active");

      this._resizing = false;

      document.removeEventListener(
        "pointermove",
        onPointerMove as EventListener,
      );

      this._persistHeight();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) {
        return;
      }

      stopResize();
    };

    handle.addEventListener("pointerdown", (e: Event) => {
      const pointerEvent = e as PointerEvent;
      if (
        pointerEvent.pointerType === "mouse" &&
        pointerEvent.button !== 0 &&
        pointerEvent.button !== -1
      ) {
        return;
      }

      pointerEvent.preventDefault();

      activePointerId = pointerEvent.pointerId;
      handle.classList.add("active");

      this._resizing = true;

      handle.setPointerCapture(pointerEvent.pointerId);
      document.addEventListener("pointermove", onPointerMove as EventListener);
    });

    handle.addEventListener("pointerup", onPointerUp as EventListener);
    handle.addEventListener("pointercancel", stopResize);

    handle.addEventListener("dblclick", () => {
      this.style.flex = "";
      this.style.height = "";

      this._persistHeight(0);
    });
  }

  /**
   * Persist the current height to IndexedDB.
   */
  async _persistHeight(height?: number) {
    if (!this.db) {
      return;
    }

    const val =
      height !== undefined ? height : this.getBoundingClientRect().height;

    await setConfig(this.db, CONFIG_KEYS.CONVERSATIONS_HEIGHT, val || 0);
  }

  async render() {
    const list = (this.shadowRoot as ShadowRoot).querySelector(
      ".conversation-list",
    );

    if (!list) {
      return;
    }

    const groups = orchestratorStore.groups || [];
    const activeId = orchestratorStore.activeGroupId;
    const unreadIds = orchestratorStore.unreadGroupIds || new Set();
    const channelRegistry = this.getChannelRegistry();

    list.replaceChildren();

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const isActive = group.groupId === activeId;
      const isUnread = !isActive && unreadIds.has(group.groupId);
      const li = document.createElement("li");

      li.className = `conversation-item${isActive ? " active" : ""}${isUnread ? " unread" : ""}`;
      li.setAttribute("data-group-id", group.groupId);
      li.setAttribute("role", "listitem");
      li.setAttribute("tabindex", "0");
      li.setAttribute("aria-describedby", "reorder-instructions");
      li.setAttribute(
        "aria-label",
        `${group.name}, position ${i + 1} of ${groups.length}`,
      );

      if (this._keyboardGrabbedId === group.groupId) {
        li.classList.add("keyboard-grabbed");

        li.setAttribute("aria-grabbed", "true");
      }

      const badge = channelRegistry
        ? channelRegistry.getBadge(group.groupId)
        : "";

      const canDelete = groups.length > 1;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.setAttribute("draggable", "true");
      handle.setAttribute("aria-hidden", "true");
      handle.setAttribute("title", "Drag to reorder");
      handle.textContent = "⠿";

      li.append(handle);

      if (badge) {
        const badgeEl = document.createElement("span");
        badgeEl.className = "channel-badge";
        badgeEl.textContent = badge;
        li.append(badgeEl);
      }

      const nameEl = document.createElement("span");
      nameEl.className = "conversation-name";
      nameEl.textContent = group.name;

      const actionsEl = document.createElement("span");
      actionsEl.className = "conversation-actions";

      const cloneBtn = document.createElement("button");
      cloneBtn.setAttribute("data-action", "clone");
      cloneBtn.setAttribute("title", "Clone");
      cloneBtn.setAttribute("aria-label", `Clone ${group.name}`);
      cloneBtn.textContent = "📋";

      const renameBtn = document.createElement("button");
      renameBtn.setAttribute("data-action", "rename");
      renameBtn.setAttribute("title", "Rename");
      renameBtn.setAttribute("aria-label", `Rename ${group.name}`);
      renameBtn.textContent = "✏️";

      actionsEl.append(cloneBtn, renameBtn);

      if (canDelete) {
        const deleteBtn = document.createElement("button");
        deleteBtn.setAttribute("data-action", "delete");
        deleteBtn.setAttribute("title", "Delete");
        deleteBtn.setAttribute("aria-label", `Delete ${group.name}`);
        deleteBtn.textContent = "🗑️";
        actionsEl.append(deleteBtn);
      }

      const actionsToggleBtn = document.createElement("button");
      actionsToggleBtn.className = "conversation-actions-toggle";
      actionsToggleBtn.setAttribute("title", "More actions");
      actionsToggleBtn.setAttribute(
        "aria-label",
        `More actions for ${group.name}`,
      );
      actionsToggleBtn.textContent = "⋮";

      li.append(nameEl, actionsEl, actionsToggleBtn);

      li.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const action = target
          .closest("[data-action]")
          ?.getAttribute("data-action");

        if (action === "clone") {
          this.handleClone(group.groupId);
        } else if (action === "rename") {
          this.handleRename(group.groupId, group.name);
        } else if (action === "delete") {
          this.handleDelete(group.groupId, group.name);
        } else if (target.closest(".conversation-actions-toggle")) {
          li.classList.toggle("show-actions");
        } else if (!target.closest(".drag-handle")) {
          this.handleSwitch(group.groupId);
          li.classList.remove("show-actions");
        }
      });

      li.addEventListener("keydown", (e) => {
        this._handleKeyboardReorder(e, group.groupId, group.name);
      });

      handle.addEventListener("dragstart", (e) => {
        this._draggedGroupId = group.groupId;

        li.classList.add("dragging");

        (e as DragEvent).dataTransfer?.setData("text/plain", group.groupId);
      });

      handle.addEventListener("dragend", () => {
        li.classList.remove("dragging");

        this._draggedGroupId = null;

        list
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      });

      handle.addEventListener(
        "touchstart",
        (e) => {
          const touch = (e as TouchEvent).touches[0];
          if (!touch) {
            return;
          }

          this._touchId = touch.identifier;
          this._touchDraggedGroupId = group.groupId;

          li.classList.add("dragging");

          e.preventDefault();
        },
        { passive: false },
      );

      li.addEventListener("dragover", (e) => {
        e.preventDefault();

        if (this._draggedGroupId && this._draggedGroupId !== group.groupId) {
          li.classList.add("drag-over");
        }
      });

      li.addEventListener("dragleave", () => {
        li.classList.remove("drag-over");
      });

      li.addEventListener("drop", (e) => {
        e.preventDefault();

        li.classList.remove("drag-over");

        if (this._draggedGroupId && this._draggedGroupId !== group.groupId) {
          this.handleReorder(this._draggedGroupId, group.groupId);
        }
      });

      list.appendChild(li);
    }

    this._bindTouchListEvents(list);
  }

  /**
   * Bind touch move/end on the list for cross-item dragging.
   */
  _bindTouchListEvents(list: Element) {
    // Remove old listeners by replacing with clone if needed; simpler: use a flag
    if ((list as any)._touchBound) {
      return;
    }

    (list as any)._touchBound = true;

    list.addEventListener(
      "touchmove",
      (e) => {
        if (this._touchDraggedGroupId === null) {
          return;
        }

        const touch = this._findTouch(e as TouchEvent);
        if (!touch) {
          return;
        }

        e.preventDefault();

        // Find which item is under the touch point
        const target = this._itemAtPoint(touch.clientX, touch.clientY);

        list
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));

        if (
          target &&
          target.getAttribute("data-group-id") !== this._touchDraggedGroupId
        ) {
          target.classList.add("drag-over");
        }
      },
      { passive: false },
    );

    list.addEventListener("touchend", (e) => {
      if (this._touchDraggedGroupId === null) {
        return;
      }

      const touch = this._findChangedTouch(e as TouchEvent);
      if (!touch) {
        return;
      }

      const target = this._itemAtPoint(touch.clientX, touch.clientY);
      const targetId = target?.getAttribute("data-group-id");

      list
        .querySelectorAll(".dragging")
        .forEach((el) => el.classList.remove("dragging"));

      list
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));

      if (targetId && targetId !== this._touchDraggedGroupId) {
        this.handleReorder(this._touchDraggedGroupId, targetId);
      }

      this._touchDraggedGroupId = null;
      this._touchId = null;
    });

    list.addEventListener("touchcancel", () => {
      list
        .querySelectorAll(".dragging")
        .forEach((el) => el.classList.remove("dragging"));

      list
        .querySelectorAll(".drag-over")
        .forEach((el) => el.classList.remove("drag-over"));
      this._touchDraggedGroupId = null;
      this._touchId = null;
    });
  }

  _findTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _findChangedTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _itemAtPoint(x: number, y: number): Element | null {
    // elementFromPoint on shadowRoot for Shadow DOM
    const root = this.shadowRoot;
    if (!root) {
      return null;
    }

    const el = root.elementFromPoint(x, y);

    return el?.closest?.(".conversation-item") || null;
  }

  _announce(message: string) {
    const region = this.shadowRoot?.querySelector("#live-region");

    if (region) {
      region.textContent = "";

      // Force re-announcement by toggling content in the next frame
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    }
  }

  /**
   * Handle keyboard-based reorder on a conversation item.
   * Space = grab/drop, Arrow Up/Down = move, Escape = cancel.
   */
  _handleKeyboardReorder(e: KeyboardEvent, groupId: string, name: string) {
    const groups = orchestratorStore.groups || [];
    const ids = groups.map((g) => g.groupId);
    const total = ids.length;

    if (this._keyboardGrabbedId === null) {
      // Not grabbed — Space grabs
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();

        this._keyboardGrabbedId = groupId;

        const pos = ids.indexOf(groupId) + 1;

        this._announce(`${name} grabbed. Current position ${pos} of ${total}.`);
        this.render();
      }

      return;
    }

    // Currently grabbed
    if (e.key === "Escape") {
      e.preventDefault();

      this._announce(
        `Reorder cancelled. ${name} returned to original position.`,
      );

      this._keyboardGrabbedId = null;

      this.render();

      return;
    }

    if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
      // Drop
      e.preventDefault();

      const pos = ids.indexOf(this._keyboardGrabbedId) + 1;

      const droppedName =
        groups.find((g) => g.groupId === this._keyboardGrabbedId)?.name || "";

      this._announce(
        `${droppedName} dropped at position ${pos} of ${total}. Reordering complete.`,
      );

      this._keyboardGrabbedId = null;

      this.render();

      return;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();

      const currentIdx = ids.indexOf(this._keyboardGrabbedId);
      const newIdx = e.key === "ArrowUp" ? currentIdx - 1 : currentIdx + 1;

      if (newIdx < 0 || newIdx >= total) {
        return;
      }

      // Swap
      ids.splice(currentIdx, 1);
      ids.splice(newIdx, 0, this._keyboardGrabbedId);

      this._announce(`Moved to position ${newIdx + 1} of ${total}.`);
      this.handleReorder(this._keyboardGrabbedId, ids[currentIdx], ids);
    }
  }

  async handleCreate() {
    if (!this.db) {
      return;
    }

    this.openCreateDialog();
  }

  async handleRename(groupId: string, currentName: string) {
    if (!this.db) {
      return;
    }

    this._pendingRenameGroupId = groupId;
    this._pendingRenameName = currentName;
    this.openRenameDialog(currentName);
  }

  async handleDelete(groupId: string, name: string) {
    if (!this.db) {
      return;
    }

    this._pendingDeleteGroupId = groupId;
    this.openDeleteDialog(name);
  }

  async handleClone(groupId: string) {
    if (!this.db) {
      return;
    }

    const groups = orchestratorStore.groups || [];
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) {
      return;
    }

    this._pendingCloneGroupId = groupId;
    this.openCloneDialog(group.name);
  }

  /**
   * Reorder: move draggedId to the position of targetId,
   * or apply a pre-computed order array.
   */
  async handleReorder(
    draggedId: string,
    targetId: string,
    precomputedIds?: string[],
  ) {
    if (!this.db) {
      return;
    }

    if (precomputedIds) {
      await orchestratorStore.reorderConversations(this.db, precomputedIds);

      return;
    }

    const groups = orchestratorStore.groups || [];
    const ids = groups.map((g) => g.groupId);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);

    if (fromIdx < 0 || toIdx < 0) {
      return;
    }

    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);

    await orchestratorStore.reorderConversations(this.db, ids);
  }

  async handleSwitch(groupId: string) {
    if (!this.db) {
      return;
    }

    if (groupId === orchestratorStore.activeGroupId) {
      return;
    }

    await orchestratorStore.switchConversation(this.db, groupId);
  }

  openCreateDialog() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__create-dialog",
    ) as HTMLDialogElement | null;
    const input = root.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement | null;

    if (!dialog) {
      return;
    }

    dialog.showModal();

    if (input) {
      input.value = "";
      input.focus();
    }
  }

  openRenameDialog(currentName: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__rename-dialog",
    ) as HTMLDialogElement | null;
    const input = root.querySelector(
      ".conversations__rename-dialog .conversations__input",
    ) as HTMLInputElement | null;

    if (!dialog) {
      return;
    }

    dialog.showModal();

    if (input) {
      input.value = currentName;
      input.select();
      input.focus();
    }
  }

  openDeleteDialog(name: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement | null;
    const nameSpan = dialog?.querySelector(".conversations__delete-name");

    if (!dialog) {
      return;
    }

    if (nameSpan) {
      nameSpan.textContent = name;
    }

    dialog.showModal();
  }

  openCloneDialog(name: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__clone-dialog",
    ) as HTMLDialogElement | null;
    const nameSpan = dialog?.querySelector(".conversations__clone-name");

    if (!dialog) {
      return;
    }

    if (nameSpan) {
      nameSpan.textContent = name;
    }

    dialog.showModal();
  }

  _setupDialogListeners() {
    const root = this.shadowRoot as ShadowRoot;

    // Create dialog
    const createDialog = root.querySelector(
      ".conversations__create-dialog",
    ) as HTMLDialogElement | null;
    const createForm = root.querySelector(
      ".conversations__create-dialog .conversations__form",
    ) as HTMLFormElement | null;
    const createCancel = root.querySelector(
      ".conversations__create-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;

    createCancel?.addEventListener("click", () => {
      createDialog?.close();
    });

    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this._submitCreateDialog();
    });

    // Rename dialog
    const renameDialog = root.querySelector(
      ".conversations__rename-dialog",
    ) as HTMLDialogElement | null;
    const renameForm = root.querySelector(
      ".conversations__rename-dialog .conversations__form",
    ) as HTMLFormElement | null;
    const renameCancel = root.querySelector(
      ".conversations__rename-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;

    renameCancel?.addEventListener("click", () => {
      renameDialog?.close();
      this._pendingRenameGroupId = null;
      this._pendingRenameName = null;
    });

    renameForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this._submitRenameDialog();
    });

    // Delete dialog
    const deleteDialog = root.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement | null;
    const deleteForm = root.querySelector(
      ".conversations__delete-dialog .conversations__form",
    ) as HTMLFormElement | null;
    const deleteCancel = root.querySelector(
      ".conversations__delete-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;

    deleteCancel?.addEventListener("click", () => {
      deleteDialog?.close();
      this._pendingDeleteGroupId = null;
    });

    deleteForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this._submitDeleteDialog();
    });

    // Clone dialog
    const cloneDialog = root.querySelector(
      ".conversations__clone-dialog",
    ) as HTMLDialogElement | null;
    const cloneForm = root.querySelector(
      ".conversations__clone-dialog .conversations__form",
    ) as HTMLFormElement | null;
    const cloneCancel = root.querySelector(
      ".conversations__clone-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;

    cloneCancel?.addEventListener("click", () => {
      cloneDialog?.close();
      this._pendingCloneGroupId = null;
    });

    cloneForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this._submitCloneDialog();
    });
  }

  async _submitCreateDialog() {
    const root = this.shadowRoot as ShadowRoot;
    if (!root || !this.db) {
      return;
    }

    const input = root.querySelector(
      ".conversations__create-dialog .conversations__input",
    ) as HTMLInputElement | null;
    const dialog = root.querySelector(
      ".conversations__create-dialog",
    ) as HTMLDialogElement | null;

    const name = input?.value.trim();
    if (!name) {
      return;
    }

    await orchestratorStore.createConversation(this.db, name);
    dialog?.close();
  }

  async _submitRenameDialog() {
    const root = this.shadowRoot as ShadowRoot;
    if (
      !root ||
      !this.db ||
      !this._pendingRenameGroupId ||
      !this._pendingRenameName
    ) {
      return;
    }

    const input = root.querySelector(
      ".conversations__rename-dialog .conversations__input",
    ) as HTMLInputElement | null;
    const dialog = root.querySelector(
      ".conversations__rename-dialog",
    ) as HTMLDialogElement | null;

    const name = input?.value.trim();
    if (!name || name === this._pendingRenameName) {
      dialog?.close();
      this._pendingRenameGroupId = null;
      this._pendingRenameName = null;

      return;
    }

    await orchestratorStore.renameConversation(
      this.db,
      this._pendingRenameGroupId,
      name,
    );
    dialog?.close();
    this._pendingRenameGroupId = null;
    this._pendingRenameName = null;
  }

  async _submitDeleteDialog() {
    const root = this.shadowRoot as ShadowRoot;
    if (!root || !this.db || !this._pendingDeleteGroupId) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement | null;

    await orchestratorStore.deleteConversation(
      this.db,
      this._pendingDeleteGroupId,
    );
    dialog?.close();
    this._pendingDeleteGroupId = null;
  }

  async _submitCloneDialog() {
    const root = this.shadowRoot as ShadowRoot;
    if (!root || !this.db || !this._pendingCloneGroupId) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__clone-dialog",
    ) as HTMLDialogElement | null;

    await orchestratorStore.cloneConversation(
      this.db,
      this._pendingCloneGroupId,
    );
    dialog?.close();
    this._pendingCloneGroupId = null;
  }
}

customElements.define("shadow-claw-conversations", ShadowClawConversations);
