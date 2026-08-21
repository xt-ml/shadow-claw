import{N as e,k as t}from"./config-64zJ5TLN.js";import{n}from"./txPromise-EBECky1b.js";import{cn as r,ln as i,t as a}from"./orchestrator-DrMg2dnI.js";import{t as o}from"./ulid-BY7rQVLN.js";import{n as s,r as c,t as l}from"./toast-D3gxhZpN.js";import{t as u}from"./shadow-claw-element-na_3JW5e.js";import{t as d}from"./effect-BEsuusE8.js";import"./shadow-claw-page-header-action-button-Cn1xDjfA.js";import"./shadow-claw-page-header-DyG_qg9T.js";import"./shadow-claw-dialog-n4xdcUp-.js";import{i as f,n as p,t as m}from"./syncWebMcpRegistration-CIzFLqsk.js";const h=new CSSStyleSheet;h.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
  scrollbar-color: var(--shadow-claw-border-color) transparent;
  scrollbar-width: thin;
}

::-webkit-scrollbar {
  height: 0.5rem;
  width: 0.5rem;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--shadow-claw-border-color);
  border-radius: 0.25rem;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--shadow-claw-text-tertiary);
}

.hidden,
[hidden] {
  display: none !important;
}

:host {
  display: flex;
  flex-direction: column;
  font-family: var(--shadow-claw-font-sans, system-ui, sans-serif);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.tools {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

.tools__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}

/* Sections */
.tools__section {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  margin-bottom: 1rem;
  padding: 1rem;
}

.tools__section-title {
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin: 0 0 0.75rem;
}

/* Tool list */
.tools__list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tools__item {
  align-items: center;
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  display: flex;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  transition: background 0.15s;
}

.tools__item:hover {
  background: var(--shadow-claw-bg-tertiary);
}

.tools__item-checkbox {
  cursor: pointer;
  flex: none;
  height: 1rem;
  width: 1rem;
}

.tools__item-info {
  flex: 1;
  min-width: 0;
}

.tools__item-name {
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.8125rem;
  font-weight: 600;
}

.tools__item-desc {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tools__item-delete {
  background: none;
  border: none;
  color: var(--shadow-claw-error-color);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.tools__item-badge {
  background: var(--shadow-claw-bg-tertiary);
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-secondary);
  flex: none;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  text-transform: uppercase;
}

/* Toolbar */
.tools__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.tools__webmcp-optin {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.tools__internet-optin {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.tools__internet-access-toggle {
  cursor: pointer;
  height: 1rem;
  width: 1rem;
}

/* Search Files */
.tools__searchfiles-row {
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tools__searchfiles-row label {
  color: var(--shadow-claw-text-secondary);
  min-width: 14rem;
}

.tools__searchfiles-max-file-bytes-input,
.tools__searchfiles-max-files-visited-input,
.tools__searchfiles-skip-dirs-input {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.375rem 0.5rem;
}

.tools__searchfiles-max-file-bytes-input:focus,
.tools__searchfiles-max-files-visited-input:focus,
.tools__searchfiles-skip-dirs-input:focus,
.tools__websearch-proxy-url-input:focus,
.tools__websearch-url-input:focus {
  border-color: var(--shadow-claw-accent-primary);
  outline: none;
}

.tools__searchfiles-actions {
  display: flex;
  margin-bottom: 0.5rem;
  margin-top: 0.5rem;
}

.tools__websearch-optin {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.tools__websearch-proxy-toggle {
  cursor: pointer;
  height: 1rem;
  width: 1rem;
}

.tools__websearch-row {
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tools__websearch-row label {
  color: var(--shadow-claw-text-secondary);
  min-width: 7.5rem;
}

.tools__websearch-proxy-url-input,
.tools__websearch-url-input {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.375rem 0.5rem;
}

.tools__websearch-actions {
  display: flex;
  margin-bottom: 0.5rem;
  margin-top: 0.5rem;
}

.tools__webmcp-toggle {
  cursor: pointer;
  height: 1rem;
  width: 1rem;
}

.tools__webmcp-mode-row {
  align-items: center;
  display: flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.tools__webmcp-mode-row label {
  color: var(--shadow-claw-text-secondary);
}

.tools__webmcp-mode {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.tools__toolbar-btn {
  background: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 0.375rem 0.625rem;
}

.tools__toolbar-btn:hover {
  background: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-primary);
}

.tools__count {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.6875rem;
  margin-left: auto;
  padding: 0.375rem 0;
}

/* System prompt area */
.tools__prompt-area {
  background: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.75rem;
  min-height: 8rem;
  padding: 0.625rem;
  resize: vertical;
  width: 100%;
}

.tools__prompt-hint {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.6875rem;
  margin-top: 0.375rem;
}

.tools__prompt-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tools__save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  transition: background-color 0.15s;
}

.tools__save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.tools__clear-prompt-btn {
  background: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.5rem 1rem;
}

/* Dialog */
dialog {
  background: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l, 1rem);
  color: var(--shadow-claw-text-primary);
  max-width: 32rem;
  padding: 0;
  width: calc(100% - 2rem);
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.tools__dialog-header {
  align-items: center;
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  justify-content: space-between;
  padding: 1rem;
}

.tools__dialog-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.tools__dialog-close {
  background: none;
  border: none;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
  padding: 0.25rem;
}

.tools__dialog-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.tools__form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tools__form-label {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  font-weight: 600;
}

.tools__form-input,
.tools__form-textarea {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.75rem;
  padding: 0.5rem;
}

.tools__form-textarea {
  min-height: 5rem;
  resize: vertical;
}

.tools__form-hint {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.6875rem;
}

.tools__dialog-footer {
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 1rem;
}

.tools__btn-cancel {
  background: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.5rem 1rem;
  transition: all 0.15s;
}

.tools__btn-cancel:hover {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
}

.tools__btn-save {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  transition: background-color 0.15s;
}

.tools__btn-save:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

/* Profile styles */
.tools__profile-bar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tools__profile-select {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-size: 0.75rem;
  min-width: 0;
  padding: 0.375rem 0.5rem;
}

.tools__profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.tools__profile-btn {
  background: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.6875rem;
  padding: 0.3125rem 0.5rem;
  white-space: nowrap;
}

.tools__profile-btn:hover {
  background: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-primary);
}

.tools__profile-btn--danger {
  color: var(--shadow-claw-error-color);
}

.tools__profile-badge {
  background: var(--shadow-claw-accent-primary);
  border-radius: 0.25rem;
  color: var(--shadow-claw-on-primary);
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  text-transform: uppercase;
}

.tools__item-clone {
  background: none;
  border: none;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.tools__item-clone:hover {
  color: var(--shadow-claw-accent-primary);
}
`);const g=new DOMParser().parseFromString(`<template>
  <section aria-label="Tool Configuration" class="tools">
    <shadow-claw-page-header icon="🛠️" title="Tool Configuration">
      <shadow-claw-page-header-action-button
        class="tools__back-btn"
        slot="actions"
      >
        ← Back to Settings
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tools__add-btn"
        slot="actions"
        variant="primary"
      >
        + Add Tool
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tools__backup-btn"
        slot="actions"
      >
        💾 Backup
      </shadow-claw-page-header-action-button>
      <shadow-claw-page-header-action-button
        class="tools__restore-btn"
        slot="actions"
      >
        ♻️ Restore
      </shadow-claw-page-header-action-button>
    </shadow-claw-page-header>

    <input
      accept=".json,application/json"
      aria-label="Restore tools config from JSON backup"
      class="tools__hidden-restore"
      hidden
      type="file"
    />

    <div class="tools__content">
      <div class="tools__section">
        <h3 class="tools__section-title">📋 Profiles</h3>
        <div class="tools__profile-bar">
          <select
            aria-label="Select tool profile"
            class="tools__profile-select"
          >
            <option value="">— No profile (manual config) —</option>
          </select>
          <div class="tools__profile-actions">
            <button
              class="tools__profile-btn tools__profile-save-btn"
              type="button"
            >
              💾 Save as Profile
            </button>
            <button
              class="tools__profile-btn tools__profile-new-btn"
              type="button"
            >
              + New
            </button>
            <button
              class="tools__profile-btn tools__profile-btn--danger tools__profile-delete-btn"
              type="button"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
        <div class="tools__prompt-hint">
          Profiles save your tool selection, custom tools, and system prompt
          override. Associate a profile with a provider and model for quick
          switching.
        </div>
      </div>

      <!-- Tool Enable/Disable -->
      <div class="tools__section">
        <h3 class="tools__section-title">Available Tools</h3>
        <div class="tools__toolbar">
          <button
            class="tools__toolbar-btn tools__select-all-btn"
            type="button"
          >
            Select All
          </button>
          <button
            class="tools__toolbar-btn tools__select-none-btn"
            type="button"
          >
            Select None
          </button>
          <span class="tools__count"></span>
        </div>
        <div aria-live="polite" class="tools__list" role="list"></div>
      </div>

      <!-- Internet Access -->
      <div class="tools__section">
        <h3 class="tools__section-title">Internet Access</h3>
        <label class="tools__internet-optin" for="toolsInternetAccessOptIn">
          <input
            class="tools__internet-access-toggle"
            id="toolsInternetAccessOptIn"
            type="checkbox"
          />
          Allow full internet access for Bash and JavaScript tools
        </label>
        <div class="tools__prompt-hint">
          When enabled, both the <strong>bash</strong> and
          <strong>javascript</strong> tools can access the public internet. When
          disabled, external network access is restricted.
        </div>
      </div>

      <!-- Search Files -->
      <div class="tools__section">
        <h3 class="tools__section-title">🔍 Search Files</h3>
        <div class="tools__searchfiles-row">
          <label for="toolsSearchFilesMaxFileBytes"
            >Max file size (bytes):</label
          >
          <input
            class="tools__searchfiles-max-file-bytes-input"
            id="toolsSearchFilesMaxFileBytes"
            min="1"
            placeholder="524288"
            type="number"
          />
        </div>
        <div class="tools__searchfiles-row">
          <label for="toolsSearchFilesMaxFilesVisited"
            >Max files visited:</label
          >
          <input
            class="tools__searchfiles-max-files-visited-input"
            id="toolsSearchFilesMaxFilesVisited"
            min="1"
            placeholder="1000"
            type="number"
          />
        </div>
        <div class="tools__searchfiles-row">
          <label for="toolsSearchFilesSkipDirs"
            >Skip directories (comma-separated):</label
          >
          <input
            class="tools__searchfiles-skip-dirs-input"
            id="toolsSearchFilesSkipDirs"
            placeholder=".git,node_modules,dist,…"
            type="text"
          />
        </div>
        <div class="tools__searchfiles-actions">
          <button
            class="tools__save-btn tools__save-searchfiles-btn"
            type="button"
          >
            💾 Save Search Files Settings
          </button>
        </div>
        <div class="tools__prompt-hint">
          <strong>Max file size:</strong> Files larger than this (in bytes) are
          skipped to prevent out-of-memory crashes (default:
          <code>524288</code> = 512 KB).<br />
          <strong>Max files visited:</strong> Walk terminates after this many
          files are read, bounding CPU and memory use (default:
          <code>1000</code>).<br />
          <strong>Skip directories:</strong> Comma-separated directory names
          (not paths) that are never descended into, regardless of
          <code>path</code> or <code>file_glob</code> (default:
          <code>.git,node_modules,dist,…</code>).
        </div>
      </div>

      <!-- Web Search -->
      <div class="tools__section">
        <h3 class="tools__section-title">🔍 Web Search</h3>
        <label class="tools__websearch-optin" for="toolsWebSearchUseProxy">
          <input
            class="tools__websearch-proxy-toggle"
            id="toolsWebSearchUseProxy"
            type="checkbox"
          />
          Use local proxy for Web Search
        </label>
        <div class="tools__websearch-row">
          <label for="toolsWebSearchProxyUrl">Proxy URL:</label>
          <input
            class="tools__websearch-proxy-url-input"
            id="toolsWebSearchProxyUrl"
            placeholder="/proxy"
            type="text"
          />
        </div>
        <div class="tools__websearch-row">
          <label for="toolsWebSearchUrl">Web Search URL:</label>
          <input
            class="tools__websearch-url-input"
            id="toolsWebSearchUrl"
            placeholder="https://html.duckduckgo.com/html/?q={query}"
            type="text"
          />
        </div>
        <div class="tools__websearch-actions">
          <button
            class="tools__save-btn tools__save-websearch-btn"
            type="button"
          >
            💾 Save Web Search Settings
          </button>
        </div>
        <div class="tools__prompt-hint">
          <strong>Proxy URL:</strong> Endpoint for the local proxy service
          (default: <code>/proxy</code>).<br />
          <strong>Web Search URL:</strong> Target search engine URL template.
          Use <code>{query}</code> as placeholder for search terms (default:
          <code>https://html.duckduckgo.com/html/?q={query}</code>).
        </div>
      </div>

      <!-- WebMCP -->
      <div class="tools__section">
        <h3 class="tools__section-title">WebMCP</h3>
        <label class="tools__webmcp-optin" for="toolsWebMcpOptIn">
          <input
            class="tools__webmcp-toggle"
            id="toolsWebMcpOptIn"
            type="checkbox"
          />
          Enable WebMCP tool registration
        </label>
        <div class="tools__webmcp-mode-row">
          <label for="toolsWebMcpMode">Mode:</label>
          <select class="tools__webmcp-mode" id="toolsWebMcpMode">
            <option value="polyfill">Polyfill (recommended)</option>
            <option value="native">Native WebMCP flag (experimental)</option>
          </select>
        </div>
        <div class="tools__prompt-hint">
          <strong>Polyfill</strong> uses @mcp-b/webmcp-polyfill — works in all
          browsers, no flags needed.<br />
          <strong>Native</strong> uses WebMCP API — requires
          chrome://flags/#enable-webmcp-testing (may crash in early Canary
          builds).
        </div>
      </div>

      <!-- System Prompt Override -->
      <div class="tools__section">
        <h3 class="tools__section-title">System Prompt Override</h3>
        <textarea
          aria-label="System prompt override"
          class="tools__prompt-area"
          placeholder="Leave empty to use the default system prompt. Any text here is appended to the default prompt."
        ></textarea>
        <div class="tools__prompt-hint">
          This text is appended to the built-in system prompt for all providers.
          Leave empty to use defaults only.
        </div>
        <div class="tools__prompt-actions">
          <button class="tools__save-btn tools__save-prompt-btn" type="button">
            💾 Save Prompt
          </button>
          <button class="tools__clear-prompt-btn" type="button">Clear</button>
        </div>
      </div>
    </div>

    <shadow-claw-dialog
      dialog-aria-labelledby="toolsDialogTitle"
      dialog-class="tools__dialog"
    >
      <div class="tools__dialog-header">
        <h3 class="tools__dialog-title" id="toolsDialogTitle">
          Add Custom Tool
        </h3>
        <button
          aria-label="Close dialog"
          class="tools__dialog-close"
          type="button"
        >
          ✕
        </button>
      </div>
      <form class="tools__dialog-form">
        <div class="tools__dialog-body">
          <div class="tools__form-group">
            <label class="tools__form-label" for="toolNameInput">
              Tool Name
            </label>
            <input
              class="tools__form-input"
              id="toolNameInput"
              name="name"
              pattern="[a-z][a-z0-9_]*"
              placeholder="my_tool"
              required
              type="text"
            />
            <div class="tools__form-hint">
              Lowercase letters, digits, and underscores only.
            </div>
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="toolDescInput">
              Description
            </label>
            <textarea
              class="tools__form-textarea"
              id="toolDescInput"
              name="description"
              placeholder="Describe what this tool does..."
              required
            ></textarea>
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="toolSchemaInput">
              Input Schema (JSON)
            </label>
            <textarea
              class="tools__form-textarea"
              id="toolSchemaInput"
              name="input_schema"
              placeholder='{"type":"object","properties":{}}'
            ></textarea>
            <div class="tools__form-hint">
              JSON Schema for the tool's input parameters. Leave empty for no
              parameters.
            </div>
          </div>
        </div>
        <div class="tools__dialog-footer">
          <button class="tools__btn-cancel" type="button">Cancel</button>
          <button class="tools__btn-save" type="submit">Add Tool</button>
        </div>
      </form>
    </shadow-claw-dialog>

    <shadow-claw-dialog
      dialog-aria-labelledby="cloneDialogTitle"
      dialog-class="tools__clone-dialog"
    >
      <div class="tools__dialog-header">
        <h3 class="tools__dialog-title" id="cloneDialogTitle">Clone Tool</h3>
        <button
          aria-label="Close dialog"
          class="tools__dialog-close tools__clone-dialog-close"
          type="button"
        >
          ✕
        </button>
      </div>
      <form class="tools__clone-dialog-form">
        <div class="tools__dialog-body">
          <div class="tools__form-group">
            <label class="tools__form-label">Source Tool</label>
            <input
              class="tools__form-input"
              name="source"
              readonly
              type="text"
            />
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="cloneNameInput">
              New Tool Name
            </label>
            <input
              class="tools__form-input"
              id="cloneNameInput"
              name="name"
              pattern="[a-z][a-z0-9_]*"
              placeholder="my_tool_v2"
              required
              type="text"
            />
            <div class="tools__form-hint">
              Lowercase letters, digits, and underscores only.
            </div>
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="cloneDescInput">
              Description (optional)
            </label>
            <textarea
              class="tools__form-textarea"
              id="cloneDescInput"
              name="description"
              placeholder="Leave empty to copy the original description."
            ></textarea>
          </div>
        </div>
        <div class="tools__dialog-footer">
          <button
            class="tools__btn-cancel tools__clone-cancel-btn"
            type="button"
          >
            Cancel
          </button>
          <button class="tools__btn-save" type="submit">Clone Tool</button>
        </div>
      </form>
    </shadow-claw-dialog>

    <shadow-claw-dialog
      dialog-aria-labelledby="profileDialogTitle"
      dialog-class="tools__profile-dialog"
    >
      <div class="tools__dialog-header">
        <h3 class="tools__dialog-title" id="profileDialogTitle">
          Save Tool Profile
        </h3>
        <button
          aria-label="Close dialog"
          class="tools__dialog-close tools__profile-dialog-close"
          type="button"
        >
          ✕
        </button>
      </div>
      <form class="tools__profile-dialog-form">
        <div class="tools__dialog-body">
          <div class="tools__form-group">
            <label class="tools__form-label" for="profileNameInput">
              Profile Name
            </label>
            <input
              class="tools__form-input"
              id="profileNameInput"
              name="name"
              placeholder="Claude Haiku Tools"
              required
              type="text"
            />
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="profileProviderSelect">
              Provider (optional)
            </label>
            <select
              class="tools__form-input"
              id="profileProviderSelect"
              name="providerId"
            >
              <option value="">— Any provider —</option>
            </select>
            <div class="tools__form-hint">
              Associate this profile with a specific provider.
            </div>
          </div>
          <div class="tools__form-group">
            <label class="tools__form-label" for="profileModelInput">
              Model (optional)
            </label>
            <input
              class="tools__form-input"
              id="profileModelInput"
              name="model"
              placeholder="e.g. anthropic/claude-haiku-4.5"
              type="text"
            />
            <div class="tools__form-hint">
              Associate this profile with a specific model name.
            </div>
          </div>
        </div>
        <div class="tools__dialog-footer">
          <button
            class="tools__btn-cancel tools__profile-cancel-btn"
            type="button"
          >
            Cancel
          </button>
          <button class="tools__btn-save" type="submit">Save Profile</button>
        </div>
      </form>
    </shadow-claw-dialog>
  </section>
</template>
`,`text/html`),_=g.querySelector(`template`);let v=[];v=_?Array.from(_.content.children):Array.from(g.head.children).concat(Array.from(g.body.children));var y=v;const b=new Set(i.map(e=>e.name)),x=`shadow-claw-tools`;var S=class extends u{static styles=h;static template=y;orchestrator=null;constructor(){super()}async connectedCallback(){let e=await n();this.orchestrator=a.orchestrator,this.setupEffects(e),this.bindEventListeners(e)}disconnectedCallback(){super.disconnectedCallback()}bindEventListeners(n){let i=this.shadowRoot;if(!i)return;i.querySelector(`.tools__back-btn`)?.addEventListener(`click`,()=>{this.dispatchEvent(new CustomEvent(`navigate-back`,{bubbles:!0,composed:!0}))}),i.querySelector(`.tools__add-btn`)?.addEventListener(`click`,()=>{let e=i.querySelector(`dialog`);e&&(i.querySelector(`.tools__dialog-form`)?.reset(),e.showModal())}),i.querySelector(`.tools__backup-btn`)?.addEventListener(`click`,()=>{this.handleBackup()});let o=i.querySelector(`.tools__hidden-restore`);i.querySelector(`.tools__restore-btn`)?.addEventListener(`click`,()=>{o instanceof HTMLInputElement&&o.click()}),o?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.handleRestore(n,e.target)}),i.querySelector(`.tools__select-all-btn`)?.addEventListener(`click`,()=>{let e=r.allTools.map(e=>e.name);r.setAllEnabled(n,e),s(`All tools enabled`)}),i.querySelector(`.tools__select-none-btn`)?.addEventListener(`click`,()=>{r.setAllEnabled(n,[]),s(`All tools disabled`)});let u=i.querySelector(`.tools__webmcp-toggle`);u&&u.addEventListener(`change`,async()=>{let e=this.orchestrator??a.orchestrator;if(!e){u.checked=!1,l(`Orchestrator is not ready`);return}let t=u.checked;try{await p(e,n,t,{orchestrator:e}),s(t?`WebMCP tool registration enabled`:`WebMCP tool registration disabled`)}catch(e){u.checked=!t,l(`Failed to update WebMCP setting: ${e instanceof Error?e.message:String(e)}`)}});let d=i.querySelector(`.tools__internet-access-toggle`);d&&d.addEventListener(`change`,async()=>{let e=d.checked;try{await a.setVMBashFullInternetAccess(n,e),s(e?`Full internet access enabled for Bash and JavaScript tools`:`Full internet access disabled for Bash and JavaScript tools`)}catch(t){d.checked=!e,l(`Failed to update internet access setting: ${t instanceof Error?t.message:String(t)}`)}});let f=i.querySelector(`.tools__websearch-proxy-toggle`);f?.addEventListener(`change`,async()=>{try{await r.setWebSearchUseProxy(n,f.checked),s(f.checked?`Web Search local proxy enabled`:`Web Search local proxy disabled`)}catch(e){f.checked=!f.checked,l(`Failed to update Web Search proxy setting: ${e instanceof Error?e.message:String(e)}`)}}),i.querySelector(`.tools__save-searchfiles-btn`)?.addEventListener(`click`,async()=>{let e=i.querySelector(`.tools__searchfiles-max-file-bytes-input`),t=i.querySelector(`.tools__searchfiles-max-files-visited-input`),a=i.querySelector(`.tools__searchfiles-skip-dirs-input`),o=parseInt(e?.value||``,10),s=parseInt(t?.value||``,10),u=a?.value??``;try{!isNaN(o)&&o>0&&await r.setSearchFilesMaxFileBytes(n,o),!isNaN(s)&&s>0&&await r.setSearchFilesMaxFilesVisited(n,s),await r.setSearchFilesSkipDirs(n,u),c(`Search Files settings saved`)}catch(e){l(`Failed to save Search Files settings: ${e instanceof Error?e.message:String(e)}`)}}),i.querySelector(`.tools__save-websearch-btn`)?.addEventListener(`click`,async()=>{let e=i.querySelector(`.tools__websearch-proxy-url-input`),t=i.querySelector(`.tools__websearch-url-input`),a=e?.value.trim()||`/proxy`,o=t?.value.trim()||`https://html.duckduckgo.com/html/?q={query}`;try{await r.setWebSearchProxyUrl(n,a),await r.setWebSearchUrl(n,o),c(`Web Search settings saved`)}catch(e){l(`Failed to save Web Search settings: ${e instanceof Error?e.message:String(e)}`)}});let h=i.querySelector(`.tools__webmcp-mode`);h&&h.addEventListener(`change`,async()=>{let e=this.orchestrator??a.orchestrator;if(!e)return;let t=h.value;try{await m(e,n,t,{orchestrator:e}),s(`WebMCP mode set to ${t}`)}catch(e){l(`Failed to update WebMCP mode: ${e instanceof Error?e.message:String(e)}`)}}),i.querySelector(`.tools__save-prompt-btn`)?.addEventListener(`click`,()=>{let e=i.querySelector(`.tools__prompt-area`);e instanceof HTMLTextAreaElement&&(r.setSystemPromptOverride(n,e.value),c(`System prompt override saved`))}),i.querySelector(`.tools__clear-prompt-btn`)?.addEventListener(`click`,()=>{let e=i.querySelector(`.tools__prompt-area`);e instanceof HTMLTextAreaElement&&(e.value=``,r.setSystemPromptOverride(n,``),c(`System prompt override cleared`))});let g=i.querySelector(`.tools__dialog`),_=g?.querySelector(`.tools__dialog-close`),v=g?.querySelector(`.tools__btn-cancel`),y=i.querySelector(`.tools__dialog-form`);_?.addEventListener(`click`,()=>g?.close()),v?.addEventListener(`click`,()=>g?.close()),g?.addEventListener(`click`,e=>{e.target===g&&g.close()}),y?.addEventListener(`submit`,e=>{e.preventDefault(),y&&this.handleAddTool(n,y)});let b=i.querySelector(`.tools__clone-dialog`),x=i.querySelector(`.tools__clone-dialog-close`),S=i.querySelector(`.tools__clone-cancel-btn`),C=i.querySelector(`.tools__clone-dialog-form`);x?.addEventListener(`click`,()=>b?.close()),S?.addEventListener(`click`,()=>b?.close()),b?.addEventListener(`click`,e=>{e.target===b&&b.close()}),C?.addEventListener(`submit`,e=>{e.preventDefault(),C&&this.handleCloneTool(n,C)});let w=i.querySelector(`.tools__profile-dialog`),T=i.querySelector(`.tools__profile-dialog-close`),E=i.querySelector(`.tools__profile-cancel-btn`),D=i.querySelector(`.tools__profile-dialog-form`);T?.addEventListener(`click`,()=>w?.close()),E?.addEventListener(`click`,()=>w?.close()),w?.addEventListener(`click`,e=>{e.target===w&&w.close()}),D?.addEventListener(`submit`,e=>{e.preventDefault(),D&&this.handleSaveProfile(n,D)}),i.querySelector(`.tools__profile-select`)?.addEventListener(`change`,e=>{let t=e.target.value;t?(r.activateProfile(n,t),s(`Profile activated`)):(r.deactivateProfile(n),s(`Profile deactivated`))}),i.querySelector(`.tools__profile-new-btn`)?.addEventListener(`click`,()=>{if(w&&D){D.reset();let n=D.querySelector(`[name="providerId"]`);if(n){n.replaceChildren();let r=document.createElement(`option`);r.value=``,r.textContent=`— Any provider —`,n.append(r);for(let r of t()){let t=e(r);if(t){let e=document.createElement(`option`);e.value=r,e.textContent=t.name,n.appendChild(e)}}}w.showModal()}}),i.querySelector(`.tools__profile-save-btn`)?.addEventListener(`click`,async()=>{r.activeProfileId?(await r.saveToActiveProfile(n),c(`Profile saved`)):i.querySelector(`.tools__profile-new-btn`)?.dispatchEvent(new Event(`click`))}),i.querySelector(`.tools__profile-delete-btn`)?.addEventListener(`click`,async()=>{let e=r.activeProfileId;if(!e){s(`No profile selected`);return}if(e.startsWith(`__builtin_`)){s(`Built-in profiles cannot be deleted`);return}await r.deleteProfile(n,e),c(`Profile deleted`)})}handleBackup(){let e=r.exportBackup(),t=new Blob([e],{type:`application/json`}),n=URL.createObjectURL(t),i=document.createElement(`a`);i.href=n,i.download=`shadowclaw-tools-${Date.now()}.json`,i.click(),URL.revokeObjectURL(n),c(`Tools config exported`)}openCloneDialog(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.tools__clone-dialog`),r=t.querySelector(`.tools__clone-dialog-form`);if(!n||!r)return;r.reset();let i=r.querySelector(`[name="source"]`);i&&(i.value=e),n.showModal()}setupEffects(e){let t=this.shadowRoot;if(!t)return;this.addCleanup(d(()=>{r.enabledToolNames,r.customTools,r.systemPromptOverride,r.profiles,r.activeProfileId,this.updateToolList(e)}));let n=t.querySelector(`.tools__webmcp-toggle`),i=t.querySelector(`.tools__internet-access-toggle`),o=t.querySelector(`.tools__webmcp-mode`);n&&this.addCleanup(d(()=>{a.ready&&(this.orchestrator=a.orchestrator,n.checked=this.orchestrator?.webMcpToolsEnabled===!0,o&&this.orchestrator&&(o.value=f()||`polyfill`))})),i&&this.addCleanup(d(()=>{i.checked=a.vmBashFullInternetAccess}));let s=t.querySelector(`.tools__websearch-proxy-toggle`),c=t.querySelector(`.tools__websearch-proxy-url-input`),l=t.querySelector(`.tools__websearch-url-input`);s&&this.addCleanup(d(()=>{s.checked=r.webSearchUseProxy})),c&&this.addCleanup(d(()=>{document.activeElement!==c&&!c.matches(`:focus`)&&(c.value=r.webSearchProxyUrl)})),l&&this.addCleanup(d(()=>{document.activeElement!==l&&!l.matches(`:focus`)&&(l.value=r.webSearchUrl)}));let u=t.querySelector(`.tools__searchfiles-max-file-bytes-input`),p=t.querySelector(`.tools__searchfiles-max-files-visited-input`),m=t.querySelector(`.tools__searchfiles-skip-dirs-input`);u&&this.addCleanup(d(()=>{document.activeElement!==u&&!u.matches(`:focus`)&&(u.value=String(r.searchFilesMaxFileBytes))})),p&&this.addCleanup(d(()=>{document.activeElement!==p&&!p.matches(`:focus`)&&(p.value=String(r.searchFilesMaxFilesVisited))})),m&&this.addCleanup(d(()=>{document.activeElement!==m&&!m.matches(`:focus`)&&(m.value=r.searchFilesSkipDirs)}))}updateProfileSelector(){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.tools__profile-select`);if(!n)return;let i=r.profiles,a=r.activeProfileId;n.replaceChildren();let o=document.createElement(`option`);o.value=``,o.textContent=`— No profile (manual config) —`,n.append(o);for(let t of i){let r=document.createElement(`option`);r.value=t.id;let i=t.id.startsWith(`__builtin_`),o=t.providerId?e(t.providerId)?.name||t.providerId:`any`,s=t.model||`any`;r.textContent=i?`⚡ ${t.name} (${o})`:`${t.name} (${o} / ${s})`,t.id===a&&(r.selected=!0),n.appendChild(r)}let s=t.querySelector(`.tools__profile-delete-btn`);if(s){let e=a?.startsWith(`__builtin_`);s.disabled=!!e,s.title=e?`Built-in profiles cannot be deleted`:``}}updateToolList(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.tools__list`);if(!n)return;let i=r.enabledToolNames,a=r.allTools;n.replaceChildren();for(let t of a){let a=!b.has(t.name),o=i.has(t.name),c=t.description.split(`. `)[0],l=document.createElement(`div`);l.className=`tools__item`,l.setAttribute(`role`,`listitem`);let u=document.createElement(`input`);u.type=`checkbox`,u.className=`tools__item-checkbox`,u.setAttribute(`data-tool`,t.name),u.setAttribute(`aria-label`,`Enable ${t.name}`),u.checked=o;let d=document.createElement(`div`);d.className=`tools__item-info`;let f=document.createElement(`div`);f.className=`tools__item-name`,f.textContent=t.name;let p=document.createElement(`div`);p.className=`tools__item-desc`,p.setAttribute(`title`,t.description),p.textContent=c,d.append(f,p);let m=document.createElement(`button`);if(m.className=`tools__item-clone`,m.setAttribute(`data-clone`,t.name),m.setAttribute(`aria-label`,`Clone ${t.name}`),m.setAttribute(`title`,`Clone tool`),m.textContent=`📋`,l.append(u,d),a){let e=document.createElement(`span`);e.className=`tools__item-badge`,e.textContent=`custom`,l.append(e)}l.append(m);let h=null;a&&(h=document.createElement(`button`),h.className=`tools__item-delete`,h.setAttribute(`data-delete`,t.name),h.setAttribute(`aria-label`,`Delete ${t.name}`),h.textContent=`🗑️`,l.append(h)),u?.addEventListener(`change`,()=>{r.setToolEnabled(e,t.name,u.checked)}),m?.addEventListener(`click`,()=>{this.openCloneDialog(t.name)}),h?.addEventListener(`click`,()=>{r.removeCustomTool(e,t.name),s(`Removed custom tool: ${t.name}`)}),n.appendChild(l)}let o=t.querySelector(`.tools__count`);o&&(o.textContent=`${i.size} of ${a.length} enabled`);let c=t.querySelector(`.tools__prompt-area`);c instanceof HTMLTextAreaElement&&document.activeElement!==c&&!c.matches(`:focus`)&&(c.value=r.systemPromptOverride),this.updateProfileSelector()}async handleAddTool(e,t){let n=new FormData(t),i=String(n.get(`name`)||``).trim(),a=String(n.get(`description`)||``).trim(),o=String(n.get(`input_schema`)||``).trim();if(!i||!a){l(`Name and description are required`);return}if(r.allTools.some(e=>e.name===i)){l(`A tool named "${i}" already exists`);return}let s={type:`object`,properties:{}};if(o)try{s=JSON.parse(o)}catch{l(`Invalid JSON in input schema`);return}await r.addCustomTool(e,{name:i,description:a,input_schema:s}),c(`Added custom tool: ${i}`),(this.shadowRoot?.querySelector(`.tools__dialog`))?.close()}async handleCloneTool(e,t){let n=new FormData(t),i=String(n.get(`source`)||``).trim(),a=String(n.get(`name`)||``).trim(),o=String(n.get(`description`)||``).trim();if(!i||!a){l(`Source and new tool name are required`);return}if(!await r.cloneTool(e,i,a,o||void 0)){l(`Clone failed: source not found or name "${a}" already exists.`);return}c(`Cloned "${i}" → "${a}"`),(this.shadowRoot?.querySelector(`.tools__clone-dialog`))?.close()}async handleRestore(e,t){let n=t.files?.[0];if(n){try{let t=await n.text();await r.importBackup(e,t),c(`Tools config restored`)}catch(e){l(`Failed to restore: ${e instanceof Error?e.message:String(e)}`)}t.value=``}}async handleSaveProfile(e,t){let n=new FormData(t),i=String(n.get(`name`)||``).trim(),a=String(n.get(`providerId`)||``).trim(),s=String(n.get(`model`)||``).trim();if(!i){l(`Profile name is required`);return}let u={id:o(),name:i,providerId:a||void 0,model:s||void 0,enabledToolNames:[...r.enabledToolNames],customTools:[...r.customTools],systemPromptOverride:r.systemPromptOverride};await r.addProfile(e,u),await r.activateProfile(e,u.id),c(`Profile "${i}" created and activated`),(this.shadowRoot?.querySelector(`.tools__profile-dialog`))?.close()}};customElements.get(x)||customElements.define(x,S);export{S as ShadowClawTools};