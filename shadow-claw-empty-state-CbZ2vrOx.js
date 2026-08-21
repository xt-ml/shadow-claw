import{t as e}from"./shadow-claw-element-na_3JW5e.js";const t=new CSSStyleSheet;t.replaceSync(`:host {
  display: block;
}

.empty-state {
  border: 0.0625rem dashed var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s, 0.625rem);
  color: var(--shadow-claw-text-tertiary);
  font-size: 0.8125rem;
  line-height: 1.45;
  padding: 1rem;
  text-align: center;
}

.empty-state__hint {
  margin-top: 0.25rem;
  opacity: 0.9;
}

:host([compact]) .empty-state {
  padding: 0.75rem;
}

:host([warning]) .empty-state {
  border-style: solid;
}
`);const n=new DOMParser().parseFromString(`<template>
  <div class="empty-state" role="status">
    <div class="empty-state__message"></div>
    <div class="empty-state__hint" hidden></div>
  </div>
</template>
`,`text/html`),r=n.querySelector(`template`);let i=[];i=r?Array.from(r.content.children):Array.from(n.head.children).concat(Array.from(n.body.children));var a=i;const o=`shadow-claw-empty-state`;var s=class extends e{static styles=t;static template=a;attributeChangedCallback(){this.render()}async connectedCallback(){await this.render()}async render(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.empty-state__message`),n=e.querySelector(`.empty-state__hint`);if(!t||!n)return;t.textContent=this.getAttribute(`message`)||`Nothing here yet.`;let r=this.getAttribute(`hint`)||``;n.textContent=r,n.toggleAttribute(`hidden`,!r)}};customElements.get(o)||customElements.define(o,s);