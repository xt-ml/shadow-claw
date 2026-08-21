import{r as e,y as t}from"./config-64zJ5TLN.js";import{n}from"./txPromise-EBECky1b.js";import{t as r}from"./getConfig-D89uJgo5.js";import{d as i,h as a}from"./custom-element-security-MwgLnC6q.js";import{r as o,t as s}from"./toast-D3gxhZpN.js";import{t as c}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-card-BMtKXkEh.js";import"./shadow-claw-empty-state-CbZ2vrOx.js";function l(e){return!e||e.authMode===`token`||e.authMode===`token`?`token`:e.authMode===`basic`?`basic`:e.authMode===`oauth`||e.oauthProviderId||e.oauthClientId||e.oauthClientSecret||e.refreshToken||e.accessTokenExpiresAt||e.tokenType||e.oauthReauthRequired?`oauth`:`token`}const u=new CSSStyleSheet;u.replaceSync(`*,
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

.accounts-header {
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

.account-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

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

.oauth-connect-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.oauth-status {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
}

.oauth-connect-btn[disabled] {
  cursor: progress;
  opacity: 0.65;
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
`);const d=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <div class="accounts-header">
      <h3>🗂️ Non-Git Accounts</h3>
      <button class="add-btn" data-action="add-account">
        + Add Non-Git Account
      </button>
    </div>

    <div class="form-group">
      <div class="form-helper">
        Store personal access token accounts for external services like Figma or
        any other provider that grants PAT-based access to storage.
      </div>
    </div>

    <div data-region="account-form-slot"></div>
    <div class="account-list" data-region="account-list"></div>
  </div>
</template>
`,`text/html`),f=d.querySelector(`template`);let p=[];p=f?Array.from(f.content.children):Array.from(d.head.children).concat(Array.from(d.body.children));var m=p;const h=`shadow-claw-accounts`;var g=class extends c{static styles=u;static template=m;accounts=[];db=null;defaultAccountId=``;editingAccountId=null;pendingOauthResult=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await n(),await this.render(),this.bindEventListeners()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="add-account"]`)?.addEventListener(`click`,()=>this.showAccountForm(`new`)),e.querySelector(`[data-region="account-list"]`)?.addEventListener(`settings-action`,e=>{let{action:t,id:n}=e.detail||{action:``,id:``};n&&(t===`edit-account`?this.showAccountForm(n):t===`delete-account`?this.deleteAccount(n):t===`set-default`&&this.setDefaultAccount(n))}))}hideAccountForm(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="account-form-slot"]`);t&&t.replaceChildren()}renderAccountList(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="account-list"]`);if(!t)return;if(t.replaceChildren(),this.accounts.length===0){let e=document.createElement(`shadow-claw-empty-state`);e.setAttribute(`message`,`No additional accounts configured.`),e.setAttribute(`hint`,`Click '+ Add Non-Git Account' to get started.`),t.append(e);return}let n=document.createDocumentFragment();this.accounts.forEach(e=>{let t=e.id===this.defaultAccountId,r=!!e.token,i=l(e),a=i===`oauth`&&!!e.oauthReauthRequired,o=i===`oauth`?`OAuth${e.oauthProviderId?` (${e.oauthProviderId})`:``}`:i===`basic`?`Basic Auth`:`Token`,s=r?i===`oauth`?a?`Reconnect required`:`OAuth token saved`:`Token saved`:`No token`,c=`${e.service} · ${e.hostPattern} · ${o} · ${s}`,u=document.createElement(`shadow-claw-card`);u.setAttribute(`data-account-id`,e.id),u.setAttribute(`label`,e.label),u.setAttribute(`meta`,c),t&&(u.setAttribute(`highlight`,``),u.setAttribute(`badge`,`Default`));let d=document.createElement(`shadow-claw-actions`);d.setAttribute(`slot`,`actions`),d.setAttribute(`kind`,`account`),d.setAttribute(`item-id`,e.id),t&&d.setAttribute(`is-default`,``),u.append(d),n.append(u)}),t.append(n)}showAccountForm(e){let n=this.shadowRoot;if(!n)return;this.editingAccountId=e,this.pendingOauthResult=null;let r=e===`new`,o=r?null:this.accounts.find(t=>t.id===e),s=l(o||null),c=o?.oauthProviderId&&t[o.oauthProviderId]?o.oauthProviderId:`github`,u=o?.scopes?.join(` `)||``,d=Object.values(t).map(e=>`<option value="${e.id}"${e.id===c?` selected`:``}>${a(e.name)}</option>`).join(``),f=n.querySelector(`[data-region="account-form-slot"]`);f&&(i(f,`
      <div class="account-form">
        <h4>${r?`Add Account`:`Edit Account`}</h4>

        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-input" data-field="acct-label"
                 placeholder="e.g. Design Team Figma"
                 value="${a(o?.label||``)}" />
          <div class="form-helper">A friendly name to identify this account.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Service</label>
          <input type="text" class="form-input" data-field="acct-service"
                 placeholder="e.g. Figma"
                 value="${a(o?.service||``)}" />
          <div class="form-helper">The external service this token belongs to.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Host Pattern</label>
          <input type="text" class="form-input" data-field="acct-host"
                 placeholder="e.g. figma.com or api.figma.com"
                 value="${a(o?.hostPattern||``)}" />
          <div class="form-helper">Used to identify the service endpoint or host.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Auth Mode</label>
          <select class="form-input" data-field="acct-auth-mode">
            <option value="token"${s===`token`?` selected`:``}>Token (PAT)</option>
            <option value="basic"${s===`basic`?` selected`:``}>Basic Auth</option>
            <option value="oauth"${s===`oauth`?` selected`:``}>OAuth</option>
          </select>
          <div class="form-helper">Use Token for generic tokens, Basic for user/password, or OAuth for provider-managed access.</div>
        </div>

        <div class="oauth-fields" data-region="oauth-fields">
          <div class="form-group">
            <label class="form-label">OAuth Provider</label>
            <select class="form-input" data-field="acct-oauth-provider">${d}</select>
          </div>

          <div class="custom-mcp-oauth-fields" data-region="custom-mcp-oauth-fields">
            <div class="form-group">
              <label class="form-label">Authorize URL</label>
              <input type="text" class="form-input" data-field="acct-oauth-authorize-url" value="${a(o?.oauthCustomAuthorizeUrl||``)}" placeholder="https://example.com/oauth/authorize" />
              <div class="form-helper">The OAuth authorization endpoint of the MCP server.</div>
            </div>

            <div class="form-group">
              <label class="form-label">Token URL</label>
              <input type="text" class="form-input" data-field="acct-oauth-token-url" value="${a(o?.oauthCustomTokenUrl||``)}" placeholder="https://example.com/oauth/token" />
              <div class="form-helper">The OAuth token exchange endpoint of the MCP server.</div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <input type="checkbox" data-field="acct-oauth-use-pkce" ${o?.oauthCustomUsePkce===!1?``:`checked`} />
                Use PKCE (S256)
              </label>
              <div class="form-helper">Most servers require PKCE. Uncheck only if the server doesn't support it.</div>
            </div>

            <div class="form-group">
              <label class="form-label">Redirect URI</label>
              <input type="text" class="form-input" data-field="acct-oauth-redirect-uri" value="${a(o?.oauthCustomRedirectUri||``)}" placeholder="https://localhost/callback" />
              <div class="form-helper">Must match the redirect URI registered with the OAuth server. Leave blank to use default.</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client ID</label>
            <input type="text" class="form-input" data-field="acct-oauth-client-id" value="${a(o?.oauthClientId||``)}" placeholder="Enter provider OAuth app client ID" />
            <div class="form-helper">Required for OAuth connect. Register an OAuth app with the selected provider first.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Client Secret (if required)</label>
            <input type="password" class="form-input" data-field="acct-oauth-client-secret" placeholder="${o?.oauthClientSecret?`•••••••••••• (Saved)`:`Enter client secret if provider requires it`}" />
            <div class="form-helper">Stored encrypted locally. Needed by some providers for token exchange/refresh.</div>
          </div>

          <div class="form-group">
            <label class="form-label">OAuth Scope (if required)</label>
            <input type="text" class="form-input" data-field="acct-oauth-scope" value="${a(u)}" placeholder="space-separated scopes" />
            <div class="form-helper">Leave blank to use provider defaults.</div>
          </div>

          <div class="form-group oauth-connect-row">
            <button class="confirm-btn oauth-connect-btn" data-action="connect-oauth" type="button">Connect OAuth</button>
            <span class="oauth-status" data-region="oauth-status">${s===`oauth`&&o?.oauthReauthRequired?`Reconnect required`:s===`oauth`&&o?.token?`OAuth token already saved`:`Not connected`}</span>
          </div>
        </div>

        <div class="form-group" data-region="basic-username-field">
          <label class="form-label">Username or Email</label>
          <input type="text" class="form-input" data-field="acct-basic-username"
                 placeholder="e.g. user@example.com"
                 value="${a(o?.basicUsername||``)}" />
          <div class="form-helper">Required for Basic Auth.</div>
        </div>

        <div class="form-group" data-region="pat-fields">
          <label class="form-label" data-region="pat-label">Access Token</label>
          <input type="password" class="form-input" data-field="acct-token"
                 placeholder="${o?.token?`•••••••••••• (Saved)`:`Paste Token`}" />
          <div class="form-helper">Stored encrypted locally. Leave blank to keep the existing token.</div>
        </div>

        <div class="account-form-actions">
          <button class="confirm-btn" data-action="save-account">
            ${r?`Add Account`:`Update Account`}
          </button>
          <button class="cancel-btn" data-action="cancel-account-form">Cancel</button>
        </div>
      </div>`),f.querySelector(`[data-action="save-account"]`)?.addEventListener(`click`,()=>void this.saveAccountForm()),f.querySelector(`[data-action="cancel-account-form"]`)?.addEventListener(`click`,()=>this.hideAccountForm()),f.querySelector(`[data-field="acct-auth-mode"]`)?.addEventListener(`change`,()=>this.updateAuthModeVisibility(f)),f.querySelector(`[data-field="acct-oauth-provider"]`)?.addEventListener(`change`,()=>this.updateCustomMcpFieldsVisibility(f)),f.querySelector(`[data-action="connect-oauth"]`)?.addEventListener(`click`,()=>void this.connectOAuthFromForm(f)),this.updateAuthModeVisibility(f),this.updateCustomMcpFieldsVisibility(f))}updateAuthModeVisibility(e){let t=e.querySelector(`[data-field="acct-auth-mode"]`)?.value,n=t===`oauth`,r=t===`basic`,i=e.querySelector(`[data-region="oauth-fields"]`),a=e.querySelector(`[data-region="pat-fields"]`),o=e.querySelector(`[data-region="basic-username-field"]`),s=e.querySelector(`[data-region="pat-label"]`);i instanceof HTMLElement&&(i.style.display=n?`block`:`none`),a instanceof HTMLElement&&(a.style.display=n?`none`:`block`),s&&(s.textContent=r?`Password / API Token`:`Access Token`),o instanceof HTMLElement&&(o.style.display=r?`block`:`none`)}updateCustomMcpFieldsVisibility(e){let t=e.querySelector(`[data-field="acct-oauth-provider"]`)?.value===`custom_mcp`,n=e.querySelector(`[data-region="custom-mcp-oauth-fields"]`);n instanceof HTMLElement&&(n.style.display=t?`block`:`none`)}async connectOAuthFromForm(e){let n=e.querySelector(`[data-field="acct-oauth-provider"]`)?.value,r=e.querySelector(`[data-field="acct-oauth-client-id"]`)?.value.trim(),i=e.querySelector(`[data-field="acct-oauth-client-secret"]`)?.value.trim(),a=e.querySelector(`[data-field="acct-oauth-scope"]`)?.value.trim();if(!n){s(`OAuth provider is required.`,4e3);return}if(!r){s(`OAuth client ID is required.`,4e3);return}let c=e.querySelector(`[data-region="oauth-status"]`),l=e.querySelector(`[data-action="connect-oauth"]`);c&&(c.textContent=`Starting OAuth...`),l&&(l.disabled=!0);try{let s=a?a.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):void 0,l=n===`custom_mcp`,u=l?e.querySelector(`[data-field="acct-oauth-authorize-url"]`)?.value.trim():void 0,d=l?e.querySelector(`[data-field="acct-oauth-token-url"]`)?.value.trim():void 0,f=l?e.querySelector(`[data-field="acct-oauth-use-pkce"]`)?.checked:void 0,p=l?e.querySelector(`[data-field="acct-oauth-redirect-uri"]`)?.value.trim():void 0,m=t[n],h=l&&p?p:m?.redirectUri?m.redirectUri:`${window.location.origin}/oauth/callback`,g=await fetch(`/oauth/authorize`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({providerId:n,clientId:r,clientSecret:i||void 0,redirectUri:h,scope:s,...l&&u?{authorizeUrl:u}:{},...l&&d?{tokenUrl:d}:{},...l&&typeof f==`boolean`?{usePkce:f}:{}})}),_=await g.json();if(!g.ok||!_.state||!_.authorizeUrl)throw Error(_.error||`OAuth authorize failed`);window.open(_.authorizeUrl,`shadowclaw-oauth`,`popup=yes,width=540,height=720`);let v=_.state,y=`pending`;for(let e=0;e<60;e++){let e=await fetch(`/oauth/session/${encodeURIComponent(v)}`),t=await e.json();if(!e.ok)throw Error(t.error||`OAuth session not found`);if(y=t.status||`pending`,y===`authorized`)break;if(y===`error`)throw Error(t.error||`OAuth authorization failed`);await new Promise(e=>setTimeout(e,1e3))}if(y!==`authorized`)throw Error(`OAuth authorization timed out`);let b=await fetch(`/oauth/token`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({state:v})}),x=await b.json();if(!b.ok||!x.accessToken)throw Error(x.error||`OAuth token exchange failed`);this.pendingOauthResult={providerId:n,accessToken:x.accessToken,refreshToken:x.refreshToken,expiresAt:x.expiresIn?Date.now()+x.expiresIn*1e3:void 0,scope:x.scope,tokenType:x.tokenType},c&&(c.textContent=`OAuth connected`),o(`OAuth connected`,3e3)}catch(e){let t=e instanceof Error?e.message:String(e);c&&(c.textContent=`OAuth failed`),s(`OAuth connect failed: ${t}`,6e3)}finally{l&&(l.disabled=!1)}}async deleteAccount(t){if(this.db){this.accounts=this.accounts.filter(e=>e.id!==t),this.defaultAccountId===t&&(this.defaultAccountId=this.accounts[0]?.id||``);try{let{setConfig:t}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await t(this.db,e.SERVICE_ACCOUNTS,this.accounts),await t(this.db,e.SERVICE_DEFAULT_ACCOUNT,this.defaultAccountId)}catch(e){console.warn(`Error persisting account deletion:`,e)}this.renderAccountList(),o(`Account deleted`,3e3)}}async render(){if(!(!this.shadowRoot||!this.db))try{let t=await r(this.db,e.SERVICE_ACCOUNTS);this.accounts=Array.isArray(t)?t:[],this.defaultAccountId=await r(this.db,e.SERVICE_DEFAULT_ACCOUNT)||``,this.renderAccountList()}catch(e){console.warn(`Could not load service accounts:`,e)}}async saveAccountForm(){if(!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-region="account-form-slot"]`);if(!n)return;let r=n.querySelector(`[data-field="acct-label"]`)?.value.trim(),i=n.querySelector(`[data-field="acct-service"]`)?.value.trim(),a=n.querySelector(`[data-field="acct-host"]`)?.value.trim(),c=n.querySelector(`[data-field="acct-auth-mode"]`)?.value,l=n.querySelector(`[data-field="acct-basic-username"]`)?.value.trim();if(!r||!i||!a){s(`Label, Service, and Host Pattern are required.`,4e3);return}try{let{encryptValue:t}=await import(`./crypto-C8c5wMzN.js`).then(e=>e.t),{setConfig:u}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n),d=n.querySelector(`[data-field="acct-token"]`)?.value.trim(),f=this.editingAccountId===`new`,p=f?null:this.accounts.find(e=>e.id===this.editingAccountId),m=p?.token||``,h=p?.refreshToken,g=p?.accessTokenExpiresAt,_=p?.scopes,v=p?.tokenType,y=p?.oauthProviderId,b=p?.oauthClientId,x=p?.oauthClientSecret,S=p?.oauthRefreshFailureCount,C=p?.oauthReauthRequired,w=p?.oauthReauthRequiredAt,T=p?.oauthCustomAuthorizeUrl,E=p?.oauthCustomTokenUrl,D=p?.oauthCustomUsePkce,O=p?.oauthCustomRedirectUri;if(c===`oauth`){y=n.querySelector(`[data-field="acct-oauth-provider"]`)?.value,b=n.querySelector(`[data-field="acct-oauth-client-id"]`)?.value.trim();let e=n.querySelector(`[data-field="acct-oauth-client-secret"]`)?.value.trim(),r=n.querySelector(`[data-field="acct-oauth-scope"]`)?.value.trim(),i=r?r.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):void 0;if(!y){s(`OAuth provider is required for OAuth mode.`,4e3);return}if(!b){s(`OAuth client ID is required for OAuth mode.`,4e3);return}if(y===`custom_mcp`?(T=n.querySelector(`[data-field="acct-oauth-authorize-url"]`)?.value.trim()||void 0,E=n.querySelector(`[data-field="acct-oauth-token-url"]`)?.value.trim()||void 0,D=n.querySelector(`[data-field="acct-oauth-use-pkce"]`)?.checked,O=n.querySelector(`[data-field="acct-oauth-redirect-uri"]`)?.value.trim()||void 0):(T=void 0,E=void 0,D=void 0,O=void 0),e){let n=await t(e);n&&(x=n)}if(this.pendingOauthResult?.accessToken){let e=await t(this.pendingOauthResult.accessToken);if(e&&(m=e),this.pendingOauthResult.refreshToken){let e=await t(this.pendingOauthResult.refreshToken);e&&(h=e)}g=this.pendingOauthResult.expiresAt,_=this.pendingOauthResult.scope?this.pendingOauthResult.scope.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):i||_,v=this.pendingOauthResult.tokenType,S=0,C=!1,w=void 0}else _=i||_;if(!m){s(`Connect OAuth first to obtain an access token for this account.`,5e3);return}}else{if(d){let e=await t(d);e&&(m=e)}h=void 0,g=void 0,_=void 0,v=void 0,y=void 0,b=void 0,x=void 0,S=void 0,C=void 0,w=void 0,T=void 0,E=void 0,D=void 0,O=void 0}if(f){let{ulid:t}=await import(`./ulid-BY7rQVLN.js`).then(e=>e.n),n={id:t(),label:r,service:i,hostPattern:a,token:m,basicUsername:c===`basic`?l:void 0,authMode:c||`token`,oauthProviderId:y,oauthClientId:b,oauthClientSecret:x,accessTokenExpiresAt:g,refreshToken:h,scopes:_,tokenType:v,oauthRefreshFailureCount:S,oauthReauthRequired:C,oauthReauthRequiredAt:w,oauthCustomAuthorizeUrl:T,oauthCustomTokenUrl:E,oauthCustomUsePkce:D,oauthCustomRedirectUri:O};this.accounts.push(n),this.accounts.length===1&&(this.defaultAccountId=n.id,await u(this.db,e.SERVICE_DEFAULT_ACCOUNT,n.id))}else p&&(p.label=r,p.service=i,p.hostPattern=a,p.token=m,p.basicUsername=c===`basic`?l:void 0,p.authMode=c||`token`,p.oauthProviderId=y,p.oauthClientId=b,p.oauthClientSecret=x,p.accessTokenExpiresAt=g,p.refreshToken=h,p.scopes=_,p.tokenType=v,p.oauthRefreshFailureCount=S,p.oauthReauthRequired=C,p.oauthReauthRequiredAt=w,p.oauthCustomAuthorizeUrl=T,p.oauthCustomTokenUrl=E,p.oauthCustomUsePkce=D,p.oauthCustomRedirectUri=O);await u(this.db,e.SERVICE_ACCOUNTS,this.accounts),this.hideAccountForm(),this.renderAccountList(),o(f?`Account added`:`Account updated`,3e3)}catch(e){s(`Error saving account: `+(e instanceof Error?e.message:String(e)),6e3)}}async setDefaultAccount(t){if(this.db){this.defaultAccountId=t;try{let{setConfig:n}=await import(`./setConfig-DFMYnYLE.js`).then(e=>e.n);await n(this.db,e.SERVICE_DEFAULT_ACCOUNT,t)}catch(e){console.warn(`Error setting default account:`,e)}this.renderAccountList(),o(`Default account updated`,3e3)}}};customElements.get(h)||customElements.define(h,g);export{g as ShadowClawAccounts};