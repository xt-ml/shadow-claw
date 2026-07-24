import { CONFIG_KEYS } from "../../config/config.js";
import { effect } from "../../core/effect.js";

import { getDb, ShadowClawDatabase } from "../../db/db.js";
import { getConfig } from "../../db/getConfig.js";
import { setConfig } from "../../db/setConfig.js";

import { setSanitizedHtml } from "../../security/trusted-types.js";
import { orchestratorStore } from "../../stores/orchestrator.js";
import { toolsStore } from "../../stores/tools.js";
import { ChannelRegistry } from "../../subsystems/channels/channel-registry.js";
import { TOOL_DEFINITIONS } from "../../subsystems/tools/tools.js";
import type { LLMProvider } from "../../subsystems/providers/types.js";

import "../shadow-claw-dialog/shadow-claw-dialog.js";
import "../common/shadow-claw-provider-model-picker/shadow-claw-provider-model-picker.js";
import "../common/shadow-claw-provider-module-settings/shadow-claw-provider-module-settings.js";

import ShadowClawElement from "../shadow-claw-element.js";
import type {
  ProviderModelItem,
  ShadowClawProviderModelPicker,
} from "../common/shadow-claw-provider-model-picker/shadow-claw-provider-model-picker.js";
import type {
  ProviderRuntimeOverrides,
  ShadowClawProviderModuleSettings,
} from "../common/shadow-claw-provider-module-settings/shadow-claw-provider-module-settings.js";
import shadowClawConversationsStyles from "./shadow-claw-conversations.css" with { type: "css" };
import shadowClawConversationsTemplate from "./shadow-claw-conversations.html" with { type: "html" };

export class ShadowClawConversations extends ShadowClawElement {
  static styles = shadowClawConversationsStyles;
  static template = shadowClawConversationsTemplate;

  public channelRegistry: ChannelRegistry | null = null;
  public db: ShadowClawDatabase | null = null;

  private _draggedGroupId: string | null = null;
  private _effectCleanup: (() => void) | null = null;
  private _keyboardGrabbedId: string | null = null;
  private _pendingCloneGroupId: string | null = null;
  private _pendingDeleteGroupId: string | null = null;
  private _pendingDetailsPinnedModel: string | null = null;
  private _pendingDetailsPinnedProvider: string | null = null;
  private _pendingDetailsProviderRuntimeOverrides: ProviderRuntimeOverrides =
    {};
  private _pendingDetailsSubagentMaxTokens: number | null = null;
  private _pendingDetailsSubagentMode: "automatic" | "manual" = "automatic";
  private _pendingDetailsSubagentModel: string | null = null;
  private _pendingDetailsSubagentProvider: string | null = null;
  private _pendingDetailsToolTags: string[] | null = null;
  private _pendingRenameGroupId: string | null = null;
  private _pendingRenameName: string | null = null;
  private _touchDraggedGroupId: string | null = null;
  private _touchId: number | null = null;

  async connectedCallback() {
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

  disconnectedCallback() {
    if (this._effectCleanup) {
      this._effectCleanup();
      this._effectCleanup = null;
    }
  }

  getChannelRegistry(): ChannelRegistry | null {
    const current = orchestratorStore.orchestrator?.channelRegistry || null;
    if (current) {
      this.channelRegistry = current;
    }

    return this.channelRegistry;
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

  openDeleteDialog(name: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__delete-dialog",
    ) as HTMLDialogElement | null;
    const nameSpan = dialog?.querySelector(".conversations__delete-name");
    const cancelBtn = dialog?.querySelector(
      ".conversations__cancel",
    ) as HTMLButtonElement | null;

    if (!dialog) {
      return;
    }

    if (nameSpan) {
      nameSpan.textContent = name;
    }

    dialog.showModal();
    cancelBtn?.focus();
  }

  openDetailsDialog(currentName: string, groupId?: string) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const dialog = root.querySelector(
      ".conversations__details-dialog",
    ) as HTMLDialogElement | null;
    const input = root.querySelector(
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement | null;
    const groupIdInput = root.querySelector(
      "#conversations-details-group-id",
    ) as HTMLInputElement | null;
    const copyBtn = root.querySelector(
      "#conversations-group-id-copy-btn",
    ) as HTMLButtonElement | null;
    const toolsContainer = root.querySelector(
      "#conversations-details-tools",
    ) as HTMLElement | null;
    const toolInput = root.querySelector(
      "#conversations-tool-input",
    ) as HTMLInputElement | null;
    const toolAddBtn = root.querySelector(
      "#conversations-add-tool-btn",
    ) as HTMLButtonElement | null;
    const datalist = root.querySelector(
      "#conversations-available-tools",
    ) as HTMLDataListElement | null;
    const mainPicker = root.querySelector(
      "#conversations-main-picker",
    ) as ShadowClawProviderModelPicker | null;
    const mainProviderModuleSettings = root.querySelector(
      "#conversations-main-provider-module-settings",
    ) as ShadowClawProviderModuleSettings | null;
    const subagentSettingsContainer = root.querySelector(
      "#conversations-subagent-settings-container",
    ) as HTMLElement | null;
    const subagentModeSelect = root.querySelector(
      "#conversations-subagent-mode",
    ) as HTMLSelectElement | null;
    const subagentMaxTokensInput = root.querySelector(
      "#conversations-subagent-max-tokens",
    ) as HTMLInputElement | null;
    const subagentManualContainer = root.querySelector(
      "#conversations-subagent-manual-container",
    ) as HTMLElement | null;
    const subagentPicker = root.querySelector(
      "#conversations-subagent-picker",
    ) as ShadowClawProviderModelPicker | null;
    const subagentProviderModuleSettings = root.querySelector(
      "#conversations-subagent-provider-module-settings",
    ) as ShadowClawProviderModuleSettings | null;

    // Populate Group ID field
    if (groupIdInput) {
      groupIdInput.value = groupId?.replace(":", "-") || "";
    }

    // Wire up copy button
    if (copyBtn && groupIdInput) {
      // Clone to remove previous listeners
      const freshCopyBtn = copyBtn.cloneNode(true) as HTMLButtonElement;
      copyBtn.replaceWith(freshCopyBtn);

      freshCopyBtn.addEventListener("click", async () => {
        const val = groupIdInput.value;
        if (!val) {
          return;
        }

        try {
          await navigator.clipboard.writeText(val);
          // Swap to a checkmark briefly
          const originalInner = freshCopyBtn.innerHTML;
          setSanitizedHtml(
            freshCopyBtn,
            `<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`,
          );
          freshCopyBtn.classList.add(
            "conversations__group-id-copy-btn--copied",
          );
          setTimeout(() => {
            setSanitizedHtml(freshCopyBtn, originalInner);
            freshCopyBtn.classList.remove(
              "conversations__group-id-copy-btn--copied",
            );
          }, 1500);
        } catch {
          // Fallback: select the text
          groupIdInput.select();
        }
      });
    }

    const participantsContainer = root.querySelector(
      "#conversations-details-participants-container",
    ) as HTMLElement | null;
    const participantsList = root.querySelector(
      "#conversations-details-participants-list",
    ) as HTMLElement | null;

    if (participantsContainer && participantsList) {
      if (groupId && groupId.startsWith("peer:")) {
        participantsContainer.style.display = "block";
        participantsList.replaceChildren();

        const orchestrator = orchestratorStore.orchestrator;
        if (orchestrator) {
          const connectedPeers =
            orchestrator.peerjs?.connectedPeersSignal?.get() || [];
          const targetPeer = groupId.replace("peer:", "");

          if (connectedPeers.includes(targetPeer)) {
            let alias = "";
            if (orchestrator.peerjsPeerAliases) {
              for (const [a, id] of Object.entries(
                orchestrator.peerjsPeerAliases,
              )) {
                if (id === targetPeer) {
                  alias = a;

                  break;
                }
              }
            }

            const displayName = alias
              ? `${alias} (${targetPeer.substring(0, 8)})`
              : targetPeer;

            const row = document.createElement("div");
            row.className = "conversations__group-id-row";

            const input = document.createElement("input");
            input.className =
              "conversations__input conversations__group-id-input";
            input.type = "text";
            input.readOnly = true;
            input.value = displayName;
            input.style.marginBottom = "0";

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "conversations__group-id-copy-btn";
            btn.title = "Copy Peer ID";
            btn.setAttribute("aria-label", "Copy Peer ID to clipboard");
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>`;

            btn.addEventListener("click", async () => {
              try {
                await navigator.clipboard.writeText(targetPeer);
                const originalInner = btn.innerHTML;
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`;
                btn.classList.add("conversations__group-id-copy-btn--copied");
                setTimeout(() => {
                  btn.innerHTML = originalInner;
                  btn.classList.remove(
                    "conversations__group-id-copy-btn--copied",
                  );
                }, 1500);
              } catch {
                input.value = targetPeer;
                input.select();
              }
            });

            row.appendChild(input);
            row.appendChild(btn);
            participantsList.appendChild(row);
          } else {
            const noPeers = document.createElement("div");
            noPeers.style.fontSize = "0.875rem";
            noPeers.style.color = "var(--text-secondary)";
            noPeers.textContent = "Peer is not currently connected.";
            participantsList.appendChild(noPeers);
          }
        }
      } else {
        participantsContainer.style.display = "none";
      }
    }

    if (!dialog) {
      return;
    }

    dialog.showModal();

    const updateDatalist = () => {
      if (!datalist) {
        return;
      }

      const pinned = new Set(this._pendingDetailsToolTags || []);
      datalist.replaceChildren();
      for (const tool of TOOL_DEFINITIONS) {
        if (pinned.has(tool.name)) {
          continue;
        }

        const option = document.createElement("option");
        option.value = tool.name;
        datalist.appendChild(option);
      }
    };

    const renderChips = () => {
      if (!toolsContainer) {
        return;
      }

      toolsContainer.replaceChildren();

      const tags = this._pendingDetailsToolTags || [];
      for (const tagName of tags) {
        const tool = TOOL_DEFINITIONS.find((t) => t.name === tagName);
        const chip = document.createElement("span");
        chip.className = "conversations__tool-chip";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = tagName;
        if (tool) {
          nameSpan.title = tool.description;
        }

        chip.appendChild(nameSpan);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "conversations__tool-chip-remove";
        removeBtn.textContent = "×";
        removeBtn.setAttribute("aria-label", `Remove tool ${tagName}`);

        removeBtn.addEventListener("click", () => {
          if (!this._pendingDetailsToolTags) {
            return;
          }

          this._pendingDetailsToolTags = this._pendingDetailsToolTags.filter(
            (t) => t !== tagName,
          );
          renderChips();
        });

        chip.appendChild(removeBtn);
        toolsContainer.appendChild(chip);
      }

      updateDatalist();

      if (subagentSettingsContainer && subagentModeSelect) {
        const showSubagentSettings =
          this._isSpawnSubagentEnabledInCurrentScope();
        subagentSettingsContainer.style.display = showSubagentSettings
          ? "flex"
          : "none";
        if (!showSubagentSettings) {
          this._pendingDetailsSubagentMode = "automatic";
        }

        if (subagentManualContainer) {
          subagentManualContainer.style.display =
            this._pendingDetailsSubagentMode === "manual" &&
            showSubagentSettings
              ? "flex"
              : "none";
        }

        if (subagentMaxTokensInput) {
          subagentMaxTokensInput.value =
            typeof this._pendingDetailsSubagentMaxTokens === "number" &&
            Number.isFinite(this._pendingDetailsSubagentMaxTokens) &&
            this._pendingDetailsSubagentMaxTokens > 0
              ? String(Math.floor(this._pendingDetailsSubagentMaxTokens))
              : "";
        }
      }
    };

    if (toolAddBtn && toolInput) {
      toolAddBtn.onclick = () => {
        const val = toolInput.value.trim();
        if (!val) {
          return;
        }

        const tool = TOOL_DEFINITIONS.find((t) => t.name === val);
        if (!tool) {
          toolInput.value = "";

          return;
        }

        if (!this._pendingDetailsToolTags) {
          this._pendingDetailsToolTags = [];
        }

        if (!this._pendingDetailsToolTags.includes(val)) {
          this._pendingDetailsToolTags.push(val);
          renderChips();
        }

        toolInput.value = "";
      };

      toolInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          toolAddBtn.click();
        }
      };
    }

    renderChips();

    if (
      mainPicker &&
      mainProviderModuleSettings &&
      subagentModeSelect &&
      subagentSettingsContainer &&
      subagentManualContainer &&
      subagentPicker &&
      subagentProviderModuleSettings
    ) {
      const providers =
        (orchestratorStore.orchestrator?.getAvailableProviders() as LLMProvider[]) ||
        [];

      mainPicker.setLabels({
        providerLabel: "Pinned Provider",
        defaultProviderLabel: "Default (Global)",
        modelLabel: "Pinned Model",
        defaultModelLabel: "Default Model",
        customModelPlaceholder: "Custom model id",
      });

      mainPicker.setModelLoader((provider) =>
        this._loadProviderModels(provider),
      );
      mainPicker.setProviders(providers);
      mainPicker.setValue({
        providerId: this._pendingDetailsPinnedProvider,
        modelId: this._pendingDetailsPinnedModel,
      });

      mainProviderModuleSettings.setProvider(
        this._pendingDetailsPinnedProvider,
      );
      mainProviderModuleSettings.setOverrides(
        this._pendingDetailsProviderRuntimeOverrides,
      );

      subagentPicker.setLabels({
        providerLabel: "Pinned Subagent Provider",
        defaultProviderLabel: "Default (Parent Provider)",
        modelLabel: "Pinned Subagent Model",
        defaultModelLabel: "Default Model",
        customModelPlaceholder: "Custom subagent model id",
      });

      subagentPicker.setModelLoader((provider) =>
        this._loadProviderModels(provider),
      );
      subagentPicker.setProviders(providers);
      subagentPicker.setValue({
        providerId: this._pendingDetailsSubagentProvider,
        modelId: this._pendingDetailsSubagentModel,
      });

      subagentProviderModuleSettings.setProvider(
        this._pendingDetailsSubagentProvider,
      );

      subagentProviderModuleSettings.setOverrides(
        this._pendingDetailsProviderRuntimeOverrides,
      );

      if (!mainPicker.hasAttribute("data-bound")) {
        mainPicker.addEventListener("provider-model-change", (e: Event) => {
          const detail = (e as CustomEvent).detail || {};
          this._pendingDetailsPinnedProvider = detail.providerId || null;
          this._pendingDetailsPinnedModel = detail.modelId || null;

          mainProviderModuleSettings.setProvider(
            this._pendingDetailsPinnedProvider,
          );
          mainProviderModuleSettings.setOverrides(
            this._pendingDetailsProviderRuntimeOverrides,
          );
        });

        mainPicker.setAttribute("data-bound", "true");
      }

      if (!mainProviderModuleSettings.hasAttribute("data-bound")) {
        mainProviderModuleSettings.addEventListener(
          "provider-module-settings-change",
          (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const providerId = detail.providerId as string | undefined;
            const overrides = detail.overrides as ProviderRuntimeOverrides;
            if (!providerId) {
              return;
            }

            const next = JSON.parse(
              JSON.stringify(
                this._pendingDetailsProviderRuntimeOverrides || {},
              ),
            ) as ProviderRuntimeOverrides;

            if (providerId === "llamafile") {
              next.llamafile = overrides.llamafile;
            } else if (providerId === "bedrock_proxy") {
              next.bedrock_proxy = overrides.bedrock_proxy;
            }

            this._pendingDetailsProviderRuntimeOverrides = next;
            mainPicker.invalidateProviderModels(providerId);
            subagentPicker.invalidateProviderModels(providerId);
          },
        );

        mainProviderModuleSettings.setAttribute("data-bound", "true");
      }

      if (!subagentPicker.hasAttribute("data-bound")) {
        subagentPicker.addEventListener("provider-model-change", (e: Event) => {
          const detail = (e as CustomEvent).detail || {};
          this._pendingDetailsSubagentProvider = detail.providerId || null;
          this._pendingDetailsSubagentModel = detail.modelId || null;
          subagentProviderModuleSettings.setProvider(
            this._pendingDetailsSubagentProvider,
          );

          subagentProviderModuleSettings.setOverrides(
            this._pendingDetailsProviderRuntimeOverrides,
          );
        });
        subagentPicker.setAttribute("data-bound", "true");
      }

      if (!subagentProviderModuleSettings.hasAttribute("data-bound")) {
        subagentProviderModuleSettings.addEventListener(
          "provider-module-settings-change",
          (e: Event) => {
            const detail = (e as CustomEvent).detail || {};
            const providerId = detail.providerId as string | undefined;
            const overrides = detail.overrides as ProviderRuntimeOverrides;
            if (!providerId) {
              return;
            }

            const next = JSON.parse(
              JSON.stringify(
                this._pendingDetailsProviderRuntimeOverrides || {},
              ),
            ) as ProviderRuntimeOverrides;

            if (providerId === "llamafile") {
              next.llamafile = overrides.llamafile;
            } else if (providerId === "bedrock_proxy") {
              next.bedrock_proxy = overrides.bedrock_proxy;
            }

            this._pendingDetailsProviderRuntimeOverrides = next;
            mainPicker.invalidateProviderModels(providerId);
            subagentPicker.invalidateProviderModels(providerId);
          },
        );

        subagentProviderModuleSettings.setAttribute("data-bound", "true");
      }

      subagentModeSelect.value = this._pendingDetailsSubagentMode;

      const showSubagentSettings = this._isSpawnSubagentEnabledInCurrentScope();
      subagentSettingsContainer.style.display = showSubagentSettings
        ? "flex"
        : "none";

      mainProviderModuleSettings.style.display = this
        ._pendingDetailsPinnedProvider
        ? "flex"
        : "none";

      subagentManualContainer.style.display =
        showSubagentSettings && this._pendingDetailsSubagentMode === "manual"
          ? "flex"
          : "none";

      subagentProviderModuleSettings.style.display =
        showSubagentSettings &&
        this._pendingDetailsSubagentMode === "manual" &&
        !!this._pendingDetailsSubagentProvider
          ? "flex"
          : "none";

      subagentModeSelect.onchange = () => {
        this._pendingDetailsSubagentMode =
          subagentModeSelect.value === "manual" ? "manual" : "automatic";

        subagentManualContainer.style.display =
          this._pendingDetailsSubagentMode === "manual" &&
          this._isSpawnSubagentEnabledInCurrentScope()
            ? "flex"
            : "none";

        subagentProviderModuleSettings.style.display =
          this._pendingDetailsSubagentMode === "manual" &&
          this._isSpawnSubagentEnabledInCurrentScope() &&
          !!this._pendingDetailsSubagentProvider
            ? "flex"
            : "none";
      };

      if (!subagentMaxTokensInput?.hasAttribute("data-bound")) {
        subagentMaxTokensInput?.addEventListener("input", () => {
          const value = Number(subagentMaxTokensInput.value);
          if (Number.isFinite(value) && value > 0) {
            this._pendingDetailsSubagentMaxTokens = Math.floor(value);
          } else {
            this._pendingDetailsSubagentMaxTokens = null;
          }
        });

        subagentMaxTokensInput?.setAttribute("data-bound", "true");
      }
    }

    if (input) {
      input.value = currentName;
      input.select();
      input.focus();
    }
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

  async handleCreate() {
    if (!this.db) {
      return;
    }

    this.openCreateDialog();
  }

  async handleDelete(groupId: string, name: string) {
    if (!this.db) {
      return;
    }

    this._pendingDeleteGroupId = groupId;
    this.openDeleteDialog(name);
  }

  async handleDetails(groupId: string, currentName: string) {
    if (!this.db) {
      return;
    }

    this._pendingRenameGroupId = groupId;
    this._pendingRenameName = currentName;

    const groups = orchestratorStore.groups || [];
    const group = groups.find((g) => g.groupId === groupId);
    const currentTags = group?.toolTags || [];

    this._pendingDetailsToolTags = [...currentTags];
    this._pendingDetailsPinnedProvider = group?.pinnedProvider || null;
    this._pendingDetailsPinnedModel = group?.pinnedModel || null;
    this._pendingDetailsProviderRuntimeOverrides = JSON.parse(
      JSON.stringify(group?.providerRuntimeOverrides || {}),
    );
    this._pendingDetailsSubagentMode =
      group?.subagentModelSelectionMode === "manual" ? "manual" : "automatic";
    this._pendingDetailsSubagentMaxTokens =
      typeof group?.subagentMaxTokens === "number" &&
      Number.isFinite(group.subagentMaxTokens) &&
      group.subagentMaxTokens > 0
        ? Math.floor(group.subagentMaxTokens)
        : null;
    this._pendingDetailsSubagentProvider =
      group?.subagentPinnedProvider || null;
    this._pendingDetailsSubagentModel = group?.subagentPinnedModel || null;
    this.openDetailsDialog(currentName, groupId);
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
    if (groupId === orchestratorStore.activeGroupId) {
      return;
    }

    // Derive the appropriate sidebar page from the current active page.
    const rawPage = orchestratorStore.activePage;
    const page =
      rawPage === "chat" || rawPage === "tasks" || rawPage === "files"
        ? rawPage
        : (orchestratorStore.sidebarDefaultPage ?? "chat");

    // Dispatch a navigate event so the URL updates to /page/groupId and
    // the router calls applyRoute, which handles switchConversation.
    document.dispatchEvent(
      new CustomEvent("shadow-claw-navigate", {
        detail: { page, groupId },
        bubbles: true,
        composed: true,
      }),
    );
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

      if (group.toolTags && group.toolTags.length > 0) {
        const toolBadgeEl = document.createElement("span");
        toolBadgeEl.className = "tool-badge";
        toolBadgeEl.textContent = "🔧";
        toolBadgeEl.title = `Pinned Tools: ${group.toolTags.join(", ")}`;
        li.append(toolBadgeEl);
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

      const detailsBtn = document.createElement("button");
      detailsBtn.setAttribute("data-action", "details");
      detailsBtn.setAttribute("title", "Details");
      detailsBtn.setAttribute("aria-label", `Details for ${group.name}`);
      detailsBtn.textContent = "⚙️";

      actionsEl.append(cloneBtn, detailsBtn);

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
        } else if (action === "details") {
          this.handleDetails(group.groupId, group.name);
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
        this._handleKeyboard(e, group.groupId, group.name);
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

  _findChangedTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _findTouch(e: TouchEvent): Touch | undefined {
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === this._touchId) {
        return t;
      }
    }
  }

  _focusNext(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const focusables = Array.from(
      root.querySelectorAll('li[tabindex="0"], button:not([disabled])'),
    ) as HTMLElement[];
    const idx = focusables.indexOf(current);
    if (idx !== -1 && idx < focusables.length - 1) {
      focusables[idx + 1].focus();
    }
  }

  _focusNextItem(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const items = Array.from(
      root.querySelectorAll(".conversation-item"),
    ) as HTMLElement[];
    const currentItem = current.closest(".conversation-item") as HTMLElement;
    const idx = items.indexOf(currentItem);
    if (idx !== -1 && idx < items.length - 1) {
      items[idx + 1].focus();
    }
  }

  _focusPrev(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const focusables = Array.from(
      root.querySelectorAll('li[tabindex="0"], button:not([disabled])'),
    ) as HTMLElement[];
    const idx = focusables.indexOf(current);
    if (idx > 0) {
      focusables[idx - 1].focus();
    }
  }

  _focusPrevItem(current: HTMLElement) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const items = Array.from(
      root.querySelectorAll(".conversation-item"),
    ) as HTMLElement[];
    const currentItem = current.closest(".conversation-item") as HTMLElement;
    const idx = items.indexOf(currentItem);
    if (idx > 0) {
      items[idx - 1].focus();
    }
  }

  /**
   * Handle keyboard-based navigation, selection, and reordering.
   * Enter/Space = select, Arrow Down/Right = focus next, Arrow Up/Left = focus prev.
   * M = grab/drop for reorder (when grabbed, Arrows move, Space/Enter drop).
   */
  _handleKeyboard(e: KeyboardEvent, groupId: string, name: string) {
    const groups = orchestratorStore.groups || [];
    const ids = groups.map((g) => g.groupId);
    const total = ids.length;

    if (this._keyboardGrabbedId === null) {
      // Navigation & Selection
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this._focusNextItem(e.target as HTMLElement);

        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._focusPrevItem(e.target as HTMLElement);

        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        this._focusNext(e.target as HTMLElement);

        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this._focusPrev(e.target as HTMLElement);

        return;
      }

      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
        // If we are on the LI itself, select it
        if ((e.target as HTMLElement).classList.contains("conversation-item")) {
          e.preventDefault();
          this.handleSwitch(groupId);
        }

        // If on a button, the default button behavior handles it (click event)
        return;
      }

      // Grab for reorder
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        this._keyboardGrabbedId = groupId;
        const pos = ids.indexOf(groupId) + 1;
        this._announce(
          `${name} grabbed. Current position ${pos} of ${total}. Use Arrow Up and Down to move, Space or Enter to drop.`,
        );
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

  private _isSpawnSubagentEnabledInCurrentScope(): boolean {
    if (
      Array.isArray(this._pendingDetailsToolTags) &&
      this._pendingDetailsToolTags.length > 0
    ) {
      return this._pendingDetailsToolTags.includes("spawn_subagent");
    }

    return toolsStore.enabledToolNames.has("spawn_subagent");
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

    // Details dialog
    const detailsDialog = root.querySelector(
      ".conversations__details-dialog",
    ) as HTMLDialogElement | null;
    const detailsForm = root.querySelector(
      ".conversations__details-dialog .conversations__form",
    ) as HTMLFormElement | null;
    const detailsCancel = root.querySelector(
      ".conversations__details-dialog .conversations__cancel",
    ) as HTMLButtonElement | null;

    detailsCancel?.addEventListener("click", () => {
      detailsDialog?.close();
      this._pendingRenameGroupId = null;
      this._pendingRenameName = null;
      this._pendingDetailsToolTags = null;
      this._pendingDetailsPinnedProvider = null;
      this._pendingDetailsPinnedModel = null;
      this._pendingDetailsProviderRuntimeOverrides = {};
      this._pendingDetailsSubagentMode = "automatic";
      this._pendingDetailsSubagentMaxTokens = null;
      this._pendingDetailsSubagentProvider = null;
      this._pendingDetailsSubagentModel = null;
    });

    detailsForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this._submitDetailsDialog();
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

  private async _loadProviderModels(
    provider: LLMProvider,
  ): Promise<ProviderModelItem[]> {
    if (Array.isArray(provider.models) && provider.models.length > 0) {
      return provider.models as ProviderModelItem[];
    }

    if (!provider.modelsUrl) {
      return [];
    }

    const headers: Record<string, string> = {
      ...(provider.headers || {}),
      ...(orchestratorStore.orchestrator?.getProviderRuntimeHeaders(
        provider.id,
        "",
        this._pendingDetailsProviderRuntimeOverrides,
      ) || {}),
    };

    if (this.db && provider.apiKeyHeader && orchestratorStore.orchestrator) {
      const apiKey =
        await orchestratorStore.orchestrator.getApiKeyForSpecificProvider(
          this.db,
          provider.id,
        );
      if (apiKey) {
        const format = provider.apiKeyHeaderFormat || "{key}";
        headers[provider.apiKeyHeader] = format.replace("{key}", apiKey);
      }
    }

    const response = await fetch(provider.modelsUrl, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    let items: ProviderModelItem[] = [];

    if (Array.isArray(data)) {
      items = data as ProviderModelItem[];
    } else if (data && typeof data === "object") {
      const dataObject = data as Record<string, unknown>;
      if (Array.isArray(dataObject.models)) {
        items = dataObject.models as ProviderModelItem[];
      } else if (Array.isArray(dataObject.data)) {
        items = dataObject.data as ProviderModelItem[];
      } else {
        for (const value of Object.values(dataObject)) {
          if (Array.isArray(value) && value.length > 0) {
            items = value as ProviderModelItem[];

            break;
          }
        }

        if (items.length === 0 && (dataObject.id || dataObject.name)) {
          items = [dataObject as ProviderModelItem];
        }
      }
    }

    if (Array.isArray(provider.models) && provider.models.length > 0) {
      const dynamicIds = new Set(
        items
          .map((item) =>
            typeof item === "string" ? item : item.id || item.name || "",
          )
          .filter(Boolean),
      );
      const staticItems = (provider.models as ProviderModelItem[]).filter(
        (item) => {
          const modelId =
            typeof item === "string" ? item : item.id || item.name || "";

          return modelId && !dynamicIds.has(modelId);
        },
      );
      items = [...staticItems, ...items];
    }

    return items;
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

  async _submitDetailsDialog() {
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
      ".conversations__details-dialog .conversations__input",
    ) as HTMLInputElement | null;
    const dialog = root.querySelector(
      ".conversations__details-dialog",
    ) as HTMLDialogElement | null;

    const name = input?.value.trim();

    if (name && name !== this._pendingRenameName) {
      await orchestratorStore.renameConversation(
        this.db,
        this._pendingRenameGroupId,
        name,
      );
    }

    if (this._pendingDetailsToolTags) {
      await orchestratorStore.updateConversationToolTags(
        this.db,
        this._pendingRenameGroupId,
        this._pendingDetailsToolTags,
      );
    }

    await orchestratorStore.updateConversationPinnedProvider(
      this.db,
      this._pendingRenameGroupId,
      this._pendingDetailsPinnedProvider || undefined,
      this._pendingDetailsPinnedModel || undefined,
    );

    await orchestratorStore.updateConversationProviderRuntimeOverrides(
      this.db,
      this._pendingRenameGroupId,
      this._pendingDetailsProviderRuntimeOverrides,
    );

    await orchestratorStore.updateConversationSubagentSettings(
      this.db,
      this._pendingRenameGroupId,
      this._pendingDetailsSubagentMode,
      this._pendingDetailsSubagentProvider || undefined,
      this._pendingDetailsSubagentModel || undefined,
      this._pendingDetailsSubagentMaxTokens || undefined,
    );

    dialog?.close();
    this._pendingRenameGroupId = null;
    this._pendingRenameName = null;
    this._pendingDetailsToolTags = null;
    this._pendingDetailsPinnedProvider = null;
    this._pendingDetailsPinnedModel = null;
    this._pendingDetailsProviderRuntimeOverrides = {};
    this._pendingDetailsSubagentMode = "automatic";
    this._pendingDetailsSubagentMaxTokens = null;
    this._pendingDetailsSubagentProvider = null;
    this._pendingDetailsSubagentModel = null;
  }
}

customElements.define("shadow-claw-conversations", ShadowClawConversations);
