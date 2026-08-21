import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{g as n}from"./custom-element-security-MwgLnC6q.js";import{q as r,rn as i,t as a}from"./orchestrator-DrMg2dnI.js";import{n as o,r as s}from"./crypto-C8c5wMzN.js";import{n as c,r as l,t as u}from"./toast-D3gxhZpN.js";import{t as d}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-page-header-DyG_qg9T.js";import{t as f}from"./config-value-oBfKgLT4.js";import"./shadow-claw-dialog-n4xdcUp-.js";function p(e){try{return JSON.parse(JSON.stringify(e))}catch{return null}}async function m(t,n){let r=[],i=[];for(let a of t){let t=a.key;if(t===e.STORAGE_HANDLE)continue;if(t===e.GIT_PASSWORD||t===e.API_KEY||t.startsWith(`api_key:`)||t===e.IMESSAGE_API_KEY||t===e.TELEGRAM_BOT_TOKEN){if(n&&typeof a.value==`string`){let e=await o(a.value);e&&i.push({key:t,path:[],value:e})}continue}let s=p(a.value);if(t===e.GIT_ACCOUNTS&&Array.isArray(s))for(let e=0;e<s.length;e+=1){let r=s[e];if(!r||typeof r!=`object`)continue;let a=r.password;if(typeof a==`string`&&a){if(n){let n=await o(a);n&&i.push({key:t,path:[e,`password`],value:n})}delete r.password}}if(t===e.INTEGRATION_CONNECTIONS&&Array.isArray(s))for(let e=0;e<s.length;e+=1){let r=s[e]?.credentialRef,a=r?.encryptedSecret;if(typeof a==`string`&&a){if(n){let n=await o(a);n&&i.push({key:t,path:[e,`credentialRef`,`encryptedSecret`],value:n})}delete r.encryptedSecret}}if(t===e.REMOTE_MCP_CONNECTIONS&&Array.isArray(s))for(let e=0;e<s.length;e+=1){let r=s[e]?.credentialRef,a=r?.encryptedValue;if(typeof a==`string`&&a){if(n){let n=await o(a);n&&i.push({key:t,path:[e,`credentialRef`,`encryptedValue`],value:n})}delete r.encryptedValue}}r.push({key:t,value:s})}return{configEntries:r,plaintextPasswords:i}}function h(e,t,n){if(t.length===0)return n;let r=e;for(let n=0;n<t.length-1;n+=1){let i=t[n];if(typeof i==`number`){if(!Array.isArray(r)||!r[i])return e;r=r[i]}else{if(!r||typeof r!=`object`)return e;let t=r[i];if(!t||typeof t!=`object`)return e;r=t}}let i=t[t.length-1];if(typeof i==`number`){if(!Array.isArray(r))return e;r[i]=n}else{if(!r||typeof r!=`object`)return e;r[i]=n}return e}async function g(e,t){let n=await m(e,t);return{kind:`shadowclaw-settings-backup`,version:1,exportedAt:Date.now(),includePlaintextPasswords:t,configEntries:n.configEntries,plaintextPasswords:t?n.plaintextPasswords:void 0}}async function _(e,t){let n=await g(e,t);return new Blob([JSON.stringify(n,null,2)],{type:`application/json`})}async function v(e,t,n){let r=await g(t,n);await i(e,JSON.stringify(r,null,2))}async function y(e,t){if(!t.length)return e;let n=e.map(e=>({key:e.key,value:p(e.value)}));for(let e of t){let t=await s(e.value);if(!t)continue;let r=n.find(t=>t.key===e.key);r?r.value=h(r.value,e.path,t):e.path.length===0&&n.push({key:e.key,value:t})}return n}function b(e){let t=JSON.parse(e);if(t?.kind!==`shadowclaw-settings-backup`||t.version!==1||!Array.isArray(t.configEntries))throw Error(`Invalid settings backup file`);let n=Array.isArray(t.plaintextPasswords)?t.plaintextPasswords.filter(e=>e&&typeof e.key==`string`&&Array.isArray(e.path)&&typeof e.value==`string`):[];return{kind:`shadowclaw-settings-backup`,version:1,exportedAt:typeof t.exportedAt==`number`?t.exportedAt:Date.now(),includePlaintextPasswords:!!t.includePlaintextPasswords,configEntries:t.configEntries.filter(e=>e&&typeof e.key==`string`).map(e=>({key:e.key,value:e.value})),plaintextPasswords:n}}const x=new CSSStyleSheet;x.replaceSync(`*,
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

:host {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.settings__confirm-dialog {
  background: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.85rem;
  color: var(--shadow-claw-text-primary);
  max-width: min(32rem, calc(100vw - 2rem));
  padding: 0;
  width: 100%;
}

.settings__confirm-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.settings__confirm-title {
  font-size: var(--shadow-claw-font-size-md);
  margin: 0;
}

.settings__confirm-message {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
  margin: 0;
}

.settings__confirm-note {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.8rem;
  margin: 0;
}

.settings__confirm-checkbox-row {
  align-items: center;
  display: flex;
  font-size: 0.85rem;
  gap: 0.5rem;
}

.settings__confirm-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.settings__confirm-actions button {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 62.5rem;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  min-height: 2rem;
  padding: 0.45rem 0.9rem;
}

.settings__confirm-actions button:hover {
  border-color: var(--shadow-claw-accent-primary);
}

.settings__danger-btn {
  background: color-mix(
    in srgb,
    var(--shadow-claw-danger, #ef4444) 16%,
    transparent
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-danger, #ef4444) 55%,
    var(--shadow-claw-border-color)
  );
  color: var(--shadow-claw-danger, #ef4444);
}

.settings__danger-btn:hover {
  border-color: var(--shadow-claw-danger, #ef4444);
}

.settings-page {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.settings-tab-nav {
  background: var(--shadow-claw-bg-primary);
  display: flex;
  gap: 0.5rem;
  margin: -0.25rem 0 1rem;
  overflow-x: auto;
  padding: 0.25rem 0 0.75rem;
  position: sticky;
  top: 0;
  z-index: 1;
}

.settings-tab-btn {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 999px;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  flex: 0 0 auto;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  transition:
    background-color 150ms cubic-bezier(0.33, 1, 0.68, 1),
    border-color 150ms cubic-bezier(0.33, 1, 0.68, 1),
    color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.settings-tab-btn:hover {
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-text-primary);
}

.settings-tab-btn.active {
  background: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
}

.settings-tab-btn:focus-visible {
  outline: 0.125rem solid
    color-mix(in srgb, var(--shadow-claw-accent-primary) 55%, transparent);
  outline-offset: 0.125rem;
}

.settings-tab-panels {
  min-height: 0;
}

.settings-tab-panel[hidden] {
  display: none;
}

.settings-collapsible {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.75rem;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.settings-collapsible > summary {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: flex;
  font-size: 0.92rem;
  font-weight: 600;
  gap: 0.45rem;
  list-style: none;
  padding: 0.7rem 0.85rem;
  user-select: none;
}

.settings-collapsible > summary::-webkit-details-marker {
  display: none;
}

.settings-collapsible > summary::before {
  color: var(--shadow-claw-text-tertiary);
  content: "▸";
  font-size: 0.78rem;
  transform: translateY(0.02rem);
  transition: transform 120ms cubic-bezier(0.33, 1, 0.68, 1);
}

.settings-collapsible[open] > summary::before {
  transform: rotate(90deg) translateX(0.02rem);
}

.settings-collapsible[open] > summary {
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
}

.settings-collapsible-content {
  padding: 0.75rem 0.85rem;
}

.settings-collapsible-content .settings-section:last-child {
  margin-bottom: 0;
}

.settings-section {
  margin-bottom: 1.75rem;
}

.settings-section h3 {
  align-items: center;
  display: flex;
  font-size: 1rem;
  font-weight: 600;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
}

.form-input,
.form-select,
.form-textarea {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  padding: 0.625rem 0.75rem;
  transition: border-color 0.15s;
  width: 100%;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.06);
  outline: none;
}

.form-textarea {
  resize: vertical;
}

.form-toggle {
  align-items: center;
  display: flex;
  gap: 0.75rem;
}

.form-toggle input[type="checkbox"] {
  accent-color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  height: 1.125rem;
  width: 1.125rem;
}

.form-toggle .form-label {
  cursor: pointer;
  display: inline;
  margin-bottom: 0;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin-bottom: 0.5rem;
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.settings-version-text {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  margin-top: 1rem;
  opacity: 0.7;
}

@media (min-width: 48rem) {
  .settings-tab-nav {
    margin-bottom: 1.25rem;
    overflow-x: visible;
    position: static;
  }

  .settings-tab-btn {
    font-size: var(--shadow-claw-font-size-md);
    padding: 0.5rem 1rem;
  }
}
`);const S=new DOMParser().parseFromString(`<template>
  <shadow-claw-page-header icon="⚙️" title="Settings">
    <shadow-claw-page-header-action-button
      slot="actions"
      data-action="backup-settings"
      title="Backup settings"
    >
      💾 Backup
    </shadow-claw-page-header-action-button>
    <shadow-claw-page-header-action-button
      slot="actions"
      data-action="restore-settings"
      title="Restore settings"
    >
      ♻️ Restore
    </shadow-claw-page-header-action-button>
    <shadow-claw-page-header-action-button
      slot="actions"
      data-action="clear-settings"
      title="Clear all settings"
      variant="danger"
    >
      🗑️ Clear
    </shadow-claw-page-header-action-button>
  </shadow-claw-page-header>

  <input
    class="settings__restore-input"
    type="file"
    accept=".json,application/json"
    aria-label="Restore settings from JSON backup"
    hidden
  />

  <shadow-claw-dialog
    dialog-class="settings__confirm-dialog settings__backup-dialog"
    dialog-aria-label="Backup settings"
  >
    <form class="settings__confirm-form" method="dialog">
      <h3 class="settings__confirm-title">Backup Settings</h3>
      <p class="settings__confirm-message">
        Create a backup of all saved settings, accounts, integrations, and
        profiles.
      </p>
      <label class="settings__confirm-checkbox-row">
        <input type="checkbox" data-setting="include-plaintext-passwords" />
        <span>Include passwords in plaintext</span>
      </label>
      <p class="settings__confirm-note">
        Default is off. When disabled, password fields are excluded from the
        backup.
      </p>
      <div class="settings__confirm-actions">
        <button type="button" data-action="cancel-backup-settings">
          Cancel
        </button>
        <button type="button" data-action="confirm-backup-settings">
          Backup
        </button>
      </div>
    </form>
  </shadow-claw-dialog>

  <shadow-claw-dialog
    dialog-class="settings__confirm-dialog settings__restore-dialog"
    dialog-aria-label="Restore settings"
  >
    <form class="settings__confirm-form" method="dialog">
      <h3 class="settings__confirm-title">Restore Settings</h3>
      <p class="settings__confirm-message">
        Restoring will replace all current settings, accounts, integrations, and
        profiles.
      </p>
      <p class="settings__confirm-note" data-info="restore-filename">
        No file selected.
      </p>
      <div class="settings__confirm-actions">
        <button type="button" data-action="cancel-restore-settings">
          Cancel
        </button>
        <button type="button" data-action="confirm-restore-settings">
          Restore
        </button>
      </div>
    </form>
  </shadow-claw-dialog>

  <shadow-claw-dialog
    dialog-class="settings__confirm-dialog settings__clear-dialog"
    dialog-aria-label="Clear settings"
  >
    <form class="settings__confirm-form" method="dialog">
      <h3 class="settings__confirm-title">Clear Settings</h3>
      <p class="settings__confirm-message">
        This will permanently remove all settings, accounts, integrations, and
        profiles.
      </p>
      <div class="settings__confirm-actions">
        <button type="button" data-action="cancel-clear-settings">
          Cancel
        </button>
        <button
          type="button"
          data-action="confirm-clear-settings"
          class="settings__danger-btn"
        >
          Clear
        </button>
      </div>
    </form>
  </shadow-claw-dialog>

  <div class="settings-page">
    <div
      class="settings-tab-nav"
      role="tablist"
      aria-label="Settings groups"
      aria-orientation="horizontal"
    >
      <button
        class="settings-tab-btn"
        role="tab"
        id="settings-tab-ai"
        data-tab-target="ai"
        aria-controls="settings-panel-ai"
      >
        AI
      </button>
      <button
        class="settings-tab-btn"
        role="tab"
        id="settings-tab-environment"
        data-tab-target="environment"
        aria-controls="settings-panel-environment"
      >
        Environment
      </button>
      <button
        class="settings-tab-btn"
        role="tab"
        id="settings-tab-integrations"
        data-tab-target="integrations"
        aria-controls="settings-panel-integrations"
      >
        Integrations
      </button>
    </div>

    <div class="settings-tab-panels">
      <section
        class="settings-tab-panel"
        role="tabpanel"
        id="settings-panel-ai"
        data-tab-panel="ai"
        aria-labelledby="settings-tab-ai"
      >
        <details class="settings-collapsible">
          <summary>🤖 AI</summary>
          <div class="settings-collapsible-content">
            <div class="settings-section">
              <h3>👤 Assistant</h3>
              <div class="form-group">
                <label class="form-label">Name</label>
                <input
                  class="form-input"
                  data-setting="assistant-name-input"
                  placeholder="ShadowClaw"
                  type="text"
                  value="ShadowClaw"
                />
                <div class="form-helper">
                  Used to mention the assistant in chat (@name)
                </div>
              </div>
              <button class="save-btn" data-action="save-assistant-name">
                💾 Save Name
              </button>
            </div>

            <div class="settings-section">
              <h3>📝 Activity Log</h3>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="activity-log-disk-logging-toggle"
                    id="activity-log-disk-logging-toggle"
                    type="checkbox"
                  />
                  <label
                    class="form-label"
                    for="activity-log-disk-logging-toggle"
                  >
                    Log activity details to disk
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, activity log entries are automatically written
                  to a plain text file under .cache/logs in the app data
                  directory. Default: disabled.
                </div>
              </div>
            </div>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🔑 Model Provider</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-llm></shadow-claw-llm>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🛠️ Tools</summary>
          <div class="settings-collapsible-content">
            <div class="settings-section">
              <div class="form-group">
                <div class="form-helper">
                  Configure which tools are available to the AI, edit the system
                  prompt, and manage custom tools.
                </div>
              </div>
              <button class="save-btn" data-action="show-tools-config">
                🛠️ Configure Tools
              </button>
            </div>
          </div>
        </details>
      </section>

      <section
        class="settings-tab-panel"
        role="tabpanel"
        id="settings-panel-environment"
        data-tab-panel="environment"
        aria-labelledby="settings-tab-environment"
        hidden
      >
        <details class="settings-collapsible">
          <summary>🌐 Networking</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-networking></shadow-claw-networking>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🖥️ WebVM</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-webvm></shadow-claw-webvm>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🗃️ Misc</summary>
          <div class="settings-collapsible-content">
            <div class="settings-section">
              <h3>🧭 Navigation</h3>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="sidebar-hide-pages-toggle"
                    id="sidebar-hide-pages-toggle"
                    type="checkbox"
                  />
                  <label class="form-label" for="sidebar-hide-pages-toggle">
                    Hide Pages in sidebar
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, the Pages item is hidden from the sidebar.
                </div>
              </div>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="sidebar-hide-chat-toggle"
                    id="sidebar-hide-chat-toggle"
                    type="checkbox"
                  />
                  <label class="form-label" for="sidebar-hide-chat-toggle">
                    Hide Chat in sidebar
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, the Chat item is hidden from the sidebar.
                </div>
              </div>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="sidebar-hide-tasks-toggle"
                    id="sidebar-hide-tasks-toggle"
                    type="checkbox"
                  />
                  <label class="form-label" for="sidebar-hide-tasks-toggle">
                    Hide Tasks in sidebar
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, the Tasks item is hidden from the sidebar.
                </div>
              </div>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="sidebar-hide-files-toggle"
                    id="sidebar-hide-files-toggle"
                    type="checkbox"
                  />
                  <label class="form-label" for="sidebar-hide-files-toggle">
                    Hide Files in sidebar
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, the Files item is hidden from the sidebar.
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pages-auto-refresh-input">
                  Pages Automatic Refresh (seconds, 0-86400)
                </label>
                <input
                  class="form-input"
                  data-setting="pages-auto-refresh-input"
                  id="pages-auto-refresh-input"
                  type="number"
                  min="0"
                  max="86400"
                  step="1"
                  placeholder="0"
                />
                <div class="form-helper">
                  Interval in seconds (0 to 86400, e.g. 5 = 5s, 60 = 1 min, 3600
                  = 1 hr) to automatically refresh the content of the pinned
                  page (billboard style). Set to 0 to disable automatic refresh.
                </div>
              </div>
              <div class="form-group">
                <div class="form-toggle">
                  <input
                    data-setting="override-prerender-skeleton-toggle"
                    id="override-prerender-skeleton-toggle"
                    type="checkbox"
                  />
                  <label
                    class="form-label"
                    for="override-prerender-skeleton-toggle"
                  >
                    Override pre-rendered content with workspace skeleton loader
                  </label>
                </div>
                <div class="form-helper">
                  When enabled, pre-rendered static content is hidden on startup
                  and replaced with the workspace skeleton loader until app
                  initialization completes.
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>🖼️ DOM</h3>
              <div class="settings-section">
                <h4>📝 Markdown Frontmatter</h4>
                <div class="form-group">
                  <div class="form-toggle">
                    <input
                      data-setting="markdown-frontmatter-pages-toggle"
                      id="markdown-frontmatter-pages-toggle"
                      type="checkbox"
                    />
                    <label
                      class="form-label"
                      for="markdown-frontmatter-pages-toggle"
                    >
                      Render frontmatter in Pages previews
                    </label>
                  </div>
                </div>
                <div class="form-group">
                  <div class="form-toggle">
                    <input
                      data-setting="markdown-frontmatter-file-viewer-toggle"
                      id="markdown-frontmatter-file-viewer-toggle"
                      type="checkbox"
                    />
                    <label
                      class="form-label"
                      for="markdown-frontmatter-file-viewer-toggle"
                    >
                      Render frontmatter in File Viewer previews
                    </label>
                  </div>
                </div>
                <div class="form-group">
                  <div class="form-toggle">
                    <input
                      data-setting="markdown-frontmatter-chat-toggle"
                      id="markdown-frontmatter-chat-toggle"
                      type="checkbox"
                    />
                    <label
                      class="form-label"
                      for="markdown-frontmatter-chat-toggle"
                    >
                      Render frontmatter in Chat messages
                    </label>
                  </div>
                </div>
                <div class="form-group">
                  <div class="form-toggle">
                    <input
                      data-setting="markdown-frontmatter-tasks-toggle"
                      id="markdown-frontmatter-tasks-toggle"
                      type="checkbox"
                    />
                    <label
                      class="form-label"
                      for="markdown-frontmatter-tasks-toggle"
                    >
                      Render frontmatter in Tasks previews
                    </label>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="dom-allowed-iframe-hosts">
                  Allowed Iframe Embed Hosts
                </label>
                <textarea
                  class="form-textarea"
                  id="dom-allowed-iframe-hosts"
                  data-setting="dom-allowed-iframe-hosts"
                  rows="5"
                  placeholder="youtube.com&#10;youtube-nocookie.com&#10;youtu.be&#10;xt-ml.github.io&#10;kherrick.github.io"
                ></textarea>
                <div class="form-helper">
                  Specify hostnames or regex patterns (one per line) allowed for
                  iframe embeds. Default: YouTube and github.io pages.
                </div>
              </div>
              <button
                class="save-btn"
                data-action="save-dom-allowed-iframe-hosts"
              >
                💾 Save DOM Settings
              </button>
            </div>

            <shadow-claw-storage></shadow-claw-storage>
          </div>
        </details>
      </section>

      <section
        class="settings-tab-panel"
        role="tabpanel"
        id="settings-panel-integrations"
        data-tab-panel="integrations"
        aria-labelledby="settings-tab-integrations"
        hidden
      >
        <details class="settings-collapsible">
          <summary>🔐 Git Credentials</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-git></shadow-claw-git>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>👤 Accounts</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-accounts></shadow-claw-accounts>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🔌 Remote MCP Connections</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-mcp-remote></shadow-claw-mcp-remote>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>📧 Email</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-integrations></shadow-claw-integrations>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>📅 Server Task Scheduling</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-task-server></shadow-claw-task-server>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>🔔 Notifications</summary>
          <div class="settings-collapsible-content">
            <shadow-claw-notifications></shadow-claw-notifications>
          </div>
        </details>

        <details class="settings-collapsible">
          <summary>💬 Messaging Channels</summary>
          <div class="settings-collapsible-content">
            <div class="settings-section">
              <div class="form-group">
                <div class="form-helper">
                  Configure Telegram and iMessage bridge integrations in a
                  dedicated channel configuration interface.
                </div>
              </div>
              <button class="save-btn" data-action="show-channels-config">
                💬 Configure Channels
              </button>
            </div>
          </div>
        </details>
      </section>
    </div>

    <div class="settings-version-text" data-info="deployed-revision">
      Deployed revision: unknown
    </div>
  </div>
</template>
`,`text/html`),C=S.querySelector(`template`);let w=[];w=C?Array.from(C.content.children):Array.from(S.head.children).concat(Array.from(S.body.children));var T=w;const E={ai:[()=>import(`./shadow-claw-llm-DVJ5j9A3.js`)],environment:[()=>import(`./shadow-claw-networking-D9AxvmWj.js`),()=>import(`./shadow-claw-webvm-Cnx7x8cf.js`),()=>import(`./shadow-claw-storage-TKHgNxcW.js`)],integrations:[()=>import(`./shadow-claw-git-8MH4GcvV.js`),()=>import(`./shadow-claw-accounts-fGykKjs-.js`),()=>import(`./shadow-claw-mcp-remote-BcysjBnn.js`),()=>import(`./shadow-claw-integrations-gnY6vBq5.js`),()=>import(`./shadow-claw-task-server-CN-LpriW.js`),()=>import(`./shadow-claw-notifications-Bthy4vfp.js`)]},D=new Set;async function O(e){if(D.has(e))return;let t=E[e];t&&(D.add(e),await Promise.all(t.map(e=>e())))}const k=`shadow-claw-settings`;var A=class extends d{static styles=x;static template=T;activeTab=`ai`;db=null;orchestrator=null;pendingRestoreFile=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await t(),this.orchestrator=a.orchestrator,await this.render()}activateTab(e){!e||this.activeTab===e||(this.activeTab=e,this.applyTabState())}applyTabState(){O(this.activeTab).catch(console.error);let e=this.shadowRoot;e&&(e.querySelectorAll(`[data-tab-target]`).forEach(e=>{let t=e.dataset.tabTarget===this.activeTab;e.classList.toggle(`active`,t),e.setAttribute(`aria-selected`,String(t)),e.tabIndex=t?0:-1}),e.querySelectorAll(`[data-tab-panel]`).forEach(e=>{e.hidden=e.dataset.tabPanel!==this.activeTab}))}bindSettingsActions(){let e=this.shadowRoot;if(!e)return;e.querySelector(`[data-action="backup-settings"]`)?.addEventListener(`click`,()=>this.openBackupDialog());let t=e.querySelector(`.settings__restore-input`);e.querySelector(`[data-action="restore-settings"]`)?.addEventListener(`click`,()=>{t instanceof HTMLInputElement&&(t.value=``,t.click())}),t?.addEventListener(`change`,e=>{let t=e.target;if(!(t instanceof HTMLInputElement))return;let n=t.files?.[0]||null;n&&(this.pendingRestoreFile=n,this.openRestoreDialog(n.name))}),e.querySelector(`[data-action="clear-settings"]`)?.addEventListener(`click`,()=>this.openClearDialog()),e.querySelector(`[data-action="cancel-backup-settings"]`)?.addEventListener(`click`,()=>this.closeDialog(`.settings__backup-dialog`)),e.querySelector(`[data-action="confirm-backup-settings"]`)?.addEventListener(`click`,()=>{this.confirmBackup()}),e.querySelector(`[data-action="cancel-restore-settings"]`)?.addEventListener(`click`,()=>{this.pendingRestoreFile=null,this.closeDialog(`.settings__restore-dialog`)}),e.querySelector(`[data-action="confirm-restore-settings"]`)?.addEventListener(`click`,()=>{this.confirmRestore()}),e.querySelector(`[data-action="cancel-clear-settings"]`)?.addEventListener(`click`,()=>this.closeDialog(`.settings__clear-dialog`)),e.querySelector(`[data-action="confirm-clear-settings"]`)?.addEventListener(`click`,()=>{this.confirmClear()}),e.querySelector(`[data-action="save-assistant-name"]`)?.addEventListener(`click`,()=>this.saveAssistantName()),e.querySelector(`[data-setting="activity-log-disk-logging-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onActivityLogDiskLoggingToggle(t.checked)}),e.querySelector(`[data-setting="sidebar-hide-pages-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onSidebarHidePagesToggle(t.checked)}),e.querySelector(`[data-setting="sidebar-hide-chat-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onSidebarHideChatToggle(t.checked)}),e.querySelector(`[data-setting="sidebar-hide-tasks-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onSidebarHideTasksToggle(t.checked)}),e.querySelector(`[data-setting="sidebar-hide-files-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onSidebarHideFilesToggle(t.checked)}),e.querySelector(`[data-setting="pages-auto-refresh-input"]`)?.addEventListener(`change`,e=>{let t=e.target;if(t){let e=parseInt(t.value,10);this.onPagesAutoRefreshInputChange(isNaN(e)?0:e)}}),e.querySelector(`[data-setting="override-prerender-skeleton-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;t&&this.onOverridePrerenderSkeletonToggle(t.checked)}),e.querySelector(`[data-action="save-dom-allowed-iframe-hosts"]`)?.addEventListener(`click`,()=>{this.saveDomAllowedIframeHosts()})}closeDialog(e){this.getDialog(e)?.close()}getDialog(e){let t=this.shadowRoot;if(!t)return null;let n=t.querySelector(e);return n instanceof HTMLDialogElement?n:null}handleTabKeydown(e,t){let n=this.shadowRoot;if(!n)return;let r=Array.from(n.querySelectorAll(`[data-tab-target]`)),i=r.indexOf(t);if(i<0)return;let a=-1;switch(e.key){case`ArrowRight`:case`ArrowDown`:a=(i+1)%r.length;break;case`ArrowLeft`:case`ArrowUp`:a=(i-1+r.length)%r.length;break;case`Home`:a=0;break;case`End`:a=r.length-1;break;default:return}e.preventDefault();let o=r[a];o.focus(),this.activateTab(o.dataset.tabTarget)}openBackupDialog(){let e=this.shadowRoot?.querySelector(`[data-setting="include-plaintext-passwords"]`);e instanceof HTMLInputElement&&(e.checked=!1),this.showDialog(`.settings__backup-dialog`)}openClearDialog(){this.showDialog(`.settings__clear-dialog`)}openRestoreDialog(e){let t=this.shadowRoot?.querySelector(`[data-info="restore-filename"]`);t instanceof HTMLElement&&(t.textContent=`Selected file: ${e}`),this.showDialog(`.settings__restore-dialog`)}showDialog(e){let t=this.getDialog(e);if(t){if(typeof t.showModal==`function`){t.showModal();return}t.setAttribute(`open`,``)}}async confirmBackup(){if(!this.db){u(`Settings database is unavailable`,5e3);return}let e=this.shadowRoot?.querySelector(`[data-setting="include-plaintext-passwords"]`),t=e instanceof HTMLInputElement&&e.checked;try{if(t){let e=await this.promptForPlaintextBackupHandle();if(!e)return;await v(e,await this.getAllConfigEntries(),t),this.closeDialog(`.settings__backup-dialog`),l(`Settings backup saved`,3e3);return}let e=await _(await this.getAllConfigEntries(),t),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=`shadowclaw-settings-backup-${Date.now()}.json`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(n),this.closeDialog(`.settings__backup-dialog`),l(`Settings backup downloaded`,3e3)}catch(e){u(`Failed to backup settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async confirmClear(){if(!this.db){u(`Settings database is unavailable`,5e3);return}try{await this.replaceConfigEntries([]),this.closeDialog(`.settings__clear-dialog`),c(`Settings cleared. Reloading app...`,3200),setTimeout(()=>{window.location.reload()},250)}catch(e){u(`Failed to clear settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async confirmRestore(){if(!this.db){u(`Settings database is unavailable`,5e3);return}let e=this.pendingRestoreFile;if(!e){u(`No backup file selected`,4e3);return}try{let t=b(await e.text()),n=await y(t.configEntries,t.plaintextPasswords||[]);await this.replaceConfigEntries(n),this.pendingRestoreFile=null,this.closeDialog(`.settings__restore-dialog`),l(`Settings restored. Reloading app...`,3200),setTimeout(()=>{window.location.reload()},250)}catch(e){u(`Failed to restore settings: ${e instanceof Error?e.message:String(e)}`,6e3)}}async getAllConfigEntries(){if(!this.db)throw Error(`Database is unavailable`);return await new Promise((e,t)=>{try{let n=this.db?.transaction(`config`,`readonly`);if(!n){t(Error(`Failed to open read transaction`));return}let r=n.objectStore(`config`).getAll();r.onsuccess=()=>{e((Array.isArray(r.result)?r.result:[]).filter(e=>e&&typeof e.key==`string`).map(e=>({key:e.key,value:e.value})))},r.onerror=()=>{t(r.error||Error(`Failed to read settings config`))}}catch(e){t(e)}})}async onActivityLogDiskLoggingToggle(t){if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.ACTIVITY_LOG_DISK_LOGGING_ENABLED,t?`true`:`false`),l(t?`Activity log disk logging enabled`:`Activity log disk logging disabled`,2500)}catch(e){u(`Error saving activity log disk logging setting: `+(e instanceof Error?e.message:String(e)),6e3)}}async onOverridePrerenderSkeletonToggle(t){try{localStorage.setItem(`shadow-claw-override-prerender-skeleton`,t?`true`:`false`)}catch(e){console.warn(`Unable to save setting to localStorage:`,e)}if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.OVERRIDE_PRERENDER_SKELETON,t?`true`:`false`),l(t?`Pre-rendered content override enabled`:`Pre-rendered content override disabled`,2500)}catch(e){u(`Error saving pre-rendered content override setting: `+(e instanceof Error?e.message:String(e)),6e3)}}async onSidebarHidePagesToggle(t){if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.SIDEBAR_PAGES_HIDDEN,t?`true`:`false`),this.dispatchEvent(new CustomEvent(`sidebar-pages-visibility-change`,{detail:{hidden:t},bubbles:!0,composed:!0})),l(t?`Pages hidden in sidebar`:`Pages shown in sidebar`,2500)}catch(e){u(`Error saving sidebar Pages visibility: `+(e instanceof Error?e.message:String(e)),6e3)}}async onSidebarHideChatToggle(t){if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.SIDEBAR_CHAT_HIDDEN,t?`true`:`false`),this.dispatchEvent(new CustomEvent(`sidebar-chat-visibility-change`,{detail:{hidden:t},bubbles:!0,composed:!0})),l(t?`Chat hidden in sidebar`:`Chat shown in sidebar`,2500)}catch(e){u(`Error saving sidebar Chat visibility: `+(e instanceof Error?e.message:String(e)),6e3)}}async onSidebarHideTasksToggle(t){if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.SIDEBAR_TASKS_HIDDEN,t?`true`:`false`),this.dispatchEvent(new CustomEvent(`sidebar-tasks-visibility-change`,{detail:{hidden:t},bubbles:!0,composed:!0})),l(t?`Tasks hidden in sidebar`:`Tasks shown in sidebar`,2500)}catch(e){u(`Error saving sidebar Tasks visibility: `+(e instanceof Error?e.message:String(e)),6e3)}}async onSidebarHideFilesToggle(t){if(this.db)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.SIDEBAR_FILES_HIDDEN,t?`true`:`false`),this.dispatchEvent(new CustomEvent(`sidebar-files-visibility-change`,{detail:{hidden:t},bubbles:!0,composed:!0})),l(t?`Files hidden in sidebar`:`Files shown in sidebar`,2500)}catch(e){u(`Error saving sidebar Files visibility: `+(e instanceof Error?e.message:String(e)),6e3)}}async onPagesAutoRefreshInputChange(t){if(!this.db)return;let n=Math.max(0,Math.min(t,86400));try{let{setConfig:t}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await t(this.db,e.PAGES_AUTO_REFRESH_INTERVAL,String(n)),window.dispatchEvent(new CustomEvent(`shadow-claw-pages-auto-refresh-change`,{detail:{interval:n}})),l(n>0?`Pages auto refresh set to ${n}s`:`Pages auto refresh disabled`,2500)}catch(e){u(`Error saving Pages auto refresh interval: `+(e instanceof Error?e.message:String(e)),6e3)}}async populateAssistantSettings(){let t=this.shadowRoot;if(!t||!this.db)return;let n=t.querySelector(`[data-setting="assistant-name-input"]`);if(n){let{getConfig:t}=await import(`./getConfig-D89uJgo5.js`).then(e=>e.n),r=await t(this.db,e.ASSISTANT_NAME),i=this.orchestrator?.assistantName||a.orchestrator?.assistantName;n.value=typeof r==`string`&&r||i||`ShadowClaw`}let{getConfig:r}=await import(`./getConfig-D89uJgo5.js`).then(e=>e.n),i=await r(this.db,e.ACTIVITY_LOG_DISK_LOGGING_ENABLED),o=i===!0||i===`true`||i===1||i===`1`,s=t.querySelector(`[data-setting="activity-log-disk-logging-toggle"]`);s&&(s.checked=o);let c=await r(this.db,e.SIDEBAR_PAGES_HIDDEN),l=c===!0||c===`true`||c===1||c===`1`,u=t.querySelector(`[data-setting="sidebar-hide-pages-toggle"]`);u&&(u.checked=l);let d=await r(this.db,e.SIDEBAR_CHAT_HIDDEN),p=d===!0||d===`true`||d===1||d===`1`,m=t.querySelector(`[data-setting="sidebar-hide-chat-toggle"]`);m&&(m.checked=p);let h=await r(this.db,e.SIDEBAR_TASKS_HIDDEN),g=h===!0||h===`true`||h===1||h===`1`,_=t.querySelector(`[data-setting="sidebar-hide-tasks-toggle"]`);_&&(_.checked=g);let v=await r(this.db,e.SIDEBAR_FILES_HIDDEN),y=v===!0||v===`true`||v===1||v===`1`,b=t.querySelector(`[data-setting="sidebar-hide-files-toggle"]`);b&&(b.checked=y);let x=t.querySelector(`[data-setting="pages-auto-refresh-input"]`);if(x){let t=await r(this.db,e.PAGES_AUTO_REFRESH_INTERVAL);if(typeof t==`string`||typeof t==`number`){let e=parseInt(String(t),10);x.value=!isNaN(e)&&e>=0?String(e):`0`}else x.value=`0`}let S=await r(this.db,e.OVERRIDE_PRERENDER_SKELETON),C=null;try{C=localStorage.getItem(`shadow-claw-override-prerender-skeleton`)}catch{}let w=!0;if(S==null?C!==null&&(w=C===`true`):w=f(S),w)try{localStorage.setItem(`shadow-claw-override-prerender-skeleton`,`true`)}catch{}let T=t.querySelector(`[data-setting="override-prerender-skeleton-toggle"]`);T&&(T.checked=w);let E=t.querySelector(`[data-setting="dom-allowed-iframe-hosts"]`);if(E){let t=await r(this.db,e.ALLOWED_IFRAME_HOST_PATTERNS);if(typeof t==`string`&&t.trim().length>0){E.value=t;let{setAllowedIframeHostPatterns:e}=await import(`./iframe-sanitizer-DC-_ys8U.js`).then(e=>e.r);e(t)}else{let{DEFAULT_ALLOWED_IFRAME_HOST_PATTERNS:e}=await import(`./iframe-sanitizer-DC-_ys8U.js`).then(e=>e.r);E.value=e.join(`
`)}}let D=t.querySelector(`[data-setting="markdown-frontmatter-pages-toggle"]`);D&&(D.checked=f(await r(this.db,e.MARKDOWN_FRONTMATTER_PAGES),!0));let O=t.querySelector(`[data-setting="markdown-frontmatter-file-viewer-toggle"]`);O&&(O.checked=f(await r(this.db,e.MARKDOWN_FRONTMATTER_FILE_VIEWER),!0));let k=t.querySelector(`[data-setting="markdown-frontmatter-chat-toggle"]`);k&&(k.checked=f(await r(this.db,e.MARKDOWN_FRONTMATTER_CHAT),!0));let A=t.querySelector(`[data-setting="markdown-frontmatter-tasks-toggle"]`);A&&(A.checked=f(await r(this.db,e.MARKDOWN_FRONTMATTER_TASKS),!0))}async promptForPlaintextBackupHandle(){let e=Reflect.get(globalThis,`showSaveFilePicker`),t=typeof e==`function`?e.bind(globalThis):null;if(!t)throw Error(`Plaintext settings backup requires the File System Access API.`);try{return await t({id:`shadowclaw-settings-backup`,suggestedName:`shadowclaw-settings-backup-${n()}.json`,types:[{description:`JSON Files`,accept:{"application/json":[`.json`]}}]})}catch(e){if(e instanceof Error&&e.name===`AbortError`)return null;throw e}}async render(){let e=this.shadowRoot;if(!e)return;e.querySelector(`[data-action="show-channels-config"]`)?.addEventListener(`click`,()=>{this.dispatchEvent(new CustomEvent(`navigate`,{detail:{page:`channels`},bubbles:!0,composed:!0}))}),e.querySelector(`[data-action="show-tools-config"]`)?.addEventListener(`click`,()=>{this.dispatchEvent(new CustomEvent(`navigate`,{detail:{page:`tools`},bubbles:!0,composed:!0}))}),e.querySelectorAll(`[data-tab-target]`).forEach(e=>{e.addEventListener(`click`,()=>{this.activateTab(e.dataset.tabTarget)}),e.addEventListener(`keydown`,t=>{this.handleTabKeydown(t,e)})}),this.applyTabState(),this.bindSettingsActions();let t=e.querySelector(`[data-info="deployed-revision"]`);t&&(t.textContent=`Deployed revision: ${document.querySelector(`meta[name="revision"]`)?.getAttribute(`content`)?.trim()||`unknown`}`),await this.populateAssistantSettings()}async replaceConfigEntries(e){if(!this.db)throw Error(`Database is unavailable`);await new Promise((t,n)=>{try{let r=this.db?.transaction(`config`,`readwrite`);if(!r){n(Error(`Failed to open write transaction`));return}let i=r.objectStore(`config`);i.clear();for(let t of e)i.put({key:t.key,value:t.value});r.oncomplete=()=>t(),r.onerror=()=>n(r.error||Error(`Failed to update config`)),r.onabort=()=>n(r.error||Error(`Config update aborted`))}catch(e){n(e)}})}async saveAssistantName(){if(!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="assistant-name-input"]`);if(!n)return;let i=n.value.trim();if(!i){let{showWarning:e}=await import(`./toast-D3gxhZpN.js`).then(e=>e.o);e(`Please enter a name`,3e3);return}localStorage.setItem(`assistantName`,i);try{let t=this.orchestrator||a.orchestrator;if(t)this.orchestrator=t,await r(t,this.db,i);else{let{setConfig:t}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await t(this.db,e.ASSISTANT_NAME,i)}}catch(e){console.warn(`Could not update orchestrator:`,e)}l(`Assistant name saved`,3e3)}async saveDomAllowedIframeHosts(){let t=this.shadowRoot;if(!t||!this.db)return;let n=t.querySelector(`[data-setting="dom-allowed-iframe-hosts"]`);if(!n)return;let r=n.value.split(`
`).map(e=>e.trim()).filter(e=>e.length>0),i=t.querySelector(`[data-setting="markdown-frontmatter-pages-toggle"]`),a=t.querySelector(`[data-setting="markdown-frontmatter-file-viewer-toggle"]`),o=t.querySelector(`[data-setting="markdown-frontmatter-chat-toggle"]`),s=t.querySelector(`[data-setting="markdown-frontmatter-tasks-toggle"]`);try{let{setConfig:t}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n),n=r.join(`
`);await t(this.db,e.ALLOWED_IFRAME_HOST_PATTERNS,n),await t(this.db,e.MARKDOWN_FRONTMATTER_PAGES,String(i?.checked??!0)),await t(this.db,e.MARKDOWN_FRONTMATTER_FILE_VIEWER,String(a?.checked??!0)),await t(this.db,e.MARKDOWN_FRONTMATTER_CHAT,String(o?.checked??!0)),await t(this.db,e.MARKDOWN_FRONTMATTER_TASKS,String(s?.checked??!0));let{setAllowedIframeHostPatterns:c}=await import(`./iframe-sanitizer-DC-_ys8U.js`).then(e=>e.r);c(r),l(`DOM iframe embed settings saved`,2500)}catch(e){u(`Error saving DOM iframe embed settings: `+(e instanceof Error?e.message:String(e)),6e3)}}};customElements.get(k)||customElements.define(k,A);export{A as ShadowClawSettings};