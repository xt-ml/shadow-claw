import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{a as r,i,l as a,n as o,o as s,r as c}from"./app-routes-CA-uT3Nk.js";import{d as l,f as u,i as d,n as f,r as p,s as m,u as h}from"./custom-element-security-MwgLnC6q.js";import{n as g}from"./toast-60iDlgiH.js";import{pn as _,r as v,t as y,tn as b,un as x}from"./orchestrator-DrMg2dnI.js";import{a as S,r as C,t as w}from"./toast-D3gxhZpN.js";import{t as T}from"./shadow-claw-element-na_3JW5e.js";import{t as E}from"./effect-BEsuusE8.js";import"./shadow-claw-page-header-action-button-Cn1xDjfA.js";import"./shadow-claw-page-header-DyG_qg9T.js";import{n as D,t as O}from"./markdown-DXtaNEac.js";import{t as k}from"./file-viewer-C3DgeHSd.js";import{t as A}from"./config-value-oBfKgLT4.js";import{n as j,t as M}from"./iframe-theme-Du-qyM1D.js";const N=new CSSStyleSheet;N.replaceSync(`* {
  box-sizing: border-box;
}

:host {
  display: block;
  height: calc(100dvh + 4rem);
  line-height: 1.5;
}

.pages {
  background: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.pages__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.pages__sidebar {
  display: none;
}

.pages__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.625rem;
}

.pages__group-details {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pages__group-label {
  align-items: center;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  font-size: 0.75rem;
  font-weight: 700;
  justify-content: space-between;
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0.125rem 0.25rem;
  text-transform: uppercase;
  user-select: none;
}

.pages__group-label::-webkit-details-marker {
  display: none;
}

.pages__group-icon {
  font-size: 0.625rem;
  transform: rotate(-90deg);
  transition: transform var(--shadow-claw-duration-min)
    var(--shadow-claw-ease-out);
}

.pages__group-details[open] .pages__group-icon {
  transform: rotate(0deg);
}

.pages__group-pages {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.pages__list-item {
  align-items: center;
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-primary);
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  gap: 0.375rem;
  justify-content: space-between;
  line-height: 1.35;
  padding: 0.375rem;
  width: 100%;
}

.pages__list-item:hover {
  border-color: var(--shadow-claw-accent-primary);
}

.pages__select {
  align-items: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  flex: 1;
  font: inherit;
  min-width: 0;
  padding: 0.125rem 0.25rem;
  text-align: left;
}

.pages__list-item.active {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 20%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: var(--shadow-claw-accent-primary);
}

.pages__list-path {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.pages__remove {
  background: transparent;
  border: none;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  flex: none;
  font-size: 1rem;
  line-height: 1;
  padding: 0.125rem 0.25rem;
}

.pages__remove:hover {
  color: var(--shadow-claw-error-color);
}

.pages__viewer {
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: calc(100vh - 11rem);
  min-height: calc(100dvh - 11rem);
  min-width: 0;
  overflow: hidden;
  position: relative;
}

.pages__viewer-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: calc(100% + 1.5rem);
  min-width: 0;
  padding: 0.75rem 1rem;
}

.pages__rendered {
  max-width: 72rem;
  padding: 1rem 1.5rem 1rem 1rem;
}

.pages__rendered :is(pre) {
  overflow: auto;
}

.pages__rendered img {
  max-height: 100%;
  max-width: 100%;
}

.pages__rendered a {
  color: var(--shadow-claw-accent-primary);
}

article > h1,
article > h2,
.pages__rendered > h1,
.pages__rendered > h2 {
  margin-top: 0;
}

.pages__iframe {
  background: transparent;
  border-width: 0;
  display: block;
  height: auto;
  min-height: 20rem;
  overflow: hidden;
  width: 100%;
}

.pages__empty {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
}

.pages__status {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
}

.pages:has(.pages__sidebar.collapsed) .pages__remove-all-btn {
  display: none;
}

.pages:has(.pages__sidebar.collapsed)
  shadow-claw-page-header::part(actions-disclosure) {
  display: none;
}

.pages__dropdown-container {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  position: relative;
  width: 100%;
}

/* Ebook-style edge navigation buttons */
.pages__nav-btn {
  align-items: center;
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-secondary) 80%,
    transparent
  );
  backdrop-filter: blur(6px);
  border: 0.0625rem solid
    color-mix(in srgb, var(--shadow-claw-border-color) 60%, transparent);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  flex: none;
  height: 8rem;
  justify-content: center;
  max-height: 8rem;
  min-height: 8rem;
  opacity: 0;
  padding: 0.75rem 0.5rem;
  pointer-events: none;
  position: fixed;
  top: 50dvh;
  transform: translateY(-50%);
  transition:
    opacity 0.4s var(--shadow-claw-ease-out),
    color 0.15s var(--shadow-claw-ease-out),
    border-color 0.15s var(--shadow-claw-ease-out),
    background 0.15s var(--shadow-claw-ease-out);
  z-index: 100;
}

.pages__nav-btn--prev {
  left: 0.5rem;
}

.pages__nav-btn--next {
  right: 0.5rem;
}

/* Reveal on direct button hover, viewer focus, or temporary JS active state */
.pages__nav-btn:hover:not(:disabled):not([hidden]),
.pages__content:focus-within .pages__nav-btn:not(:disabled):not([hidden]),
.pages__viewer:focus-within ~ .pages__nav-btn:not(:disabled):not([hidden]),
.pages__content:has(.pages__viewer--nav-visible)
  .pages__nav-btn:not(:disabled):not([hidden]),
.pages__viewer.pages__viewer--nav-visible
  ~ .pages__nav-btn:not(:disabled):not([hidden]) {
  opacity: 1;
  pointer-events: auto;
}

/* Completely hide unclickable (disabled/hidden) buttons */
.pages__nav-btn:disabled,
.pages__nav-btn[hidden] {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.pages__nav-btn:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 15%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-accent-primary);
  opacity: 1;
}

.pages__nav-btn:disabled {
  cursor: not-allowed;
}

.pages__dropdown {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-sm);
  color: var(--shadow-claw-text-primary);
  display: block;
  transition: border-color var(--shadow-claw-duration-min)
    var(--shadow-claw-ease-out);
  width: 100%;
}

.pages__dropdown:hover {
  border-color: var(--shadow-claw-accent-primary);
}

.pages__dropdown-summary {
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  gap: 0.5rem;
  justify-content: space-between;
  list-style: none;
  padding: 0.625rem 1rem;
  user-select: none;
}

.pages__dropdown-summary::-webkit-details-marker {
  display: none;
}

.pages__dropdown-selected {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pages__dropdown-arrow {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.75rem;
  transition: transform var(--shadow-claw-duration-min)
    var(--shadow-claw-ease-out);
}

.pages__dropdown[open] .pages__dropdown-arrow {
  transform: rotate(180deg);
}

.pages__dropdown-menu {
  backdrop-filter: blur(10px);
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  box-shadow: var(--shadow-claw-shadow-lg);
  left: 0;
  margin-top: 0.375rem;
  max-height: 20rem;
  overflow-y: auto;
  position: absolute;
  right: 0;
  z-index: 100;
}

.pages__dropdown-menu .pages__list {
  padding: 0.375rem;
}

.pages__breadcrumbs {
  align-items: center;
  display: flex;
  font-size: 0.8125rem;
}

.pages__sidebar-toggle-btn {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: 0.1875rem;
  color: var(--shadow-claw-accent-primary);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  transition: all 0.1s;
}

.pages__sidebar-toggle-btn:hover,
.pages__sidebar-toggle-btn:focus-visible {
  background-color: var(--shadow-claw-bg-tertiary);
  border-color: var(--shadow-claw-accent-primary);
  outline: none;
}

.pages__drag-handle {
  color: var(--shadow-claw-text-tertiary);
  cursor: grab;
  flex: none;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0.125rem 0.25rem;
  user-select: none;
}

.pages__drag-handle:hover {
  color: var(--shadow-claw-text-secondary);
}

.pages__drag-handle:active,
.pages__list-item.dragging .pages__drag-handle {
  cursor: grabbing;
}

.pages__list-item.drag-over {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-accent-primary);
}

.pages__default-btn {
  background: transparent;
  border: none;
  color: var(--shadow-claw-text-tertiary);
  cursor: pointer;
  flex: none;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0.125rem 0.25rem;
}

.pages__default-btn:hover,
.pages__default-btn.is-default {
  color: var(--shadow-claw-accent-primary);
}

.pages__edit {
  background: transparent;
  border: none;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  flex: none;
  font-size: 0.875rem;
  line-height: 1;
  padding: 0.125rem 0.25rem;
}

.pages__edit:hover {
  color: var(--shadow-claw-text-primary);
}

/* Desktop breakpoint: show pages column side-by-side */
@media (min-width: 75rem) {
  .pages__content {
    display: grid;
    grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .pages__content.pages__content--sidebar-collapsed {
    grid-template-columns: 1fr !important;
  }

  .pages__sidebar {
    border-right: 0.0625rem solid var(--shadow-claw-border-color);
    display: block;
    min-height: 0;
    overflow: auto;
  }

  .pages__sidebar.collapsed {
    display: none !important;
  }

  .pages__dropdown {
    display: none;
  }

  .pages__nav-btn--prev {
    left: 20.5rem;
  }

  .pages__content.pages__content--sidebar-collapsed .pages__nav-btn--prev {
    left: 0.5rem;
  }
}

ul {
  line-height: 1.5;
}

.pages__announcer {
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
`);const P=new DOMParser().parseFromString(`<template>
  <section class="pages" aria-label="Pages">
    <div
      class="pages__announcer"
      data-pages-announcer
      aria-live="polite"
      aria-atomic="true"
    ></div>
    <shadow-claw-page-header icon="📚" title="Pages">
      <nav
        slot="breadcrumbs"
        class="pages__breadcrumbs"
        aria-label="Toggle pages sidebar"
      >
        <button
          type="button"
          class="pages__sidebar-toggle-btn"
          data-pages-sidebar-toggle
          title="Toggle pages list"
        >
          📁 Pages
        </button>
      </nav>
      <div slot="status" class="pages__status" data-pages-status></div>

      <shadow-claw-page-header-action-button
        class="pages__remove-all-btn"
        slot="actions"
        title="Remove all saved pages"
        variant="danger"
      >
        🗑️ Remove All
      </shadow-claw-page-header-action-button>
    </shadow-claw-page-header>

    <div class="pages__content pages__content--sidebar-collapsed">
      <aside class="pages__sidebar collapsed" aria-label="Saved pages">
        <div class="pages__list" data-pages-list role="list"></div>
      </aside>

      <button
        type="button"
        class="pages__nav-btn pages__nav-btn--prev"
        data-pages-prev
        aria-label="Previous page"
        hidden
        disabled
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <article class="pages__viewer" aria-label="Page preview">
        <div class="pages__viewer-scroll">
          <div class="pages__dropdown-container" data-pages-dropdown-container>
            <details class="pages__dropdown" data-pages-dropdown>
              <summary class="pages__dropdown-summary">
                <span
                  class="pages__dropdown-selected"
                  data-pages-dropdown-selected
                  >Select a page...</span
                >
                <span class="pages__dropdown-arrow">▼</span>
              </summary>
              <div class="pages__dropdown-menu">
                <div class="pages__list" data-pages-list role="list"></div>
              </div>
            </details>
          </div>

          <div class="pages__empty" data-pages-empty>
            No pages yet. In Files, use "Set as Page" on a markdown or HTML
            file.
          </div>
          <div class="pages__rendered" data-pages-rendered hidden></div>
        </div>
      </article>

      <button
        type="button"
        class="pages__nav-btn pages__nav-btn--next"
        data-pages-next
        aria-label="Next page"
        hidden
        disabled
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  </section>
</template>
`,`text/html`),F=P.querySelector(`template`);let I=[];I=F?Array.from(F.content.children):Array.from(P.head.children).concat(Array.from(P.body.children));var L=I;const R={ALLOWED_URI_REGEXP:/^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,ADD_TAGS:[`iframe`,`figure`,`figcaption`],CUSTOM_ELEMENT_HANDLING:{tagNameCheck:e=>m(e),attributeNameCheck:()=>!0,allowCustomizedBuiltInElements:!1},ADD_ATTR:[`allow`,`allowfullscreen`,`frameborder`,`scrolling`,`referrerpolicy`,`loading`]},z=`shadow-claw-pages`;async function B(e,t){if(!e||typeof e.transaction!=`function`)return!0;try{return A(await n(e,t),!0)}catch{return!0}}var V=class extends T{static styles=N;static template=L;db=null;draggedPageIndex=null;pageFrontmatter=new g.State(null);previewFrameWindow=null;renderToken=0;navFadeTimer=null;sidebarOpen=!1;themeObserver=null;autoRefreshIntervalSec=0;autoRefreshTimer=null;_routingReady=!1;_renderedKey=null;_renderedContent=null;_renderedFrontmatterToggle=null;_dsdInitialPath=null;touchStartX=0;touchStartY=0;touchStartTime=0;mouseStartX=0;mouseStartY=0;mouseStartTime=0;isMouseDown=!1;constructor(){super()}announcePageChange(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-pages-announcer]`);if(n instanceof HTMLElement){let t=this.pageFrontmatter.get();n.textContent=`Navigated to page: ${t&&t.title?t.title:e.path}`}}isNavigationSuppressed=(e,t)=>{let n=[`data-no-nav`,`data-no-swipe`,`data-no-page-nav`,`data-prevent-nav`,`data-prevent-page-nav`,`data-isolate-input`,`data-isolate-navigation`,`data-game-controls`],r=e=>{if(!e||!(e instanceof HTMLElement))return!1;let t=e.tagName.toLowerCase();return!!(t===`input`||t===`textarea`||t===`select`||t===`option`||t===`iframe`||e.classList.contains(`pages__preview-frame`)||e.isContentEditable||e.getAttribute(`contenteditable`)===`true`||e.closest(`[data-pages-list]`)||e.closest(`[data-pages-dropdown]`)||e.closest(`.pages__sidebar`)||e.closest(`.pages__preview-frame`)||e.closest(`iframe`)||n.some(t=>e.closest(`[${t}]`)))};if(t&&r(t))return!0;if(e){let t=typeof e.composedPath==`function`?e.composedPath():[];for(let e of t)if(e instanceof HTMLElement){let t=e.tagName.toLowerCase();if(n.some(t=>e.hasAttribute(t))||t===`input`||t===`textarea`||t===`select`||t===`option`||t===`iframe`||e.classList.contains(`pages__preview-frame`)||e.isContentEditable||e.getAttribute(`contenteditable`)===`true`)return!0}if(e.target&&r(e.target))return!0}return!1};handleKeyDown=e=>{if(!this.isConnected||e.key!==`ArrowLeft`&&e.key!==`ArrowRight`||e.ctrlKey||e.altKey||e.metaKey)return;let t=this.shadowRoot?.activeElement||document.activeElement,n=e.target||null;this.isNavigationSuppressed(e,n)||this.isNavigationSuppressed(void 0,t)||(e.preventDefault(),this.showNavButtonsTemporarily(2e3),e.key===`ArrowLeft`?this.goToPreviousPage():e.key===`ArrowRight`&&this.goToNextPage())};handleTouchStart=e=>{if(this.isNavigationSuppressed(e)){this.touchStartX=0,this.touchStartY=0,this.touchStartTime=0;return}e.touches&&e.touches.length===1&&(this.touchStartX=e.touches[0].clientX,this.touchStartY=e.touches[0].clientY,this.touchStartTime=Date.now())};handleTouchEnd=e=>{if(!this.touchStartTime||this.isNavigationSuppressed(e)){this.touchStartTime=0;return}if(e.changedTouches&&e.changedTouches.length===1){let t=e.changedTouches[0].clientX,n=e.changedTouches[0].clientY,r=Date.now()-this.touchStartTime,i=t-this.touchStartX,a=n-this.touchStartY;Math.abs(i)>=50&&Math.abs(i)>Math.abs(a)&&r<=600&&(this.showNavButtonsTemporarily(2e3),i<0?this.goToNextPage():this.goToPreviousPage())}this.touchStartTime=0};handleMouseDown=e=>{if(e.button!==0||this.isNavigationSuppressed(e)){this.isMouseDown=!1;return}this.isMouseDown=!0,this.mouseStartX=e.clientX,this.mouseStartY=e.clientY,this.mouseStartTime=Date.now()};handleMouseUp=e=>{if(!this.isMouseDown||(this.isMouseDown=!1,this.isNavigationSuppressed(e)))return;let t=window.getSelection();if(t&&t.toString().length>0)return;let n=e.clientX,r=e.clientY,i=Date.now()-this.mouseStartTime,a=n-this.mouseStartX,o=r-this.mouseStartY;Math.abs(a)>=50&&Math.abs(a)>Math.abs(o)&&i<=600&&(this.showNavButtonsTemporarily(2e3),a<0?this.goToNextPage():this.goToPreviousPage())};handleVisibilityChange=()=>{!document.hidden&&this.isConnected?(this.renderSelectedPage(),this.setupAutoRefreshTimer()):document.hidden&&this.autoRefreshTimer!==null&&(clearInterval(this.autoRefreshTimer),this.autoRefreshTimer=null)};handleWindowFocus=()=>{!document.hidden&&this.isConnected&&this.renderSelectedPage()};handleAutoRefreshConfigChange=e=>{let t=e.detail;t&&typeof t.interval==`number`&&(this.autoRefreshIntervalSec=Math.max(0,Math.min(t.interval,86400))),this.setupAutoRefreshTimer()};async setupAutoRefreshTimer(){if(this.autoRefreshTimer!==null&&(clearInterval(this.autoRefreshTimer),this.autoRefreshTimer=null),this.db)try{let t=await n(this.db,e.PAGES_AUTO_REFRESH_INTERVAL),r=0;if(typeof t==`string`||typeof t==`number`){let e=parseInt(String(t),10);!isNaN(e)&&e>=0&&(r=Math.min(e,86400))}this.autoRefreshIntervalSec=r,r>0&&!document.hidden&&this.isConnected&&(this.autoRefreshTimer=setInterval(()=>{!document.hidden&&this.isConnected&&this.renderSelectedPage()},r*1e3))}catch{}}showNavButtonsTemporarily(e=2500){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.pages__viewer`);n instanceof HTMLElement&&n.classList.add(`pages__viewer--nav-visible`),this.navFadeTimer!==null&&clearTimeout(this.navFadeTimer),this.navFadeTimer=setTimeout(()=>{this.navFadeTimer=null,n instanceof HTMLElement&&n.classList.remove(`pages__viewer--nav-visible`)},e)}async connectedCallback(){let e=this.shadowRoot;if(!e)throw Error(`shadowRoot not found`);let n=this.closest(`shadow-claw`),r=document.documentElement.classList.contains(`sc-prerender-override`),i=n?.getAttribute(`data-prerender-no-seed`)===`true`;if(r||i){let t=e.querySelector(`[data-pages-rendered]`);t instanceof HTMLElement&&(t.hidden=!0,t.textContent=``)}else{let t=e.querySelector(`[data-pages-dropdown-selected]`)?.textContent?.trim();t&&(this._dsdInitialPath=t)}this.db=await t(),await y.whenInitialized,window.addEventListener(`message`,this.handleIframeMessage),document.addEventListener(`visibilitychange`,this.handleVisibilityChange),window.addEventListener(`focus`,this.handleWindowFocus),window.addEventListener(`shadow-claw-pages-auto-refresh-change`,this.handleAutoRefreshConfigChange),document.addEventListener(`keydown`,this.handleKeyDown),e.addEventListener(`click`,t=>{let n=e.querySelector(`[data-pages-dropdown]`);if(n instanceof HTMLDetailsElement&&n.open){let r=t.target,i=e.querySelector(`[data-pages-sidebar-toggle]`);!n.contains(r)&&(!i||!i.contains(r))&&n.removeAttribute(`open`)}});let a=e.querySelector(`.pages__viewer`),o=e.querySelector(`.pages__viewer-scroll`),s=()=>{this.showNavButtonsTemporarily(2e3)};a instanceof HTMLElement&&(a.addEventListener(`pointermove`,s,{passive:!0}),a.addEventListener(`pointerdown`,s,{passive:!0}),a.addEventListener(`touchstart`,s,{passive:!0}),a.addEventListener(`touchstart`,this.handleTouchStart,{passive:!0}),a.addEventListener(`touchend`,this.handleTouchEnd,{passive:!0}),a.addEventListener(`mousedown`,this.handleMouseDown,{passive:!0}),a.addEventListener(`mouseup`,this.handleMouseUp,{passive:!0}),a.addEventListener(`click`,s,{passive:!0}),a.addEventListener(`focusin`,s,{passive:!0})),o instanceof HTMLElement&&o.addEventListener(`scroll`,s,{passive:!0});let c=e.querySelector(`[data-pages-sidebar-toggle]`);c&&c.addEventListener(`click`,()=>{this.toggleSidebar()});let l=e.querySelector(`.pages__remove-all-btn`);l&&l.addEventListener(`click`,()=>{this.handleRemoveAll()});let u=e.querySelector(`[data-pages-prev]`);u&&u.addEventListener(`click`,()=>{this.goToPreviousPage()});let d=e.querySelector(`[data-pages-next]`);d&&d.addEventListener(`click`,()=>{this.goToNextPage()}),this.toggleSidebar(this.sidebarOpen),this.setupEffects(),this.themeObserver=new MutationObserver(e=>{for(let t of e)t.type===`attributes`&&t.attributeName===`class`&&this.syncIframeTheme()}),this.themeObserver.observe(document.documentElement,{attributes:!0,attributeFilter:[`class`]}),await y.whenReady,this._routingReady=!0,this.renderSelectedPage(),this.setupAutoRefreshTimer()}disconnectedCallback(){this._renderedKey=null,this._renderedContent=null,this._renderedFrontmatterToggle=null,this._dsdInitialPath=null,this.themeObserver&&=(this.themeObserver.disconnect(),null),this.navFadeTimer!==null&&(clearTimeout(this.navFadeTimer),this.navFadeTimer=null),this.autoRefreshTimer!==null&&(clearInterval(this.autoRefreshTimer),this.autoRefreshTimer=null),window.removeEventListener(`message`,this.handleIframeMessage),document.removeEventListener(`visibilitychange`,this.handleVisibilityChange),window.removeEventListener(`focus`,this.handleWindowFocus),window.removeEventListener(`shadow-claw-pages-auto-refresh-change`,this.handleAutoRefreshConfigChange),document.removeEventListener(`keydown`,this.handleKeyDown),this.previewFrameWindow=null,super.disconnectedCallback?.()}getPageRouteDirectory(e){return o(i(this.selectedPage?.groupId||y.activeGroupId,e))}getSelectedPageIndex(){return this.selectedPage?y.pages.findIndex(e=>this.pageRefKey(e)===this.pageRefKey(this.selectedPage)):-1}goToNextPage(){let e=y.pages,t=this.getSelectedPageIndex();t>=0&&t<e.length-1&&this.navigateToPage(e[t+1])}goToPreviousPage(){let e=y.pages,t=this.getSelectedPageIndex();t>0&&this.navigateToPage(e[t-1])}handleAnchorNavigation(e){let t=this.shadowRoot;if(!t)return!1;let n=t.querySelector(`[data-pages-rendered]`);if(!n||n.hidden)return!1;let r=e.replace(/^#/,``),i=n.querySelector(`[id="${r}"]`)||n.querySelector(`a[name="${r}"]`);return i?(i.scrollIntoView({behavior:`smooth`,block:`start`}),!0):!1}handleIframeMessage=e=>{if(!e.data||typeof e.data!=`object`)return;let t=e.data;if(t.type===`shadow-claw-swipe`&&typeof t.direction==`string`){if(this.previewFrameWindow&&e.source!==this.previewFrameWindow)return;this.showNavButtonsTemporarily(2e3),t.direction===`left`?this.goToNextPage():t.direction===`right`&&this.goToPreviousPage();return}if(t.type===`shadow-claw-iframe-resize`&&typeof t.height==`number`){let n=this.shadowRoot?.querySelector(`[data-pages-iframe]`);n instanceof HTMLIFrameElement&&(!this.previewFrameWindow||e.source===this.previewFrameWindow||n.contentWindow&&e.source===n.contentWindow)&&(this.previewFrameWindow=n.contentWindow,n.style.setProperty(`height`,`${t.height}px`,`important`));return}if(!this.db||t.type!==`shadow-claw-file-viewer-link`||typeof t.href!=`string`||this.previewFrameWindow&&e.source!==this.previewFrameWindow)return;let n=this.selectedPage?.path||``,r=this.selectedPage?.groupId||y.activeGroupId,i=this.getPageRouteDirectory(n),o=a(t.href,i,window.location.origin);if(!o)return;if(!(o.origin===window.location.origin&&(s(o.pathname)||this.resolveWorkspaceLinkPath(t.href,n,r)))){window.open(o.href,`_blank`,`noopener,noreferrer`);return}let c=`${o.pathname}${o.search}${o.hash}`,l=window.navigation;if(l&&typeof l.navigate==`function`){l.navigate(c);return}window.history.pushState({},``,c),window.dispatchEvent(new PopStateEvent(`popstate`))};isHtmlPath(e){return/\.(html?|xhtml)$/iu.test(e)}isMarkdownPath(e){return/\.(md|markdown)$/iu.test(e)}mimeTypeForImageExt(e){return{apng:`image/apng`,avif:`image/avif`,gif:`image/gif`,jpg:`image/jpeg`,jpeg:`image/jpeg`,png:`image/png`,svg:`image/svg+xml`,webp:`image/webp`}[e]??`image/jpeg`}navigateToPage(e){this.selectedPage=e,this.showNavButtonsTemporarily(2500),this.announcePageChange(e),document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`pages`,groupId:e.groupId,path:e.path},bubbles:!0,composed:!0}))}renderPageList(e,t){let n=this.shadowRoot;if(!n)return;let r=n.querySelector(`[data-pages-status]`);r instanceof HTMLElement&&(r.textContent=e.length===1?`1 saved page`:`${e.length} saved pages`);let i=n.querySelector(`.pages__remove-all-btn`);i&&i.toggleAttribute(`disabled`,e.length===0);let a=n.querySelector(`[data-pages-dropdown-selected]`);a instanceof HTMLElement&&(this.selectedPage?a.textContent=this.selectedPage.path:a.textContent=`Select a page...`);let s=n.querySelectorAll(`[data-pages-list]`);if(s.length===0)return;s.forEach(e=>{e instanceof HTMLElement&&e.replaceChildren()});let l=n.querySelector(`[data-pages-prev]`),u=n.querySelector(`[data-pages-next]`),d=n.querySelector(`shadow-claw-page-header`),f=this.pageFrontmatter.get();if(d)if(f&&f.title)if(this.selectedPage){let e=o(c({page:`pages`,groupId:this.selectedPage.groupId,path:this.selectedPage.path})),t=e;if(typeof window<`u`&&window.location?.origin)try{t=new URL(e,window.location.origin).href}catch{}d.setAttribute(`page-title`,`<a href="${t}">${f.title}</a>`),d.setAttribute(`title`,f.title)}else d.setAttribute(`page-title`,f.title),d.setAttribute(`title`,f.title);else d.setAttribute(`page-title`,`Pages`),d.setAttribute(`title`,`Pages`);if(l instanceof HTMLButtonElement&&u instanceof HTMLButtonElement)if(e.length===0)l.disabled=!0,l.hidden=!0,u.disabled=!0,u.hidden=!0;else{let t=this.getSelectedPageIndex(),n=t<=0,r=t<0||t>=e.length-1;l.disabled=n,l.hidden=n,u.disabled=r,u.hidden=r}if(e.length===0)return;let p=new Map(t.map(e=>[e.groupId,e.name])),m=new Map;e.forEach(e=>{let t=m.get(e.groupId)||[];t.push(e),m.set(e.groupId,t)}),s.forEach(t=>{if(t instanceof HTMLElement)for(let[n,r]of m){let i=document.createElement(`details`);i.className=`pages__group-details`;let a=`shadow-claw-pages-group-collapsed-${n}`,o=!1;try{o=localStorage.getItem(a)===`true`}catch{}o||(i.open=!0),i.addEventListener(`toggle`,()=>{try{i.open?localStorage.removeItem(a):localStorage.setItem(a,`true`)}catch{}});let s=document.createElement(`summary`);s.className=`pages__group-label`;let c=document.createElement(`span`);c.textContent=p.get(n)||n;let l=document.createElement(`span`);l.className=`pages__group-icon`,l.textContent=`▼`,s.appendChild(c),s.appendChild(l),i.appendChild(s);let u=document.createElement(`div`);u.className=`pages__group-pages`,r.forEach(r=>{let i=r.path,a=e.findIndex(e=>e.path===r.path&&e.groupId===r.groupId),o=document.createElement(`div`);o.className=`pages__list-item`,this.selectedPage&&this.pageRefKey(r)===this.pageRefKey(this.selectedPage)&&o.classList.add(`active`);let s=document.createElement(`span`);s.className=`pages__drag-handle`,s.setAttribute(`draggable`,`true`),s.title=`Drag to reorder`,s.textContent=`⠿`,s.addEventListener(`dragstart`,e=>{this.draggedPageIndex=a,o.classList.add(`dragging`),e.dataTransfer&&(e.dataTransfer.effectAllowed=`move`)}),o.addEventListener(`dragend`,()=>{this.draggedPageIndex=null,o.classList.remove(`dragging`)}),o.addEventListener(`dragover`,e=>{e.preventDefault(),this.draggedPageIndex!==null&&this.draggedPageIndex!==a&&o.classList.add(`drag-over`)}),o.addEventListener(`dragleave`,()=>{o.classList.remove(`drag-over`)}),o.addEventListener(`drop`,e=>{e.preventDefault(),o.classList.remove(`drag-over`),this.draggedPageIndex!==null&&this.draggedPageIndex!==a&&this.handleReorder(this.draggedPageIndex,a)});let c=y.effectiveDefaultPage,l=c&&c.path===r.path&&c.groupId===r.groupId,d=document.createElement(`button`);d.type=`button`,d.className=`pages__select`,d.title=`Open ${i}`;let f=document.createElement(`span`);f.className=`pages__list-path`,f.textContent=i,d.appendChild(f),d.addEventListener(`click`,()=>{this.selectedPage=r,this.renderPageList(y.pages,y.groups),this.renderSelectedPage(),this.sidebarOpen=!1;let e=t.closest(`details`);e&&e.removeAttribute(`open`),document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`pages`,groupId:r.groupId,path:r.path},bubbles:!0,composed:!0}))});let m=document.createElement(`button`);m.className=`pages__edit`,m.type=`button`,m.title=`Edit in file editor`,m.setAttribute(`aria-label`,`Edit ${i} in file editor`),m.textContent=`✏️`,m.addEventListener(`click`,async e=>{if(e.stopPropagation(),this.db)try{await k.openFile(this.db,i,n)}catch(e){w(`Failed to edit file: ${e instanceof Error?e.message:String(e)}`,4500)}});let h=document.createElement(`button`);if(h.className=`pages__remove`,h.type=`button`,h.title=`Remove from Pages`,h.setAttribute(`aria-label`,`Remove ${i} from Pages in ${p.get(n)||n}`),h.textContent=`✕`,h.addEventListener(`click`,async e=>{if(e.stopPropagation(),this.db&&await this.requestConfirmation({title:`Remove Page`,message:`Are you sure you want to remove this page from Pages?\n\n${i}`,confirmLabel:`Remove`,cancelLabel:`Cancel`}))try{await y.removePage(this.db,i,n),C(`Removed ${i} from Pages`,2400)}catch(e){w(`Failed to remove page: ${e instanceof Error?e.message:String(e)}`,4500)}}),o.appendChild(s),l){let e=document.createElement(`span`);e.className=`pages__default-btn is-default`,e.title=`Default page`,e.textContent=`⭐`,o.appendChild(e)}o.appendChild(d),o.appendChild(m),o.appendChild(h),u.appendChild(o)}),i.appendChild(u),t.appendChild(i)}})}resolveRouteGroupId(e,t){if(e===t||this.routeGroupMatches(e,t))return t;let n=Array.isArray(y.groups)?y.groups:[],r=n.find(t=>t.groupId===e);if(r)return r.groupId;let i=n.find(t=>this.routeGroupMatches(e,t.groupId));return i?i.groupId:e||null}resolveWorkspaceFileTarget(e,t,n){let i=e.trim();if(!i||i.startsWith(`#`))return null;let a=[],o=i.split(/[?#]/,1)[0];if(/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(o)||o.startsWith(`//`)){let e;try{e=new URL(o,window.location.href)}catch{return null}if(e.origin!==window.location.origin)return null;o=e.pathname}let s=o.replace(/^(?:\.\/)+/u,``);if(s.startsWith(`files/`)&&a.push(`/${s}`),o.startsWith(`/`)){let e=o.lastIndexOf(`/files/`);e>0&&a.push(o.slice(e)),a.push(o)}for(let e of a){let t=r(e);if(!t)continue;let i=this.resolveRouteGroupId(t.groupId,n);if(i)return{groupId:i,path:t.path}}let c=this.resolveWorkspaceLinkPath(i,t,n);return c?{groupId:n,path:c}:null}resolveWorkspaceLinkPath(e,t,n){let o=e.trim();if(!o||o.startsWith(`#`))return null;let s=o.split(/[?#]/,1)[0],c=s.replace(/^(?:\.\/)+/u,``),l=[];if(c.startsWith(`files/`)&&l.push(`/${c}`),s.startsWith(`/`)){let e=s.lastIndexOf(`/files/`);e>0&&l.push(s.slice(e)),l.push(s)}for(let e of l){let t=r(e);if(t&&this.routeGroupMatches(t.groupId,n))return t.path}let u=a(o,i(n,t),window.location.origin);if(!u||u.origin!==window.location.origin)return null;let d=r(u.pathname);return!d||!this.routeGroupMatches(d.groupId,n)?null:d.path}rewriteWorkspacePreviewHtml(e,t){if(!e)return e;let n=this.getPageRouteDirectory(t),r=new DOMParser().parseFromString(e,`text/html`),i=(e,i)=>{let o=Array.from(r.querySelectorAll(e));for(let e of o){let r=(e.getAttribute(i)||``).trim();if(!r||r.startsWith(`#`)||r.startsWith(`javascript:`))continue;let o=a(r,n,window.location.origin);if(!(!o||o.origin!==window.location.origin)){if(i===`href`){let e=this.selectedPage?.groupId||y.activeGroupId;if(!(s(o.pathname)||this.resolveWorkspaceLinkPath(r,t,e)))continue}e.setAttribute(i,`${o.pathname}${o.search}${o.hash}`)}}};return i(`a[href]`,`href`),i(`img[src]`,`src`),i(`audio[src]`,`src`),i(`video[src]`,`src`),i(`source[src]`,`src`),r.body.innerHTML}routeGroupMatches(e,t){if(e===t||e===`main`&&t===`br:main`||e===`br:main`&&t===`main`)return!0;if(!e.includes(`:`)&&!t.includes(`:`))return!1;let n=e=>e.trim().replace(/:/g,`-`);return n(e)===n(t)}get selectedPage(){return y.activePinnedPage}set selectedPage(e){this.pageRefKey(e)!==this.pageRefKey(this.selectedPage)&&(this.db?y.setActivePinnedPage(this.db,e):y._activePinnedPage.set(e),e&&this.announcePageChange(e),this.renderPageList(y.pages,y.groups),this.renderSelectedPage())}setupEffects(){this.addCleanup(E(()=>{let e=y.pages,t=y.groups;this.renderPageList(e,t)})),this.addCleanup(E(()=>{let e=y.pages,t=y.activePinnedPage;e.length===0?t!==null&&(this.selectedPage=null):(!t||!e.some(e=>this.pageRefKey(e)===this.pageRefKey(t)))&&(this.selectedPage=y.effectiveDefaultPage||e[0]),this._routingReady&&this.renderSelectedPage()}))}toggleSidebar(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-pages-dropdown]`),r=n instanceof HTMLDetailsElement&&n.open,i;i=e===void 0?!(r||this.sidebarOpen):e,this.sidebarOpen=i;let a=t.querySelector(`.pages__sidebar`),o=t.querySelector(`.pages__content`);a&&a.classList.toggle(`collapsed`,!this.sidebarOpen),o&&o.classList.toggle(`pages__content--sidebar-collapsed`,!this.sidebarOpen),n instanceof HTMLDetailsElement&&(i?n.setAttribute(`open`,``):n.removeAttribute(`open`))}async buildHtmlPageSrcdoc(e,t){let n=this.rewriteWorkspacePreviewHtml(e,t),r=this.selectedPage?.groupId||y.activeGroupId,i=h(await this.resolveRelativeImagesInHtml(n,t,r),R),a=crypto.randomUUID().replace(/-/g,``),s=o(`/assets/file-viewer-preview-bridge.js`),c=f(),l=p(a),u=typeof document<`u`?document.getElementById(`shadow-claw-site-config`):null,d=u&&u.textContent?`<script id="shadow-claw-site-config" type="application/json">${u.textContent}<\/script>`:``,m=c.map(e=>`<script type="module" src="${e.startsWith(`http://`)||e.startsWith(`https://`)||e.startsWith(`//`)?e:o(e.startsWith(`/`)?e:`/${e.replace(/^pages\/main\//,``)}`)}" nonce="${a}"><\/script>`).join(`
`),g=`<link rel="stylesheet" href="${o(`/theme.css`)}">`;return[`<!doctype html>`,`<html class="${M()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,`<meta http-equiv="Content-Security-Policy" content="${l}">`,`<base href="${this.getPageRouteDirectory(t)}" target="_blank">`,d,`<script src="${s}" nonce="${a}"><\/script>`,j(),g,m,`</head><body>`,i,`</body></html>`].join(``)}async handleRemoveAll(){if(this.db&&await this.requestConfirmation({title:`Remove All Pages`,message:`Remove ALL saved pages from Pages? This cannot be undone!`,confirmLabel:`Remove All`,cancelLabel:`Cancel`}))try{let e=this.shadowRoot?.querySelector(`.pages__remove-all-btn`);e?.toggleAttribute(`disabled`,!0),e&&(e.textContent=`⏳`),await y.removeAllPages(this.db),C(`Removed all pages from Pages`,2400)}catch(e){w(`Failed to remove all pages: ${e instanceof Error?e.message:String(e)}`,4500),console.error(`Remove all pages error:`,e)}finally{let e=this.shadowRoot?.querySelector(`.pages__remove-all-btn`);e?.toggleAttribute(`disabled`,!1),e&&(e.textContent=`🗑️ Remove All`)}}async handleReorder(e,t){if(!this.db||e===t)return;let n=[...y.pages];if(e<0||e>=n.length||t<0||t>=n.length)return;let[r]=n.splice(e,1);n.splice(t,0,r),await y.reorderPages(this.db,n),t===0&&r&&(this.selectedPage=r,this.renderSelectedPage(),document.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`pages`,groupId:r.groupId,path:r.path},bubbles:!0,composed:!0})))}async readImageAsDataUrl(e,t){if(this.db)try{let n=await _(this.db,e,t),r=t.split(`.`).pop()?.toLowerCase()||``,i=this.mimeTypeForImageExt(r),a=new Uint8Array(n.byteLength);return a.set(n),await new Promise((e,t)=>{let n=new FileReader;n.onload=()=>e(n.result),n.onerror=t,n.readAsDataURL(new Blob([a],{type:i}))})}catch{}try{let n=t.replace(/^\/+/,``),r=[o(`/files/main/${n}`),o(`/static-main/${n}`),o(`/pages/main/${n}`)];for(let n of r)try{let r=typeof window<`u`&&window.location?.origin?new URL(n,window.location.origin).toString():n,i=await fetch(r);if(i.ok){let n=await i.blob();if(this.db)try{let r=await n.arrayBuffer();await b(this.db,e,t,new Uint8Array(r))}catch{}return await new Promise((e,t)=>{let r=new FileReader;r.onload=()=>e(r.result),r.onerror=t,r.readAsDataURL(n)})}}catch{}}catch{}return null}async renderSelectedPage(){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-pages-empty]`),r=t.querySelector(`[data-pages-rendered]`);if(!(n instanceof HTMLElement)||!(r instanceof HTMLElement))return;let i=this.selectedPage;if(!this.db||!i){this._renderedKey=null,this._renderedContent=null,this._renderedFrontmatterToggle=null,n.hidden=!1,r.hidden=!0,r.textContent=``,this.pageFrontmatter.set(null),this.removePreviewIframe(t);return}let a=++this.renderToken;try{let o;try{o=await x(this.db,i.groupId,i.path)}catch(e){try{let t=await v(i.path);if(typeof t==`string`)o=t,Promise.resolve(b(this.db,i.groupId,i.path,o)).catch(()=>{});else throw e}catch{throw e}}if(a!==this.renderToken)return;n.hidden=!0;let s=`${i.groupId}:${i.path}`;if(this.isHtmlPath(i.path)){let e=D(o),n=Object.keys(e.data).length>0?e.data:null,a=this.pageFrontmatter.get();if(JSON.stringify(a)!==JSON.stringify(n)&&this.pageFrontmatter.set(n),this._renderedKey===s&&this._renderedContent===o&&t.querySelector(`[data-pages-iframe]`)){this.showNavButtonsTemporarily(2500);return}this._renderedKey=s,this._renderedContent=o,this._renderedFrontmatterToggle=null,r.hidden=!0;let c=this.ensurePreviewIframe(t,r);c.hidden=!1,this.previewFrameWindow=null,u(c,await this.buildHtmlPageSrcdoc(e.content,i.path)),this.showNavButtonsTemporarily(2500);return}if(this.removePreviewIframe(t),this.isMarkdownPath(i.path)){let t=D(o),n=Object.keys(t.data).length>0?t.data:null,c=this.pageFrontmatter.get();JSON.stringify(c)!==JSON.stringify(n)&&this.pageFrontmatter.set(n);let u=await B(this.db,e.MARKDOWN_FRONTMATTER_PAGES);if(this._renderedKey===s&&this._renderedContent===o&&this._renderedFrontmatterToggle===u&&r.children.length>0&&!r.hidden){this.showNavButtonsTemporarily(2500);return}if(!this._renderedKey&&this._dsdInitialPath&&this._dsdInitialPath===i.path&&r.children.length>0&&!r.hidden){this._renderedKey=s,this._renderedContent=o,this._renderedFrontmatterToggle=u,await this.resolveMarkdownImages(r,i.groupId,i.path),this.showNavButtonsTemporarily(2500);return}this._renderedKey=s,this._renderedContent=o,this._renderedFrontmatterToggle=u,r.hidden=!1;let d=await O(o,{renderFrontmatter:u});if(a!==this.renderToken)return;let f=this.rewriteWorkspacePreviewHtml(d,i.path);if(a!==this.renderToken)return;l(r,f,R),await this.resolveMarkdownImages(r,i.groupId,i.path),this.showNavButtonsTemporarily(2500);return}if(this._renderedKey===s&&this._renderedContent===o&&!r.hidden){this.showNavButtonsTemporarily(2500);return}this._renderedKey=s,this._renderedContent=o,this._renderedFrontmatterToggle=null,this.pageFrontmatter.set(null),r.hidden=!1,r.textContent=o,this.showNavButtonsTemporarily(2500)}catch(e){this._renderedKey=null,this._renderedContent=null,this._renderedFrontmatterToggle=null,n.hidden=!1,r.hidden=!0,r.textContent=``,this.pageFrontmatter.set(null),this.removePreviewIframe(t);let a=e instanceof Error?e.message:String(e);w(`Failed to load page ${i.path}: ${a}`,5e3)}}async requestConfirmation(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog({mode:`confirm`,...e}):(S(e.message,4500),!1)}async resolveMarkdownImages(e,t,n){let r=Array.from(e.querySelectorAll(`img[src]`));r.length!==0&&await Promise.all(r.map(async e=>{let r=e.getAttribute(`src`)||``;if(!r||/^(?:blob:|data:|#)/u.test(r))return;let i=this.resolveWorkspaceFileTarget(r,n,t);if(!i)return;let a=await this.readImageAsDataUrl(i.groupId,i.path);a&&e.setAttribute(`src`,a)}))}async resolveRelativeImagesInHtml(e,t,n){if(!e)return e;let r=new DOMParser().parseFromString(e,`text/html`),i=Array.from(r.querySelectorAll(`img[src]`));return i.length===0?e:(await Promise.all(i.map(async e=>{let r=e.getAttribute(`src`)||``;if(!r||/^(?:blob:|data:|#)/u.test(r))return;let i=this.resolveWorkspaceFileTarget(r,t,n);if(!i)return;let a=await this.readImageAsDataUrl(i.groupId,i.path);a&&e.setAttribute(`src`,a)})),r.body.innerHTML)}ensurePreviewIframe(e,t){let n=e.querySelector(`[data-pages-iframe]`);if(n instanceof HTMLIFrameElement)return n;let r=document.createElement(`iframe`);return r.className=`pages__iframe`,r.setAttribute(`data-pages-iframe`,``),r.setAttribute(`title`,this.selectedPage?`Preview: ${this.selectedPage.path}`:`Page preview`),r.setAttribute(`sandbox`,d()),r.setAttribute(`allow`,`fullscreen`),r.setAttribute(`allowfullscreen`,`true`),r.hidden=!0,r.addEventListener(`load`,()=>{this.previewFrameWindow=r.contentWindow,this.syncIframeTheme()}),t.before(r),r}syncIframeTheme(){if(!this.previewFrameWindow)return;let e=document.documentElement.classList.contains(`dark-mode`),t=getComputedStyle(document.documentElement),n={};for(let e=0;e<t.length;e++){let r=t[e];r.startsWith(`--`)&&(n[r]=t.getPropertyValue(r))}this.previewFrameWindow.postMessage({type:`shadow-claw-theme-update`,theme:e?`dark`:`light`,customProperties:n},`*`)}pageRefKey(e){if(!e)return``;let t=e.groupId;return t===`main`&&(t=`br:main`),`${t}\u0000${e.path}`}removePreviewIframe(e){let t=e.querySelector(`[data-pages-iframe]`);t instanceof HTMLIFrameElement&&(t.removeAttribute(`srcdoc`),t.remove())}};customElements.get(z)||customElements.define(z,V);export{V as ShadowClawPages};