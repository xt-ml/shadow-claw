import { Signal } from "signal-polyfill";

import { CONFIG_KEYS } from "../config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { TOOL_DEFINITIONS } from "../tools.js";
import { NANO_BUILTIN_PROFILE } from "../tools/builtin-profiles.js";
import type { ShadowClawDatabase } from "../types.js";
import type { ToolDefinition, ToolProfile } from "../tools.js";

export class ToolsStore {
  private _enabledToolNames: Signal.State<Set<string>>;
  private _customTools: Signal.State<ToolDefinition[]>;
  private _systemPromptOverride: Signal.State<string>;
  private _profiles: Signal.State<ToolProfile[]>;
  private _activeProfileId: Signal.State<string | null>;
  private _allTools: Signal.Computed<ToolDefinition[]>;
  private _enabledTools: Signal.Computed<ToolDefinition[]>;
  private _activeProfile: Signal.Computed<ToolProfile | null>;

  constructor() {
    this._enabledToolNames = new Signal.State(
      new Set(TOOL_DEFINITIONS.map((t) => t.name)),
    );
    this._customTools = new Signal.State([]);
    this._systemPromptOverride = new Signal.State("");
    this._profiles = new Signal.State([]);
    this._activeProfileId = new Signal.State(null);

    // Derived signals using Signal.Computed for proper reactive propagation.
    this._allTools = new Signal.Computed(() => [
      ...TOOL_DEFINITIONS,
      ...this._customTools.get(),
    ]);

    this._enabledTools = new Signal.Computed(() => {
      const enabled = this._enabledToolNames.get();

      return this._allTools
        .get()
        .filter((t: ToolDefinition) => enabled.has(t.name));
    });

    this._activeProfile = new Signal.Computed(() => {
      const id = this._activeProfileId.get();
      if (!id) {
        return null;
      }

      if (NANO_BUILTIN_PROFILE.id === id) {
        return NANO_BUILTIN_PROFILE;
      }

      return this._profiles.get().find((p: ToolProfile) => p.id === id) || null;
    });
  }

  get enabledToolNames(): Set<string> {
    return this._enabledToolNames.get();
  }

  get customTools(): ToolDefinition[] {
    return this._customTools.get();
  }

  get systemPromptOverride(): string {
    return this._systemPromptOverride.get();
  }

  get profiles(): ToolProfile[] {
    return [NANO_BUILTIN_PROFILE, ...this._profiles.get()];
  }

  get activeProfileId(): string | null {
    return this._activeProfileId.get();
  }

  get activeProfile(): ToolProfile | null {
    return this._activeProfile.get();
  }

  get allTools(): ToolDefinition[] {
    return this._allTools.get();
  }

  get enabledTools(): ToolDefinition[] {
    return this._enabledTools.get();
  }

  /**
   * Load persisted tool config from IndexedDB.
   */
  async load(db: ShadowClawDatabase): Promise<void> {
    const [
      enabledRaw,
      customRaw,
      promptOverride,
      profilesRaw,
      activeProfileIdRaw,
    ] = await Promise.all([
      getConfig(db, CONFIG_KEYS.ENABLED_TOOLS),
      getConfig(db, CONFIG_KEYS.CUSTOM_TOOLS),
      getConfig(db, CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE),
      getConfig(db, CONFIG_KEYS.TOOL_PROFILES),
      getConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE),
    ]);

    if (Array.isArray(enabledRaw)) {
      this._enabledToolNames.set(new Set(enabledRaw));
    }

    if (Array.isArray(customRaw)) {
      this._customTools.set(customRaw);
    }

    if (typeof promptOverride === "string") {
      this._systemPromptOverride.set(promptOverride);
    }

    if (Array.isArray(profilesRaw)) {
      this._profiles.set(profilesRaw);
    }

    if (typeof activeProfileIdRaw === "string") {
      this._activeProfileId.set(activeProfileIdRaw);
    }
  }

  async setToolEnabled(
    db: ShadowClawDatabase,
    toolName: string,
    enabled: boolean,
  ): Promise<void> {
    const current = new Set(this._enabledToolNames.get());
    if (enabled) {
      current.add(toolName);
    } else {
      current.delete(toolName);
    }

    this._enabledToolNames.set(current);

    const saves = [setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, [...current])];
    if (this._activeProfileId.get()) {
      this._activeProfileId.set(null);
      saves.push(setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, null));
    }

    await Promise.all(saves);
  }

  async setAllEnabled(
    db: ShadowClawDatabase,
    toolNames: string[],
  ): Promise<void> {
    this._enabledToolNames.set(new Set(toolNames));

    const saves = [setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, toolNames)];
    if (this._activeProfileId.get()) {
      this._activeProfileId.set(null);
      saves.push(setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, null));
    }

    await Promise.all(saves);
  }

  async addCustomTool(
    db: ShadowClawDatabase,
    tool: ToolDefinition,
  ): Promise<void> {
    const tools = [...this._customTools.get(), tool];
    this._customTools.set(tools);
    // Auto-enable new tool
    const enabled = new Set(this._enabledToolNames.get());
    enabled.add(tool.name);
    this._enabledToolNames.set(enabled);
    await Promise.all([
      setConfig(db, CONFIG_KEYS.CUSTOM_TOOLS, tools),
      setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, [...enabled]),
    ]);
  }

  async removeCustomTool(
    db: ShadowClawDatabase,
    toolName: string,
  ): Promise<void> {
    const tools = this._customTools.get().filter((t) => t.name !== toolName);
    this._customTools.set(tools);
    const enabled = new Set(this._enabledToolNames.get());
    enabled.delete(toolName);
    this._enabledToolNames.set(enabled);
    await Promise.all([
      setConfig(db, CONFIG_KEYS.CUSTOM_TOOLS, tools),
      setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, [...enabled]),
    ]);
  }

  async setSystemPromptOverride(
    db: ShadowClawDatabase,
    override: string,
  ): Promise<void> {
    this._systemPromptOverride.set(override);
    await setConfig(db, CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE, override);
  }

  // ── Profile Management ───────────────────────────────────────────

  async addProfile(
    db: ShadowClawDatabase,
    profile: ToolProfile,
  ): Promise<void> {
    const profiles = [...this._profiles.get(), profile];
    this._profiles.set(profiles);
    await setConfig(db, CONFIG_KEYS.TOOL_PROFILES, profiles);
  }

  async updateProfile(
    db: ShadowClawDatabase,
    profile: ToolProfile,
  ): Promise<void> {
    const profiles = this._profiles
      .get()
      .map((p) => (p.id === profile.id ? profile : p));
    this._profiles.set(profiles);
    await setConfig(db, CONFIG_KEYS.TOOL_PROFILES, profiles);
  }

  async deleteProfile(
    db: ShadowClawDatabase,
    profileId: string,
  ): Promise<void> {
    if (profileId === NANO_BUILTIN_PROFILE.id) {
      return;
    }

    const profiles = this._profiles.get().filter((p) => p.id !== profileId);
    this._profiles.set(profiles);
    if (this._activeProfileId.get() === profileId) {
      this._activeProfileId.set(null);
      await setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, null);
    }

    await setConfig(db, CONFIG_KEYS.TOOL_PROFILES, profiles);
  }

  async activateProfile(
    db: ShadowClawDatabase,
    profileId: string,
  ): Promise<void> {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) {
      return;
    }

    this._activeProfileId.set(profileId);
    this._enabledToolNames.set(new Set(profile.enabledToolNames));
    this._customTools.set(profile.customTools);
    this._systemPromptOverride.set(profile.systemPromptOverride || "");

    await Promise.all([
      setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, profileId),
      setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, profile.enabledToolNames),
      setConfig(db, CONFIG_KEYS.CUSTOM_TOOLS, profile.customTools),
      setConfig(
        db,
        CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE,
        profile.systemPromptOverride || "",
      ),
    ]);
  }

  async deactivateProfile(db: ShadowClawDatabase): Promise<void> {
    this._activeProfileId.set(null);
    await setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, null);
  }

  async saveToActiveProfile(db: ShadowClawDatabase): Promise<void> {
    const id = this._activeProfileId.get();
    if (!id) {
      return;
    }

    const profile = this._profiles.get().find((p) => p.id === id);
    if (!profile) {
      return;
    }

    const updated = {
      ...profile,
      enabledToolNames: [...this._enabledToolNames.get()],
      customTools: [...this._customTools.get()],
      systemPromptOverride: this._systemPromptOverride.get(),
    };
    await this.updateProfile(db, updated);
  }

  findProfilesForProvider(providerId?: string, model?: string): ToolProfile[] {
    return this.profiles.filter((p) => {
      if (p.providerId && p.providerId !== providerId) {
        return false;
      }

      if (p.model && p.model !== model) {
        return false;
      }

      return true;
    });
  }

  async cloneTool(
    db: ShadowClawDatabase,
    sourceToolName: string,
    newToolName: string,
    newDescription?: string,
  ): Promise<boolean> {
    const source = this.allTools.find((t) => t.name === sourceToolName);
    if (!source) {
      return false;
    }

    if (this.allTools.some((t) => t.name === newToolName)) {
      return false;
    }

    const cloned: ToolDefinition = {
      name: newToolName,
      description: newDescription || source.description,
      input_schema: JSON.parse(JSON.stringify(source.input_schema)),
    };

    await this.addCustomTool(db, cloned);

    return true;
  }

  /**
   * Export tools config as JSON for backup.
   */
  exportBackup(): string {
    return JSON.stringify(
      {
        enabledTools: [...this._enabledToolNames.get()],
        customTools: this._customTools.get(),
        systemPromptOverride: this._systemPromptOverride.get(),
        profiles: this._profiles.get(),
        activeProfileId: this._activeProfileId.get(),
      },
      null,
      2,
    );
  }

  async importBackup(db: ShadowClawDatabase, json: string): Promise<void> {
    const data = JSON.parse(json);
    if (Array.isArray(data.enabledTools)) {
      this._enabledToolNames.set(new Set(data.enabledTools));
      await setConfig(db, CONFIG_KEYS.ENABLED_TOOLS, data.enabledTools);
    }

    if (Array.isArray(data.customTools)) {
      this._customTools.set(data.customTools);
      await setConfig(db, CONFIG_KEYS.CUSTOM_TOOLS, data.customTools);
    }

    if (typeof data.systemPromptOverride === "string") {
      this._systemPromptOverride.set(data.systemPromptOverride);
      await setConfig(
        db,
        CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE,
        data.systemPromptOverride,
      );
    }

    if (Array.isArray(data.profiles)) {
      this._profiles.set(data.profiles);
      await setConfig(db, CONFIG_KEYS.TOOL_PROFILES, data.profiles);
    }

    if (
      typeof data.activeProfileId === "string" ||
      data.activeProfileId === null
    ) {
      this._activeProfileId.set(data.activeProfileId);
      await setConfig(
        db,
        CONFIG_KEYS.ACTIVE_TOOL_PROFILE,
        data.activeProfileId,
      );
    }
  }
}

export const toolsStore = new ToolsStore();
