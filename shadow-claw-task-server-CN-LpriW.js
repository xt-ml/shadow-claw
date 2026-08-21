import{n as e}from"./txPromise-EBECky1b.js";import{g as t,h as n,t as r}from"./orchestrator-DrMg2dnI.js";import{r as i,t as a}from"./toast-D3gxhZpN.js";import{t as o}from"./shadow-claw-element-na_3JW5e.js";import{t as s}from"./effect-BEsuusE8.js";const c=new CSSStyleSheet;c.replaceSync(`*,
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
  margin: 0 0 0.75rem;
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
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
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
  line-height: 1.45;
  margin-top: 0.375rem;
  max-width: 48rem;
}

.form-helper code {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.375rem;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.72rem;
  padding: 0.08rem 0.3rem;
}

.save-btn {
  background-color: var(--shadow-claw-text-primary);
  border: none;
  border-radius: 62.5rem;
  color: var(--shadow-claw-bg-primary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  margin-top: 0.75rem;
  padding: 0.625rem 1.5rem;
  transition: background-color 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.save-btn:focus-visible {
  outline: 0.125rem solid var(--shadow-claw-accent-primary);
  outline-offset: 0.125rem;
}
`);const l=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>📅 Task Server</h3>

    <div class="form-group">
      <div class="form-helper">
        Configure where scheduled task requests are sent. Use a local path when
        the scheduler backend is hosted alongside the app, or a full URL when
        the app runs on a static host and scheduling is handled elsewhere.
      </div>
    </div>

    <div class="form-group">
      <div class="form-toggle">
        <input
          data-setting="task-server-enabled-toggle"
          id="task-server-enabled-toggle"
          type="checkbox"
        />
        <label class="form-label" for="task-server-enabled-toggle">
          Enable Server-Side Tasks
        </label>
      </div>
      <div class="form-helper">
        Opt in to server-side task scheduling. When disabled, the application
        will not attempt to probe or communicate with a task server.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="task-server-url">Task Server URL</label>
      <input
        class="form-input"
        data-setting="task-server-url-input"
        id="task-server-url"
        placeholder="/schedule"
        spellcheck="false"
        type="url"
      />
      <div class="form-helper">
        The schedule API base on this host, like <code>/schedule</code>, or a
        full URL like <code>http://localhost:8888/schedule</code>. Leave it
        blank to use the default. Set this when ShadowClaw is hosted on a static
        site, and task scheduling runs on a separate backend.
      </div>
      <button class="save-btn" data-action="save-task-server-url">
        💾 Save Task Server URL
      </button>
    </div>
  </div>
</template>
`,`text/html`),u=l.querySelector(`template`);let d=[];d=u?Array.from(u.content.children):Array.from(l.head.children).concat(Array.from(l.body.children));var f=d;const p=`shadow-claw-task-server`;var m=class extends o{static styles=c;static template=f;db;orchestrator;constructor(){super(),this.db=null,this.orchestrator=null}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.db=await e(),this.orchestrator=r.orchestrator,this.bindEventListeners(),this.setupEffects(),await this.render()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="save-task-server-url"]`)?.addEventListener(`click`,()=>{this.saveTaskServerUrl()}),e.querySelector(`[data-setting="task-server-enabled-toggle"]`)?.addEventListener(`change`,e=>{let t=e.target;this.saveTaskServerEnabled(t.checked)}))}setupEffects(){s(()=>{r.ready&&(this.orchestrator=r.orchestrator,this.render())})}async render(){if(!this.orchestrator)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="task-server-url-input"]`);t&&(t.value=this.orchestrator.taskServerUrl);let n=e.querySelector(`[data-setting="task-server-enabled-toggle"]`);n&&(n.checked=this.orchestrator.taskServerEnabled)}async saveTaskServerUrl(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let n=e.querySelector(`[data-setting="task-server-url-input"]`);if(!n)return;let r=n.value.trim();try{await t(this.orchestrator,this.db,r||`/schedule`),i(`Task Server URL saved`,3e3)}catch(e){a(`Error saving Task Server URL: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveTaskServerEnabled(e){if(!(!this.orchestrator||!this.db))try{await n(this.orchestrator,this.db,e)}catch(e){a(`Error saving Task Server setting: `+(e instanceof Error?e.message:String(e)),6e3)}}};customElements.get(p)||customElements.define(p,m);export{m as ShadowClawTaskServer};