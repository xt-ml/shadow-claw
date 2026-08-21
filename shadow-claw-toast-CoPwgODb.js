import{t as e}from"./toast-60iDlgiH.js";import{t}from"./shadow-claw-element-na_3JW5e.js";import{t as n}from"./effect-BEsuusE8.js";const r=new CSSStyleSheet;r.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
}

:host {
  --toast-gap: 0.625rem;
  --toast-padding: 0.75rem;
  bottom: 1rem;
  display: block;
  pointer-events: none;
  position: fixed;
  right: 1rem;
  z-index: 9999;
}

.toast-container {
  display: flex;
  flex-direction: column;
  gap: var(--toast-gap);
  max-width: min(20rem, calc(100vw - 2rem));
  width: min(20rem, calc(100vw - 2rem));
}

.toast {
  align-items: flex-start;
  animation: toast-enter 100ms ease-out;
  background: var(--shadow-claw-bg-secondary);
  border-left: 0.25rem solid var(--toast-accent);
  border-radius: var(--shadow-claw-radius-m, 0.75rem);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
  display: grid;
  gap: 0.5rem;
  grid-template-columns: auto 1fr auto;
  opacity: 1;
  padding: var(--toast-padding);
  pointer-events: auto;
  transform: translateX(0);
}

.toast.exiting {
  animation: toast-exit 150ms ease-in forwards;
}

.toast.success {
  --toast-accent: var(--shadow-claw-success-color);
}

.toast.warning {
  --toast-accent: var(--shadow-claw-warning-color);
}

.toast.error {
  --toast-accent: var(--shadow-claw-error-color);
}

.toast.info {
  --toast-accent: var(--shadow-claw-accent-primary);
}

.toast-icon {
  color: var(--toast-accent);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
  margin-top: 0.0625rem;
}

.toast-message {
  font-size: var(--shadow-claw-font-size-sm);
  line-height: 1.4;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.toast-actions {
  align-items: center;
  display: flex;
  gap: 0.375rem;
  grid-column: 2 / 4;
  justify-content: flex-end;
}

.toast-action,
.toast-close {
  align-items: center;
  background: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.5rem);
  color: var(--shadow-claw-text-primary);
  cursor: pointer;
  display: inline-flex;
  font-size: 0.75rem;
  font-weight: 600;
  justify-content: center;
  min-height: 1.75rem;
  padding: 0.25rem 0.5rem;
}

.toast-action:hover,
.toast-close:hover {
  background: var(--shadow-claw-bg-tertiary);
}

.toast-action:focus-visible,
.toast-close:focus-visible {
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
  outline: 0.0625rem solid var(--shadow-claw-accent-primary);
  outline-offset: 0.0625rem;
}

.toast-close {
  border: none;
  font-size: var(--shadow-claw-font-size-md);
  font-weight: 400;
  line-height: 1;
  margin-left: 0.375rem;
  min-height: auto;
  min-width: 1.75rem;
  padding: 0.125rem;
}

@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(1.5rem);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-exit {
  from {
    opacity: 1;
    transform: translateX(0);
  }

  to {
    opacity: 0;
    transform: translateX(150%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toast,
  .toast.exiting {
    animation: none;
  }
}

@media (max-width: 47.9375rem) {
  :host {
    bottom: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
  }

  .toast-container {
    max-width: 100%;
    width: 100%;
  }
}
`);const i=new DOMParser().parseFromString(`<template>
  <div aria-atomic="false" aria-live="polite" class="toast-container"></div>
</template>
`,`text/html`),a=i.querySelector(`template`);let o=[];o=a?Array.from(a.content.children):Array.from(i.head.children).concat(Array.from(i.body.children));var s=o;const c=`shadow-claw-toast`;var l=class extends t{static styles=r;static template=s;exitingToasts=new Set;constructor(){super(),this.handleKeyDown=this.handleKeyDown.bind(this)}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);await this.render(),this.cleanup=n(()=>{e.toasts,this.render()})}disconnectedCallback(){this.cleanup(),this.shadowRoot?.removeEventListener(`keydown`,this.handleKeyDown)}cleanup=()=>{};iconForType(e){return e===`success`?`✓`:e===`error`?`!`:e===`warning`?`⚠`:`i`}async dismissWithAnimation(t){this.exitingToasts.has(t)||(this.exitingToasts.add(t),await this.render(),globalThis.setTimeout(()=>{this.exitingToasts.delete(t),e.dismiss(t)},150))}async handleKeyDown(e){if(!(e instanceof KeyboardEvent)||e.key!==`Escape`)return;let t=e.target;if(!(t instanceof Element))return;let n=t.closest(`.toast`);if(!(n instanceof HTMLElement))return;let r=Number(n.dataset.toastId);Number.isFinite(r)&&(e.preventDefault(),await this.dismissWithAnimation(r))}async render(){let t=this.shadowRoot;if(!t)return;t.addEventListener(`keydown`,this.handleKeyDown);let n=t.querySelector(`.toast-container`);if(!(n instanceof HTMLElement))return;let r=e.toasts;n.replaceChildren(),r.forEach(t=>{let r=document.createElement(`article`);r.className=`toast ${t.type}`,r.dataset.toastId=String(t.id),r.setAttribute(`role`,t.type===`error`?`alert`:`status`),r.setAttribute(`aria-live`,t.type===`error`?`assertive`:`polite`);let i=document.createElement(`div`);i.className=`toast-icon`,i.setAttribute(`aria-hidden`,`true`),i.textContent=this.iconForType(t.type);let a=document.createElement(`div`);a.className=`toast-message`,a.textContent=t.message;let o=document.createElement(`button`);if(o.className=`toast-close`,o.setAttribute(`aria-label`,`Dismiss notification`),o.type=`button`,o.textContent=`×`,r.append(i,a,o),t.action){let n=document.createElement(`div`);n.className=`toast-actions`;let i=document.createElement(`button`);i.type=`button`,i.className=`toast-action`,i.textContent=t.action.label,n.appendChild(i),r.appendChild(n),i.addEventListener(`click`,async()=>{try{await e.runAction(t.id)}finally{this.dismissWithAnimation(t.id)}})}o.addEventListener(`click`,()=>this.dismissWithAnimation(t.id)),r.addEventListener(`mouseenter`,()=>e.pause(t.id)),r.addEventListener(`mouseleave`,()=>e.resume(t.id)),this.exitingToasts.has(t.id)&&r.classList.add(`exiting`),n.appendChild(r)})}};customElements.get(c)||customElements.define(c,l);export{l as ShadowClawToast};