import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{t as r}from"./setConfig-DFMYnYLE.js";import{i,n as a,r as o,t as s}from"./push-client-QYVaWJyz.js";import{r as c,t as l}from"./toast-D3gxhZpN.js";import{t as u}from"./shadow-claw-element-na_3JW5e.js";import"./shadow-claw-empty-state-CbZ2vrOx.js";const d=new CSSStyleSheet;d.replaceSync(`*,
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

.toggle-row {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.toggle-switch {
  background-color: var(--shadow-claw-bg-tertiary);
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  flex-shrink: 0;
  height: 1.5rem;
  position: relative;
  transition: background-color 200ms;
  width: 2.75rem;
}

.toggle-switch::after {
  background: white;
  border-radius: 50%;
  content: "";
  height: 1.125rem;
  left: 0.1875rem;
  position: absolute;
  top: 0.1875rem;
  transition: transform 200ms;
  width: 1.125rem;
}

.toggle-switch[aria-checked="true"] {
  background-color: var(--shadow-claw-success-color, #22c55e);
}

.toggle-switch[aria-checked="true"]::after {
  transform: translateX(1.25rem);
}

.status-text {
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 500;
}

.subscription-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 12rem;
  overflow-y: auto;
}

.subscription-item {
  align-items: center;
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  transition: border-color 150ms;
}

.subscription-item:hover {
  border-color: var(--shadow-claw-text-tertiary);
}

.subscription-item.selected {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-accent-primary);
}

.subscription-id {
  color: var(--shadow-claw-text-secondary);
  flex: 1;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-date {
  color: var(--shadow-claw-text-tertiary);
  flex-shrink: 0;
  font-size: 0.6875rem;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.settings-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 62.5rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.5rem 0.75rem;
  transition: all 150ms cubic-bezier(0.33, 1, 0.68, 1);
}

.settings-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-text-primary);
}

.settings-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.settings-btn.danger {
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-error-color);
}

.notification-input {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.375rem;
  box-sizing: border-box;
  color: var(--shadow-claw-text-primary);
  font-family: var(--shadow-claw-font-sans);
  font-size: 0.8125rem;
  padding: 0.5rem 0.625rem;
  width: 100%;
}

.notification-input:focus {
  border-color: var(--shadow-claw-accent-primary);
  outline: none;
}
`);const f=new DOMParser().parseFromString(`<template>
  <div class="settings-section">
    <h3>🔔 Push Notifications</h3>

    <div class="form-group">
      <div class="toggle-row">
        <button
          aria-checked="false"
          class="toggle-switch"
          data-action="toggle-push"
          role="switch"
        ></button>
        <span class="status-text" data-info="subscription-status">
          Disabled
        </span>
      </div>
      <div class="form-helper">
        Enable push notifications to receive alerts even when the app is in the
        background. Your browser will ask for permission.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label" for="push-proxy-url">Push Proxy URL</label>
      <input
        class="notification-input"
        data-input="push-proxy-url"
        id="push-proxy-url"
        placeholder="e.g. http://localhost:8888"
        type="url"
      />
      <div class="form-helper">
        If you are hosting ShadowClaw on a static site, enter the URL of your
        push proxy here.
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Stored Subscriptions</label>
      <div class="subscription-list" data-info="subscription-list">
        <shadow-claw-empty-state
          compact
          message="No subscriptions stored."
        ></shadow-claw-empty-state>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Send Notification</label>
      <input
        class="notification-input"
        data-input="notification-text"
        placeholder="Enter notification message…"
        type="text"
      />
      <div class="action-row">
        <button class="settings-btn" data-action="send-notification" disabled>
          📤 Send to Selected
        </button>
        <button
          class="danger settings-btn"
          data-action="delete-subscription"
          disabled
        >
          🗑️ Delete Selected
        </button>
        <button class="settings-btn" data-action="refresh-subscriptions">
          🔄 Refresh
        </button>
      </div>
    </div>
  </div>
</template>
`,`text/html`),p=f.querySelector(`template`);let m=[];m=p?Array.from(p.content.children):Array.from(f.head.children).concat(Array.from(f.body.children));var h=m,g=class extends u{static styles=d;static template=h;_backendAvailable=!0;_selectedId=null;_subscribed=!1;_subscriptions=[];constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);await this.refreshState(),await this.loadProxyConfig(),await this.loadSubscriptions(),this.bindEventListeners()}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-action="toggle-push"]`)?.addEventListener(`click`,()=>this.handleToggle()),e.querySelector(`[data-action="send-notification"]`)?.addEventListener(`click`,()=>this.handleSendNotification()),e.querySelector(`[data-action="delete-subscription"]`)?.addEventListener(`click`,()=>this.handleDeleteSubscription()),e.querySelector(`[data-action="refresh-subscriptions"]`)?.addEventListener(`click`,()=>this.loadSubscriptions()),e.querySelector(`[data-input="push-proxy-url"]`)?.addEventListener(`change`,e=>this.handleProxyUrlChange(e)))}renderSubscriptionList(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-info="subscription-list"]`);if(t){if(t.replaceChildren(),this._subscriptions.length===0){let e=this._backendAvailable?`No subscriptions stored.`:`⚠️ Backend services unavailable (push notification server is not running).`,n=document.createElement(`shadow-claw-empty-state`);n.setAttribute(`compact`,``),n.setAttribute(`message`,e),t.append(n);return}this._subscriptions.forEach(e=>{let n=`#${e.id}`,r=e.endpoint.length>60?`…${e.endpoint.slice(-56)}`:e.endpoint,i=e.created_at||``,a=document.createElement(`div`);a.className=`subscription-item${this._selectedId===e.id?` selected`:``}`,a.setAttribute(`data-sub-id`,String(e.id)),a.setAttribute(`data-endpoint`,e.endpoint);let o=document.createElement(`span`);o.className=`subscription-id`,o.title=e.endpoint,o.textContent=`${n} ${r}`;let s=document.createElement(`span`);s.className=`subscription-date`,s.textContent=i,a.append(o,s),a.addEventListener(`click`,()=>{this._selectedId=e.id,this.renderSubscriptionList(),this.updateActionButtons()}),t.append(a)})}}updateActionButtons(){let e=this.shadowRoot;if(!e)return;let t=this._selectedId!=null,n=e.querySelector(`[data-action="send-notification"]`),r=e.querySelector(`[data-action="delete-subscription"]`);n&&(n.disabled=!t),r&&(r.disabled=!t)}updateToggle(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-action="toggle-push"]`),n=e.querySelector(`[data-info="subscription-status"]`);t&&t.setAttribute(`aria-checked`,String(this._subscribed)),n&&(n.textContent=this._subscribed?`Enabled`:`Disabled`)}async handleDeleteSubscription(){if(this._selectedId!=null)try{let e=await a(`/push/subscription/${this._selectedId}`);(await fetch(e,{method:`DELETE`})).ok?(c(`Subscription deleted.`),await this.loadSubscriptions()):l(`Failed to delete subscription.`)}catch(e){l(`Delete failed: ${e.message}`)}}async handleProxyUrlChange(n){let i=n.target.value.trim();try{await r(await t(),e.PUSH_PROXY_URL,i),c(`Push proxy URL updated.`),await this.loadSubscriptions()}catch(e){l(`Failed to save proxy URL: ${e.message}`)}}async handleSendNotification(){if(this._selectedId==null)return;let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-input="notification-text"]`)?.value?.trim()||`Test notification from ShadowClaw`,n=this._subscriptions.find(e=>e.id===this._selectedId);if(n)try{let e=await a(`/push/send`),r=await fetch(e,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({endpoint:n.endpoint,payload:t})});r.ok?c(`Notification sent!`):r.status===410?(l(`Subscription expired and was removed.`),await this.loadSubscriptions()):l(`Failed to send: ${(await r.json().catch(()=>({}))).error||r.statusText}`)}catch(e){l(`Send failed: ${e.message}`)}}async handleToggle(){try{this._subscribed?(await i(),this._subscribed=!1,c(`Push notifications disabled.`)):(await o(),this._subscribed=!0,c(`Push notifications enabled!`)),this.updateToggle(),await this.loadSubscriptions()}catch(e){l(`Push notification error: ${e.message}`)}}async loadProxyConfig(){let r=this.shadowRoot;if(!r)return;let i=await n(await t(),e.PUSH_PROXY_URL),a=r.querySelector(`[data-input="push-proxy-url"]`);a&&(a.value=i||``)}async loadSubscriptions(){if(this.shadowRoot){try{let e=await a(`/push/subscriptions`),t=await fetch(e);if(!t.ok)return;this._subscriptions=await t.json(),this._backendAvailable=!0}catch{this._subscriptions=[],this._backendAvailable=!1}this._selectedId=null,this.renderSubscriptionList(),this.updateActionButtons()}}async refreshState(){try{let e=await s();this._subscribed=!!e,this.updateToggle()}catch{this._subscribed=!1,this.updateToggle()}}};customElements.define(`shadow-claw-notifications`,g);export{g as ShadowClawNotifications};