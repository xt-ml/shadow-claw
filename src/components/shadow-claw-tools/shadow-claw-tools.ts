import { getDb, ShadowClawDatabase } from "../../db/db.js";
import { getAvailableProviders, getProvider, PROVIDERS } from "../../config.js";
import { effect } from "../../effect.js";
import { TOOL_DEFINITIONS } from "../../tools.js";
import { toolsStore } from "../../stores/tools.js";
import { showError, showInfo, showSuccess } from "../../toast.js";
import { ulid } from "../../ulid.js";

import "../shadow-claw-page-header/shadow-claw-page-header.js";
import ShadowClawElement from "../shadow-claw-element.js";

/** Built-in tool names (non-deletable). */
const BUILTIN_TOOL_NAMES = new Set(TOOL_DEFINITIONS.map((t) => t.name));

const elementName = "shadow-claw-tools";
export class ShadowClawTools extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawTools.componentPath}/${elementName}.css`;
  static template = `${ShadowClawTools.componentPath}/${elementName}.html`;

  cleanup: () => void = () => {};

  constructor() {
    super();
  }

  async connectedCallback() {
    const db = await getDb();

    // Reactive re-render on tool store changes
    this.cleanup = effect(() => {
      toolsStore.enabledToolNames;
      toolsStore.customTools;
      toolsStore.systemPromptOverride;
      toolsStore.profiles;
      toolsStore.activeProfileId;
      this.updateToolList(db);
    });

    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("shadowRoot not found");
    }

    // Back button
    root.querySelector(".tools__back-btn")?.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("navigate-back", { bubbles: true, composed: true }),
      );
    });

    // Add tool button
    root.querySelector(".tools__add-btn")?.addEventListener("click", () => {
      const dialog = root.querySelector("dialog");
      if (dialog) {
        const form = root.querySelector(
          ".tools__dialog-form",
        ) as HTMLFormElement | null;
        form?.reset();
        dialog.showModal();
      }
    });

    // Backup
    root.querySelector(".tools__backup-btn")?.addEventListener("click", () => {
      this.handleBackup();
    });

    // Restore
    const restoreInput = root.querySelector(".tools__hidden-restore");
    root.querySelector(".tools__restore-btn")?.addEventListener("click", () => {
      if (restoreInput instanceof HTMLInputElement) {
        restoreInput.click();
      }
    });
    restoreInput?.addEventListener("change", (e) => {
      if (e.target instanceof HTMLInputElement) {
        this.handleRestore(db, e.target);
      }
    });

    // Select all / none
    root
      .querySelector(".tools__select-all-btn")
      ?.addEventListener("click", () => {
        const allNames = toolsStore.allTools.map((t) => t.name);
        toolsStore.setAllEnabled(db, allNames);
        showInfo("All tools enabled");
      });

    root
      .querySelector(".tools__select-none-btn")
      ?.addEventListener("click", () => {
        toolsStore.setAllEnabled(db, []);
        showInfo("All tools disabled");
      });

    // Save prompt
    root
      .querySelector(".tools__save-prompt-btn")
      ?.addEventListener("click", () => {
        const textarea = root.querySelector(".tools__prompt-area");
        if (textarea instanceof HTMLTextAreaElement) {
          toolsStore.setSystemPromptOverride(db, textarea.value);
          showSuccess("System prompt override saved");
        }
      });

    // Clear prompt
    root
      .querySelector(".tools__clear-prompt-btn")
      ?.addEventListener("click", () => {
        const textarea = root.querySelector(".tools__prompt-area");
        if (textarea instanceof HTMLTextAreaElement) {
          textarea.value = "";
          toolsStore.setSystemPromptOverride(db, "");
          showSuccess("System prompt override cleared");
        }
      });

    // Dialog controls — Add Tool
    const dialog = root.querySelector(
      ".tools__dialog",
    ) as HTMLDialogElement | null;
    const closeBtn = dialog?.querySelector(".tools__dialog-close");
    const cancelBtn = dialog?.querySelector(".tools__btn-cancel");
    const form = root.querySelector(
      ".tools__dialog-form",
    ) as HTMLFormElement | null;

    closeBtn?.addEventListener("click", () => dialog?.close());
    cancelBtn?.addEventListener("click", () => dialog?.close());

    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
      }
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (form) {
        this.handleAddTool(db, form);
      }
    });

    // Dialog controls — Clone Tool
    const cloneDialog = root.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement | null;
    const cloneCloseBtn = root.querySelector(".tools__clone-dialog-close");
    const cloneCancelBtn = root.querySelector(".tools__clone-cancel-btn");
    const cloneForm = root.querySelector(
      ".tools__clone-dialog-form",
    ) as HTMLFormElement | null;

    cloneCloseBtn?.addEventListener("click", () => cloneDialog?.close());
    cloneCancelBtn?.addEventListener("click", () => cloneDialog?.close());
    cloneDialog?.addEventListener("click", (e) => {
      if (e.target === cloneDialog) {
        cloneDialog.close();
      }
    });

    cloneForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (cloneForm) {
        this.handleCloneTool(db, cloneForm);
      }
    });

    // Dialog controls — Profile
    const profileDialog = root.querySelector(
      ".tools__profile-dialog",
    ) as HTMLDialogElement | null;
    const profileCloseBtn = root.querySelector(".tools__profile-dialog-close");
    const profileCancelBtn = root.querySelector(".tools__profile-cancel-btn");
    const profileForm = root.querySelector(
      ".tools__profile-dialog-form",
    ) as HTMLFormElement | null;

    profileCloseBtn?.addEventListener("click", () => profileDialog?.close());
    profileCancelBtn?.addEventListener("click", () => profileDialog?.close());
    profileDialog?.addEventListener("click", (e) => {
      if (e.target === profileDialog) {
        profileDialog.close();
      }
    });

    profileForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (profileForm) {
        this.handleSaveProfile(db, profileForm);
      }
    });

    // Profile select
    const profileSelect = root.querySelector(".tools__profile-select");
    profileSelect?.addEventListener("change", (e) => {
      const select = e.target as HTMLSelectElement;
      const value = select.value;
      if (value) {
        toolsStore.activateProfile(db, value);
        showInfo("Profile activated");
      } else {
        toolsStore.deactivateProfile(db);
        showInfo("Profile deactivated");
      }
    });

    // Profile new button → open dialog
    root
      .querySelector(".tools__profile-new-btn")
      ?.addEventListener("click", () => {
        if (profileDialog && profileForm) {
          profileForm.reset();
          // Populate provider dropdown
          const providerSelect = profileForm.querySelector(
            '[name="providerId"]',
          );
          if (providerSelect) {
            providerSelect.innerHTML =
              '<option value="">— Any provider —</option>';
            for (const pid of getAvailableProviders()) {
              const p = getProvider(pid);
              if (p) {
                const opt = document.createElement("option");
                opt.value = pid;
                opt.textContent = p.name;
                providerSelect.appendChild(opt);
              }
            }
          }

          (profileDialog as HTMLDialogElement).showModal();
        }
      });

    // Profile save (overwrite active)
    root
      .querySelector(".tools__profile-save-btn")
      ?.addEventListener("click", async () => {
        const activeId = toolsStore.activeProfileId;
        if (activeId) {
          await toolsStore.saveToActiveProfile(db);
          showSuccess("Profile saved");
        } else {
          // No active profile — open new profile dialog
          root
            .querySelector(".tools__profile-new-btn")
            ?.dispatchEvent(new Event("click"));
        }
      });

    // Profile delete
    root
      .querySelector(".tools__profile-delete-btn")
      ?.addEventListener("click", async () => {
        const activeId = toolsStore.activeProfileId;
        if (!activeId) {
          showInfo("No profile selected");

          return;
        }

        if (activeId.startsWith("__builtin_")) {
          showInfo("Built-in profiles cannot be deleted");

          return;
        }

        await toolsStore.deleteProfile(db, activeId);
        showSuccess("Profile deleted");
      });
  }

  disconnectedCallback() {
    this.cleanup();
  }

  updateToolList(db: ShadowClawDatabase) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const list = root.querySelector(".tools__list");
    if (!list) {
      return;
    }

    const enabled = toolsStore.enabledToolNames;
    const allTools = toolsStore.allTools;

    list.innerHTML = "";

    for (const tool of allTools) {
      const isCustom = !BUILTIN_TOOL_NAMES.has(tool.name);
      const isChecked = enabled.has(tool.name);
      const brief = tool.description.split(". ")[0];

      const item = document.createElement("div");
      item.className = "tools__item";
      item.setAttribute("role", "listitem");

      item.innerHTML = `
        <input type="checkbox" class="tools__item-checkbox"
          data-tool="${tool.name}"
          ${isChecked ? "checked" : ""}
          aria-label="Enable ${tool.name}">
        <div class="tools__item-info">
          <div class="tools__item-name">${tool.name}</div>
          <div class="tools__item-desc" title="${tool.description}">${brief}</div>
        </div>
        ${isCustom ? '<span class="tools__item-badge">custom</span>' : ""}
        <button class="tools__item-clone" data-clone="${tool.name}" aria-label="Clone ${tool.name}" title="Clone tool">📋</button>
        ${isCustom ? `<button class="tools__item-delete" data-delete="${tool.name}" aria-label="Delete ${tool.name}">🗑️</button>` : ""}
      `;

      // Toggle
      const checkbox = item.querySelector("input");
      checkbox?.addEventListener("change", () => {
        toolsStore.setToolEnabled(db, tool.name, checkbox.checked);
      });

      // Clone
      const cloneBtn = item.querySelector(".tools__item-clone");
      cloneBtn?.addEventListener("click", () => {
        this.openCloneDialog(tool.name);
      });

      // Delete custom tool
      if (isCustom) {
        const deleteBtn = item.querySelector(".tools__item-delete");
        deleteBtn?.addEventListener("click", () => {
          toolsStore.removeCustomTool(db, tool.name);
          showInfo(`Removed custom tool: ${tool.name}`);
        });
      }

      list.appendChild(item);
    }

    // Update count
    const countEl = root.querySelector(".tools__count");
    if (countEl) {
      countEl.textContent = `${enabled.size} of ${allTools.length} enabled`;
    }

    // Update prompt textarea
    const textarea = root.querySelector(".tools__prompt-area");
    if (
      textarea instanceof HTMLTextAreaElement &&
      document.activeElement !== textarea &&
      !textarea.matches(":focus")
    ) {
      textarea.value = toolsStore.systemPromptOverride;
    }

    // Update profile selector
    this.updateProfileSelector();
  }

  /** Update the profile dropdown to reflect current state. */
  updateProfileSelector() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const select = root.querySelector(".tools__profile-select");
    if (!select) {
      return;
    }

    const profiles = toolsStore.profiles;
    const activeId = toolsStore.activeProfileId;

    // Preserve selection
    select.innerHTML =
      '<option value="">— No profile (manual config) —</option>';
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      const isBuiltin = p.id.startsWith("__builtin_");
      const providerLabel = p.providerId
        ? getProvider(p.providerId)?.name || p.providerId
        : "any";
      const modelLabel = p.model || "any";
      opt.textContent = isBuiltin
        ? `⚡ ${p.name} (${providerLabel})`
        : `${p.name} (${providerLabel} / ${modelLabel})`;
      if (p.id === activeId) {
        opt.selected = true;
      }

      select.appendChild(opt);
    }

    // Disable delete button for built-in profiles
    const deleteBtn = root.querySelector(
      ".tools__profile-delete-btn",
    ) as HTMLButtonElement | null;
    if (deleteBtn) {
      const isBuiltinActive = activeId?.startsWith("__builtin_");
      deleteBtn.disabled = !!isBuiltinActive;
      deleteBtn.title = isBuiltinActive
        ? "Built-in profiles cannot be deleted"
        : "";
    }
  }

  /**
   * Open the clone tool dialog for a given source tool.
   */
  openCloneDialog(sourceToolName: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const cloneDialog = root.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement | null;
    const cloneForm = root.querySelector(
      ".tools__clone-dialog-form",
    ) as HTMLFormElement | null;
    if (!cloneDialog || !cloneForm) {
      return;
    }

    cloneForm.reset();
    const sourceInput = cloneForm.querySelector(
      '[name="source"]',
    ) as HTMLInputElement | null;
    if (sourceInput) {
      sourceInput.value = sourceToolName;
    }

    cloneDialog.showModal();
  }

  async handleAddTool(db: ShadowClawDatabase, form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const description = String(data.get("description") || "").trim();
    const schemaStr = String(data.get("input_schema") || "").trim();

    if (!name || !description) {
      showError("Name and description are required");

      return;
    }

    // Check uniqueness
    if (toolsStore.allTools.some((t) => t.name === name)) {
      showError(`A tool named "${name}" already exists`);

      return;
    }

    let input_schema = { type: "object", properties: {} };
    if (schemaStr) {
      try {
        input_schema = JSON.parse(schemaStr);
      } catch {
        showError("Invalid JSON in input schema");

        return;
      }
    }

    await toolsStore.addCustomTool(db, { name, description, input_schema });
    showSuccess(`Added custom tool: ${name}`);

    const dialog = this.shadowRoot?.querySelector(
      ".tools__dialog",
    ) as HTMLDialogElement | null;
    dialog?.close();
  }

  async handleCloneTool(db: ShadowClawDatabase, form: HTMLFormElement) {
    const data = new FormData(form);
    const sourceToolName = String(data.get("source") || "").trim();
    const newName = String(data.get("name") || "").trim();
    const newDesc = String(data.get("description") || "").trim();

    if (!sourceToolName || !newName) {
      showError("Source and new tool name are required");

      return;
    }

    const ok = await toolsStore.cloneTool(
      db,
      sourceToolName,
      newName,
      newDesc || undefined,
    );
    if (!ok) {
      showError(
        `Clone failed: source not found or name "${newName}" already exists.`,
      );

      return;
    }

    showSuccess(`Cloned "${sourceToolName}" → "${newName}"`);
    const cloneDialog = this.shadowRoot?.querySelector(
      ".tools__clone-dialog",
    ) as HTMLDialogElement | null;
    cloneDialog?.close();
  }

  async handleSaveProfile(db: ShadowClawDatabase, form: HTMLFormElement) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const providerId = String(data.get("providerId") || "").trim();
    const model = String(data.get("model") || "").trim();

    if (!name) {
      showError("Profile name is required");

      return;
    }

    const profile = {
      id: ulid(),
      name,
      providerId: providerId || undefined,
      model: model || undefined,
      enabledToolNames: [...toolsStore.enabledToolNames],
      customTools: [...toolsStore.customTools],
      systemPromptOverride: toolsStore.systemPromptOverride,
    };

    await toolsStore.addProfile(db, profile);
    await toolsStore.activateProfile(db, profile.id);
    showSuccess(`Profile "${name}" created and activated`);

    const profileDialog = this.shadowRoot?.querySelector(
      ".tools__profile-dialog",
    ) as HTMLDialogElement | null;
    profileDialog?.close();
  }

  handleBackup() {
    const json = toolsStore.exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shadowclaw-tools-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("Tools config exported");
  }

  async handleRestore(db: ShadowClawDatabase, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      await toolsStore.importBackup(db, text);
      showSuccess("Tools config restored");
    } catch (err) {
      showError(
        `Failed to restore: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    input.value = "";
  }
}

customElements.define(elementName, ShadowClawTools);
