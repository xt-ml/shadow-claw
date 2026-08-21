import{n as e,p as t,r as n}from"./config-64zJ5TLN.js";import{n as r}from"./txPromise-EBECky1b.js";import{t as i}from"./getConfig-D89uJgo5.js";import{E as a,T as o,t as s,v as c,w as l}from"./orchestrator-DrMg2dnI.js";import{a as u,r as d,t as f}from"./toast-D3gxhZpN.js";import{t as p}from"./shadow-claw-element-na_3JW5e.js";import{t as m}from"./effect-BEsuusE8.js";const h=new CSSStyleSheet;h.replaceSync(`*,
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

.form-input,
.form-select {
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
.form-select:focus {
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

.save-btn--inline {
  margin-top: 0.625rem;
}
`);const g=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>🖥️ WebVM</h3>
    <div class="form-group">
      <label class="form-label">Boot Mode</label>
      <select class="form-select" data-setting="vm-boot-mode-select">
        <option value="disabled">
          Disabled (Use JavaScript Bash Emulator)
        </option>
        <option value="auto">Auto (Prefer 9p, fallback to ext2)</option>
        <option value="ext2">ext2 / hda</option>
        <option value="9p">9p / VirtFS</option>
      </select>
      <div class="form-helper">
        Disabled is the default and uses the JavaScript Bash Emulator. Auto
        keeps fallback behavior (favoring 9p). Selecting 9p or ext2 forces that
        mode.
      </div>
      <button class="save-btn save-btn--inline" data-action="save-vm-boot-mode">
        💾 Save WebVM Mode
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Default Bash Timeout (seconds)</label>
      <input
        class="form-input"
        data-setting="vm-bash-timeout-input"
        max="1800"
        min="1"
        step="1"
        type="number"
        value="120"
      />
      <div class="form-helper">
        Used when a bash tool call does not pass an explicit timeout. Range: 1
        to 1800 seconds.
      </div>
      <button
        class="save-btn save-btn--inline"
        data-action="save-vm-bash-timeout"
      >
        💾 Save Bash Timeout
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Boot Asset Host</label>
      <!-- https://xt-ml.github.io/v86 -->
      <input
        class="form-input"
        data-setting="vm-boot-host-input"
        placeholder="Auto (use current deployment host)"
        type="url"
        value="\${DEFAULT_VM_BOOT_HOST}"
      />
      <div class="form-helper">
        Leave empty to use this app's deployed host.
      </div>
      <button class="save-btn save-btn--inline" data-action="save-vm-boot-host">
        💾 Save Boot Host
      </button>
    </div>

    <div class="form-group">
      <label class="form-label">Network Relay URL</label>
      <input
        class="form-input"
        data-setting="vm-network-relay-url-input"
        type="url"
        value="wss://relay.widgetry.org/"
      />
      <div class="form-helper">
        Default is wss://relay.widgetry.org/. Use ws:// or wss://.
      </div>
      <button
        class="save-btn save-btn--inline"
        data-action="save-vm-network-relay-url"
      >
        💾 Save Relay URL
      </button>
    </div>
  </div>
</template>
`,`text/html`),_=g.querySelector(`template`);let v=[];v=_?Array.from(_.content.children):Array.from(g.head.children).concat(Array.from(g.body.children));var y=v;const b=`shadow-claw-webvm`;var x=class extends p{static styles=h;static template=y;db=null;orchestrator=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.bindEventListeners(),this.setupEffects()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="save-vm-boot-mode"]`)?.addEventListener(`click`,()=>this.saveVMBootMode()),e.querySelector(`[data-action="save-vm-bash-timeout"]`)?.addEventListener(`click`,()=>this.saveVMBashTimeout()),e.querySelector(`[data-action="save-vm-boot-host"]`)?.addEventListener(`click`,()=>this.saveVMBootHost()),e.querySelector(`[data-action="save-vm-network-relay-url"]`)?.addEventListener(`click`,()=>this.saveVMNetworkRelayURL()))}setupEffects(){m(()=>{s.ready&&(async()=>{this.db=await r(),this.orchestrator=s.orchestrator,await this.render()})()})}async render(){if(!this.db)return;let r=this.shadowRoot;if(r)try{let a=r.querySelector(`[data-setting="vm-boot-mode-select"]`),o=await i(this.db,n.VM_BOOT_MODE);a&&(a.value=o===`disabled`||o===`9p`||o===`ext2`||o===`auto`?o:`disabled`);let s=r.querySelector(`[data-setting="vm-bash-timeout-input"]`),c=await i(this.db,n.VM_BASH_TIMEOUT_SEC),l=Number(c);s&&(s.value=String(Number.isFinite(l)?Math.min(Math.max(Math.floor(l),1),e):900));let u=r.querySelector(`[data-setting="vm-boot-host-input"]`),d=await i(this.db,n.VM_BOOT_HOST);u&&(u.value=typeof d==`string`?d.trim():t);let f=r.querySelector(`[data-setting="vm-network-relay-url-input"]`),p=await i(this.db,n.VM_NETWORK_RELAY_URL);f&&typeof p==`string`&&(f.value=p.trim())}catch(e){console.warn(`Could not load WebVM settings:`,e)}}async saveVMBashTimeout(){if(!this.orchestrator||!this.db)return;let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-setting="vm-bash-timeout-input"]`),r=Number(n?.value);if(!Number.isFinite(r)){u(`Please enter a valid timeout in seconds`,3e3);return}let i=Math.min(Math.max(Math.floor(r),1),e);n&&(n.value=String(i));try{await c(this.orchestrator,this.db,i),d(`WebVM bash timeout saved`,3e3)}catch(e){f(`Error saving WebVM bash timeout: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveVMBootHost(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="vm-boot-host-input"]`)?.value?.trim()||``;if(t)try{let e=new URL(t);if(e.protocol!==`http:`&&e.protocol!==`https:`)throw Error(`Boot host must use http:// or https://`)}catch{u(`Please enter a valid HTTP(S) boot host URL`,3500);return}try{await l(this.orchestrator,this.db,t),d(`WebVM boot host saved`,3e3)}catch(e){f(`Error saving WebVM boot host: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveVMBootMode(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="vm-boot-mode-select"]`)?.value||`disabled`,n=t===`disabled`||t===`9p`||t===`ext2`||t===`auto`?t:`disabled`;try{await o(this.orchestrator,this.db,n),d(`WebVM boot mode saved`,3e3)}catch(e){f(`Error saving WebVM mode: `+(e instanceof Error?e.message:String(e)),6e3)}}async saveVMNetworkRelayURL(){if(!this.orchestrator||!this.db)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-setting="vm-network-relay-url-input"]`),n=t?.value?.trim()||``;if(n)try{let e=new URL(n);if(e.protocol!==`ws:`&&e.protocol!==`wss:`)throw Error(`Relay URL must use ws:// or wss://`)}catch{u(`Please enter a valid ws:// or wss:// relay URL`,3500);return}t&&(t.value=n);try{await a(this.orchestrator,this.db,n),d(`WebVM relay URL saved`,3e3)}catch(e){f(`Error saving WebVM relay URL: `+(e instanceof Error?e.message:String(e)),6e3)}}};customElements.get(b)||customElements.define(b,x);export{x as ShadowClawWebvm};