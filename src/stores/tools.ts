import { Signal } from "signal-polyfill";

import { CONFIG_KEYS } from "../config/config.js";
import { getConfig } from "../db/getConfig.js";
import { setConfig } from "../db/setConfig.js";
import { TOOL_DEFINITIONS } from "../subsystems/tools/tools.js";
import { DEFAULT_BUILTIN_PROFILE } from "../subsystems/tools/builtin-profiles.js";
import { loadDeclarativeTools } from "../subsystems/tools/declarative.js";
import type { DeclarativeToolDefinition } from "../subsystems/tools/declarative.js";
import type { ShadowClawDatabase } from "../db/types.js";
import type { ToolDefinition, ToolProfile } from "../subsystems/tools/tools.js";

export class ToolsStore {
  private _activeProfile: Signal.Computed<ToolProfile | null>;
  private _activeProfileId: Signal.State<string | null>;
  private _allTools: Signal.Computed<ToolDefinition[]>;
  private _customTools: Signal.State<ToolDefinition[]>;
  private _declarativeTools: Signal.State<DeclarativeToolDefinition[]>;
  private _declarativeToolNamesEnabled: Signal.State<Set<string> | null>;
  private _enabledDeclarativeTools: Signal.Computed<
    DeclarativeToolDefinition[]
  >;
  private _enabledToolNames: Signal.State<Set<string>>;
  private _enabledTools: Signal.Computed<ToolDefinition[]>;
  private _profiles: Signal.State<ToolProfile[]>;
  private _systemPromptOverride: Signal.State<string>;
  private _webSearchProxyUrl: Signal.State<string>;
  private _webSearchUrl: Signal.State<string>;
  private _webSearchUseProxy: Signal.State<boolean>;
  private _searchFilesMaxFileBytes: Signal.State<number>;
  private _searchFilesMaxFilesVisited: Signal.State<number>;
  private _searchFilesSkipDirs: Signal.State<string>;

  constructor() {
    this._enabledToolNames = new Signal.State(
      new Set(DEFAULT_BUILTIN_PROFILE.enabledToolNames),
    );
    this._customTools = new Signal.State([]);
    this._declarativeTools = new Signal.State([]);
    this._declarativeToolNamesEnabled = new Signal.State<Set<string> | null>(
      null,
    );
    this._systemPromptOverride = new Signal.State("");
    this._profiles = new Signal.State([]);
    this._activeProfileId = new Signal.State(DEFAULT_BUILTIN_PROFILE.id);
    this._webSearchUseProxy = new Signal.State(false);
    this._webSearchProxyUrl = new Signal.State("/proxy");
    this._webSearchUrl = new Signal.State(
      "https://html.duckduckgo.com/html/?q={query}",
    );
    this._searchFilesMaxFileBytes = new Signal.State(512 * 1024);
    this._searchFilesMaxFilesVisited = new Signal.State(1000);
    this._searchFilesSkipDirs = new Signal.State(
      ".git,node_modules,dist,dist-electron,.cache,.nx,.turbo,__pycache__,.venv,venv",
    );

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

    this._enabledDeclarativeTools = new Signal.Computed(() => {
      const tools = this._declarativeTools.get();
      const enabledSet = this._declarativeToolNamesEnabled.get();
      if (enabledSet === null) {
        return tools;
      }
      return tools.filter((t) => enabledSet.has(t.name));
    });

    this._activeProfile = new Signal.Computed(() => {
      const id = this._activeProfileId.get();
      if (!id) {
        return null;
      }

      if (DEFAULT_BUILTIN_PROFILE.id === id) {
        return DEFAULT_BUILTIN_PROFILE;
      }

      return this._profiles.get().find((p: ToolProfile) => p.id === id) || null;
    });
  }

  get activeProfile(): ToolProfile | null {
    return this._activeProfile.get();
  }

  get activeProfileId(): string | null {
    return this._activeProfileId.get();
  }

  get allTools(): ToolDefinition[] {
    return this._allTools.get();
  }

  get customTools(): ToolDefinition[] {
    return this._customTools.get();
  }

  get declarativeTools(): DeclarativeToolDefinition[] {
    return this._declarativeTools.get();
  }

  get declarativeToolNamesEnabled(): Set<string> | null {
    return this._declarativeToolNamesEnabled.get();
  }

  get enabledDeclarativeTools(): DeclarativeToolDefinition[] {
    return this._enabledDeclarativeTools.get();
  }

  get enabledToolNames(): Set<string> {
    return this._enabledToolNames.get();
  }

  get enabledTools(): ToolDefinition[] {
    return this._enabledTools.get();
  }

  isDeclarativeToolEnabled(name: string): boolean {
    const enabledSet = this._declarativeToolNamesEnabled.get();
    if (enabledSet === null) {
      return true;
    }
    return enabledSet.has(name);
  }

  async refreshDeclarativeTools(
    db: ShadowClawDatabase,
    groupId?: string,
  ): Promise<DeclarativeToolDefinition[]> {
    try {
      const res = await loadDeclarativeTools(db, groupId || "br:main");
      const allBuiltInAndCustom = this.allTools;
      const declTools = (res?.tools || []).filter(
        (dt) => !allBuiltInAndCustom.some((bt) => bt.name === dt.name),
      );

      const current = this._declarativeTools.get();
      const isSame =
        current.length === declTools.length &&
        current.every(
          (t, i) =>
            t.name === declTools[i].name &&
            t.description === declTools[i].description &&
            JSON.stringify(t.execution) ===
              JSON.stringify(declTools[i].execution),
        );

      if (!isSame) {
        this._declarativeTools.set(declTools);
      }
      return declTools;
    } catch {
      if (this._declarativeTools.get().length > 0) {
        this._declarativeTools.set([]);
      }
      return [];
    }
  }

  async setDeclarativeToolEnabled(
    db: ShadowClawDatabase,
    toolName: string,
    enabled: boolean,
  ): Promise<void> {
    const currentEnabled = this._declarativeToolNamesEnabled.get();
    const allDeclTools = this._declarativeTools.get();
    const nextSet = new Set(
      currentEnabled === null
        ? allDeclTools.map((t) => t.name)
        : currentEnabled,
    );
    if (enabled) {
      nextSet.add(toolName);
    } else {
      nextSet.delete(toolName);
    }
    this._declarativeToolNamesEnabled.set(nextSet);
    await setConfig(
      db,
      CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED,
      Array.from(nextSet),
    );
  }

  async setAllDeclarativeEnabled(
    db: ShadowClawDatabase,
    toolNames: string[],
  ): Promise<void> {
    const nextSet = new Set(toolNames);
    this._declarativeToolNamesEnabled.set(nextSet);
    await setConfig(db, CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED, toolNames);
  }

  /**
   * Export tools config as JSON for backup.
   */
  exportBackup(): string {
    return JSON.stringify(
      {
        enabledTools: [...this._enabledToolNames.get()],
        customTools: this._customTools.get(),
        declarativeToolsEnabled: this._declarativeToolNamesEnabled.get()
          ? Array.from(this._declarativeToolNamesEnabled.get()!)
          : null,
        systemPromptOverride: this._systemPromptOverride.get(),
        profiles: this._profiles.get(),
        activeProfileId: this._activeProfileId.get(),
        webSearchUseProxy: this._webSearchUseProxy.get(),
        webSearchProxyUrl: this._webSearchProxyUrl.get(),
        webSearchUrl: this._webSearchUrl.get(),
        searchFilesMaxFileBytes: this._searchFilesMaxFileBytes.get(),
        searchFilesMaxFilesVisited: this._searchFilesMaxFilesVisited.get(),
        searchFilesSkipDirs: this._searchFilesSkipDirs.get(),
      },
      null,
      2,
    );
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

  get profiles(): ToolProfile[] {
    return [DEFAULT_BUILTIN_PROFILE, ...this._profiles.get()];
  }

  get systemPromptOverride(): string {
    return this._systemPromptOverride.get();
  }

  get webSearchProxyUrl(): string {
    return this._webSearchProxyUrl.get();
  }

  get webSearchUrl(): string {
    return this._webSearchUrl.get();
  }

  get webSearchUseProxy(): boolean {
    return this._webSearchUseProxy.get();
  }

  get searchFilesMaxFileBytes(): number {
    return this._searchFilesMaxFileBytes.get();
  }

  get searchFilesMaxFilesVisited(): number {
    return this._searchFilesMaxFilesVisited.get();
  }

  /** Comma-separated list of directory names to skip when walking the workspace. */
  get searchFilesSkipDirs(): string {
    return this._searchFilesSkipDirs.get();
  }

  /** Parsed Set of directory names to skip — derived from the comma-separated string. */
  get searchFilesSkipDirsSet(): Set<string> {
    return new Set(
      this._searchFilesSkipDirs
        .get()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
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

  // ── Profile Management ───────────────────────────────────────────

  async addProfile(
    db: ShadowClawDatabase,
    profile: ToolProfile,
  ): Promise<void> {
    const profiles = [...this._profiles.get(), profile];
    this._profiles.set(profiles);
    await setConfig(db, CONFIG_KEYS.TOOL_PROFILES, profiles);
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

  async deactivateProfile(db: ShadowClawDatabase): Promise<void> {
    this._activeProfileId.set(null);
    await setConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE, null);
  }

  async deleteProfile(
    db: ShadowClawDatabase,
    profileId: string,
  ): Promise<void> {
    if (profileId === DEFAULT_BUILTIN_PROFILE.id) {
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

    if (typeof data.webSearchUseProxy === "boolean") {
      this._webSearchUseProxy.set(data.webSearchUseProxy);
      await setConfig(
        db,
        CONFIG_KEYS.WEB_SEARCH_USE_PROXY,
        data.webSearchUseProxy ? "true" : "false",
      );
    }

    if (typeof data.webSearchProxyUrl === "string") {
      this._webSearchProxyUrl.set(data.webSearchProxyUrl);
      await setConfig(
        db,
        CONFIG_KEYS.WEB_SEARCH_PROXY_URL,
        data.webSearchProxyUrl,
      );
    }

    if (typeof data.webSearchUrl === "string") {
      this._webSearchUrl.set(data.webSearchUrl);
      await setConfig(db, CONFIG_KEYS.WEB_SEARCH_URL, data.webSearchUrl);
    }

    if (
      typeof data.searchFilesMaxFileBytes === "number" &&
      data.searchFilesMaxFileBytes > 0
    ) {
      this._searchFilesMaxFileBytes.set(data.searchFilesMaxFileBytes);
      await setConfig(
        db,
        CONFIG_KEYS.SEARCH_FILES_MAX_FILE_BYTES,
        String(data.searchFilesMaxFileBytes),
      );
    }

    if (
      typeof data.searchFilesMaxFilesVisited === "number" &&
      data.searchFilesMaxFilesVisited > 0
    ) {
      this._searchFilesMaxFilesVisited.set(data.searchFilesMaxFilesVisited);
      await setConfig(
        db,
        CONFIG_KEYS.SEARCH_FILES_MAX_FILES_VISITED,
        String(data.searchFilesMaxFilesVisited),
      );
    }

    if (typeof data.searchFilesSkipDirs === "string") {
      this._searchFilesSkipDirs.set(data.searchFilesSkipDirs);
      await setConfig(
        db,
        CONFIG_KEYS.SEARCH_FILES_SKIP_DIRS,
        data.searchFilesSkipDirs,
      );
    }

    if (Array.isArray(data.declarativeToolsEnabled)) {
      this._declarativeToolNamesEnabled.set(
        new Set(data.declarativeToolsEnabled),
      );
      await setConfig(
        db,
        CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED,
        data.declarativeToolsEnabled,
      );
    } else if (data.declarativeToolsEnabled === null) {
      this._declarativeToolNamesEnabled.set(null);
      await setConfig(db, CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED, null);
    }
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
      webSearchUseProxyRaw,
      webSearchProxyUrlRaw,
      webSearchUrlRaw,
      searchFilesMaxFileBytesRaw,
      searchFilesMaxFilesVisitedRaw,
      searchFilesSkipDirsRaw,
      declarativeEnabledRaw,
    ] = await Promise.all([
      getConfig(db, CONFIG_KEYS.ENABLED_TOOLS),
      getConfig(db, CONFIG_KEYS.CUSTOM_TOOLS),
      getConfig(db, CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE),
      getConfig(db, CONFIG_KEYS.TOOL_PROFILES),
      getConfig(db, CONFIG_KEYS.ACTIVE_TOOL_PROFILE),
      getConfig(db, CONFIG_KEYS.WEB_SEARCH_USE_PROXY),
      getConfig(db, CONFIG_KEYS.WEB_SEARCH_PROXY_URL),
      getConfig(db, CONFIG_KEYS.WEB_SEARCH_URL),
      getConfig(db, CONFIG_KEYS.SEARCH_FILES_MAX_FILE_BYTES),
      getConfig(db, CONFIG_KEYS.SEARCH_FILES_MAX_FILES_VISITED),
      getConfig(db, CONFIG_KEYS.SEARCH_FILES_SKIP_DIRS),
      getConfig(db, CONFIG_KEYS.DECLARATIVE_TOOLS_ENABLED),
    ]);

    if (Array.isArray(enabledRaw)) {
      this._enabledToolNames.set(new Set(enabledRaw));
    }

    if (Array.isArray(customRaw)) {
      this._customTools.set(customRaw);
    }

    if (Array.isArray(declarativeEnabledRaw)) {
      this._declarativeToolNamesEnabled.set(new Set(declarativeEnabledRaw));
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

    if (webSearchUseProxyRaw !== null && webSearchUseProxyRaw !== undefined) {
      const strVal = String(webSearchUseProxyRaw).toLowerCase();
      this._webSearchUseProxy.set(strVal === "true" || strVal === "1");
    }

    if (
      typeof webSearchProxyUrlRaw === "string" &&
      webSearchProxyUrlRaw.trim().length > 0
    ) {
      this._webSearchProxyUrl.set(webSearchProxyUrlRaw.trim());
    }

    if (
      typeof webSearchUrlRaw === "string" &&
      webSearchUrlRaw.trim().length > 0
    ) {
      this._webSearchUrl.set(webSearchUrlRaw.trim());
    }

    if (
      searchFilesMaxFileBytesRaw !== null &&
      searchFilesMaxFileBytesRaw !== undefined
    ) {
      const n = Number(searchFilesMaxFileBytesRaw);
      if (Number.isFinite(n) && n > 0) {
        this._searchFilesMaxFileBytes.set(n);
      }
    }

    if (
      searchFilesMaxFilesVisitedRaw !== null &&
      searchFilesMaxFilesVisitedRaw !== undefined
    ) {
      const n = Number(searchFilesMaxFilesVisitedRaw);
      if (Number.isFinite(n) && n > 0) {
        this._searchFilesMaxFilesVisited.set(n);
      }
    }

    if (
      typeof searchFilesSkipDirsRaw === "string" &&
      searchFilesSkipDirsRaw.trim().length > 0
    ) {
      this._searchFilesSkipDirs.set(searchFilesSkipDirsRaw.trim());
    }
  }

  async setWebSearchProxyUrl(
    db: ShadowClawDatabase,
    proxyUrl: string,
  ): Promise<void> {
    const trimmed = proxyUrl.trim() || "/proxy";
    this._webSearchProxyUrl.set(trimmed);
    await setConfig(db, CONFIG_KEYS.WEB_SEARCH_PROXY_URL, trimmed);
  }

  async setWebSearchUrl(db: ShadowClawDatabase, url: string): Promise<void> {
    const trimmed = url.trim() || "https://html.duckduckgo.com/html/?q={query}";
    this._webSearchUrl.set(trimmed);
    await setConfig(db, CONFIG_KEYS.WEB_SEARCH_URL, trimmed);
  }

  async setWebSearchUseProxy(
    db: ShadowClawDatabase,
    useProxy: boolean,
  ): Promise<void> {
    const enabled = !!useProxy;
    this._webSearchUseProxy.set(enabled);
    await setConfig(
      db,
      CONFIG_KEYS.WEB_SEARCH_USE_PROXY,
      enabled ? "true" : "false",
    );
  }

  async setSearchFilesMaxFileBytes(
    db: ShadowClawDatabase,
    bytes: number,
  ): Promise<void> {
    const clamped = Math.max(1, Math.round(bytes));
    this._searchFilesMaxFileBytes.set(clamped);
    await setConfig(
      db,
      CONFIG_KEYS.SEARCH_FILES_MAX_FILE_BYTES,
      String(clamped),
    );
  }

  async setSearchFilesMaxFilesVisited(
    db: ShadowClawDatabase,
    count: number,
  ): Promise<void> {
    const clamped = Math.max(1, Math.round(count));
    this._searchFilesMaxFilesVisited.set(clamped);
    await setConfig(
      db,
      CONFIG_KEYS.SEARCH_FILES_MAX_FILES_VISITED,
      String(clamped),
    );
  }

  async setSearchFilesSkipDirs(
    db: ShadowClawDatabase,
    dirs: string,
  ): Promise<void> {
    const trimmed = dirs.trim();
    this._searchFilesSkipDirs.set(trimmed);
    await setConfig(db, CONFIG_KEYS.SEARCH_FILES_SKIP_DIRS, trimmed);
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

  async setSystemPromptOverride(
    db: ShadowClawDatabase,
    override: string,
  ): Promise<void> {
    this._systemPromptOverride.set(override);
    await setConfig(db, CONFIG_KEYS.SYSTEM_PROMPT_OVERRIDE, override);
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
}

export const toolsStore = new ToolsStore();
