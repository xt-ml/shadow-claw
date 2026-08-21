import{t as e}from"./shadow-claw-element-na_3JW5e.js";const t=new CSSStyleSheet;t.replaceSync(`:host {
  display: block;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  font-family: var(--shadow-claw-font-sans);
}

.action-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  transition: all 0.15s;
  white-space: nowrap;
  width: 100%;
}

.action-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
}

.action-btn:focus-visible {
  outline: 0.125rem solid var(--shadow-claw-accent-primary);
  outline-offset: 0.0625rem;
}

.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

/* Primary variant - Call-to-action (solid bg) */
.action-btn--primary {
  background-color: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
  font-weight: 600;
}

.action-btn--primary:hover {
  background-color: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

/* Danger variant - Destructive action (red) */
.action-btn--danger {
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-error-color);
}

.action-btn--danger:hover {
  background-color: var(--shadow-claw-error-color);
  border-color: var(--shadow-claw-error-color);
  color: var(--shadow-claw-on-primary);
}

@media (min-width: 40.625rem) {
  .action-btn {
    width: auto;
  }
}
`);const n=new DOMParser().parseFromString(`<template>
  <button class="action-btn action-btn--default" type="button">
    <slot></slot>
  </button>
</template>
`,`text/html`),r=n.querySelector(`template`);let i=[];i=r?Array.from(r.content.children):Array.from(n.head.children).concat(Array.from(n.body.children));var a=i;const o=`shadow-claw-page-header-action-button`;var s=class extends e{static observedAttributes=[`disabled`,`variant`];static styles=t;static template=a;attributeChangedCallback(){this.render()}async connectedCallback(){await this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.action-btn`);t&&(t.className=`action-btn action-btn--${this.getAttribute(`variant`)||`default`}`,t.disabled=this.hasAttribute(`disabled`))}};customElements.get(o)||customElements.define(o,s);