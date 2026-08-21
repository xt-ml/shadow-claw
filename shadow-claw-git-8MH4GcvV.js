import{r as e,y as t}from"./config-64zJ5TLN.js";import{n}from"./txPromise-EBECky1b.js";import{t as r}from"./getConfig-D89uJgo5.js";import{d as i,h as a}from"./custom-element-security-MwgLnC6q.js";import{t as o}from"./orchestrator-DrMg2dnI.js";import{f as s,h as c}from"./mcp-reconnect-B7CggzRr.js";import{r as l,t as u}from"./toast-D3gxhZpN.js";import{t as d}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-card-BMtKXkEh.js";import"./shadow-claw-empty-state-CbZ2vrOx.js";const f=new CSSStyleSheet;f.replaceSync(`*,
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
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.radio-item {
  align-items: flex-start;
  cursor: pointer;
  display: flex;
  gap: 0.625rem;
}

.radio-item input {
  margin-top: 0.1875rem;
}

.radio-label-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.radio-label-title {
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 500;
}

.radio-label-desc {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
}

.settings-warning {
  background-color: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.375rem;
  color: var(--shadow-claw-warning-color);
  display: none;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
}

.settings-warning b {
  font-weight: 700;
}

.accounts-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.accounts-header h4 {
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin: 0;
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

.account-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

/* ── Account form (inline) ─────────────────────── */
.account-form {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-accent-primary);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  margin-bottom: 1rem;
  padding: 1rem;
}

.account-form h4 {
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.account-form-actions {
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
`);const p=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>🔀 Git</h3>

    <div class="form-group">
      <label class="form-label">Default Author Name</label>
      <input
        class="form-input"
        data-setting="git-author-name-input"
        placeholder="ShadowClaw"
        type="text"
      />
    </div>

    <div class="form-group">
      <label class="form-label">Default Author Email</label>
      <input
        class="form-input"
        data-setting="git-author-email-input"
        placeholder="agent@example.com"
        type="text"
      />
    </div>

    <div class="form-group">
      <label class="form-label">CORS Proxy</label>
      <div class="radio-group">
        <label class="radio-item">
          <input
            checked
            data-setting="git-proxy-local"
            name="git-proxy"
            type="radio"
            value="local"
          />
          <div class="radio-label-text">
            <span class="radio-label-title">Local Proxy (Recommended)</span>
            <span class="radio-label-desc">
              Uses your local server. Secure and private.
            </span>
          </div>
        </label>
        <label class="radio-item">
          <input
            data-setting="git-proxy-public"
            name="git-proxy"
            type="radio"
            value="public"
          />
          <div class="radio-label-text">
            <span class="radio-label-title">Public Proxy</span>
            <span class="radio-label-desc">
              Uses cors-anywhere.com. Potential credential leak risk.
            </span>
          </div>
        </label>
        <label class="radio-item">
          <input
            data-setting="git-proxy-custom"
            name="git-proxy"
            type="radio"
            value="custom"
          />
          <div class="radio-label-text">
            <span class="radio-label-title">Custom Proxy URL</span>
            <span class="radio-label-desc">
              Specify a custom endpoint for Git operations.
            </span>
          </div>
        </label>
      </div>

      <div
        class="form-group"
        data-region="git-custom-proxy-field"
        style="margin-top: 0.75rem; display: none"
      >
        <label class="form-label">Custom Git Proxy URL</label>
        <input
          class="form-input"
          data-setting="git-proxy-url-input"
          placeholder="/git-proxy"
          type="text"
        />
        <div class="form-helper">
          The endpoint for isomorphic-git (e.g. /git-proxy) or a full URL.
        </div>
      </div>
      <div class="settings-warning" data-setting="git-proxy-warning">
        ⚠️ <b>Security Warning</b>: You have Git account(s) with tokens
        configured and are using the Public Proxy. Your tokens will pass through
        a third-party server.
      </div>
    </div>

    <button class="save-btn" data-action="save-git-settings">
      💾 Save Git Settings
    </button>

    <hr
      style="
        border: none;
        border-top: 0.0625rem solid var(--shadow-claw-border-color);
        margin: 1.5rem 0;
      "
    />

    <div class="accounts-header">
      <h4>Git Accounts</h4>
      <button class="add-btn" data-action="add-account">
        + Add Git Account
      </button>
    </div>

    <div data-region="account-form-slot"></div>
    <div class="account-list" data-region="account-list"></div>
  </div>
</template>
`,`text/html`),m=p.querySelector(`template`);let h=[];h=m?Array.from(m.content.children):Array.from(p.head.children).concat(Array.from(p.body.children));var g=h;const _=`shadow-claw-git`,v=[`github`,`gitlab`,`azure_devops`];function y(e){if(e===`azure-devops`)return`azure_devops`;if(e===`github`||e===`gitlab`)return e}function b(e){return c(e)}var x=class extends d{static styles=f;static template=g;accounts=[];db=null;defaultAccountId=``;editingAccountId=null;pendingOauthResult=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await n(),await this.render(),this.bindEventListeners()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="save-git-settings"]`)?.addEventListener(`click`,()=>this.saveGitSettings()),e.querySelectorAll(`input[name="git-proxy"]`).forEach(e=>{e.addEventListener(`change`,()=>{this.updateGitWarning(),this.updateCustomProxyVisibility()})}),e.querySelector(`[data-action="add-account"]`)?.addEventListener(`click`,()=>this.showAccountForm(`new`)),e.querySelector(`[data-region="account-list"]`)?.addEventListener(`settings-action`,e=>{let{action:t,id:n}=e.detail||{action:``,id:``};n&&(t===`edit-account`?this.showAccountForm(n):t===`delete-account`?this.deleteAccount(n):t===`set-default`&&this.setDefaultAccount(n))}))}hideAccountForm(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="account-form-slot"]`);t&&t.replaceChildren(),this.editingAccountId=null,this.pendingOauthResult=null}renderAccountList(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="account-list"]`);if(!t)return;if(t.replaceChildren(),this.accounts.length===0){let e=document.createElement(`shadow-claw-empty-state`);e.setAttribute(`message`,`No Git accounts configured.`),e.setAttribute(`hint`,`Click '+ Add Git Account' to get started.`),t.append(e);return}let n=document.createDocumentFragment();this.accounts.forEach(e=>{let t=e.id===this.defaultAccountId,r=!!e.token,i=!!e.username,a=b(e),o=r?a===`oauth`?e.oauthReauthRequired?`Reconnect required`:`OAuth token saved${e.oauthProviderId?` (${e.oauthProviderId})`:``}`:`Token (PAT)`:i?`Username: ${e.username}`:`No credentials`,s=`${e.hostPattern} · ${o}`,c=document.createElement(`shadow-claw-card`);c.setAttribute(`data-account-id`,e.id),c.setAttribute(`label`,e.label),c.setAttribute(`meta`,s),t&&(c.setAttribute(`highlight`,``),c.setAttribute(`badge`,`Default`));let l=document.createElement(`shadow-claw-actions`);l.setAttribute(`slot`,`actions`),l.setAttribute(`kind`,`account`),l.setAttribute(`item-id`,e.id),t&&l.setAttribute(`is-default`,``),c.append(l),n.append(c)}),t.append(n)}showAccountForm(e){let n=this.shadowRoot;if(!n)return;this.editingAccountId=e,this.pendingOauthResult=null;let r=e===`new`,o=r?null:this.accounts.find(t=>t.id===e),c=b(o||null),l=o?.oauthProviderId?o.oauthProviderId:y(s(o?.hostPattern||``)),u=l&&t[l]?l:`github`,d=o?.scopes?.join(` `)||``,f=v.filter(e=>!!t[e]).map(e=>{let n=t[e];return`<option value="${n.id}"${n.id===u?` selected`:``}>${a(n.name)}</option>`}).join(``),p=n.querySelector(`[data-region="account-form-slot"]`);p&&(i(p,`
      <div class="account-form">
        <h4>${r?`Add Git Account`:`Edit Account`}</h4>

        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-input" data-field="acct-label"
                 placeholder="e.g. GitHub, Azure DevOps"
                 value="${a(o?.label||``)}" />
          <div class="form-helper">A friendly name to identify this account.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Host Pattern</label>
          <input type="text" class="form-input" data-field="acct-host"
                 placeholder="e.g. github.com, dev.azure.com"
                 value="${a(o?.hostPattern||``)}" />
          <div class="form-helper">
            Matched against remote URLs to auto-select credentials.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Auth Mode</label>
          <select class="form-input" data-field="acct-auth-mode">
            <option value="token"${c===`token`?` selected`:``}>PAT / Username</option>
            <option value="oauth"${c===`oauth`?` selected`:``}>OAuth</option>
          </select>
          <div class="form-helper">Use OAuth for provider-managed access tokens or PAT for manual Git credentials.</div>
        </div>

        <div class="oauth-fields" data-region="oauth-fields">
          <div class="form-group">
            <label class="form-label">OAuth Provider</label>
            <select class="form-input" data-field="acct-oauth-provider">${f}</select>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client ID</label>
            <input type="text" class="form-input" data-field="acct-oauth-client-id"
                   value="${a(o?.oauthClientId||``)}"
                   placeholder="Enter provider OAuth app client ID" />
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client Secret (if required)</label>
            <input type="password" class="form-input" data-field="acct-oauth-client-secret"
                   placeholder="${o?.oauthClientSecret?`•••••••••••• (Saved)`:`Enter client secret if provider requires it`}" />
            <div class="form-helper">Stored encrypted locally. Needed by some providers for token exchange/refresh.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Scope (if required)</label>
            <input type="text" class="form-input" data-field="acct-oauth-scope"
                   value="${a(d)}"
                   placeholder="space-separated scopes" />
            <div class="form-helper">Leave blank to use provider defaults.</div>
          </div>

          <div class="form-group oauth-connect-row">
            <button class="confirm-btn oauth-connect-btn" data-action="connect-oauth" type="button">Connect OAuth</button>
            <span class="oauth-status" data-region="oauth-status">${c===`oauth`&&o?.oauthReauthRequired?`Reconnect required`:c===`oauth`&&o?.token?`OAuth token already saved`:`Not connected`}</span>
          </div>
        </div>

        <div data-region="pat-fields">
          <div class="form-group">
            <label class="form-label">Token (PAT)</label>
            <input type="password" class="form-input" data-field="acct-token"
                   placeholder="${o?.token?`•••••••••••• (Saved)`:`ghp_xxxx or Azure PAT`}" />
            <div class="form-helper">
              Stored encrypted locally. Leave blank to keep existing.
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" data-field="acct-username"
                   placeholder="Optional — alternative to PAT"
                   value="${a(o?.username||``)}" />
          </div>

          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" data-field="acct-password"
                   placeholder="${o?.password?`•••••••••••• (Saved)`:`Optional — used with username`}" />
            <div class="form-helper">Stored encrypted locally. Leave blank to keep existing.</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Author Name (optional)</label>
          <input type="text" class="form-input" data-field="acct-author-name"
                 placeholder="Override default author for this account"
                 value="${a(o?.authorName||``)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Author Email (optional)</label>
          <input type="text" class="form-input" data-field="acct-author-email"
                 placeholder="Override default author email for this account"
                 value="${a(o?.authorEmail||``)}" />
        </div>

        <div class="account-form-actions">
          <button class="confirm-btn" data-action="save-account">
            ${r?`Add Account`:`Update Account`}
          </button>
          <button class="cancel-btn" data-action="cancel-account-form">Cancel</button>
        </div>
      </div>`),p.querySelector(`[data-action="save-account"]`)?.addEventListener(`click`,()=>this.saveAccountForm()),p.querySelector(`[data-action="cancel-account-form"]`)?.addEventListener(`click`,()=>this.hideAccountForm()),p.querySelector(`[data-field="acct-auth-mode"]`)?.addEventListener(`change`,()=>this.updateAuthModeVisibility(p)),p.querySelector(`[data-action="connect-oauth"]`)?.addEventListener(`click`,()=>void this.connectOAuthFromForm(p)),this.updateAuthModeVisibility(p))}updateAuthModeVisibility(e){let t=e.querySelector(`[data-field="acct-auth-mode"]`)?.value===`oauth`,n=e.querySelector(`[data-region="oauth-fields"]`),r=e.querySelector(`[data-region="pat-fields"]`);n instanceof HTMLElement&&(n.style.display=t?`block`:`none`),r instanceof HTMLElement&&(r.style.display=t?`none`:`block`)}updateCustomProxyVisibility(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="git-proxy-custom"]`),n=e.querySelector(`[data-region="git-custom-proxy-field"]`);n instanceof HTMLElement&&(n.style.display=t?.checked?`block`:`none`)}async connectOAuthFromForm(e){let t=e.querySelector(`[data-field="acct-oauth-provider"]`)?.value,n=e.querySelector(`[data-field="acct-oauth-client-id"]`)?.value.trim(),r=e.querySelector(`[data-field="acct-oauth-client-secret"]`)?.value.trim(),i=e.querySelector(`[data-field="acct-oauth-scope"]`)?.value.trim();if(!t){u(`OAuth provider is required.`,4e3);return}if(!n){u(`OAuth client ID is required.`,4e3);return}let a=e.querySelector(`[data-region="oauth-status"]`),o=e.querySelector(`[data-action="connect-oauth"]`);a&&(a.textContent=`Starting OAuth...`),o&&(o.disabled=!0);try{let e=i?i.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):void 0,o=await fetch(`/oauth/authorize`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({providerId:t,clientId:n,clientSecret:r||void 0,redirectUri:`${window.location.origin}/oauth/callback`,scope:e})}),s=await o.json();if(!o.ok||!s.state||!s.authorizeUrl)throw Error(s.error||`OAuth authorize failed`);window.open(s.authorizeUrl,`shadowclaw-oauth`,`popup=yes,width=540,height=720`);let c=s.state,u=`pending`;for(let e=0;e<60;e++){let e=await fetch(`/oauth/session/${encodeURIComponent(c)}`),t=await e.json();if(!e.ok)throw Error(t.error||`OAuth session not found`);if(u=t.status||`pending`,u===`authorized`)break;if(u===`error`)throw Error(t.error||`OAuth authorization failed`);await new Promise(e=>setTimeout(e,1e3))}if(u!==`authorized`)throw Error(`OAuth authorization timed out`);let d=await fetch(`/oauth/token`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({state:c})}),f=await d.json();if(!d.ok||!f.accessToken)throw Error(f.error||`OAuth token exchange failed`);this.pendingOauthResult={providerId:t,accessToken:f.accessToken,refreshToken:f.refreshToken,expiresAt:f.expiresIn?Date.now()+f.expiresIn*1e3:void 0,scope:f.scope,tokenType:f.tokenType},a&&(a.textContent=`OAuth connected`),l(`OAuth connected`,3e3)}catch(e){let t=e instanceof Error?e.message:String(e);a&&(a.textContent=`OAuth failed`),u(`OAuth connect failed: ${t}`,6e3)}finally{o&&(o.disabled=!1)}}async deleteAccount(t){if(this.db){this.accounts=this.accounts.filter(e=>e.id!==t),this.defaultAccountId===t&&(this.defaultAccountId=this.accounts[0]?.id||``);try{let{setConfig:t}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await t(this.db,e.GIT_ACCOUNTS,this.accounts),await t(this.db,e.GIT_DEFAULT_ACCOUNT,this.defaultAccountId)}catch(e){console.warn(`Error persisting account deletion:`,e)}this.renderAccountList(),this.updateGitWarning(),l(`Account deleted`,3e3)}}async migrateLegacyAccount(){if(!this.db)return;let t=await r(this.db,e.GIT_TOKEN),n=await r(this.db,e.GIT_USERNAME);if(!t&&!n)return;let i=await r(this.db,e.GIT_PASSWORD)||``,a={id:`legacy-migrated`,label:`GitHub`,hostPattern:`github.com`,token:t||``,username:n||``,password:i,authorName:``,authorEmail:``};this.accounts=[a],this.defaultAccountId=a.id;let{setConfig:o}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await o(this.db,e.GIT_ACCOUNTS,this.accounts),await o(this.db,e.GIT_DEFAULT_ACCOUNT,a.id)}async render(){let t=this.shadowRoot;if(t)try{let n=await r(this.db,e.GIT_CORS_PROXY)||`local`,i=t.querySelector(`[data-setting="git-proxy-local"]`),a=t.querySelector(`[data-setting="git-proxy-public"]`),s=t.querySelector(`[data-setting="git-proxy-custom"]`),c=t.querySelector(`[data-setting="git-proxy-url-input"]`);i&&a&&s&&(i.checked=n===`local`,a.checked=n===`public`,s.checked=n===`custom`),c&&(c.value=o.gitProxyUrl||`/git-proxy`),this.updateCustomProxyVisibility();let l=t.querySelector(`[data-setting="git-author-name-input"]`);l&&(l.value=await r(this.db,e.GIT_AUTHOR_NAME)||`ShadowClaw`);let u=t.querySelector(`[data-setting="git-author-email-input"]`);u&&(u.value=await r(this.db,e.GIT_AUTHOR_EMAIL)||`agent@example.com`);let d=await r(this.db,e.GIT_ACCOUNTS);this.accounts=Array.isArray(d)?d:[],this.defaultAccountId=await r(this.db,e.GIT_DEFAULT_ACCOUNT)||``,this.accounts.length===0&&await this.migrateLegacyAccount(),this.renderAccountList(),this.updateGitWarning()}catch(e){console.warn(`Could not load git settings:`,e)}}async saveAccountForm(){if(!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-region="account-form-slot"]`);if(!n)return;let r=n.querySelector(`[data-field="acct-label"]`)?.value.trim(),i=n.querySelector(`[data-field="acct-host"]`)?.value.trim(),a=n.querySelector(`[data-field="acct-auth-mode"]`)?.value;if(!r||!i){u(`Label and Host Pattern are required.`,4e3);return}try{let{encryptValue:t}=await import(`./crypto-C8c5wMzN.js`).then(e=>e.t),{setConfig:o}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n),s=n.querySelector(`[data-field="acct-token"]`)?.value.trim(),c=n.querySelector(`[data-field="acct-password"]`)?.value.trim(),d=n.querySelector(`[data-field="acct-username"]`)?.value.trim()||``,f=n.querySelector(`[data-field="acct-author-name"]`)?.value.trim()||``,p=n.querySelector(`[data-field="acct-author-email"]`)?.value.trim()||``,m=this.editingAccountId===`new`,h=m?null:this.accounts.find(e=>e.id===this.editingAccountId),g=h?.token||``,_=h?.password||``,v=h?.oauthProviderId,y=h?.oauthClientId,b=h?.oauthClientSecret,x=h?.accessTokenExpiresAt,S=h?.refreshToken,C=h?.scopes,w=h?.tokenType,T=h?.oauthRefreshFailureCount,E=h?.oauthReauthRequired,D=h?.oauthReauthRequiredAt;if(a===`oauth`){v=n.querySelector(`[data-field="acct-oauth-provider"]`)?.value,y=n.querySelector(`[data-field="acct-oauth-client-id"]`)?.value.trim();let e=n.querySelector(`[data-field="acct-oauth-client-secret"]`)?.value.trim(),r=n.querySelector(`[data-field="acct-oauth-scope"]`)?.value.trim(),i=r?r.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):void 0;if(!v){u(`OAuth provider is required for OAuth mode.`,4e3);return}if(!y){u(`OAuth client ID is required for OAuth mode.`,4e3);return}if(e){let n=await t(e);n&&(b=n)}if(this.pendingOauthResult?.accessToken){let e=await t(this.pendingOauthResult.accessToken);if(e&&(g=e),this.pendingOauthResult.refreshToken){let e=await t(this.pendingOauthResult.refreshToken);e&&(S=e)}x=this.pendingOauthResult.expiresAt,C=this.pendingOauthResult.scope?this.pendingOauthResult.scope.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):i||C,w=this.pendingOauthResult.tokenType,T=0,E=!1,D=void 0}else C=i||C;if(!g){u(`Connect OAuth first to obtain an access token for this account.`,5e3);return}_=``}else{if(s){let e=await t(s);e&&(g=e)}if(c){let e=await t(c);e&&(_=e)}v=void 0,y=void 0,b=void 0,x=void 0,S=void 0,C=void 0,w=void 0,T=void 0,E=void 0,D=void 0}if(m){let{ulid:t}=await import(`./ulid-BY7rQVLN.js`).then(e=>e.n),n={id:t(),label:r,hostPattern:i,token:g,username:a===`oauth`?``:d,password:_,authorName:f,authorEmail:p,authMode:a||`token`,oauthProviderId:v,oauthClientId:y,oauthClientSecret:b,accessTokenExpiresAt:x,refreshToken:S,scopes:C,tokenType:w,oauthRefreshFailureCount:T,oauthReauthRequired:E,oauthReauthRequiredAt:D};this.accounts.push(n),this.accounts.length===1&&(this.defaultAccountId=n.id,await o(this.db,e.GIT_DEFAULT_ACCOUNT,n.id))}else h&&(h.label=r,h.hostPattern=i,h.token=g,h.username=a===`oauth`?``:d,h.password=_,h.authorName=f,h.authorEmail=p,h.authMode=a||`token`,h.oauthProviderId=v,h.oauthClientId=y,h.oauthClientSecret=b,h.accessTokenExpiresAt=x,h.refreshToken=S,h.scopes=C,h.tokenType=w,h.oauthRefreshFailureCount=T,h.oauthReauthRequired=E,h.oauthReauthRequiredAt=D);await o(this.db,e.GIT_ACCOUNTS,this.accounts),this.hideAccountForm(),this.renderAccountList(),this.updateGitWarning(),l(m?`Account added`:`Account updated`,3e3)}catch(e){u(`Error saving account: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveGitSettings(){if(!this.db)return;let t=this.shadowRoot;if(t)try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n),r=t.querySelector(`[data-setting="git-proxy-public"]`),i=t.querySelector(`[data-setting="git-proxy-custom"]`),a=r?.checked?`public`:i?.checked?`custom`:`local`;if(await n(this.db,e.GIT_CORS_PROXY,a),a===`custom`){let e=t.querySelector(`[data-setting="git-proxy-url-input"]`)?.value.trim()||`/git-proxy`,{orchestratorStore:n}=await import(`./orchestrator-DrMg2dnI.js`).then(e=>e.n);await n.setGitProxyUrl(this.db,e)}let o=t.querySelector(`[data-setting="git-author-name-input"]`);o&&await n(this.db,e.GIT_AUTHOR_NAME,o.value.trim()||`ShadowClaw`);let s=t.querySelector(`[data-setting="git-author-email-input"]`);s&&await n(this.db,e.GIT_AUTHOR_EMAIL,s.value.trim()||`agent@example.com`),l(`Git settings saved`,3e3),this.updateGitWarning()}catch(e){u(`Error saving Git settings: `+(e instanceof Error?e.message:String(e)),6e3)}}async setDefaultAccount(t){if(this.db){this.defaultAccountId=t;try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.GIT_DEFAULT_ACCOUNT,t)}catch(e){console.warn(`Error setting default account:`,e)}this.renderAccountList(),l(`Default account updated`,3e3)}}async updateGitWarning(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="git-proxy-warning"]`);if(!t)return;let n=e.querySelector(`[data-setting="git-proxy-public"]`),r=this.accounts.some(e=>!!e.token);t.style.display=n?.checked&&r?`block`:`none`}};customElements.get(_)||customElements.define(_,x);export{x as ShadowClawGit};