import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{d as r}from"./custom-element-security-MwgLnC6q.js";import{Jt as i,Yt as a,t as o,yn as s}from"./orchestrator-DrMg2dnI.js";import{t as c}from"./setConfig-DFMYnYLE.js";import{a as l,r as u,t as d}from"./toast-D3gxhZpN.js";import{t as f}from"./shadow-claw-element-na_3JW5e.js";import{t as p}from"./effect-BEsuusE8.js";async function m(){try{if(typeof navigator<`u`&&navigator.storage&&navigator.storage.estimate){let e=await navigator.storage.estimate();return{usage:e.usage||0,quota:e.quota||0}}}catch(e){console.warn(`Failed to get storage estimate:`,e)}return{usage:0,quota:0}}async function h(){try{if(typeof navigator<`u`&&navigator.storage&&navigator.storage.persisted)return await navigator.storage.persisted()}catch(e){console.warn(`Failed to check persistent storage:`,e)}return!1}async function g(){try{if(typeof navigator<`u`&&navigator.storage&&navigator.storage.persist)return await navigator.storage.persist()}catch(e){console.warn(`Failed to request persistent storage:`,e)}return!1}async function _(t){let n=Reflect.get(globalThis,`showDirectoryPicker`),r=typeof n==`function`?n.bind(globalThis):null;if(!r)throw Error(`Local folder picker is unavailable in this browser/context.`);try{let n=await r({mode:`readwrite`,id:`shadowclaw-storage`});return await c(t,e.STORAGE_HANDLE,n),await a(t),await i(t),!0}catch(e){if(e instanceof Error&&e.name===`AbortError`)return!1;throw e}}const v=new CSSStyleSheet;v.replaceSync(`*,
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

.form-helper {
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.hidden,
[hidden] {
  display: none !important;
}

.storage-header {
  display: flex;
  font-size: 0.8125rem;
  justify-content: space-between;
  margin-bottom: 0.375rem;
}

.opacity-60 {
  opacity: 0.6;
}

.storage-progress-container {
  background-color: var(--shadow-claw-bg-tertiary);
  border-radius: 0.25rem;
  height: 0.5rem;
  margin-bottom: 0.75rem;
  overflow: hidden;
  width: 100%;
}

.storage-progress-bar {
  background-color: var(--shadow-claw-accent-primary);
  height: 100%;
  transition: width 0.3s;
  width: 0%;
}

.storage-info-row {
  align-items: center;
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.storage-badge {
  border-radius: 0.25rem;
  display: none;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
}

.persistent-badge {
  background-color: var(--shadow-claw-success-color);
  border-radius: 0.25rem;
  color: white;
  display: none;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
}

.storage-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.settings-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 62.5rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.625rem 0.75rem;
  transition: all 150ms cubic-bezier(0.33, 1, 0.68, 1);
  width: auto;
}

.settings-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: 0 0.625rem 1.875rem 0 rgba(0, 0, 0, 0.08);
  color: var(--shadow-claw-text-primary);
}

.grant-storage-btn {
  background-color: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
}

.grant-storage-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.reset-storage-btn {
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-error-color);
}
`);const y=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>💾 Storage</h3>
    <div class="form-group">
      <div class="storage-header">
        <span data-info="storage-usage">0 B used</span>
        <span class="opacity-60" data-info="storage-quota">of 0 B</span>
      </div>
      <div class="storage-progress-container">
        <div class="storage-progress-bar" data-info="storage-progress"></div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Storage Type</label>
      <div class="storage-info-row">
        <span data-info="storage-type">Browser Internal (OPFS)</span>
        <span class="storage-badge" data-info="storage-status-badge"></span>
        <span class="persistent-badge" data-info="storage-persistent-badge">
          PERSISTENT
        </span>
      </div>
      <div class="storage-buttons">
        <button
          class="grant-storage-btn hidden settings-btn"
          data-action="grant-storage-permission"
        >
          🔓 Grant Permission
        </button>
        <button class="settings-btn" data-action="request-persistent">
          🔒 Request Persistent
        </button>
        <button class="settings-btn" data-action="change-storage-dir">
          📁 Change Location
        </button>
        <button
          class="reset-storage-btn settings-btn"
          data-action="reset-storage-dir"
        >
          ♻️ Reset to Default
        </button>
      </div>
      <div class="form-helper" data-info="storage-help-general">
        Persistent storage prevents the browser from deleting your chat history
        and configuration when disk space is low.
        <b>Note:</b> Browsers often only grant this if you bookmark the site or
        use it frequently.
      </div>
      <div class="form-helper" data-info="storage-help-local">
        You can use a local folder on your computer for storage. This makes
        files directly accessible on your disk.
      </div>
    </div>
  </div>
</template>
`,`text/html`),b=y.querySelector(`template`);let x=[];x=b?Array.from(b.content.children):Array.from(y.head.children).concat(Array.from(y.body.children));var S=x;const C=`shadow-claw-storage`;var w=class extends f{static styles=v;static template=S;db=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await t(),this.bindEventListeners(),this.setupEffects(),await this.updateStorageInfo()}disconnectedCallback(){super.disconnectedCallback()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="request-persistent"]`)?.addEventListener(`click`,()=>this.handleRequestPersistent()),e.querySelector(`[data-action="change-storage-dir"]`)?.addEventListener(`click`,()=>this.handleChangeStorageDir()),e.querySelector(`[data-action="reset-storage-dir"]`)?.addEventListener(`click`,()=>this.handleResetStorageDir()),e.querySelector(`[data-action="grant-storage-permission"]`)?.addEventListener(`click`,()=>{this.db&&o.grantStorageAccess(this.db)}))}formatBytes(e){if(e===0)return`0 B`;let t=1024,n=[`B`,`KB`,`MB`,`GB`,`TB`],r=Math.floor(Math.log(e)/Math.log(t));return parseFloat((e/t**r).toFixed(1))+` `+n[r]}setupEffects(){let e=this.shadowRoot;e&&this.addCleanup(p(()=>{let t=o.storageStatus;if(!t)return;let n=e.querySelector(`[data-info="storage-type"]`),r=e.querySelector(`[data-info="storage-status-badge"]`),i=e.querySelector(`[data-action="grant-storage-permission"]`);n&&(n.textContent=t.type===`local`?`Local Directory`:`Browser Internal (OPFS)`),r&&(r.style.display=t.type===`local`?`inline-block`:`none`,t.type===`local`&&(r.textContent=t.permission===`granted`?`CONNECTED`:`NEEDS PERMISSION`,r.style.backgroundColor=t.permission===`granted`?`var(--shadow-claw-success-color)`:`var(--shadow-claw-error-color)`,r.style.color=`white`)),i&&(i.style.display=t.type===`local`&&t.permission!==`granted`?`inline-block`:`none`)}))}async handleChangeStorageDir(){if(this.db)try{await _(this.db)&&(u(`Storage location changed. Existing OPFS files were not moved.`,4500),await this.updateStorageInfo(),await o.loadFiles(this.db))}catch(e){d(`Failed to change storage location: ${e instanceof Error?e.message:String(e)}`,6e3)}}async handleRequestPersistent(){if(this.db)try{await g()?u(`Persistent storage granted`,3500):l(`Persistent storage was not granted. Browsers may deny this based on site usage.`,5500),await this.updateStorageInfo()}catch(e){d(`Storage request failed: ${e instanceof Error?e.message:String(e)}`,6e3)}}async handleResetStorageDir(){if(this.db&&await this.requestConfirmation({title:`Reset Storage Location`,message:`Revert storage to browser-internal (OPFS)?`,confirmLabel:`Revert`,cancelLabel:`Cancel`}))try{await s(this.db),u(`Reverted to browser-internal storage`,3500),await this.updateStorageInfo(),await o.loadFiles(this.db)}catch(e){d(`Failed to reset storage location: ${e instanceof Error?e.message:String(e)}`,6e3)}}async requestConfirmation(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog({mode:`confirm`,...e}):(l(e.message,4500),!1)}async updateStorageInfo(){if(!this.db)return;let t=this.shadowRoot;if(t)try{let i=await m(),a=this.formatBytes(i.usage),o=this.formatBytes(i.quota),s=i.quota>0?i.usage/i.quota*100:0,c=t.querySelector(`[data-info="storage-usage"]`),l=t.querySelector(`[data-info="storage-quota"]`),u=t.querySelector(`[data-info="storage-progress"]`),d=t.querySelector(`[data-info="storage-type"]`),f=t.querySelector(`[data-info="storage-persistent-badge"]`);c&&(c.textContent=`${a} used`),l&&(l.textContent=`of ${o}`),u&&(u.style.width=`${s}%`);let p=await n(this.db,e.STORAGE_HANDLE);d&&(d.textContent=p?`Local Directory`:`Browser Internal (OPFS)`);let g=await h();f&&(f.style.display=g?`inline-block`:`none`);let _=t.querySelector(`[data-info="storage-help-general"]`),v=t.querySelector(`[data-info="storage-help-local"]`);_&&r(_,p?`Persistent storage protects your <b>chat history, tasks, and settings</b> in the browser database.
            Without it, the browser might clear this data if your disk is almost full.`:`Persistent storage protects your <b>files, chat history, and settings</b> in the browser.
            Without it, the browser might clear your data if your disk is almost full.`),v&&r(v,p?`ShadowClaw is currently <b>connected to a local folder</b>. Your files are safe on your disk,
            but browser persistence is still recommended for your chat history.`:`You can use a local folder on your computer for storage. This makes files directly accessible
            on your disk and independent of browser storage limits.`);let y=t.querySelector(`[data-action="request-persistent"]`);y&&(y.disabled=g)}catch(e){console.warn(`Failed to update storage info:`,e)}}};customElements.get(C)||customElements.define(C,w);export{w as ShadowClawStorage};