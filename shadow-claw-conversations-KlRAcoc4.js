import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{d as r}from"./custom-element-security-MwgLnC6q.js";import{G as i,H as a,cn as o,ln as s,t as c}from"./orchestrator-DrMg2dnI.js";import{t as l}from"./setConfig-DFMYnYLE.js";import{t as u}from"./shadow-claw-element-na_3JW5e.js";import{t as d}from"./effect-BEsuusE8.js";import{n as f}from"./model-ranking-C60HgQ2c.js";import"./shadow-claw-dialog-n4xdcUp-.js";const p=new CSSStyleSheet;p.replaceSync(`:host {
  display: block;
}

.picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.picker__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.picker__label:not(:first-child) {
  margin-top: 0.5rem;
}

.picker__input {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  min-height: 2rem;
  padding: 0.375rem 0.5rem;
}

.picker__input:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
  outline: none;
}

.picker__model {
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
`);const m=new DOMParser().parseFromString(`<template>
  <div class="picker">
    <label
      class="picker__label"
      data-role="provider-label"
      for="provider-select"
    >
      Pinned Provider
    </label>
    <select
      class="picker__input"
      data-role="provider-select"
      id="provider-select"
    >
      <option value="">Default</option>
    </select>

    <div class="picker__model" data-role="model-container">
      <label class="picker__label" data-role="model-label" for="model-select">
        Pinned Model
      </label>
      <select class="picker__input" data-role="model-select" id="model-select">
        <option value="">Default Model</option>
      </select>
      <input
        autocomplete="off"
        class="picker__input"
        data-role="custom-model-input"
        placeholder="Custom model id"
        type="text"
      />
    </div>
  </div>
</template>
`,`text/html`),h=m.querySelector(`template`);let g=[];g=h?Array.from(h.content.children):Array.from(m.head.children).concat(Array.from(m.body.children));var _=g;const v=`shadow-claw-provider-model-picker`,y={providerLabel:`Pinned Provider`,defaultProviderLabel:`Default`,modelLabel:`Pinned Model`,defaultModelLabel:`Default Model`,customModelPlaceholder:`Custom model id`};var b=class extends u{static styles=p;static template=_;customModelSelected=!1;labels={...y};loadedProviderIds=new Set;loadingProviderId=null;modelLoadEpoch=0;modelLoader=null;providerModels=new Map;providers=[];value={providerId:null,modelId:null};async connectedCallback(){this.bindEvents(),await this.render()}getValue(){return{providerId:this.value.providerId,modelId:this.value.modelId}}invalidateProviderModels(e){e?(this.providerModels.delete(e),this.loadedProviderIds.delete(e),this.loadingProviderId===e&&(this.loadingProviderId=null,this.modelLoadEpoch+=1)):(this.providerModels.clear(),this.loadedProviderIds.clear(),this.loadingProviderId=null,this.modelLoadEpoch+=1),this.render()}setLabels(e){this.labels={...this.labels,...e},this.render()}setModelLoader(e){this.modelLoader=e,this.providerModels.clear(),this.loadedProviderIds.clear(),this.loadingProviderId=null,this.modelLoadEpoch+=1,this.render()}setProviders(e){this.providers=Array.isArray(e)?[...e]:[];let t=new Set(this.providers.map(e=>e.id));for(let e of this.providerModels.keys())t.has(e)||(this.providerModels.delete(e),this.loadedProviderIds.delete(e));this.render()}setValue(e){this.value={providerId:e.providerId||null,modelId:e.modelId||null},this.customModelSelected=!!e.modelId,this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-role="provider-label"]`),n=e.querySelector(`[data-role="provider-select"]`),r=e.querySelector(`[data-role="model-container"]`),i=e.querySelector(`[data-role="model-label"]`),a=e.querySelector(`[data-role="model-select"]`),o=e.querySelector(`[data-role="custom-model-input"]`);if(!t||!n||!r||!i||!a||!o)return;t.textContent=this.labels.providerLabel,i.textContent=this.labels.modelLabel,o.placeholder=this.labels.customModelPlaceholder,n.replaceChildren();let s=document.createElement(`option`);s.value=``,s.textContent=this.labels.defaultProviderLabel,n.appendChild(s);for(let e of this.providers){let t=document.createElement(`option`);t.value=e.id,t.textContent=e.name,n.appendChild(t)}n.value=this.value.providerId||``,a.replaceChildren();let c=document.createElement(`option`);c.value=``,c.textContent=this.labels.defaultModelLabel,a.appendChild(c);let l=this.value.providerId?this.providers.find(e=>e.id===this.value.providerId):void 0,u=this.getProviderModels(l),d=u.map(e=>this.getModelId(e)).filter(e=>!!e);if(l?.modelsUrl&&this.ensureProviderModelsLoaded(l),l?.modelsUrl&&this.loadingProviderId===l.id&&u.length===0){let e=document.createElement(`option`);e.value=``,e.textContent=`Loading models...`,a.appendChild(e)}for(let e of u){let t=document.createElement(`option`),n=this.getModelId(e);n&&(t.value=n,t.textContent=this.getModelLabel(e,l?.id||``),a.appendChild(t))}let f=document.createElement(`option`);if(f.value=`__custom__`,f.textContent=`Custom Model...`,a.appendChild(f),!this.value.providerId){r.style.display=`none`,o.style.display=`none`,o.value=``,a.value=``;return}if(r.style.display=`flex`,!this.value.modelId&&!this.customModelSelected){a.value=``,o.style.display=`none`,o.value=``;return}if(this.value.modelId&&d.includes(this.value.modelId)&&!this.customModelSelected){a.value=this.value.modelId,o.style.display=`none`,o.value=``;return}a.value=`__custom__`,o.style.display=`block`,o.value=this.value.modelId||``}bindEvents(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-role="provider-select"]`),n=e.querySelector(`[data-role="model-select"]`),r=e.querySelector(`[data-role="custom-model-input"]`);t?.addEventListener(`change`,()=>{this.value={providerId:t.value||null,modelId:null},this.customModelSelected=!1,this.render(),this.emitChange()}),n?.addEventListener(`change`,()=>{n.value===`__custom__`?(this.customModelSelected=!0,this.value.modelId=r?.value.trim()||this.value.modelId||null):(this.customModelSelected=!1,this.value.modelId=n.value||null),this.render(),this.emitChange()}),r?.addEventListener(`input`,()=>{n?.value===`__custom__`&&(this.value.modelId=r.value.trim()||null,this.customModelSelected=!0,this.emitChange())})}emitChange(){this.dispatchEvent(new CustomEvent(`provider-model-change`,{detail:{providerId:this.value.providerId,modelId:this.value.modelId},bubbles:!0,composed:!0}))}getContextLength(e){return typeof e==`string`?0:typeof e.context_length==`number`?e.context_length:typeof e.context_window==`number`?e.context_window:Array.isArray(e.providers)?Math.max(...e.providers.map(e=>e.context_length||0),0):0}getModelId(e){return typeof e==`string`?e:typeof e.id==`string`&&e.id.trim()?e.id.trim():typeof e.name==`string`&&e.name.trim()?e.name.trim():null}getModelLabel(e,t){let n=this.getModelId(e)||``,r=typeof e==`string`?n:typeof e.displayName==`string`&&e.displayName.trim()?e.displayName.trim():typeof e.name==`string`&&e.name.trim()?e.name.trim():n,i=r===n?n:`${r} - ${n}`,a=this.getContextLength(e);return`${i}${a>=1e6?` (${(a/1e6).toFixed(1)}M)`:a>=1e3?` (${Math.round(a/1024)}k)`:a>0?` (${a})`:``}${this.getToolsBadge(e,t)}`}getProviderModels(e){return e?Array.isArray(e.models)&&e.models.length>0?e.models:this.providerModels.get(e.id)||[]:[]}getToolsBadge(e,t){let n=new Set([`transformers_js_local`,`transformers_js_browser`,`ollama`,`llamafile`,`prompt_api`,`litert_lm`]),r=this.getModelId(e)||``;if(n.has(t))return f(r)?` 🛠️`:` ❔🛠️`;if(typeof e==`string`)return` ❔🛠️`;if(e.supports_tools===!0||e.supportsTools===!0)return` 🛠️`;if(e.supports_tools===!1||e.supportsTools===!1)return` 🚫🛠️`;if(Array.isArray(e.providers)){if(e.providers.some(e=>e.supports_tools===!0))return` 🛠️`;if(e.providers.some(e=>e.supports_tools===!1))return` 🚫🛠️`}return Array.isArray(e.supported_parameters)?e.supported_parameters.includes(`tools`)?` 🛠️`:` 🚫🛠️`:` ❔🛠️`}async ensureProviderModelsLoaded(e){if(!e.modelsUrl||!this.modelLoader||this.loadedProviderIds.has(e.id)||this.loadingProviderId===e.id)return;let t=++this.modelLoadEpoch;this.loadingProviderId=e.id;try{let n=await this.modelLoader(e);if(t!==this.modelLoadEpoch)return;this.providerModels.set(e.id,Array.isArray(n)?n:[]),this.loadedProviderIds.add(e.id)}catch{if(t!==this.modelLoadEpoch)return;this.providerModels.set(e.id,[]),this.loadedProviderIds.add(e.id)}finally{t===this.modelLoadEpoch&&this.loadingProviderId===e.id&&(this.loadingProviderId=null),await this.render()}}};customElements.get(v)||customElements.define(v,b);const x=new CSSStyleSheet;x.replaceSync(`:host {
  display: block;
}

.module-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.module-settings__section {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
}

.module-settings__label:not(:first-child) {
  margin-top: 0.5rem;
}

.module-settings__label {
  font-size: 0.875rem;
  font-weight: 600;
}

.module-settings__input {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  min-height: 2rem;
  padding: 0.375rem 0.5rem;
  width: 100%;
}

.module-settings__checkbox {
  align-items: center;
  display: inline-flex;
  font-size: 0.875rem;
  gap: 0.5rem;
}
`);const S=new DOMParser().parseFromString(`<template>
  <div class="module-settings">
    <div class="module-settings__section" data-role="llamafile-section">
      <label class="module-settings__label" for="llamafile-mode"
        >Llamafile Mode</label
      >
      <select
        class="module-settings__input"
        data-role="llamafile-mode"
        id="llamafile-mode"
      >
        <option value="cli">CLI</option>
        <option value="server">Server</option>
      </select>

      <label class="module-settings__label" for="llamafile-host"
        >Llamafile Host</label
      >
      <input
        class="module-settings__input"
        data-role="llamafile-host"
        id="llamafile-host"
        type="text"
      />

      <label class="module-settings__label" for="llamafile-port"
        >Llamafile Port</label
      >
      <input
        class="module-settings__input"
        data-role="llamafile-port"
        id="llamafile-port"
        type="number"
      />

      <label class="module-settings__checkbox">
        <input data-role="llamafile-offline" type="checkbox" />
        Offline
      </label>
    </div>

    <div class="module-settings__section" data-role="bedrock-section">
      <label class="module-settings__label" for="bedrock-auth-mode"
        >Bedrock Auth Mode</label
      >
      <select
        class="module-settings__input"
        data-role="bedrock-auth-mode"
        id="bedrock-auth-mode"
      >
        <option value="provider_chain">Provider Chain</option>
        <option value="sso">SSO</option>
      </select>

      <label class="module-settings__label" for="bedrock-region"
        >Bedrock Region</label
      >
      <input
        class="module-settings__input"
        data-role="bedrock-region"
        id="bedrock-region"
        type="text"
      />

      <label class="module-settings__label" for="bedrock-profile"
        >Bedrock Profile</label
      >
      <input
        class="module-settings__input"
        data-role="bedrock-profile"
        id="bedrock-profile"
        type="text"
      />
    </div>
  </div>
</template>
`,`text/html`),C=S.querySelector(`template`);let w=[];w=C?Array.from(C.content.children):Array.from(S.head.children).concat(Array.from(S.body.children));var T=w;const E=`shadow-claw-provider-module-settings`;var D=class extends u{static styles=x;static template=T;currentProviderId=null;overrides={};async connectedCallback(){this.bindEvents(),await this.render()}getOverrides(){return JSON.parse(JSON.stringify(this.overrides))}setOverrides(e){this.overrides=e?JSON.parse(JSON.stringify(e)):{},this.render()}setProvider(e){this.currentProviderId=e||null,this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-role="llamafile-section"]`),n=e.querySelector(`[data-role="bedrock-section"]`);if(!t||!n)return;t.style.display=this.currentProviderId===`llamafile`?`flex`:`none`,n.style.display=this.currentProviderId===`bedrock_proxy`?`flex`:`none`;let r=this.overrides.llamafile||{},i=e.querySelector(`[data-role="llamafile-mode"]`),a=e.querySelector(`[data-role="llamafile-host"]`),o=e.querySelector(`[data-role="llamafile-port"]`),s=e.querySelector(`[data-role="llamafile-offline"]`);i&&a&&o&&s&&(i.value=r.mode===`server`?`server`:`cli`,a.value=r.host||`127.0.0.1`,o.value=String(r.port||8080),s.checked=r.offline??!0);let c=this.overrides.bedrock_proxy||{},l=e.querySelector(`[data-role="bedrock-auth-mode"]`),u=e.querySelector(`[data-role="bedrock-region"]`),d=e.querySelector(`[data-role="bedrock-profile"]`);l&&u&&d&&(l.value=c.authMode===`sso`?`sso`:`provider_chain`,u.value=c.region||``,d.value=c.profile||``)}bindEvents(){let e=this.shadowRoot;if(e)for(let[t,n]of[[`llamafile-mode`,`change`],[`llamafile-host`,`input`],[`llamafile-port`,`input`],[`llamafile-offline`,`change`],[`bedrock-auth-mode`,`change`],[`bedrock-region`,`input`],[`bedrock-profile`,`input`]])e.querySelector(`[data-role=\"${t}\"]`)?.addEventListener(n,()=>{this.readControlsIntoOverrides(),this.emitChange()})}emitChange(){this.dispatchEvent(new CustomEvent(`provider-module-settings-change`,{detail:{providerId:this.currentProviderId,overrides:this.getOverrides()},bubbles:!0,composed:!0}))}readControlsIntoOverrides(){let e=this.shadowRoot;if(e){if(this.currentProviderId===`llamafile`){let t=e.querySelector(`[data-role="llamafile-mode"]`),n=e.querySelector(`[data-role="llamafile-host"]`),r=e.querySelector(`[data-role="llamafile-port"]`),i=e.querySelector(`[data-role="llamafile-offline"]`);if(!t||!n||!r||!i)return;let a=parseInt(r.value,10);this.overrides.llamafile={mode:t.value===`server`?`server`:`cli`,host:n.value.trim(),port:Number.isFinite(a)&&a>0?a:8080,offline:i.checked};return}if(this.currentProviderId===`bedrock_proxy`){let t=e.querySelector(`[data-role="bedrock-auth-mode"]`),n=e.querySelector(`[data-role="bedrock-region"]`),r=e.querySelector(`[data-role="bedrock-profile"]`);if(!t||!n||!r)return;this.overrides.bedrock_proxy={authMode:t.value===`sso`?`sso`:`provider_chain`,region:n.value.trim(),profile:r.value.trim()}}}}};customElements.get(E)||customElements.define(E,D);const O=new CSSStyleSheet;O.replaceSync(`* {
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
  flex-direction: column;
  font-family: var(--shadow-claw-font-sans, system-ui, sans-serif);
  min-height: 0;
}

#conversations-subagent-settings-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

#conversations-subagent-manual-container {
  flex-direction: column;
  margin-top: 0.5rem;
}

#conversations-subagent-picker {
  width: 100%;
}

.resize-handle {
  background: transparent;
  cursor: row-resize;
  flex: none;
  height: 0.75rem;
  position: relative;
  touch-action: none;
  transition: background var(--shadow-claw-duration-min, 150ms);
  user-select: none;
}

.resize-handle::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-secondary) 72%,
    var(--shadow-claw-border-color)
  );
  border: 0.0625rem solid
    color-mix(in srgb, var(--shadow-claw-border-color) 80%, transparent);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 0.5625rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition:
    background-color var(--shadow-claw-duration-min, 150ms),
    border-color var(--shadow-claw-duration-min, 150ms),
    box-shadow var(--shadow-claw-duration-min, 150ms);
  width: calc(100% - 1rem);
}

.resize-handle::after {
  background: var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 0.125rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: background var(--shadow-claw-duration-min, 150ms);
  width: calc(100% - 2.5rem);
}

.resize-handle:hover::before,
.resize-handle.active::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 16%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 40%,
    transparent
  );
  box-shadow: 0 0 0.5rem
    color-mix(in srgb, var(--shadow-claw-accent-primary) 16%, transparent);
}

.resize-handle:hover::after,
.resize-handle.active::after {
  background: var(--shadow-claw-accent-primary);
}

.conversations-header {
  align-items: center;
  color: var(--shadow-claw-text-tertiary);
  display: flex;
  font-size: 0.75rem;
  font-weight: 600;
  justify-content: space-between;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem;
  text-transform: uppercase;
}

.create-btn {
  background: none;
  border: none;
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 1rem;
  padding: 0.125rem 0.375rem;
  transition: background var(--shadow-claw-duration-min, 150ms);
}

.create-btn:hover {
  background: var(--shadow-claw-bg-tertiary);
  color: var(--shadow-claw-accent-primary);
}

.conversation-list {
  flex: 1;
  list-style: none;
  margin: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 0.5rem 0;
}

.conversation-item {
  align-items: center;
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  margin: 0.25rem 0.375rem;
  min-height: 1.25rem;
  padding: 0.5rem 0.75rem;
  transition:
    background var(--shadow-claw-duration-min, 150ms),
    border-color 150ms;
}

.conversation-item:hover {
  background: var(--shadow-claw-bg-tertiary);
}

.conversation-item.active {
  background: var(--shadow-claw-bg-tertiary);
  color: var(--shadow-claw-accent-primary);
  font-weight: 600;
}

.conversation-item:focus-visible {
  outline: 2px solid var(--shadow-claw-accent-primary);
  outline-offset: -0.125rem;
}

.conversation-item.keyboard-grabbed {
  background: var(--shadow-claw-bg-tertiary);
  outline: 2px dashed var(--shadow-claw-accent-primary);
  outline-offset: -0.125rem;
}

.conversation-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversation-actions {
  display: none;
  gap: 0.25rem;
  margin-left: 0.25rem;
}

.conversation-actions-toggle {
  background: none;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  display: none;
  font-size: 1rem;
  margin-left: 0.25rem;
  padding: 0.125rem 0.375rem;
}

@media (hover: hover) and (pointer: fine) {
  .conversation-item:hover .conversation-actions {
    display: flex;
  }
}

.conversation-item:focus-within .conversation-actions {
  display: flex;
}

@media (hover: none), (pointer: coarse) {
  .conversation-actions-toggle {
    display: block;
  }

  .conversation-item.show-actions .conversation-actions {
    display: flex;
  }

  .conversation-item.show-actions .conversation-actions-toggle {
    display: none;
  }
}

.conversation-actions button {
  background: none;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.25rem;
}

.conversation-actions button:hover {
  background: var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-primary);
}

.channel-badge {
  background: var(--shadow-claw-bg-secondary);
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-tertiary);
  flex-shrink: 0;
  font-size: 0.625rem;
  margin-right: 0.375rem;
  padding: 0.0625rem 0.25rem;
}

.tool-badge {
  color: var(--shadow-claw-text-tertiary);
  flex-shrink: 0;
  font-size: 0.75rem;
  margin-right: 0.25rem;
  opacity: 0.7;
}

.drag-handle {
  align-items: center;
  cursor: grab;
  display: inline-flex;
  flex-shrink: 0;
  font-size: 0.75rem;
  justify-content: center;
  margin-left: -0.5rem;
  margin-right: 0;
  opacity: 0.4;
  padding: 0.5rem;
  touch-action: none;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.conversation-item:hover .drag-handle {
  opacity: 0.8;
}

.conversation-item.dragging {
  opacity: 0.4;
}

.conversation-item.drag-over {
  border-top: 2px solid var(--shadow-claw-accent-primary);
}

.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 0.0625rem;
  margin: -0.0625rem;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 0.0625rem;
}

@keyframes pulse-unread {
  0%,
  100% {
    background: transparent;
  }

  50% {
    background: color-mix(
      in srgb,
      var(--shadow-claw-accent-primary) 15%,
      transparent
    );
  }
}

.conversation-item.unread {
  animation: pulse-unread 2s ease-in-out infinite;
}

.conversation-item.unread .conversation-name {
  font-weight: 600;
}

.conversations__dialog {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l, 1.5rem);
  color: var(--shadow-claw-text-primary);
  max-width: 22rem;
  padding: 0;
  width: calc(100vw - 2rem);
}

.conversations__dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.35);
}

.conversations__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.conversations__label {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
}

.conversations__delete-message {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
  margin: 0;
}

.conversations__delete-name {
  color: var(--shadow-claw-text-primary);
  font-weight: 600;
}

.conversations__clone-name {
  color: var(--shadow-claw-text-primary);
  font-weight: 600;
}

.conversations__input {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  font-size: var(--shadow-claw-font-size-sm);
  min-height: 2rem;
  padding: 0.375rem 0.5rem;
}

.conversations__input:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
  outline: none;
}

.conversations__label--tools {
  margin-top: 0.5rem;
}

.conversations__label--group-id {
  color: var(--shadow-claw-text-tertiary);
  font-weight: 500;
  letter-spacing: 0.02em;
  margin-top: 0.25rem;
}

.conversations__group-id-row {
  align-items: center;
  display: flex;
  gap: 0.375rem;
}

.conversations__group-id-input {
  background-color: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-tertiary);
  cursor: text;
  flex: 1;
  font-family: var(--shadow-claw-font-mono, monospace);
  font-size: 0.75rem;
  min-height: 1.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conversations__group-id-input:focus {
  border-color: var(--shadow-claw-border-color);
  box-shadow: none;
  outline: none;
}

.conversations__group-id-copy-btn {
  align-items: center;
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  height: 1.75rem;
  justify-content: center;
  padding: 0;
  transition:
    background-color var(--shadow-claw-duration-min, 150ms),
    border-color var(--shadow-claw-duration-min, 150ms),
    color var(--shadow-claw-duration-min, 150ms);
  width: 1.75rem;
}

.conversations__group-id-copy-btn:hover {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-accent-primary);
}

.conversations__group-id-copy-btn--copied {
  border-color: var(--shadow-claw-success-color, #22c55e);
  color: var(--shadow-claw-success-color, #22c55e);
}

.conversations__tool-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.conversations__tool-input {
  flex: 1;
}

.conversations__tool-add-btn {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0 0.75rem;
}

.conversations__tool-add-btn:hover {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-accent-primary);
}

.conversations__tool-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  max-height: 8rem;
  overflow-y: auto;
  padding-bottom: 0.5rem;
}

.conversations__tool-chip {
  align-items: center;
  background-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 15%,
    transparent
  );
  border: 0.0625rem solid var(--shadow-claw-accent-primary);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-accent-primary);
  display: inline-flex;
  font-size: 0.75rem;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
}

.conversations__tool-chip-remove {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.7;
  padding: 0;
}

.conversations__tool-chip-remove:hover {
  opacity: 1;
}

.conversations__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.conversations__ok,
.conversations__cancel,
.conversations__delete-ok {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  min-height: 2rem;
  min-width: 4.5rem;
  padding: 0.375rem 0.625rem;
}

.conversations__ok {
  background-color: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
}

.conversations__ok:hover,
.conversations__ok:focus-visible {
  background-color: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
  outline: none;
}

.conversations__delete-ok {
  background-color: var(--shadow-claw-important-color);
  border-color: var(--shadow-claw-important-color);
  color: white;
}

.conversations__delete-ok:hover,
.conversations__delete-ok:focus-visible {
  background-color: var(
    --shadow-claw-important-color-hover,
    color-mix(in srgb, var(--shadow-claw-important-color) 82%, black)
  );
  border-color: var(
    --shadow-claw-important-color-hover,
    color-mix(in srgb, var(--shadow-claw-important-color) 82%, black)
  );
  box-shadow: 0 0 0 0.125rem
    color-mix(in srgb, var(--shadow-claw-important-color) 24%, transparent);
  outline: none;
}

.conversations__cancel:hover,
.conversations__cancel:focus-visible {
  background-color: var(--shadow-claw-bg-tertiary);
  outline: none;
}

.conversations__participants-container {
  display: none;
  margin-bottom: 1rem;
}

.conversations__participants-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.conversations__provider-select {
  margin-bottom: 1rem;
}

.conversations__model-container {
  display: none;
  margin: 1rem 0;
}

.conversations__model-row {
  align-items: center;
  display: flex;
  gap: 0.5rem;
}

.conversations__model-select {
  flex: 1;
  margin-bottom: 0;
}
`);const k=new DOMParser().parseFromString(`<template>
  <div class="resize-handle" title="Drag to resize"></div>
  <div class="conversations-header">
    <span>Conversations</span>

    <button class="create-btn" data-action="create" title="New Conversation">
      +
    </button>
  </div>
  <span class="sr-only" id="reorder-instructions">
    Press Enter or Space to select. Use Arrow Keys to move focus. Press M to
    grab for reordering. When grabbed, use Arrow Up and Down to move. Press
    Space or Enter to drop. Press Escape to cancel.
  </span>
  <div
    aria-live="assertive"
    class="sr-only"
    id="live-region"
    role="status"
  ></div>

  <ul class="conversation-list" role="list"></ul>

  <shadow-claw-dialog
    dialog-aria-label="Create new conversation"
    dialog-class="conversations__dialog conversations__create-dialog"
  >
    <form
      class="conversations__form"
      method="dialog"
      toolname="createConversation"
      tooldescription="Creates a new conversation."
    >
      <label class="conversations__label" for="conversations-create-name">
        Conversation name
      </label>
      <input
        autocomplete="off"
        class="conversations__input"
        id="conversations-create-name"
        name="conversations-create-name"
        required
        type="text"
      />
      <div class="conversations__actions">
        <button class="conversations__cancel" type="button">Cancel</button>
        <button class="conversations__ok" type="submit">OK</button>
      </div>
    </form>
  </shadow-claw-dialog>

  <shadow-claw-dialog
    dialog-aria-label="Conversation Details"
    dialog-class="conversations__dialog conversations__details-dialog"
  >
    <form
      class="conversations__form"
      method="dialog"
      toolname="editConversationDetails"
      tooldescription="Edits the details and settings of a conversation."
    >
      <label class="conversations__label" for="conversations-details-name">
        Conversation name
      </label>
      <input
        autocomplete="off"
        class="conversations__input"
        id="conversations-details-name"
        name="conversations-details-name"
        required
        type="text"
      />
      <label
        class="conversations__label conversations__label--group-id"
        for="conversations-details-group-id"
      >
        Group ID
      </label>
      <div class="conversations__group-id-row">
        <input
          class="conversations__input conversations__group-id-input"
          id="conversations-details-group-id"
          name="conversations-details-group-id"
          readonly
          type="text"
        />
        <button
          type="button"
          class="conversations__group-id-copy-btn"
          id="conversations-group-id-copy-btn"
          title="Copy Group ID"
          aria-label="Copy Group ID to clipboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="1em"
            width="1em"
            viewBox="0 -960 960 960"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"
            />
          </svg>
        </button>
      </div>

      <div
        id="conversations-details-participants-container"
        class="conversations__participants-container"
      >
        <label class="conversations__label"> Connected Participants </label>
        <div
          id="conversations-details-participants-list"
          class="conversations__participants-list"
        ></div>
      </div>
      <shadow-claw-provider-model-picker id="conversations-main-picker">
      </shadow-claw-provider-model-picker>
      <label class="conversations__label" for="conversations-agent-max-tokens">
        Agent Max Tokens (optional)
      </label>
      <input
        class="conversations__input"
        id="conversations-agent-max-tokens"
        min="1"
        name="conversations-agent-max-tokens"
        placeholder="Auto (model-aware)"
        step="1"
        type="number"
      />
      <shadow-claw-provider-module-settings
        id="conversations-main-provider-module-settings"
      >
      </shadow-claw-provider-module-settings>

      <label class="conversations__label conversations__label--tools">
        Pinned Tools
      </label>
      <div class="conversations__tool-input-row">
        <input
          type="text"
          list="conversations-available-tools"
          id="conversations-tool-input"
          name="conversations-tool-input"
          class="conversations__input conversations__tool-input"
          placeholder="Add a tool..."
          toolparamdescription="The name of the tool to pin to the conversation."
        />
        <datalist id="conversations-available-tools"></datalist>
        <button
          type="button"
          class="conversations__tool-add-btn"
          id="conversations-add-tool-btn"
        >
          Add
        </button>
      </div>
      <div
        class="conversations__tool-tags"
        id="conversations-details-tools"
      ></div>

      <div id="conversations-subagent-settings-container">
        <label class="conversations__label" for="conversations-subagent-mode">
          Subagent Provider/Model Mode
        </label>
        <select
          class="conversations__input"
          id="conversations-subagent-mode"
          name="conversations-subagent-mode"
        >
          <option value="automatic">Automatic (parent decides)</option>
          <option value="manual">Manual (pin provider/model)</option>
        </select>

        <label
          class="conversations__label"
          for="conversations-subagent-max-tokens"
        >
          Subagent Max Tokens (optional)
        </label>
        <input
          class="conversations__input"
          id="conversations-subagent-max-tokens"
          min="1"
          name="conversations-subagent-max-tokens"
          placeholder="Auto (model-aware)"
          step="1"
          type="number"
        />

        <div id="conversations-subagent-manual-container">
          <shadow-claw-provider-model-picker id="conversations-subagent-picker">
          </shadow-claw-provider-model-picker>
          <shadow-claw-provider-module-settings
            id="conversations-subagent-provider-module-settings"
          >
          </shadow-claw-provider-module-settings>
        </div>
      </div>

      <div class="conversations__actions">
        <button class="conversations__cancel" type="button">Cancel</button>
        <button class="conversations__ok" type="submit">Save</button>
      </div>
    </form>
  </shadow-claw-dialog>

  <shadow-claw-dialog
    dialog-aria-label="Delete conversation"
    dialog-class="conversations__dialog conversations__delete-dialog"
  >
    <form
      class="conversations__form"
      method="dialog"
      toolname="deleteConversation"
      tooldescription="Deletes a conversation permanently."
    >
      <p class="conversations__delete-message">
        Delete conversation "<span class="conversations__delete-name"></span>"?
        This cannot be undone.
      </p>
      <div class="conversations__actions">
        <button autofocus class="conversations__cancel" type="button">
          Cancel
        </button>
        <button class="conversations__delete-ok" type="submit">Delete</button>
      </div>
    </form>
  </shadow-claw-dialog>

  <shadow-claw-dialog
    dialog-aria-label="Clone conversation"
    dialog-class="conversations__dialog conversations__clone-dialog"
  >
    <form
      class="conversations__form"
      method="dialog"
      toolname="cloneConversation"
      tooldescription="Clones an existing conversation."
    >
      <p class="conversations__delete-message">
        Clone conversation "<span class="conversations__clone-name"></span>"?
      </p>
      <div class="conversations__actions">
        <button class="conversations__cancel" type="button">Cancel</button>
        <button class="conversations__ok" type="submit">Clone</button>
      </div>
    </form>
  </shadow-claw-dialog>
</template>
`,`text/html`),A=k.querySelector(`template`);let j=[];j=A?Array.from(A.content.children):Array.from(k.head.children).concat(Array.from(k.body.children));var M=j,N=class extends u{static styles=O;static template=M;channelRegistry=null;db=null;_draggedGroupId=null;_effectCleanup=null;_keyboardGrabbedId=null;_pendingCloneGroupId=null;_pendingDeleteGroupId=null;_pendingDetailsPinnedMaxTokens=null;_pendingDetailsPinnedModel=null;_pendingDetailsPinnedProvider=null;_pendingDetailsProviderRuntimeOverrides={};_pendingDetailsSubagentMaxTokens=null;_pendingDetailsSubagentMode=`automatic`;_pendingDetailsSubagentModel=null;_pendingDetailsSubagentProvider=null;_pendingDetailsToolTags=null;_pendingRenameGroupId=null;_pendingRenameName=null;_touchDraggedGroupId=null;_touchId=null;_autoScrollActive=!1;_autoScrollSpeed=0;async connectedCallback(){let r=this.shadowRoot;if(!r)throw Error(`shadowRoot not found`);this.db=await t();let i=await n(this.db,e.CONVERSATIONS_HEIGHT);i&&typeof i==`number`&&i>0&&(this.style.flex=`none`,this.style.height=`${i}px`),this.channelRegistry=c.orchestrator?.channelRegistry||null,this.shadowRoot.querySelector(`[data-action='create']`)?.addEventListener(`click`,()=>this.handleCreate()),this._setupDialogListeners(),this._initResizeHandle(),r.addEventListener(`dragover`,e=>{this._draggedGroupId!==null&&this._updateAutoScrollSpeed(e.clientY)}),r.addEventListener(`dragend`,()=>{this._stopAutoScroll()}),r.addEventListener(`drop`,()=>{this._stopAutoScroll()}),this.render(),this._effectCleanup=d(()=>{c.groups,c.activeGroupId,c.unreadGroupIds,this.render()})}disconnectedCallback(){this._effectCleanup&&=(this._effectCleanup(),null)}getChannelRegistry(){let e=c.orchestrator?.channelRegistry||null;return e&&(this.channelRegistry=e),this.channelRegistry}openCloneDialog(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.conversations__clone-dialog`),r=n?.querySelector(`.conversations__clone-name`);n&&(r&&(r.textContent=e),n.showModal())}openCreateDialog(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.conversations__create-dialog`),n=e.querySelector(`.conversations__create-dialog .conversations__input`);t&&(t.showModal(),n&&(n.value=``,n.focus()))}openDeleteDialog(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.conversations__delete-dialog`),r=n?.querySelector(`.conversations__delete-name`),i=n?.querySelector(`.conversations__cancel`);n&&(r&&(r.textContent=e),n.showModal(),i?.focus())}openDetailsDialog(e,t){let n=this.shadowRoot;if(!n)return;let i=n.querySelector(`.conversations__details-dialog`),o=n.querySelector(`.conversations__details-dialog .conversations__input`),l=n.querySelector(`#conversations-details-group-id`),u=n.querySelector(`#conversations-group-id-copy-btn`),d=n.querySelector(`#conversations-details-tools`),f=n.querySelector(`#conversations-tool-input`),p=n.querySelector(`#conversations-add-tool-btn`),m=n.querySelector(`#conversations-available-tools`),h=n.querySelector(`#conversations-main-picker`),g=n.querySelector(`#conversations-main-provider-module-settings`),_=n.querySelector(`#conversations-agent-max-tokens`),v=n.querySelector(`#conversations-subagent-settings-container`),y=n.querySelector(`#conversations-subagent-mode`),b=n.querySelector(`#conversations-subagent-max-tokens`),x=n.querySelector(`#conversations-subagent-manual-container`),S=n.querySelector(`#conversations-subagent-picker`),C=n.querySelector(`#conversations-subagent-provider-module-settings`);if(l&&(l.value=t?.replace(`:`,`-`)||``),u&&l){let e=u.cloneNode(!0);u.replaceWith(e),e.addEventListener(`click`,async()=>{let t=l.value;if(t)try{await navigator.clipboard.writeText(t);let n=e.innerHTML;r(e,`<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`),e.classList.add(`conversations__group-id-copy-btn--copied`),setTimeout(()=>{r(e,n),e.classList.remove(`conversations__group-id-copy-btn--copied`)},1500)}catch{l.select()}})}let w=n.querySelector(`#conversations-details-participants-container`),T=n.querySelector(`#conversations-details-participants-list`);if(w&&T)if(t&&t.startsWith(`peer:`)){w.style.display=`block`,T.replaceChildren();let e=c.orchestrator;if(e){let n=e.peerjs?.connectedPeersSignal?.get()||[],r=t.replace(`peer:`,``);if(n.includes(r)){let t=``;if(e.peerjsPeerAliases){for(let[n,i]of Object.entries(e.peerjsPeerAliases))if(i===r){t=n;break}}let n=t?`${t} (${r.substring(0,8)})`:r,i=document.createElement(`div`);i.className=`conversations__group-id-row`;let a=document.createElement(`input`);a.className=`conversations__input conversations__group-id-input`,a.type=`text`,a.readOnly=!0,a.value=n,a.style.marginBottom=`0`;let o=document.createElement(`button`);o.type=`button`,o.className=`conversations__group-id-copy-btn`,o.title=`Copy Peer ID`,o.setAttribute(`aria-label`,`Copy Peer ID to clipboard`),o.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg>`,o.addEventListener(`click`,async()=>{try{await navigator.clipboard.writeText(r);let e=o.innerHTML;o.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" height="1em" width="1em" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>`,o.classList.add(`conversations__group-id-copy-btn--copied`),setTimeout(()=>{o.innerHTML=e,o.classList.remove(`conversations__group-id-copy-btn--copied`)},1500)}catch{a.value=r,a.select()}}),i.appendChild(a),i.appendChild(o),T.appendChild(i)}else{let e=document.createElement(`div`);e.style.fontSize=`0.875rem`,e.style.color=`var(--text-secondary)`,e.textContent=`Peer is not currently connected.`,T.appendChild(e)}}}else w.style.display=`none`;if(!i)return;i.showModal();let E=()=>{if(!m)return;let e=new Set(this._pendingDetailsToolTags||[]);m.replaceChildren();for(let t of s){if(e.has(t.name))continue;let n=document.createElement(`option`);n.value=t.name,m.appendChild(n)}},D=()=>{if(!d)return;d.replaceChildren();let e=this._pendingDetailsToolTags||[];for(let t of e){let e=s.find(e=>e.name===t),n=document.createElement(`span`);n.className=`conversations__tool-chip`;let r=document.createElement(`span`);r.textContent=t,e&&(r.title=e.description),n.appendChild(r);let i=document.createElement(`button`);i.type=`button`,i.className=`conversations__tool-chip-remove`,i.textContent=`×`,i.setAttribute(`aria-label`,`Remove tool ${t}`),i.addEventListener(`click`,()=>{this._pendingDetailsToolTags&&(this._pendingDetailsToolTags=this._pendingDetailsToolTags.filter(e=>e!==t),D())}),n.appendChild(i),d.appendChild(n)}if(E(),v&&y){let e=this._isSpawnSubagentEnabledInCurrentScope();v.style.display=e?`flex`:`none`,e||(this._pendingDetailsSubagentMode=`automatic`),x&&(x.style.display=this._pendingDetailsSubagentMode===`manual`&&e?`flex`:`none`),b&&(b.value=typeof this._pendingDetailsSubagentMaxTokens==`number`&&Number.isFinite(this._pendingDetailsSubagentMaxTokens)&&this._pendingDetailsSubagentMaxTokens>0?String(Math.floor(this._pendingDetailsSubagentMaxTokens)):``)}};if(p&&f&&(p.onclick=()=>{let e=f.value.trim();if(e){if(!s.find(t=>t.name===e)){f.value=``;return}this._pendingDetailsToolTags||=[],this._pendingDetailsToolTags.includes(e)||(this._pendingDetailsToolTags.push(e),D()),f.value=``}},f.onkeydown=e=>{e.key===`Enter`&&(e.preventDefault(),p.click())}),D(),h&&g&&y&&v&&x&&S&&C){let e=a()||[];h.setLabels({providerLabel:`Pinned Provider`,defaultProviderLabel:`Default (Global)`,modelLabel:`Pinned Model`,defaultModelLabel:`Default Model`,customModelPlaceholder:`Custom model id`}),h.setModelLoader(e=>this._loadProviderModels(e)),h.setProviders(e),h.setValue({providerId:this._pendingDetailsPinnedProvider,modelId:this._pendingDetailsPinnedModel}),g.setProvider(this._pendingDetailsPinnedProvider),_&&(_.value=typeof this._pendingDetailsPinnedMaxTokens==`number`&&Number.isFinite(this._pendingDetailsPinnedMaxTokens)&&this._pendingDetailsPinnedMaxTokens>0?String(Math.floor(this._pendingDetailsPinnedMaxTokens)):``),g.setOverrides(this._pendingDetailsProviderRuntimeOverrides),S.setLabels({providerLabel:`Pinned Subagent Provider`,defaultProviderLabel:`Default (Parent Provider)`,modelLabel:`Pinned Subagent Model`,defaultModelLabel:`Default Model`,customModelPlaceholder:`Custom subagent model id`}),S.setModelLoader(e=>this._loadProviderModels(e)),S.setProviders(e),S.setValue({providerId:this._pendingDetailsSubagentProvider,modelId:this._pendingDetailsSubagentModel}),C.setProvider(this._pendingDetailsSubagentProvider),C.setOverrides(this._pendingDetailsProviderRuntimeOverrides),h.hasAttribute(`data-bound`)||(h.addEventListener(`provider-model-change`,e=>{let t=e.detail||{};this._pendingDetailsPinnedProvider=t.providerId||null,this._pendingDetailsPinnedModel=t.modelId||null,g.setProvider(this._pendingDetailsPinnedProvider),g.setOverrides(this._pendingDetailsProviderRuntimeOverrides)}),h.setAttribute(`data-bound`,`true`)),_?.hasAttribute(`data-bound`)||(_?.addEventListener(`input`,()=>{let e=Number(_.value);Number.isFinite(e)&&e>0?this._pendingDetailsPinnedMaxTokens=Math.floor(e):this._pendingDetailsPinnedMaxTokens=null}),_?.setAttribute(`data-bound`,`true`)),g.hasAttribute(`data-bound`)||(g.addEventListener(`provider-module-settings-change`,e=>{let t=e.detail||{},n=t.providerId,r=t.overrides;if(!n)return;let i=JSON.parse(JSON.stringify(this._pendingDetailsProviderRuntimeOverrides||{}));n===`llamafile`?i.llamafile=r.llamafile:n===`bedrock_proxy`&&(i.bedrock_proxy=r.bedrock_proxy),this._pendingDetailsProviderRuntimeOverrides=i,h.invalidateProviderModels(n),S.invalidateProviderModels(n)}),g.setAttribute(`data-bound`,`true`)),S.hasAttribute(`data-bound`)||(S.addEventListener(`provider-model-change`,e=>{let t=e.detail||{};this._pendingDetailsSubagentProvider=t.providerId||null,this._pendingDetailsSubagentModel=t.modelId||null,C.setProvider(this._pendingDetailsSubagentProvider),C.setOverrides(this._pendingDetailsProviderRuntimeOverrides)}),S.setAttribute(`data-bound`,`true`)),C.hasAttribute(`data-bound`)||(C.addEventListener(`provider-module-settings-change`,e=>{let t=e.detail||{},n=t.providerId,r=t.overrides;if(!n)return;let i=JSON.parse(JSON.stringify(this._pendingDetailsProviderRuntimeOverrides||{}));n===`llamafile`?i.llamafile=r.llamafile:n===`bedrock_proxy`&&(i.bedrock_proxy=r.bedrock_proxy),this._pendingDetailsProviderRuntimeOverrides=i,h.invalidateProviderModels(n),S.invalidateProviderModels(n)}),C.setAttribute(`data-bound`,`true`)),y.value=this._pendingDetailsSubagentMode;let t=this._isSpawnSubagentEnabledInCurrentScope();v.style.display=t?`flex`:`none`,g.style.display=this._pendingDetailsPinnedProvider?`flex`:`none`,x.style.display=t&&this._pendingDetailsSubagentMode===`manual`?`flex`:`none`,C.style.display=t&&this._pendingDetailsSubagentMode===`manual`&&this._pendingDetailsSubagentProvider?`flex`:`none`,y.onchange=()=>{this._pendingDetailsSubagentMode=y.value===`manual`?`manual`:`automatic`,x.style.display=this._pendingDetailsSubagentMode===`manual`&&this._isSpawnSubagentEnabledInCurrentScope()?`flex`:`none`,C.style.display=this._pendingDetailsSubagentMode===`manual`&&this._isSpawnSubagentEnabledInCurrentScope()&&this._pendingDetailsSubagentProvider?`flex`:`none`},b?.hasAttribute(`data-bound`)||(b?.addEventListener(`input`,()=>{let e=Number(b.value);Number.isFinite(e)&&e>0?this._pendingDetailsSubagentMaxTokens=Math.floor(e):this._pendingDetailsSubagentMaxTokens=null}),b?.setAttribute(`data-bound`,`true`))}o&&(o.value=e,o.select(),o.focus())}async handleClone(e){if(!this.db)return;let t=(c.groups||[]).find(t=>t.groupId===e);t&&(this._pendingCloneGroupId=e,this.openCloneDialog(t.name))}async handleCreate(){this.db&&this.openCreateDialog()}async handleDelete(e,t){this.db&&(this._pendingDeleteGroupId=e,this.openDeleteDialog(t))}async handleDetails(e,t){if(!this.db)return;this._pendingRenameGroupId=e,this._pendingRenameName=t;let n=(c.groups||[]).find(t=>t.groupId===e),r=n?.toolTags||[];this._pendingDetailsToolTags=[...r],this._pendingDetailsPinnedMaxTokens=typeof n?.pinnedMaxTokens==`number`&&Number.isFinite(n.pinnedMaxTokens)&&n.pinnedMaxTokens>0?Math.floor(n.pinnedMaxTokens):null,this._pendingDetailsPinnedProvider=n?.pinnedProvider||null,this._pendingDetailsPinnedModel=n?.pinnedModel||null,this._pendingDetailsProviderRuntimeOverrides=JSON.parse(JSON.stringify(n?.providerRuntimeOverrides||{})),this._pendingDetailsSubagentMode=n?.subagentModelSelectionMode===`manual`?`manual`:`automatic`,this._pendingDetailsSubagentMaxTokens=typeof n?.subagentMaxTokens==`number`&&Number.isFinite(n.subagentMaxTokens)&&n.subagentMaxTokens>0?Math.floor(n.subagentMaxTokens):null,this._pendingDetailsSubagentProvider=n?.subagentPinnedProvider||null,this._pendingDetailsSubagentModel=n?.subagentPinnedModel||null,this.openDetailsDialog(t,e)}async handleReorder(e,t,n){if(!this.db)return;if(n){await c.reorderConversations(this.db,n);return}let r=(c.groups||[]).map(e=>e.groupId),i=r.indexOf(e),a=r.indexOf(t);i<0||a<0||(r.splice(i,1),r.splice(a,0,e),await c.reorderConversations(this.db,r))}async handleSwitch(e){if(e===c.activeGroupId)return;let t=c.activePage,n=t===`chat`||t===`tasks`||t===`files`?t:c.sidebarDefaultPage??`chat`;document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:n,groupId:e},bubbles:!0,composed:!0}))}async render(){let e=this.shadowRoot.querySelector(`.conversation-list`);if(!e)return;let t=c.groups||[],n=c.activeGroupId,r=c.unreadGroupIds||new Set,i=this.getChannelRegistry();e.replaceChildren();for(let a=0;a<t.length;a++){let o=t[a],s=o.groupId===n,c=!s&&r.has(o.groupId),l=document.createElement(`li`);l.className=`conversation-item${s?` active`:``}${c?` unread`:``}`,l.setAttribute(`data-group-id`,o.groupId),l.setAttribute(`role`,`listitem`),l.setAttribute(`tabindex`,`0`),l.setAttribute(`aria-describedby`,`reorder-instructions`),l.setAttribute(`aria-label`,`${o.name}, position ${a+1} of ${t.length}`),this._keyboardGrabbedId===o.groupId&&(l.classList.add(`keyboard-grabbed`),l.setAttribute(`aria-grabbed`,`true`));let u=i?i.getBadge(o.groupId):``,d=t.length>1,f=document.createElement(`span`);if(f.className=`drag-handle`,f.setAttribute(`draggable`,`true`),f.setAttribute(`aria-hidden`,`true`),f.setAttribute(`title`,`Drag to reorder`),f.textContent=`⠿`,l.append(f),u){let e=document.createElement(`span`);e.className=`channel-badge`,e.textContent=u,l.append(e)}if(o.toolTags&&o.toolTags.length>0){let e=document.createElement(`span`);e.className=`tool-badge`,e.textContent=`🔧`,e.title=`Pinned Tools: ${o.toolTags.join(`, `)}`,l.append(e)}let p=document.createElement(`span`);p.className=`conversation-name`,p.textContent=o.name;let m=document.createElement(`span`);m.className=`conversation-actions`;let h=document.createElement(`button`);h.setAttribute(`data-action`,`clone`),h.setAttribute(`title`,`Clone`),h.setAttribute(`aria-label`,`Clone ${o.name}`),h.textContent=`📋`;let g=document.createElement(`button`);if(g.setAttribute(`data-action`,`details`),g.setAttribute(`title`,`Details`),g.setAttribute(`aria-label`,`Details for ${o.name}`),g.textContent=`⚙️`,m.append(h,g),d){let e=document.createElement(`button`);e.setAttribute(`data-action`,`delete`),e.setAttribute(`title`,`Delete`),e.setAttribute(`aria-label`,`Delete ${o.name}`),e.textContent=`🗑️`,m.append(e)}let _=document.createElement(`button`);_.className=`conversation-actions-toggle`,_.setAttribute(`title`,`More actions`),_.setAttribute(`aria-label`,`More actions for ${o.name}`),_.textContent=`⋮`,l.append(p,m,_),l.addEventListener(`click`,e=>{let t=e.target,n=t.closest(`[data-action]`)?.getAttribute(`data-action`);n===`clone`?this.handleClone(o.groupId):n===`details`?this.handleDetails(o.groupId,o.name):n===`delete`?this.handleDelete(o.groupId,o.name):t.closest(`.conversation-actions-toggle`)?l.classList.toggle(`show-actions`):t.closest(`.drag-handle`)||(this.handleSwitch(o.groupId),l.classList.remove(`show-actions`))}),l.addEventListener(`keydown`,e=>{this._handleKeyboard(e,o.groupId,o.name)}),f.addEventListener(`dragstart`,e=>{this._draggedGroupId=o.groupId,l.classList.add(`dragging`),e.dataTransfer?.setData(`text/plain`,o.groupId)}),f.addEventListener(`dragend`,()=>{l.classList.remove(`dragging`),this._draggedGroupId=null,e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`))}),f.addEventListener(`touchstart`,e=>{let t=e.touches[0];t&&(this._touchId=t.identifier,this._touchDraggedGroupId=o.groupId,l.classList.add(`dragging`),e.preventDefault())},{passive:!1}),l.addEventListener(`dragover`,e=>{e.preventDefault(),this._draggedGroupId&&this._draggedGroupId!==o.groupId&&l.classList.add(`drag-over`)}),l.addEventListener(`dragleave`,()=>{l.classList.remove(`drag-over`)}),l.addEventListener(`drop`,e=>{e.preventDefault(),l.classList.remove(`drag-over`),this._draggedGroupId&&this._draggedGroupId!==o.groupId&&this.handleReorder(this._draggedGroupId,o.groupId)}),e.appendChild(l)}this._bindTouchListEvents(e)}_announce(e){let t=this.shadowRoot?.querySelector(`#live-region`);t&&(t.textContent=``,requestAnimationFrame(()=>{t.textContent=e}))}_bindTouchListEvents(e){e._touchBound||(e._touchBound=!0,e.addEventListener(`touchmove`,t=>{if(this._touchDraggedGroupId===null)return;let n=this._findTouch(t);if(!n)return;t.preventDefault();let r=this._itemAtPoint(n.clientX,n.clientY);e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),r&&r.getAttribute(`data-group-id`)!==this._touchDraggedGroupId&&r.classList.add(`drag-over`),this._updateAutoScrollSpeed(n.clientY)},{passive:!1}),e.addEventListener(`touchend`,t=>{if(this._touchDraggedGroupId===null)return;let n=this._findChangedTouch(t);if(!n)return;let r=this._itemAtPoint(n.clientX,n.clientY)?.getAttribute(`data-group-id`);e.querySelectorAll(`.dragging`).forEach(e=>e.classList.remove(`dragging`)),e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),r&&r!==this._touchDraggedGroupId&&this.handleReorder(this._touchDraggedGroupId,r),this._stopAutoScroll(),this._touchDraggedGroupId=null,this._touchId=null}),e.addEventListener(`touchcancel`,()=>{e.querySelectorAll(`.dragging`).forEach(e=>e.classList.remove(`dragging`)),e.querySelectorAll(`.drag-over`).forEach(e=>e.classList.remove(`drag-over`)),this._stopAutoScroll(),this._touchDraggedGroupId=null,this._touchId=null}))}_findChangedTouch(e){for(let t=0;t<e.changedTouches.length;t++){let n=e.changedTouches[t];if(n.identifier===this._touchId)return n}}_findTouch(e){for(let t=0;t<e.touches.length;t++){let n=e.touches[t];if(n.identifier===this._touchId)return n}}_focusNext(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`li[tabindex="0"], button:not([disabled])`)),r=n.indexOf(e);r!==-1&&r<n.length-1&&n[r+1].focus()}_focusNextItem(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.conversation-item`)),r=e.closest(`.conversation-item`),i=n.indexOf(r);i!==-1&&i<n.length-1&&n[i+1].focus()}_focusPrev(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`li[tabindex="0"], button:not([disabled])`)),r=n.indexOf(e);r>0&&n[r-1].focus()}_focusPrevItem(e){let t=this.shadowRoot;if(!t)return;let n=Array.from(t.querySelectorAll(`.conversation-item`)),r=e.closest(`.conversation-item`),i=n.indexOf(r);i>0&&n[i-1].focus()}_handleKeyboard(e,t,n){let r=c.groups||[],i=r.map(e=>e.groupId),a=i.length;if(this._keyboardGrabbedId===null){if(e.key===`ArrowDown`){e.preventDefault(),this._focusNextItem(e.target);return}if(e.key===`ArrowUp`){e.preventDefault(),this._focusPrevItem(e.target);return}if(e.key===`ArrowRight`){e.preventDefault(),this._focusNext(e.target);return}if(e.key===`ArrowLeft`){e.preventDefault(),this._focusPrev(e.target);return}if(e.key===` `||e.key===`Spacebar`||e.key===`Enter`){e.target.classList.contains(`conversation-item`)&&(e.preventDefault(),this.handleSwitch(t));return}if(e.key===`m`||e.key===`M`){e.preventDefault(),this._keyboardGrabbedId=t;let r=i.indexOf(t)+1;this._announce(`${n} grabbed. Current position ${r} of ${a}. Use Arrow Up and Down to move, Space or Enter to drop.`),this.render()}return}if(e.key===`Escape`){e.preventDefault(),this._announce(`Reorder cancelled. ${n} returned to original position.`),this._keyboardGrabbedId=null,this.render();return}if(e.key===` `||e.key===`Spacebar`||e.key===`Enter`){e.preventDefault();let t=i.indexOf(this._keyboardGrabbedId)+1,n=r.find(e=>e.groupId===this._keyboardGrabbedId)?.name||``;this._announce(`${n} dropped at position ${t} of ${a}. Reordering complete.`),this._keyboardGrabbedId=null,this.render();return}if(e.key===`ArrowUp`||e.key===`ArrowDown`){e.preventDefault();let t=i.indexOf(this._keyboardGrabbedId),n=e.key===`ArrowUp`?t-1:t+1;if(n<0||n>=a)return;i.splice(t,1),i.splice(n,0,this._keyboardGrabbedId),this._announce(`Moved to position ${n+1} of ${a}.`),this.handleReorder(this._keyboardGrabbedId,i[t],i)}}_initResizeHandle(){let e=this.shadowRoot.querySelector(`.resize-handle`);if(!e)return;let t=null,n=e=>{if(e.pointerId!==t)return;let n=this.parentElement?.getBoundingClientRect();if(!n)return;let r=this.getBoundingClientRect().bottom-e.clientY,i=n.height-60,a=Math.max(80,Math.min(i,r));this.style.flex=`none`,this.style.height=`${a}px`},r=()=>{t!==null&&(t=null,e.classList.remove(`active`),document.removeEventListener(`pointermove`,n),this._persistHeight())};e.addEventListener(`pointerdown`,r=>{let i=r;i.pointerType===`mouse`&&i.button!==0&&i.button!==-1||(i.preventDefault(),t=i.pointerId,e.classList.add(`active`),e.setPointerCapture(i.pointerId),document.addEventListener(`pointermove`,n))}),e.addEventListener(`pointerup`,e=>{e.pointerId===t&&r()}),e.addEventListener(`pointercancel`,r),e.addEventListener(`dblclick`,()=>{this.style.flex=``,this.style.height=``,this._persistHeight(0)})}_isSpawnSubagentEnabledInCurrentScope(){return Array.isArray(this._pendingDetailsToolTags)&&this._pendingDetailsToolTags.length>0?this._pendingDetailsToolTags.includes(`spawn_subagent`):o.enabledToolNames.has(`spawn_subagent`)}_itemAtPoint(e,t){let n=this.shadowRoot;return n&&n.elementFromPoint(e,t)?.closest?.(`.conversation-item`)||null}_startAutoScroll(){if(this._autoScrollActive)return;this._autoScrollActive=!0;let e=()=>{if(!this._autoScrollActive)return;let t=this.shadowRoot?.querySelector(`.conversation-list`);t&&this._autoScrollSpeed!==0&&(t.scrollTop+=this._autoScrollSpeed),requestAnimationFrame(e)};requestAnimationFrame(e)}_stopAutoScroll(){this._autoScrollActive=!1,this._autoScrollSpeed=0}_updateAutoScrollSpeed(e){let t=this.shadowRoot?.querySelector(`.conversation-list`);if(!t){this._autoScrollSpeed=0;return}let n=t.getBoundingClientRect(),r=e-n.top,i=n.bottom-e;r>=0&&r<50?(this._autoScrollSpeed=-((50-r)/50)*8,this._startAutoScroll()):i>=0&&i<50?(this._autoScrollSpeed=(50-i)/50*8,this._startAutoScroll()):this._autoScrollSpeed=0}_setupDialogListeners(){let e=this.shadowRoot,t=e.querySelector(`.conversations__create-dialog`),n=e.querySelector(`.conversations__create-dialog .conversations__form`);e.querySelector(`.conversations__create-dialog .conversations__cancel`)?.addEventListener(`click`,()=>{t?.close()}),n?.addEventListener(`submit`,async e=>{e.preventDefault(),await this._submitCreateDialog()});let r=e.querySelector(`.conversations__details-dialog`),i=e.querySelector(`.conversations__details-dialog .conversations__form`);e.querySelector(`.conversations__details-dialog .conversations__cancel`)?.addEventListener(`click`,()=>{r?.close(),this._pendingRenameGroupId=null,this._pendingRenameName=null,this._pendingDetailsToolTags=null,this._pendingDetailsPinnedProvider=null,this._pendingDetailsPinnedModel=null,this._pendingDetailsProviderRuntimeOverrides={},this._pendingDetailsSubagentMode=`automatic`,this._pendingDetailsSubagentMaxTokens=null,this._pendingDetailsSubagentProvider=null,this._pendingDetailsSubagentModel=null}),i?.addEventListener(`submit`,async e=>{e.preventDefault(),await this._submitDetailsDialog()});let a=e.querySelector(`.conversations__delete-dialog`),o=e.querySelector(`.conversations__delete-dialog .conversations__form`);e.querySelector(`.conversations__delete-dialog .conversations__cancel`)?.addEventListener(`click`,()=>{a?.close(),this._pendingDeleteGroupId=null}),o?.addEventListener(`submit`,async e=>{e.preventDefault(),await this._submitDeleteDialog()});let s=e.querySelector(`.conversations__clone-dialog`),c=e.querySelector(`.conversations__clone-dialog .conversations__form`);e.querySelector(`.conversations__clone-dialog .conversations__cancel`)?.addEventListener(`click`,()=>{s?.close(),this._pendingCloneGroupId=null}),c?.addEventListener(`submit`,async e=>{e.preventDefault(),await this._submitCloneDialog()})}async _loadProviderModels(e){if(Array.isArray(e.models)&&e.models.length>0)return e.models;if(!e.modelsUrl)return[];let t={...e.headers||{},...c.orchestrator?i(c.orchestrator,e.id,``,this._pendingDetailsProviderRuntimeOverrides):{}};if(this.db&&e.apiKeyHeader&&c.orchestrator){let n=await c.orchestrator.getApiKeyForSpecificProvider(this.db,e.id);if(n){let r=e.apiKeyHeaderFormat||`{key}`;t[e.apiKeyHeader]=r.replace(`{key}`,n)}}let n=await fetch(e.modelsUrl,{headers:t});if(!n.ok)throw Error(`HTTP ${n.status}`);let r=await n.json(),a=[];if(Array.isArray(r))a=r;else if(r&&typeof r==`object`){let e=r;if(Array.isArray(e.models))a=e.models;else if(Array.isArray(e.data))a=e.data;else{for(let t of Object.values(e))if(Array.isArray(t)&&t.length>0){a=t;break}a.length===0&&(e.id||e.name)&&(a=[e])}}if(Array.isArray(e.models)&&e.models.length>0){let t=new Set(a.map(e=>typeof e==`string`?e:e.id||e.name||``).filter(Boolean));a=[...e.models.filter(e=>{let n=typeof e==`string`?e:e.id||e.name||``;return n&&!t.has(n)}),...a]}return a}async _persistHeight(t){if(!this.db)return;let n=t===void 0?this.getBoundingClientRect().height:t;await l(this.db,e.CONVERSATIONS_HEIGHT,n||0)}async _submitCloneDialog(){let e=this.shadowRoot;if(!e||!this.db||!this._pendingCloneGroupId)return;let t=e.querySelector(`.conversations__clone-dialog`);await c.cloneConversation(this.db,this._pendingCloneGroupId),t?.close(),this._pendingCloneGroupId=null}async _submitCreateDialog(){let e=this.shadowRoot;if(!e||!this.db)return;let t=e.querySelector(`.conversations__create-dialog .conversations__input`),n=e.querySelector(`.conversations__create-dialog`),r=t?.value.trim();r&&(await c.createConversation(this.db,r),n?.close())}async _submitDeleteDialog(){let e=this.shadowRoot;if(!e||!this.db||!this._pendingDeleteGroupId)return;let t=e.querySelector(`.conversations__delete-dialog`);await c.deleteConversation(this.db,this._pendingDeleteGroupId),t?.close(),this._pendingDeleteGroupId=null}async _submitDetailsDialog(){let e=this.shadowRoot;if(!e||!this.db||!this._pendingRenameGroupId||!this._pendingRenameName)return;let t=e.querySelector(`.conversations__details-dialog .conversations__input`),n=e.querySelector(`.conversations__details-dialog`),r=t?.value.trim();r&&r!==this._pendingRenameName&&await c.renameConversation(this.db,this._pendingRenameGroupId,r),this._pendingDetailsToolTags&&await c.updateConversationToolTags(this.db,this._pendingRenameGroupId,this._pendingDetailsToolTags),await c.updateConversationPinnedProvider(this.db,this._pendingRenameGroupId,this._pendingDetailsPinnedProvider||void 0,this._pendingDetailsPinnedModel||void 0,this._pendingDetailsPinnedMaxTokens||void 0),await c.updateConversationProviderRuntimeOverrides(this.db,this._pendingRenameGroupId,this._pendingDetailsProviderRuntimeOverrides),await c.updateConversationSubagentSettings(this.db,this._pendingRenameGroupId,this._pendingDetailsSubagentMode,this._pendingDetailsSubagentProvider||void 0,this._pendingDetailsSubagentModel||void 0,this._pendingDetailsSubagentMaxTokens||void 0),n?.close(),this._pendingRenameGroupId=null,this._pendingRenameName=null,this._pendingDetailsToolTags=null,this._pendingDetailsPinnedMaxTokens=null,this._pendingDetailsPinnedProvider=null,this._pendingDetailsPinnedModel=null,this._pendingDetailsProviderRuntimeOverrides={},this._pendingDetailsSubagentMode=`automatic`,this._pendingDetailsSubagentMaxTokens=null,this._pendingDetailsSubagentProvider=null,this._pendingDetailsSubagentModel=null}};customElements.define(`shadow-claw-conversations`,N);export{N as ShadowClawConversations};