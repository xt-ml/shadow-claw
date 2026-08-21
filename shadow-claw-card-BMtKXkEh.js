import{t as e}from"./shadow-claw-element-na_3JW5e.js";const t=new CSSStyleSheet;t.replaceSync(`:host {
  display: contents;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

button {
  background: none;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  transition:
    color 0.15s,
    background-color 0.15s;
}

button:hover {
  background-color: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
}

button.delete-btn:hover {
  color: var(--shadow-claw-important-color);
}
`);const n=new DOMParser().parseFromString(`<template>
  <div class="actions" role="group" aria-label="Item actions"></div>
</template>
`,`text/html`),r=n.querySelector(`template`);let i=[];i=r?Array.from(r.content.children):Array.from(n.head.children).concat(Array.from(n.body.children));var a=i;const o=`shadow-claw-actions`;var s=class extends e{static styles=t;static template=a;attributeChangedCallback(){this.render()}async connectedCallback(){this.shadowRoot?.addEventListener(`click`,e=>{let t=e.target;if(!(t instanceof HTMLButtonElement))return;let n=t.getAttribute(`data-action`),r=this.getAttribute(`item-id`);!n||!r||this.dispatchEvent(new CustomEvent(`settings-action`,{detail:{action:n,id:r},bubbles:!0,composed:!0}))}),await this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.actions`);if(!t)return;let n=this.getAttribute(`kind`)||`account`,r=this.hasAttribute(`is-default`);t.replaceChildren();let i=(e,t,n=!1)=>{let r=document.createElement(`button`);return r.setAttribute(`data-action`,e),r.textContent=t,n&&(r.className=`delete-btn`),r};if(n===`connection`){t.append(i(`test-connection`,`Test`),i(`edit-connection`,`Edit`),i(`delete-connection`,`Delete`,!0));return}r||t.append(i(`set-default`,`Set Default`)),t.append(i(`edit-account`,`Edit`),i(`delete-account`,`Delete`,!0))}};customElements.get(o)||customElements.define(o,s);const c=new CSSStyleSheet;c.replaceSync(`:host {
  display: block;
}

:host([highlight]) .card {
  border-color: var(--shadow-claw-accent-primary);
}

:host([muted]) .card {
  opacity: 0.75;
}

::slotted([slot="actions"]) {
  background: none;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  transition:
    color 0.15s,
    background-color 0.15s;
}

::slotted([slot="actions"]:hover) {
  background-color: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
}

::slotted([slot="actions"].delete-btn:hover) {
  color: var(--shadow-claw-important-color);
}

.card {
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  padding: 0.75rem;
}

.card__header {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.card__label {
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
}

.card__badge {
  background-color: var(--shadow-claw-accent-primary);
  border-radius: 62.5rem;
  color: var(--shadow-claw-on-primary);
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
}

.card__meta {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.card__actions {
  display: flex;
  gap: 0.5rem;
}
`);const l=new DOMParser().parseFromString(`<template>
  <article class="card" part="card">
    <header class="card__header">
      <span class="card__label" part="label"></span>
      <span class="card__badge" part="badge" hidden></span>
    </header>
    <div class="card__meta" part="meta"></div>
    <div class="card__actions" part="actions">
      <slot name="actions"></slot>
    </div>
  </article>
</template>
`,`text/html`),u=l.querySelector(`template`);let d=[];d=u?Array.from(u.content.children):Array.from(l.head.children).concat(Array.from(l.body.children));var f=d;const p=`shadow-claw-card`;var m=class extends e{static styles=c;static template=f;attributeChangedCallback(){this.render()}async connectedCallback(){await this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.card__label`),n=e.querySelector(`.card__meta`),r=e.querySelector(`.card__badge`);if(!t||!n||!r)return;t.textContent=this.getAttribute(`label`)||``,n.textContent=this.getAttribute(`meta`)||``;let i=this.getAttribute(`badge`)||``;r.textContent=i,r.toggleAttribute(`hidden`,!i)}};customElements.get(p)||customElements.define(p,m);