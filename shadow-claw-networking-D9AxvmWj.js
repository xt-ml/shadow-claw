import{n as e}from"./txPromise-EBECky1b.js";import{_ as t,t as n,u as r}from"./orchestrator-DrMg2dnI.js";import{a as i,r as a,t as o}from"./toast-D3gxhZpN.js";import{t as s}from"./shadow-claw-element-na_3JW5e.js";import{t as c}from"./effect-BEsuusE8.js";const l=new CSSStyleSheet;l.replaceSync(`*,
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

.save-btn--inline {
  margin-top: 0.5rem;
}
`);const u=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>🌐 Networking</h3>
    <div class="form-group">
      <div class="form-toggle">
        <input data-setting="proxy-toggle" id="proxy-toggle" type="checkbox" />
        <label class="form-label" for="proxy-toggle"> Use CORS Proxy </label>
      </div>
      <div class="form-helper">
        Intercept cross-origin requests and route them through your local proxy
        server. Enable this if you are getting CORS errors when fetching models
        or completions, but keep it disabled for standalone operation without a
        backend.
      </div>
    </div>

    <div class="form-group" data-proxy-config>
      <label class="form-label">Proxy URL</label>
      <input
        class="form-input"
        data-setting="proxy-url-input"
        placeholder="/proxy"
        type="text"
      />
      <div class="form-helper">
        The endpoint on this host (e.g. /proxy) or a full URL (e.g.
        http://localhost:8888/proxy).
      </div>
      <button class="save-btn save-btn--inline" data-action="save-proxy-url">
        💾 Save Proxy URL
      </button>
    </div>
  </div>
</template>
`,`text/html`),d=u.querySelector(`template`);let f=[];f=d?Array.from(d.content.children):Array.from(u.head.children).concat(Array.from(u.body.children));var p=f;const m=`shadow-claw-networking`;var h=class extends s{static styles=l;static template=p;db;orchestrator;constructor(){super(),this.db=null,this.orchestrator=null}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await e(),this.orchestrator=n.orchestrator,this.bindEventListeners(),this.setupEffects(),await this.render()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-setting="proxy-toggle"]`)?.addEventListener(`change`,e=>{e.target instanceof HTMLInputElement&&this.onProxyToggle(e.target.checked)}),e.querySelector(`[data-action="save-proxy-url"]`)?.addEventListener(`click`,()=>{this.saveProxyUrl()}))}setupEffects(){c(()=>{n.ready&&(this.orchestrator=n.orchestrator,this.render())})}async onProxyToggle(e){if(!(!this.orchestrator||!this.db))try{await t(this.orchestrator,this.db,e),a(e?`CORS Proxy enabled`:`CORS Proxy disabled`,2500)}catch(e){o(`Error saving proxy setting: `+(e instanceof Error?e.message:String(e)),6e3)}}async render(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="proxy-toggle"]`);t&&(t.checked=this.orchestrator.useProxy);let n=e.querySelector(`[data-setting="proxy-url-input"]`);n&&(n.value=this.orchestrator.proxyUrl)}async saveProxyUrl(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="proxy-url-input"]`);if(!t)return;let n=t.value.trim();if(!n){i(`Please enter a proxy URL (e.g. /proxy)`,3e3);return}try{await r(this.orchestrator,this.db,n),a(`Proxy URL saved`,3e3)}catch(e){o(`Error saving proxy URL: `+(e instanceof Error?e.message:String(e)),6e3)}}};customElements.get(m)||customElements.define(m,h);export{h as ShadowClawNetworking};