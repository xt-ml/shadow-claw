import{d as e}from"./custom-element-security-MwgLnC6q.js";import{t}from"./shadow-claw-element-na_3JW5e.js";const n=new CSSStyleSheet;n.replaceSync(`*,
*::before,
*::after {
  box-sizing: border-box;
  font-family: var(--shadow-claw-font-sans);
}

.hidden,
[hidden] {
  display: none !important;
}

:host {
  display: block;
}

.header {
  background-color: var(--shadow-claw-bg-primary);
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
}

.header__main {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
}

.header__top {
  align-items: flex-start;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
}

.header__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.header__title a {
  color: var(--shadow-claw-link);
  text-decoration: none;
}

.header__title a:hover {
  color: var(--shadow-claw-link-hover);
  text-decoration: underline;
}

.header__actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: 0.5rem;
  width: 100%;
}

.header__actions[hidden] {
  display: none !important;
}

.header__actions-disclosure {
  width: 100%;
}

.header__actions-disclosure[hidden] {
  display: none !important;
}

.header__actions-toggle {
  align-items: center;
  background-color: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m, 1rem);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  font-weight: 600;
  gap: 0.5rem;
  justify-content: space-between;
  list-style: none;
  min-height: 2rem;
  padding: 0.375rem 0.625rem;
  user-select: none;
  width: 100%;
}

.header__actions-toggle::-webkit-details-marker {
  display: none;
}

.header__actions-toggle::after {
  border-color: currentColor transparent transparent;
  border-style: solid;
  border-width: 0.375rem 0.3125rem 0;
  content: "";
  display: inline-block;
  flex: none;
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.header__actions-disclosure[open] .header__actions-toggle::after {
  transform: rotate(180deg);
}

.header__actions-toggle:hover,
.header__actions-toggle:focus-visible {
  background-color: var(--shadow-claw-bg-tertiary, #f1f5f9);
  border-color: var(--shadow-claw-accent-primary, #334155);
  color: var(--shadow-claw-text-primary, #0f172a);
  outline: none;
}

::slotted(button),
::slotted(shadow-claw-page-header-action-button) {
  flex: 1 1 100% !important;
  min-width: 0 !important;
  width: 100% !important;
}

@media (min-width: 40.625rem) {
  .header__main {
    padding: 0.875rem 1rem 1rem;
  }

  .header__title {
    font-size: var(--shadow-claw-font-size-md);
  }

  .header__top {
    align-items: start;
    grid-template-columns: 1fr auto;
  }

  .header__actions {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
    padding-top: 0;
    width: auto;
  }

  .header__actions-toggle {
    display: none;
  }

  .header__actions-disclosure {
    width: auto;
  }

  ::slotted(button),
  ::slotted(shadow-claw-page-header-action-button) {
    flex: 0 1 auto !important;
    min-width: fit-content !important;
    width: auto !important;
  }
}

.header__breadcrumbs {
  width: 100%;
}

.header__breadcrumbs:empty {
  display: none;
}

.header__status {
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.header__status:empty {
  display: none;
}

@media (min-width: 40.625rem) {
  .header__status {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
  }
}
`);const r=new DOMParser().parseFromString(`<template>
  <header class="header">
    <div class="header__main">
      <div class="header__top">
        <h2 class="header__title"></h2>
        <details class="header__actions-disclosure" part="actions-disclosure">
          <summary
            aria-label="Toggle page actions"
            class="header__actions-toggle"
          >
            Actions
          </summary>
          <div class="header__actions" id="header-actions-panel">
            <slot name="actions"></slot>
          </div>
        </details>
      </div>
      <div class="header__status">
        <slot name="status"></slot>
      </div>
      <div class="header__breadcrumbs">
        <slot name="breadcrumbs"></slot>
      </div>
    </div>
  </header>
</template>
`,`text/html`),i=r.querySelector(`template`);let a=[];a=i?Array.from(i.content.children):Array.from(r.head.children).concat(Array.from(r.body.children));var o=a;const s=`shadow-claw-page-header`;var c=class extends t{static styles=n;static template=o;static get observedAttributes(){return[`title`,`page-title`,`icon`]}mainCollapsed=!1;mainVisibilityMediaQuery=null;manualMainCollapsedOverride=null;constructor(){super()}attributeChangedCallback(e,t,n){t!==n&&this.render()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);await this.render()}disconnectedCallback(){this.actionsLayoutCleanup(),this.mainVisibilityCleanup()}actionsLayoutCleanup=()=>{};applyMainVisibility(e){let t=e||this.shadowRoot;if(!t)return;let n=t.querySelector(`.header__main`);if(!(n instanceof HTMLElement))return;let r=this.getEffectiveMainCollapsed();this.mainCollapsed=r,n.hidden=r}getAutoMainCollapsed(){return!1}getEffectiveMainCollapsed(){return typeof this.manualMainCollapsedOverride==`boolean`?this.manualMainCollapsedOverride:this.getAutoMainCollapsed()}isMainCollapsed(){return this.mainCollapsed}mainVisibilityCleanup=()=>{};setMainCollapsedOverride(e){this.manualMainCollapsedOverride=typeof e==`boolean`?e:null,this.applyMainVisibility()}setupActionsContainer(e){let t=e.querySelector(`slot[name="actions"]`),n=e.querySelector(`.header__actions`),r=e.querySelector(`.header__actions-disclosure`);if(!(t instanceof HTMLSlotElement)||!(n instanceof HTMLElement)||!(r instanceof HTMLElement))return;let i=()=>{let e=t.assignedElements().length>0;n.hidden=!e,r.hidden=!e};t.addEventListener(`slotchange`,i),i()}setupMainVisibility(e){this.mainVisibilityCleanup(),this.mainVisibilityMediaQuery=null,this.mainVisibilityCleanup=()=>{},this.applyMainVisibility(e)}setupResponsiveActionsDisclosure(e){this.actionsLayoutCleanup();let t=e.querySelector(`.header__actions-disclosure`);if(!(t instanceof HTMLDetailsElement))return;if(typeof globalThis.matchMedia!=`function`){t.open=!1,this.actionsLayoutCleanup=()=>{};return}let n=globalThis.matchMedia(`(min-width: 40.625rem)`),r=()=>{n.matches?t.open=!0:t.open=!1};r();let i=()=>{r()};n.addEventListener(`change`,i),this.actionsLayoutCleanup=()=>{n.removeEventListener(`change`,i)}}toggleMainCollapsedOverride(){return this.setMainCollapsedOverride(!this.isMainCollapsed()),this.isMainCollapsed()}async render(){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.header__title`);if(n){let t=this.getAttribute(`icon`)||``,r=this.hasAttribute(`page-title`)?this.getAttribute(`page-title`)||``:this.getAttribute(`title`)||``;e(n,t?`${t} ${r}`:r)}this.setupActionsContainer(t),this.setupResponsiveActionsDisclosure(t),this.setupMainVisibility(t)}};customElements.get(s)||customElements.define(s,c);