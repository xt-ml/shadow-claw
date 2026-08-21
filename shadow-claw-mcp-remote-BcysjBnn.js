import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{d as r,h as i}from"./custom-element-security-MwgLnC6q.js";import{r as a}from"./crypto-C8c5wMzN.js";import{a as o,l as s,o as c,s as l,t as u,u as d}from"./mcp-reconnect-B7CggzRr.js";import{r as f,t as p}from"./toast-D3gxhZpN.js";import{t as m}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-card-BMtKXkEh.js";import"./shadow-claw-empty-state-CbZ2vrOx.js";const h=new CSSStyleSheet;h.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
}

:host {
  display: block;
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
  margin: 0;
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

.form-input {
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

.form-input:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.06);
  outline: none;
}

select.form-input {
  appearance: auto;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.remote-mcp-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.add-btn {
  background: none;
  border: 0.0625rem dashed var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.375rem 0.75rem;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.add-btn:hover {
  border-color: var(--shadow-claw-accent-primary);
}

.connection-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.connection-form {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-accent-primary);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  margin-bottom: 1rem;
  padding: 1rem;
}

.connection-form h4 {
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.connection-form-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.connection-form-row .form-label {
  margin: 0;
}

.auth-note {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.connection-form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.cancel-btn {
  background: none;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 62.5rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.5rem 1rem;
  transition: border-color 0.15s;
}

.cancel-btn:hover {
  border-color: var(--shadow-claw-text-secondary);
}

.confirm-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.confirm-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

/* Connection diagnostic panel */
.connection-diagnostic {
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}

.diagnostic-loading {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  padding: 0.25rem 0;
}

.diagnostic-header {
  align-items: center;
  display: flex;
  font-size: 0.8125rem;
  font-weight: 600;
  gap: 0.25rem;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.diagnostic-header.diagnostic-ok {
  color: var(--shadow-claw-success-color);
}

.diagnostic-header.diagnostic-error {
  color: var(--shadow-claw-error-color);
}

.diagnostic-close {
  background: none;
  border: none;
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.125rem 0.25rem;
}

.diagnostic-close:hover {
  color: var(--shadow-claw-text-primary);
}

.diagnostic-steps {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.diagnostic-step {
  align-items: baseline;
  display: flex;
  font-size: 0.75rem;
  gap: 0.375rem;
}

.diagnostic-icon {
  flex-shrink: 0;
  font-weight: 700;
  width: 1rem;
}

.diagnostic-ok .diagnostic-icon {
  color: var(--shadow-claw-success-color);
}

.diagnostic-error .diagnostic-icon {
  color: var(--shadow-claw-error-color);
}

.diagnostic-label {
  color: var(--shadow-claw-text-primary);
  font-weight: 500;
}

.diagnostic-detail {
  color: var(--shadow-claw-text-secondary);
}

.diagnostic-detail::before {
  content: "— ";
}

.diagnostic-tools {
  font-size: 0.75rem;
  margin-top: 0.375rem;
}

.diagnostic-tools summary {
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
}

.diagnostic-tools ul {
  color: var(--shadow-claw-text-secondary);
  margin: 0.25rem 0 0;
  padding-left: 1.25rem;
}

/* Reconnect OAuth button */
.reconnect-btn {
  background: none;
  border: 0.0625rem solid var(--shadow-claw-accent-primary);
  border-radius: 62.5rem;
  color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.5rem;
  padding: 0.375rem 0.75rem;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.reconnect-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary, #fff);
}

.reconnect-btn:focus-visible {
  box-shadow: 0 0 0 0.125rem rgba(0, 0, 0, 0.1);
  outline: 0.125rem solid var(--shadow-claw-accent-primary);
  outline-offset: 0.125rem;
}

.reconnect-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
`);const g=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <div class="remote-mcp-header">
      <h3>🌐 Remote MCP Connections</h3>
      <button class="add-btn" data-action="add-connection">
        + Add Remote MCP Connection
      </button>
    </div>

    <div class="form-group">
      <div class="form-helper">
        Configure remote MCP server endpoints and choose how each connection
        authenticates. These connections power the remote_mcp_list_tools and
        remote_mcp_call_tool tools.
      </div>
    </div>

    <div data-region="connection-form-slot"></div>
    <div class="connection-list" data-region="connection-list"></div>
  </div>
</template>
`,`text/html`),_=g.querySelector(`template`);let v=[];v=_?Array.from(_.content.children):Array.from(g.head.children).concat(Array.from(g.body.children));var y=v;const b=`shadow-claw-mcp-remote`;var x=class extends m{static styles=h;static template=y;connections=[];db=null;editingConnectionId=null;gitAccounts=[];serviceAccounts=[];constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await t(),await this.render(),this.bindEventListeners()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="add-connection"]`)?.addEventListener(`click`,()=>this.showConnectionForm(`new`)),e.querySelector(`[data-region="connection-list"]`)?.addEventListener(`settings-action`,e=>{let{action:t,id:n}=e.detail||{action:``,id:``};n&&(t===`edit-connection`?this.showConnectionForm(n):t===`delete-connection`?this.deleteConnection(n):t===`test-connection`&&this.testConnection(n))}),e.querySelector(`[data-region="connection-list"]`)?.addEventListener(`click`,e=>{let t=e.target;if(!(t instanceof HTMLButtonElement))return;let n=t.dataset.reconnectConnection;n&&this.reconnectOAuth(n)}))}describeCredentialRef(e){return!e||e.authType===`none`?`No auth`:e.authType===`custom_header`?`Custom header${e.headerName?` (${e.headerName})`:``}`:e.accountId?`Service account (${e.authType.toUpperCase()})`:e.gitAccountId?`Git account (${e.authType.toUpperCase()})`:e.authType.toUpperCase()}getAuthSelectionFromCredentialRef(e){return!e||e.authType===`none`?`none`:e.authType===`custom_header`?`custom_header`:e.accountId?e.authType===`oauth`?`service_oauth`:`service_pat`:e.gitAccountId?e.authType===`oauth`?`git_oauth`:`git_pat`:`none`}hideConnectionForm(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="connection-form-slot"]`);t&&t.replaceChildren(),this.editingConnectionId=null}isOAuthConnection(e){let t=e.credentialRef;return t?t.authType===`oauth`&&!!(t.accountId||t.gitAccountId):!1}renderConnectionList(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="connection-list"]`);if(!t)return;if(t.replaceChildren(),this.connections.length===0){let e=document.createElement(`shadow-claw-empty-state`);e.setAttribute(`message`,`No remote MCP connections configured.`),e.setAttribute(`hint`,`Click '+ Add Remote MCP Connection' to get started.`),t.append(e);return}let n=document.createDocumentFragment();this.connections.forEach(e=>{let t=this.describeCredentialRef(e.credentialRef),r=e.enabled?`Enabled`:`Disabled`,i=`${e.serverUrl} · ${e.transport} · ${t}`,a=document.createElement(`shadow-claw-card`);a.setAttribute(`data-connection-id`,e.id),a.setAttribute(`label`,e.label),a.setAttribute(`meta`,i),a.setAttribute(`badge`,r),e.enabled||a.setAttribute(`muted`,``);let o=document.createElement(`shadow-claw-actions`);if(o.setAttribute(`slot`,`actions`),o.setAttribute(`kind`,`connection`),o.setAttribute(`item-id`,e.id),a.append(o),this.isOAuthConnection(e)){let t=document.createElement(`button`);t.className=`reconnect-btn`,t.textContent=`🔑 Reconnect OAuth`,t.setAttribute(`data-reconnect-connection`,e.id),a.append(t)}n.append(a)}),t.append(n)}renderDiagnostic(e,t){let n=t.steps.map(e=>{let t=e.status===`ok`?`✓`:e.status===`error`?`✗`:`—`;return`
          <div class="${`diagnostic-step diagnostic-${e.status}`}">
            <span class="diagnostic-icon">${t}</span>
            <span class="diagnostic-label">${i(e.step)}</span>
            ${e.detail?`<span class="diagnostic-detail">${i(e.detail)}</span>`:``}
          </div>`}).join(``),a=t.success&&t.toolNames.length>0?`<details class="diagnostic-tools"><summary>${t.toolCount} tool${t.toolCount===1?``:`s`} available</summary><ul>${t.toolNames.map(e=>`<li>${i(e)}</li>`).join(``)}</ul></details>`:``;r(e,`
      <div class="diagnostic-header diagnostic-${t.success?`ok`:`error`}">
        ${t.success?`✓ Connection OK`:`✗ Connection Failed`}
        <button class="diagnostic-close" data-action="close-diagnostic" title="Dismiss">\u00d7</button>
      </div>
      <div class="diagnostic-steps">${n}</div>
      ${a}
      `),e.querySelector(`[data-action="close-diagnostic"]`)?.addEventListener(`click`,()=>e.remove())}renderGitAccountOptions(e){return this.gitAccounts.length===0?`<option value="">No git accounts configured</option>`:this.gitAccounts.map(t=>{let n=t.id===e?` selected`:``;return`<option value="${t.id}"${n}>${i(t.label)} · ${i(t.hostPattern)}</option>`}).join(``)}renderServiceAccountOptions(e){return this.serviceAccounts.length===0?`<option value="">No service accounts configured</option>`:this.serviceAccounts.map(t=>{let n=t.id===e?` selected`:``;return`<option value="${t.id}"${n}>${i(t.label)} · ${i(t.hostPattern)}</option>`}).join(``)}showConnectionForm(e){let t=this.shadowRoot;if(!t)return;this.editingConnectionId=e;let n=e===`new`,a=n?null:this.connections.find(t=>t.id===e)||null,o=a?.transport||`streamable_http`,s=this.getAuthSelectionFromCredentialRef(a?.credentialRef||null),c=t.querySelector(`[data-region="connection-form-slot"]`);c&&(r(c,`
      <div class="connection-form">
        <h4>${n?`Add Remote MCP Connection`:`Edit Remote MCP Connection`}</h4>

        <div class="form-group">
          <label class="form-label">Connection Label</label>
          <input
            type="text"
            class="form-input"
            data-field="connection-label"
            placeholder="e.g. Figma MCP, Jira MCP"
            value="${i(a?.label||``)}"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Server URL</label>
          <input
            type="text"
            class="form-input"
            data-field="connection-url"
            placeholder="https://mcp.example.com/rpc"
            value="${i(a?.serverUrl||``)}"
          />
          <div class="form-helper">Must be an absolute http(s) URL.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Transport</label>
          <select class="form-input" data-field="connection-transport">
            <option value="streamable_http"${o===`streamable_http`?` selected`:``}>streamable_http</option>
            <option value="sse"${o===`sse`?` selected`:``}>sse</option>
            <option value="websocket"${o===`websocket`?` selected`:``}>websocket</option>
          </select>
          <div class="form-helper">
            Current runtime support is streamable_http. Other transports can be saved for future support.
          </div>
        </div>

        <div class="form-group connection-form-row">
          <input type="checkbox" data-field="connection-enabled"${a?.enabled===!1?``:` checked`} />
          <label class="form-label">Enabled</label>
        </div>

        <div class="form-group connection-form-row" data-region="auto-reconnect-region">
          <input type="checkbox" data-field="connection-auto-reconnect"${a?.autoReconnectOAuth?` checked`:``} />
          <label class="form-label">Auto-reconnect OAuth on 401</label>
          <div class="form-helper" style="margin-left: 0.25rem;">When enabled, a 401 error will automatically open the OAuth popup to re-authenticate.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Authentication</label>
          <select class="form-input" data-field="auth-selection">
            <option value="none"${s===`none`?` selected`:``}>None</option>
            <option value="service_pat"${s===`service_pat`?` selected`:``}>Service Account (PAT)</option>
            <option value="service_oauth"${s===`service_oauth`?` selected`:``}>Service Account (OAuth)</option>
            <option value="git_pat"${s===`git_pat`?` selected`:``}>Git Account (PAT)</option>
            <option value="git_oauth"${s===`git_oauth`?` selected`:``}>Git Account (OAuth)</option>
            <option value="custom_header"${s===`custom_header`?` selected`:``}>Custom Header</option>
          </select>
        </div>

        <div class="form-group" data-region="service-account-region">
          <label class="form-label">Service Account</label>
          <select class="form-input" data-field="service-account-id">
            ${this.renderServiceAccountOptions(a?.credentialRef?.accountId)}
          </select>
        </div>

        <div class="form-group" data-region="git-account-region">
          <label class="form-label">Git Account</label>
          <select class="form-input" data-field="git-account-id">
            ${this.renderGitAccountOptions(a?.credentialRef?.gitAccountId)}
          </select>
        </div>

        <div data-region="custom-header-region">
          <div class="form-group">
            <label class="form-label">Header Name</label>
            <input
              type="text"
              class="form-input"
              data-field="custom-header-name"
              placeholder="e.g. Authorization or X-API-Key"
              value="${i(a?.credentialRef?.headerName||``)}"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Header Value</label>
            <input
              type="password"
              class="form-input"
              data-field="custom-header-value"
              placeholder="${a?.credentialRef?.authType===`custom_header`?`•••••••••••• (Saved)`:`Enter secret value`}"
            />
            <div class="auth-note">Stored encrypted locally. Leave blank to keep existing value.</div>
          </div>
        </div>

        <div class="connection-form-actions">
          <button class="confirm-btn" data-action="save-connection">
            ${n?`Add Connection`:`Update Connection`}
          </button>
          <button class="cancel-btn" data-action="cancel-connection-form">Cancel</button>
        </div>
      </div>
    `),c.querySelector(`[data-action="save-connection"]`)?.addEventListener(`click`,()=>void this.saveConnectionForm()),c.querySelector(`[data-action="cancel-connection-form"]`)?.addEventListener(`click`,()=>this.hideConnectionForm()),c.querySelector(`[data-field="auth-selection"]`)?.addEventListener(`change`,()=>this.updateAuthFieldsVisibility(c)),this.updateAuthFieldsVisibility(c))}updateAuthFieldsVisibility(e){let t=e.querySelector(`[data-field="auth-selection"]`)?.value,n=e.querySelector(`[data-region="service-account-region"]`),r=e.querySelector(`[data-region="git-account-region"]`),i=e.querySelector(`[data-region="custom-header-region"]`),a=e.querySelector(`[data-region="auto-reconnect-region"]`),o=t===`service_pat`||t===`service_oauth`,s=t===`git_pat`||t===`git_oauth`,c=t===`custom_header`,l=t===`service_oauth`||t===`git_oauth`;n instanceof HTMLElement&&(n.style.display=o?`block`:`none`),r instanceof HTMLElement&&(r.style.display=s?`block`:`none`),i instanceof HTMLElement&&(i.style.display=c?`block`:`none`),a instanceof HTMLElement&&(a.style.display=l?`flex`:`none`)}async buildCredentialRef(e,t,n){if(t===`none`)return null;if(t===`service_pat`||t===`service_oauth`){let n=e.querySelector(`[data-field="service-account-id"]`)?.value;if(!n)throw Error(`Select a service account for this authentication mode.`);return{serviceType:`mcp_remote`,authType:t===`service_oauth`?`oauth`:`token`,providerId:`custom_mcp`,accountId:n}}if(t===`git_pat`||t===`git_oauth`){let n=e.querySelector(`[data-field="git-account-id"]`)?.value;if(!n)throw Error(`Select a git account for this authentication mode.`);return{serviceType:`mcp_remote`,authType:t===`git_oauth`?`oauth`:`token`,providerId:`custom_mcp`,gitAccountId:n}}let r=e.querySelector(`[data-field="custom-header-name"]`)?.value.trim(),i=e.querySelector(`[data-field="custom-header-value"]`)?.value.trim();if(!r)throw Error(`Header name is required for custom header authentication.`);let o;if(i&&(o=await a(i)||void 0),!o)if(n?.credentialRef?.authType===`custom_header`&&n.credentialRef.encryptedValue)o=n.credentialRef.encryptedValue;else throw Error(`Header value is required for custom header authentication.`);return{serviceType:`mcp_remote`,authType:`custom_header`,providerId:`custom_mcp`,headerName:r,encryptedValue:o}}async deleteConnection(e){if(this.db)try{if(!await l(this.db,e)){p(`Remote MCP connection not found.`,4e3);return}await this.render(),this.editingConnectionId===e&&this.hideConnectionForm(),f(`Remote MCP connection deleted`,3e3)}catch(e){p(`Failed to delete remote MCP connection: ${e instanceof Error?e.message:String(e)}`,6e3)}}async reconnectOAuth(e){if(!this.db)return;let t=this.connections.find(t=>t.id===e)?.label||e,n=await u(this.db,e);n.success?f(`OAuth reconnected for "${t}"`,4e3):p(`OAuth reconnect failed: ${n.error}`,6e3)}async render(){if(!(!this.shadowRoot||!this.db))try{this.connections=await s(this.db);let t=await n(this.db,e.SERVICE_ACCOUNTS);this.serviceAccounts=Array.isArray(t)?t:[];let r=await n(this.db,e.GIT_ACCOUNTS);this.gitAccounts=Array.isArray(r)?r:[],this.renderConnectionList()}catch(e){console.warn(`Could not load remote MCP connections:`,e)}}async saveConnectionForm(){if(!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="connection-form-slot"]`);if(!t)return;let n=t.querySelector(`[data-field="connection-label"]`)?.value.trim(),r=t.querySelector(`[data-field="connection-url"]`)?.value.trim(),i=t.querySelector(`[data-field="connection-transport"]`)?.value,a=t.querySelector(`[data-field="connection-enabled"]`)?.checked,o=t.querySelector(`[data-field="connection-auto-reconnect"]`)?.checked,s=t.querySelector(`[data-field="auth-selection"]`)?.value;if(!n||!r){p(`Connection label and server URL are required.`,4e3);return}let l=this.editingConnectionId===`new`,u=l?null:this.connections.find(e=>e.id===this.editingConnectionId)||null;try{let e=await d(this.db,{id:l?void 0:u?.id,label:n,serviceType:`mcp_remote`,serverUrl:r,transport:i,enabled:a,autoReconnectOAuth:o}),p=await this.buildCredentialRef(t,s,u);await c(this.db,e.id,p),await this.render(),this.hideConnectionForm(),f(l?`Remote MCP connection added`:`Remote MCP connection updated`,3e3)}catch(e){p(`Failed to save remote MCP connection: ${e instanceof Error?e.message:String(e)}`,6e3)}}async testConnection(e){if(!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.connection-card[data-connection-id="${e}"]`),r=n?.querySelector(`.connection-diagnostic`);r&&r.remove();let i=document.createElement(`div`);i.className=`connection-diagnostic`;let a=document.createElement(`div`);a.className=`diagnostic-loading`,a.textContent=`Testing connection…`,i.appendChild(a),n?.appendChild(i);let s=await o(this.db,e);this.renderDiagnostic(i,s)}};customElements.get(b)||customElements.define(b,x);export{x as ShadowClawMcpRemote};