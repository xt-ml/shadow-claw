import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{d as r}from"./custom-element-security-MwgLnC6q.js";import{t as i}from"./setConfig-DFMYnYLE.js";import{t as a}from"./ulid-BY7rQVLN.js";import{r as o}from"./crypto-C8c5wMzN.js";import{a as s,i as c,n as l,o as u,s as d,t as f}from"./connections-Cjo0j-GM.js";import{r as p,t as m}from"./toast-D3gxhZpN.js";import{t as h}from"./shadow-claw-element-na_3JW5e.js";function g(e){if(e.authMode===`oauth`){let t=(e.pendingOauthAccessToken||``).trim();return t?{authType:`oauth`,accessToken:t}:{error:`OAuth access token is missing. Click Connect OAuth first (or save and reconnect).`}}let t=(e.passwordInput||``).trim();return t?{authType:`basic_userpass`,password:t}:{error:`Password/app password is missing. Enter it to test this connection.`}}const _=new CSSStyleSheet;_.replaceSync(`*,
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

.integrations-header {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  margin-bottom: 0.75rem;
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
  margin-bottom: 0.75rem;
}

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  line-height: 1.45;
}

.connection-form {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.875rem;
}

.connection-form h4 {
  font-size: 0.92rem;
  margin: 0 0 0.6rem;
}

.form-row {
  margin-bottom: 0.6rem;
}

.form-row label {
  color: var(--shadow-claw-text-primary);
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.form-row input,
.form-row select,
.form-row textarea {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.55rem;
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-size: 0.82rem;
  padding: 0.5rem 0.6rem;
  width: 100%;
}

.form-row textarea {
  min-height: 4.5rem;
  resize: vertical;
}

.checkbox-row {
  margin-top: 0.15rem;
}

.checkbox-inline {
  align-items: center;
  cursor: pointer;
  display: inline-flex;
  gap: 0.5rem;
  margin: 0;
}

.checkbox-inline input[type="checkbox"] {
  width: auto;
}

.checkbox-inline span {
  color: var(--shadow-claw-text-primary);
  font-size: 0.8rem;
  font-weight: 500;
}

.readonly-field {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.55rem;
  color: var(--shadow-claw-text-secondary);
  font-size: 0.82rem;
  padding: 0.5rem 0.6rem;
}

.imap-setup-card {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-primary) 80%,
    transparent
  );
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.65rem;
  margin-bottom: 0.75rem;
  padding: 0.6rem;
}

.oauth-auth-card {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-primary) 80%,
    transparent
  );
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.65rem;
  margin-bottom: 0.75rem;
  padding: 0.6rem;
}

.imap-setup-title {
  color: var(--shadow-claw-text-primary);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 0.45rem;
}

.imap-setup-row {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: 1fr auto;
}

.imap-setup-help {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.73rem;
  margin-top: 0.4rem;
}

.oauth-connect-row {
  align-items: center;
  display: flex;
  gap: 0.55rem;
}

.oauth-status {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.76rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.6rem;
}

.connection-list {
  display: grid;
  gap: 0.6rem;
}

.connection-card {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.75rem;
  padding: 0.75rem;
}

.connection-card header {
  align-items: baseline;
  display: flex;
  gap: 0.4rem;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.connection-title {
  color: var(--shadow-claw-text-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.connection-meta {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
}

.connection-badge {
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
}

.connection-badge.enabled {
  background: color-mix(
    in srgb,
    var(--shadow-claw-success, #0a7f2e) 18%,
    transparent
  );
  color: var(--shadow-claw-success, #0a7f2e);
}

.connection-badge.disabled {
  background: color-mix(
    in srgb,
    var(--shadow-claw-text-tertiary) 20%,
    transparent
  );
  color: var(--shadow-claw-text-secondary);
}

.connection-actions {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.btn,
.add-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 999px;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: 0.73rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
}

.btn.secondary {
  background: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-primary);
}

.empty {
  border: 0.0625rem dashed var(--shadow-claw-border-color);
  border-radius: 0.7rem;
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.8rem;
  padding: 0.9rem;
  text-align: center;
}
`);const v=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <div class="integrations-header">
      <h3>📧 Email</h3>
      <button class="add-btn" data-action="add-connection">
        + Add Email Connection
      </button>
    </div>

    <div class="form-group">
      <div class="form-helper">
        Configure email connections for agent read/send capabilities with
        auto-filled IMAP and SMTP defaults. Use your provider app password when
        required.
      </div>
    </div>

    <div class="connection-form" data-region="connection-form" hidden></div>
    <div class="connection-list" data-region="connection-list"></div>
  </div>
</template>
`,`text/html`),y=v.querySelector(`template`);let b=[];b=y?Array.from(y.content.children):Array.from(v.head.children).concat(Array.from(v.body.children));var x=b;const S=`shadow-claw-integrations`,C={google:{id:`google`,label:`Gmail (Google OAuth)`,serviceName:`Google`,hostPattern:`gmail.com`,defaultScopes:[`https://mail.google.com/`],scopePlaceholder:`https://mail.google.com/`,scopeHelpText:`Use https://mail.google.com/ for Gmail IMAP/SMTP access.`,connectButtonLabel:`Connect Google OAuth`},microsoft_graph:{id:`microsoft_graph`,label:`Microsoft (Outlook / M365 OAuth)`,serviceName:`Microsoft`,hostPattern:`outlook.office365.com`,defaultScopes:[`offline_access`,`https://outlook.office.com/IMAP.AccessAsUser.All`,`https://outlook.office.com/SMTP.Send`],scopePlaceholder:`offline_access https://outlook.office.com/IMAP.AccessAsUser.All https://outlook.office.com/SMTP.Send`,scopeHelpText:`For Outlook/M365 IMAP+SMTP, include offline_access plus IMAP.AccessAsUser.All and SMTP.Send scopes.`,connectButtonLabel:`Connect Microsoft OAuth`},yahoo_mail:{id:`yahoo_mail`,label:`Yahoo Mail OAuth`,serviceName:`Yahoo`,hostPattern:`mail.yahoo.com`,defaultScopes:[`mail-r`,`mail-w`],scopePlaceholder:`mail-r mail-w`,scopeHelpText:`Yahoo commonly uses mail-r and mail-w scopes for IMAP/SMTP style access.`,connectButtonLabel:`Connect Yahoo OAuth`}},w={gmail:{imapHost:`imap.gmail.com`,imapPort:993,imapSecure:!0,smtpHost:`smtp.gmail.com`,smtpPort:465,smtpSecure:!0},outlook:{imapHost:`outlook.office365.com`,imapPort:993,imapSecure:!0,smtpHost:`smtp.office365.com`,smtpPort:587,smtpSecure:!1},yahoo:{imapHost:`imap.mail.yahoo.com`,imapPort:993,imapSecure:!0,smtpHost:`smtp.mail.yahoo.com`,smtpPort:465,smtpSecure:!0},icloud:{imapHost:`imap.mail.me.com`,imapPort:993,imapSecure:!0,smtpHost:`smtp.mail.me.com`,smtpPort:587,smtpSecure:!1},fastmail:{imapHost:`imap.fastmail.com`,imapPort:993,imapSecure:!0,smtpHost:`smtp.fastmail.com`,smtpPort:465,smtpSecure:!0}},T={host:`IMAP host`,port:`IMAP port`,secure:`IMAP TLS`,mailboxPath:`Mailbox path`,smtpHost:`SMTP host`,smtpPort:`SMTP port`,smtpSecure:`SMTP TLS`,fromAddress:`From address`,executionMode:`Execution mode`,pollIntervalSec:`Poll interval (seconds)`},E={host:`imap.example.com`,port:`993`,mailboxPath:`INBOX`,smtpHost:`smtp.example.com`,smtpPort:`465`,fromAddress:`you@example.com`,pollIntervalSec:`300`};var D=class extends h{static styles=_;static template=x;accounts=[];connections=[];db=null;editingConnectionId=null;manifests=[];pendingOauthResult=null;async connectedCallback(){this.db=await t(),this.bindEventListeners(),await this.reload()}applyImapPreset(e){let t=e.querySelector(`#int-imap-preset`),n=e.querySelector(`#int-username`),r=t?.value||`auto`,i=this.resolveImapPreset(r,n?.value||``);if(!i){m(`Could not auto-detect IMAP settings from this email domain. Choose a preset or enter settings manually.`,5e3);return}this.setConfigFieldValue(e,`host`,i.imapHost),this.setConfigFieldValue(e,`port`,String(i.imapPort)),this.setConfigFieldValue(e,`secure`,String(i.imapSecure)),this.setConfigFieldValue(e,`smtpHost`,i.smtpHost),this.setConfigFieldValue(e,`smtpPort`,String(i.smtpPort)),this.setConfigFieldValue(e,`smtpSecure`,String(i.smtpSecure));let a=(n?.value||``).trim();a&&this.setConfigFieldValue(e,`fromAddress`,a);let o=e.querySelector(`#cfg-mailboxPath`);o&&!o.value.trim()&&(o.value=`INBOX`),p(`Applied IMAP preset defaults`,2500)}bindEventListeners(){let e=this.shadowRoot;e&&e.querySelector(`[data-action="add-connection"]`)?.addEventListener(`click`,()=>this.showForm(null))}escapeHtml(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/\"/g,`&quot;`).replace(/'/g,`&#39;`)}getEmailOAuthProvider(e){return e&&C[e]?C[e]:C.google}getInitialPluginId(e){return e?.pluginId?e.pluginId:this.manifests.some(e=>e.id===`imap`)?`imap`:this.manifests[0]?.id||``}renderConfigFieldRows(e,t){return e.configurableFields.map(n=>{let r=t[n],i=e.id===`imap`?T[n]??n:n;if(n===`secure`||n===`smtpSecure`){let e=typeof r!=`boolean`||r;return`
            <div class="form-row">
              <label for="cfg-${this.escapeHtml(n)}">${this.escapeHtml(i)}</label>
              <select id="cfg-${this.escapeHtml(n)}" data-config-field="${this.escapeHtml(n)}">
                <option value="true" ${e?`selected`:``}>enabled</option>
                <option value="false" ${e?``:`selected`}>disabled</option>
              </select>
            </div>
          `}let a=e.id===`imap`?E[n]??``:``;return`
          <div class="form-row">
            <label for="cfg-${this.escapeHtml(n)}">${this.escapeHtml(i)}</label>
            <input
              id="cfg-${this.escapeHtml(n)}"
              data-config-field="${this.escapeHtml(n)}"
              value="${this.escapeHtml(typeof r==`string`||typeof r==`number`||typeof r==`boolean`?String(r):``)}"
              placeholder="${this.escapeHtml(a)}"
            />
          </div>
        `}).join(``)}renderConnectionList(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-region="connection-list"]`);if(!t)return;if(t.replaceChildren(),!this.connections.length){let e=document.createElement(`div`);e.className=`empty`,e.textContent=`No email connections configured. Click Add Email Connection to start.`,t.append(e);return}let n=document.createDocumentFragment();for(let e of this.connections){let t=u(e.pluginId),i=document.createElement(`article`);i.className=`connection-card`;let a=typeof e.config.executionMode==`string`?e.config.executionMode:`manual`,o=typeof e.config.pollIntervalSec==`number`?e.config.pollIntervalSec:null,s=!!e.credentialRef?.encryptedSecret||e.credentialRef?.authType===`oauth`&&!!e.credentialRef?.accountId;r(i,`
        <header>
          <div>
            <div class="connection-title">${this.escapeHtml(e.label)}</div>
            <div class="connection-meta">
              ${this.escapeHtml(e.pluginId)}${t?` · ${this.escapeHtml(t.name)}`:``}
            </div>
          </div>
          <span class="connection-badge ${e.enabled?`enabled`:`disabled`}">
            ${e.enabled?`Enabled`:`Disabled`}
          </span>
        </header>
        <div class="connection-meta">Mode: ${this.escapeHtml(String(a))}${o?` · Poll: ${o}s`:``}${s?` · Auth: configured`:` · Auth: missing`}</div>
        <div class="connection-actions">
          <button class="btn secondary" data-action="edit" data-id="${this.escapeHtml(e.id)}">Edit</button>
          <button class="btn secondary" data-action="toggle" data-id="${this.escapeHtml(e.id)}">${e.enabled?`Disable`:`Enable`}</button>
          <button class="btn secondary" data-action="delete" data-id="${this.escapeHtml(e.id)}">Delete</button>
        </div>
      `),i.querySelectorAll(`button[data-action]`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.action,n=e.dataset.id;!t||!n||(t===`edit`?this.showForm(n):t===`toggle`?this.toggleConnection(n):t===`delete`&&this.deleteConnection(n))})}),n.append(i)}t.append(n)}resolveImapPreset(e,t){if(e!==`auto`)return w[e]||null;let n=t.split(`@`)[1]?.trim().toLowerCase()||``;return n?n===`gmail.com`||n.endsWith(`.gmail.com`)||n.endsWith(`.googlemail.com`)?w.gmail:n===`outlook.com`||n===`hotmail.com`||n===`live.com`||n===`msn.com`||n.endsWith(`.onmicrosoft.com`)?w.outlook:n===`yahoo.com`||n.endsWith(`.yahoo.com`)?w.yahoo:n===`icloud.com`||n===`me.com`||n===`mac.com`?w.icloud:n===`fastmail.com`||n.endsWith(`.fastmail.com`)?w.fastmail:null:null}setConfigFieldValue(e,t,n){let r=e.querySelector(`#cfg-${t}`);r&&(r.value=n)}showForm(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-region="connection-form"]`);if(!n)return;this.editingConnectionId=e;let i=e&&this.connections.find(t=>t.id===e)||null,a=this.getInitialPluginId(i),o=u(a),s=i?.config||{},c=i?.credentialRef?.accountId&&this.accounts.find(e=>e.id===i.credentialRef?.accountId)||null,l=typeof s.executionMode==`string`?String(s.executionMode):`manual`,d=typeof s.pollIntervalSec==`number`?s.pollIntervalSec:300,f=i?.credentialRef?.authType===`oauth`?`oauth`:`basic_userpass`,p=i?.credentialRef?.providerId||c?.oauthProviderId||`google`,m=this.getEmailOAuthProvider(p),h=c?.oauthClientId||``,g=c?.scopes?.join(` `)||m.defaultScopes.join(` `),_=f===`oauth`?c?.oauthReauthRequired?`Reconnect required`:c?.token?`OAuth token already saved`:`Not connected`:`Not connected`,v=a===`imap`;r(n,`
      <h4>${i?`Edit Email Connection`:`Add Email Connection`}</h4>
      <div class="form-row">
        <label for="int-label">Label</label>
        <input id="int-label" value="${this.escapeHtml(i?.label||``)}" />
      </div>
      <div class="form-row">
        <label for="int-mode">Execution mode</label>
        <select id="int-mode">
          <option value="manual" ${l===`manual`?`selected`:``}>manual</option>
          <option value="scheduled" ${l===`scheduled`?`selected`:``}>scheduled</option>
          <option value="event-driven" ${l===`event-driven`?`selected`:``}>event-driven</option>
        </select>
      </div>
      <div class="form-row">
        <label for="int-poll">Poll interval (seconds)</label>
        <input id="int-poll" type="number" min="5" value="${this.escapeHtml(String(d))}" />
      </div>
      <div class="form-row checkbox-row">
        <label class="checkbox-inline" for="int-unread-only">
          <input id="int-unread-only" type="checkbox" ${s.unreadOnly===!0?`checked`:``} />
          <span>Get unread email only</span>
        </label>
      </div>
      <div class="form-row">
        <label for="int-username">Auth username (email login)</label>
        <input id="int-username" value="${this.escapeHtml(i?.credentialRef?.username||``)}" placeholder="user@example.com" />
      </div>
      <div class="form-row">
        <label for="int-auth-mode">Authentication</label>
        <select id="int-auth-mode">
          <option value="basic_userpass" ${f===`basic_userpass`?`selected`:``}>App password / password</option>
          <option value="oauth" ${f===`oauth`?`selected`:``}>OAuth</option>
        </select>
      </div>
      <div data-region="password-auth-fields">
      <div class="form-row">
        <label for="int-password">Auth password / app password</label>
        <input id="int-password" type="password" placeholder="${i?.credentialRef?.encryptedSecret?`•••••••••••• (Saved)`:`Enter password`}" />
      </div>
      </div>
      <div class="oauth-auth-card" data-region="oauth-auth-fields">
        <div class="imap-setup-title">Email OAuth</div>
        <div class="form-row">
          <label for="int-oauth-provider">OAuth provider</label>
          <select id="int-oauth-provider">
            ${Object.values(C).map(e=>`<option value="${this.escapeHtml(e.id)}" ${e.id===m.id?`selected`:``}>${this.escapeHtml(e.label)}</option>`).join(``)}
          </select>
        </div>
        <div class="form-row">
          <label for="int-oauth-client-id">OAuth client ID</label>
          <input id="int-oauth-client-id" value="${this.escapeHtml(h)}" placeholder="Enter OAuth client ID" />
        </div>
        <div class="form-row">
          <label for="int-oauth-client-secret">OAuth client secret</label>
          <input id="int-oauth-client-secret" type="password" placeholder="${c?.oauthClientSecret?`•••••••••••• (Saved)`:`Enter client secret if required`}" />
        </div>
        <div class="form-row">
          <label for="int-oauth-scope">OAuth scope</label>
          <input id="int-oauth-scope" value="${this.escapeHtml(g)}" placeholder="${this.escapeHtml(m.scopePlaceholder)}" />
          <div class="imap-setup-help" data-region="oauth-scope-help">${this.escapeHtml(m.scopeHelpText)}</div>
        </div>
        <div class="oauth-connect-row">
          <button class="btn secondary" type="button" data-action="connect-oauth">${this.escapeHtml(m.connectButtonLabel)}</button>
          <span class="oauth-status" data-region="oauth-status">${this.escapeHtml(_)}</span>
        </div>
      </div>
      ${v?`<div class="imap-setup-card">
               <div class="imap-setup-title">Quick IMAP Setup</div>
               <div class="imap-setup-row">
                 <select id="int-imap-preset">
                   <option value="auto" selected>Auto-detect from login email</option>
                   <option value="gmail">Gmail / Google Workspace</option>
                   <option value="outlook">Outlook / Microsoft 365</option>
                   <option value="yahoo">Yahoo</option>
                   <option value="icloud">iCloud</option>
                   <option value="fastmail">Fastmail</option>
                 </select>
                 <button class="btn secondary" type="button" data-action="imap-autofill">Autofill</button>
               </div>
               <div class="imap-setup-help">Uses common provider defaults. You can still override any field below.</div>
             </div>`:``}

      ${o?this.renderConfigFieldRows(o,s):``}

      <div class="form-row">
        <label for="int-extra-config">Extra config JSON (optional)</label>
        <textarea id="int-extra-config" placeholder='{"mailboxPath":"INBOX"}'></textarea>
      </div>
      <div class="form-actions">
        <button class="btn secondary" data-action="cancel">Cancel</button>
        <button class="btn secondary" data-action="test-connection">Test Connection</button>
        <button class="btn" data-action="save">Save</button>
      </div>
    `);let y=n;y.hidden=!1,this.pendingOauthResult=null,n.querySelector(`#int-auth-mode`)?.addEventListener(`change`,()=>this.updateAuthModeVisibility(n)),n.querySelector(`[data-action="imap-autofill"]`)?.addEventListener(`click`,()=>this.applyImapPreset(n)),n.querySelector(`[data-action="connect-oauth"]`)?.addEventListener(`click`,()=>void this.connectOAuthFromForm(n)),n.querySelector(`#int-oauth-provider`)?.addEventListener(`change`,()=>this.updateOAuthProviderHelp(n)),n.querySelector(`[data-action="cancel"]`)?.addEventListener(`click`,()=>{y.hidden=!0,y.replaceChildren(),this.editingConnectionId=null}),n.querySelector(`[data-action="save"]`)?.addEventListener(`click`,()=>{this.saveForm()}),n.querySelector(`[data-action="test-connection"]`)?.addEventListener(`click`,()=>{this.testConnectionFromForm(n)}),this.updateAuthModeVisibility(n),this.updateOAuthProviderHelp(n)}updateAuthModeVisibility(e){let t=e.querySelector(`#int-auth-mode`)?.value,n=e.querySelector(`[data-region="password-auth-fields"]`),r=e.querySelector(`[data-region="oauth-auth-fields"]`);n&&(n.style.display=t===`oauth`?`none`:`block`),r&&(r.style.display=t===`oauth`?`block`:`none`)}updateOAuthProviderHelp(e){let t=e.querySelector(`#int-oauth-provider`)?.value,n=this.getEmailOAuthProvider(t),r=e.querySelector(`#int-oauth-scope`),i=e.querySelector(`[data-region="oauth-scope-help"]`),a=e.querySelector(`[data-action="connect-oauth"]`);r&&(r.placeholder=n.scopePlaceholder,r.value.trim()||(r.value=n.defaultScopes.join(` `))),i&&(i.textContent=n.scopeHelpText),a&&(a.textContent=n.connectButtonLabel)}async buildCredentialRef(e,t){let n=e.querySelector(`#int-auth-mode`)?.value,r=e.querySelector(`#int-username`),i=e.querySelector(`#int-password`),a=r?.value.trim()||``,s=i?.value.trim()||``,c=this.connections.find(e=>e.id===t.id);if(n===`oauth`){if(!a)throw Error(`Email login address is required for OAuth authentication.`);let n=await this.upsertLinkedOAuthAccount(e,t);return{serviceType:`http_api`,authType:`oauth`,providerId:n.oauthProviderId||`google`,accountId:n.id,username:a}}let l;if(s){if(l=await o(s)||void 0,!l)throw Error(`Could not encrypt email password.`)}else l=c?.credentialRef?.encryptedSecret;if(!a&&!l)return null;if(!a)throw Error(`Auth username is required when a password is configured.`);if(!l)throw Error(`Auth password is required when username is configured.`);return{serviceType:`http_api`,authType:`basic_userpass`,username:a,encryptedSecret:l}}async connectOAuthFromForm(e){let t=e.querySelector(`#int-oauth-provider`)?.value,n=this.getEmailOAuthProvider(t),r=e.querySelector(`#int-oauth-client-id`)?.value.trim(),i=e.querySelector(`#int-oauth-client-secret`)?.value.trim(),a=e.querySelector(`#int-oauth-scope`)?.value.trim(),o=e.querySelector(`[data-region="oauth-status"]`),s=e.querySelector(`[data-action="connect-oauth"]`);if(!r){m(`OAuth client ID is required.`,4e3);return}o&&(o.textContent=`Starting OAuth...`),s&&(s.disabled=!0);try{let e=a?a.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):n.defaultScopes,t=`${window.location.origin}/oauth/callback`,s=await fetch(`/oauth/authorize`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({providerId:n.id,clientId:r,clientSecret:i||void 0,redirectUri:t,scope:e,extraAuthorizeParams:{access_type:`offline`,prompt:`consent`}})}),c=await s.json();if(!s.ok||!c.state||!c.authorizeUrl)throw Error(c.error||`OAuth authorize failed`);window.open(c.authorizeUrl,`shadowclaw-google-oauth`,`popup=yes,width=540,height=720`);let l=c.state,u=`pending`;for(let e=0;e<60;e++){let e=await fetch(`/oauth/session/${encodeURIComponent(l)}`),t=await e.json();if(!e.ok)throw Error(t.error||`OAuth session not found`);if(u=t.status||`pending`,u===`authorized`)break;if(u===`error`)throw Error(t.error||`OAuth authorization failed`);await new Promise(e=>setTimeout(e,1e3))}if(u!==`authorized`)throw Error(`OAuth authorization timed out`);let d=await fetch(`/oauth/token`,{method:`POST`,headers:{"content-type":`application/json`},body:JSON.stringify({state:l})}),f=await d.json();if(!d.ok||!f.accessToken)throw Error(f.error||`OAuth token exchange failed`);this.pendingOauthResult={providerId:n.id,accessToken:f.accessToken,refreshToken:f.refreshToken,expiresAt:f.expiresIn?Date.now()+f.expiresIn*1e3:void 0,scope:f.scope,tokenType:f.tokenType},o&&(o.textContent=`OAuth connected`),p(`${n.label} connected`,3e3)}catch(e){let t=e instanceof Error?e.message:String(e);o&&(o.textContent=`OAuth failed`),m(`${n.label} connect failed: ${t}`,6e3)}finally{s&&(s.disabled=!1)}}async deleteConnection(e){if(!this.db)return;let t=this.connections.find(t=>t.id===e);if(t&&await this.requestConfirmation({title:`Delete Email Connection`,message:`Delete email connection \"${t.label}\"?`,confirmLabel:`Delete`,cancelLabel:`Cancel`}))try{if(!await l(this.db,e)){m(`Failed to delete email connection.`,5e3);return}p(`Email connection deleted`,2500),await this.reload()}catch(e){m(`Failed to delete email connection: ${e instanceof Error?e.message:String(e)}`,6e3)}}async reload(){if(!this.db)return;this.manifests=d().filter(e=>e.id===`imap`),this.connections=await c(this.db);let t=await n(this.db,e.SERVICE_ACCOUNTS);this.accounts=Array.isArray(t)?t:[],this.renderConnectionList()}async requestConfirmation(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog({mode:`confirm`,...e}):!1}async saveForm(){let e=this.shadowRoot;if(!e||!this.db)return;let t=e.querySelector(`[data-region="connection-form"]`);if(!t)return;let n=t.querySelector(`#int-label`),r=t.querySelector(`#int-mode`),i=t.querySelector(`#int-poll`),a=t.querySelector(`#int-extra-config`);if(!n||!r||!i)return;let o=n.value.trim(),c=this.getInitialPluginId(null);if(!o||!c){m(`Label is required.`,4e3);return}let l={executionMode:r.value},u=Number(i.value);Number.isFinite(u)&&u>0&&(l.pollIntervalSec=Math.floor(u)),l.unreadOnly=t.querySelector(`#int-unread-only`)?.checked===!0,t.querySelectorAll(`[data-config-field]`).forEach(e=>{let t=e.dataset.configField;if(!t)return;let n=e.value.trim();n&&(/^\d+$/.test(n)?l[t]=Number(n):n===`true`||n===`false`?l[t]=n===`true`:l[t]=n)});let d=a?.value.trim()||``;if(d)try{let e=JSON.parse(d);e&&typeof e==`object`&&Object.assign(l,e)}catch{m(`Extra config JSON is invalid.`,5e3);return}try{let e=await s(this.db,{id:this.editingConnectionId||void 0,label:o,pluginId:c,config:l}),n=await this.buildCredentialRef(t,e);await f(this.db,e.id,n),p(this.editingConnectionId?`Email connection updated`:`Email connection created`,3e3),t.hidden=!0,t.replaceChildren(),this.editingConnectionId=null,await this.reload()}catch(e){m(`Failed to save email connection: ${e instanceof Error?e.message:String(e)}`,6e3)}}async testConnectionFromForm(e){let t=e.querySelector(`[data-action="test-connection"]`);t&&(t.disabled=!0);try{let t=e.querySelector(`#int-username`)?.value.trim(),n=e.querySelector(`#cfg-host`)?.value.trim(),r=e.querySelector(`#cfg-mailboxPath`)?.value.trim()||`INBOX`,i=e.querySelector(`#cfg-port`)?.value.trim(),a=e.querySelector(`#cfg-secure`)?.value,o=e.querySelector(`#int-unread-only`)?.checked,s=e.querySelector(`#int-auth-mode`)?.value;if(!t){m(`Auth username (email login) is required.`,4e3);return}if(!n){m(`IMAP host is required.`,4e3);return}let c=Number(i),l=Number.isFinite(c)&&c>0?c:993,u=a!==`false`,d=`basic_userpass`,f,h,_=this.editingConnectionId?this.connections.find(e=>e.id===this.editingConnectionId):null;if(s===`oauth`){let t=e.querySelector(`#int-oauth-provider`)?.value,n=g({authMode:s,pendingOauthAccessToken:this.pendingOauthResult?.accessToken&&(!t||this.pendingOauthResult.providerId===t)?this.pendingOauthResult.accessToken:``,hasStoredOauthCredential:!!_?.credentialRef?.accountId});if(`error`in n){m(n.error,6e3);return}d=n.authType,n.authType===`oauth`&&(h=n.accessToken)}else{let t=e.querySelector(`#int-password`)?.value,n=g({authMode:s,passwordInput:t,hasStoredPasswordCredential:!!_?.credentialRef?.encryptedSecret});if(`error`in n){m(n.error,6e3);return}d=n.authType,n.authType===`basic_userpass`&&(f=n.password)}let v=await fetch(`/integrations/email/read`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({authType:d,host:n,port:l,secure:u,username:t,password:f,accessToken:h,mailboxPath:r,limit:1,unreadOnly:o===!0})}),y=await v.json().catch(()=>({}));if(!v.ok){m(`Connection test failed (${v.status}): ${y.error||v.statusText}`,7e3);return}p(`Connection test passed. IMAP login succeeded${typeof y.count==`number`?` (${y.count} messages returned).`:`.`}`,4500)}catch(e){m(`Connection test failed: ${e instanceof Error?e.message:String(e)}`,7e3)}finally{t&&(t.disabled=!1)}}async toggleConnection(e){if(!this.db)return;let t=this.connections.find(t=>t.id===e);if(!t){m(`Email connection not found.`,4e3);return}try{await s(this.db,{id:t.id,label:t.label,pluginId:t.pluginId,enabled:!t.enabled,config:t.config}),p(`Email ${t.enabled?`disabled`:`enabled`}`,2500),await this.reload()}catch(e){m(`Failed to update email connection: ${e instanceof Error?e.message:String(e)}`,6e3)}}async upsertLinkedOAuthAccount(t,n){if(!this.db)throw Error(`Database is not ready.`);let r=t.querySelector(`#int-username`)?.value.trim(),s=t.querySelector(`#int-oauth-client-id`)?.value.trim(),c=t.querySelector(`#int-oauth-client-secret`)?.value.trim(),l=t.querySelector(`#int-oauth-scope`)?.value.trim(),u=t.querySelector(`#int-oauth-provider`)?.value,d=this.getEmailOAuthProvider(u);if(!r)throw Error(`Email login address is required for OAuth authentication.`);if(!s)throw Error(`OAuth client ID is required for OAuth authentication.`);let f=this.connections.find(e=>e.id===n.id)?.credentialRef?.accountId,p=f&&this.accounts.find(e=>e.id===f)||null,m=p?.token||``,h=p?.refreshToken,g=p?.accessTokenExpiresAt,_=p?.scopes,v=p?.tokenType,y=p?.oauthClientSecret,b=p?.oauthRefreshFailureCount,x=p?.oauthReauthRequired,S=p?.oauthReauthRequiredAt;if(c){let e=await o(c);e&&(y=e)}if(this.pendingOauthResult?.accessToken){let e=await o(this.pendingOauthResult.accessToken);if(!e)throw Error(`Failed to encrypt OAuth access token.`);if(m=e,this.pendingOauthResult.refreshToken){let e=await o(this.pendingOauthResult.refreshToken);e&&(h=e)}g=this.pendingOauthResult.expiresAt,_=this.pendingOauthResult.scope?this.pendingOauthResult.scope.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):l?l.split(/[\s,]+/).map(e=>e.trim()).filter(Boolean):d.defaultScopes,v=this.pendingOauthResult.tokenType,b=0,x=!1,S=void 0}if(!m)throw Error(`Connect OAuth first to obtain an access token.`);let C=p?.id||a(),w={id:C,label:`${n.label} ${d.label}`,service:d.serviceName,hostPattern:d.hostPattern,token:m,authMode:`oauth`,oauthProviderId:d.id,oauthClientId:s,oauthClientSecret:y,accessTokenExpiresAt:g,refreshToken:h,scopes:_||d.defaultScopes,tokenType:v,oauthRefreshFailureCount:b,oauthReauthRequired:x,oauthReauthRequiredAt:S},T=[...this.accounts],E=T.findIndex(e=>e.id===C);return E===-1?T.push(w):T[E]=w,await i(this.db,e.SERVICE_ACCOUNTS,T),this.accounts=T,w}};customElements.get(S)||customElements.define(S,D);export{D as ShadowClawIntegrations};