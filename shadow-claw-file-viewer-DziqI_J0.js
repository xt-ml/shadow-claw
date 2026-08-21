import{r as e}from"./config-64zJ5TLN.js";import{n as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{a as r,i,l as a,n as o,o as s}from"./app-routes-CA-uT3Nk.js";import{d as c,f as l,i as u,n as d,p as f,r as p,s as m,u as h}from"./custom-element-security-MwgLnC6q.js";import{pn as g,t as _,tn as v}from"./orchestrator-DrMg2dnI.js";import{r as y,t as b}from"./toast-D3gxhZpN.js";import{t as x}from"./shadow-claw-element-na_3JW5e.js";import{t as S}from"./effect-BEsuusE8.js";import{n as C,r as w,t as T}from"./markdown-DXtaNEac.js";import{t as E}from"./file-viewer-C3DgeHSd.js";import{t as D}from"./config-value-oBfKgLT4.js";import"./shadow-claw-dialog-n4xdcUp-.js";import{n as O,t as k}from"./iframe-theme-Du-qyM1D.js";const A=new CSSStyleSheet;A.replaceSync(`*,
*::before,
*::after {
  box-sizing: border-box;
  scrollbar-color: var(--shadow-claw-border-color) transparent;
  scrollbar-width: thin;
}

:root {
  --shadow-claw-font-mono: "Fira Code", "Courier New", monospace;
}

pre {
  font-family: var(--shadow-claw-font-mono) !important;
}

/* Scrollbar — cross-browser thin style (Shadow DOM) */
* {
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

.hidden,
[hidden] {
  display: none !important;
}

:host {
  display: contents;
}

.file-modal {
  background: transparent;
  border: none;
  margin: 0;
  max-height: unset;
  max-width: unset;
  padding: 0;
}

.file-modal[open] {
  align-items: flex-start;
  box-sizing: border-box;
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 0.5rem;
  position: fixed;
  width: auto;
  z-index: 1000;
}

.file-modal::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  background-color: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: var(--shadow-claw-shadow-lg);
  display: flex;
  flex-direction: column;
  height: min(88dvh, 45rem);
  max-height: calc(100dvh - 1rem);
  max-width: 56rem;
  width: calc(100vw - 1rem);
}

.modal-content.modal-content--fullscreen {
  height: calc(100dvh - 1rem);
  max-height: calc(100dvh - 1rem);
  max-width: calc(100vw - 1rem);
  width: calc(100vw - 1rem);
}

.modal-header {
  align-items: center;
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  min-width: 0;
  padding: 0.625rem 0.75rem;
}

.modal-header-actions {
  align-items: center;
  display: flex;
  flex: none;
  gap: 0.5rem;
}

.modal-cancel-btn,
.modal-save-btn,
.modal-share-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  min-height: 2rem;
  padding: 0.375rem 0.625rem;
  transition: all 0.15s;
}

.modal-share-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
}

.modal-save-btn {
  background-color: var(--shadow-claw-text-primary);
  border-color: var(--shadow-claw-text-primary);
  color: var(--shadow-claw-bg-primary);
}

.modal-save-btn:hover {
  background-color: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.modal-cancel-btn {
  border-color: var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
}

.modal-cancel-btn:hover {
  border-color: var(--shadow-claw-error, #ef4444);
  color: var(--shadow-claw-error, #ef4444);
}

.modal-title {
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Segmented view-mode group (Edit + Preview) */
.modal-view-modes {
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  display: flex;
  flex: none;
  margin-right: 0.5rem;
  overflow: hidden;
}

.modal-view-modes .modal-edit-btn,
.modal-view-modes .modal-preview-btn,
.modal-view-modes .modal-fullscreen-btn {
  background-color: transparent;
  border: none;
  border-radius: 0;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  min-height: 2rem;
  padding: 0.375rem 0.625rem;
  transition: all 0.15s;
}

.modal-view-modes .modal-edit-btn {
  border-right: 0.0625rem solid var(--shadow-claw-border-color);
}

.modal-view-modes .modal-preview-btn {
  border-right: 0.0625rem solid var(--shadow-claw-border-color);
}

/* When edit button is hidden (binary files), preview gets full rounding */
.modal-view-modes .modal-edit-btn.hidden + .modal-preview-btn {
  border-radius: var(--shadow-claw-radius-m);
}

.modal-view-modes .modal-edit-btn:hover,
.modal-view-modes .modal-preview-btn:hover,
.modal-view-modes .modal-fullscreen-btn:hover {
  background-color: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-primary);
}

.modal-view-modes .modal-edit-btn[aria-pressed="true"],
.modal-view-modes .modal-preview-btn[aria-pressed="true"],
.modal-view-modes .modal-fullscreen-btn[aria-pressed="true"] {
  background-color: var(--shadow-claw-bg-secondary);
  color: var(--shadow-claw-text-primary);
}

.modal-close-btn {
  background-color: var(--shadow-claw-bg-tertiary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  min-height: 2rem;
  padding: 0.375rem 0.625rem;
}

.modal-close-btn:hover {
  background-color: var(--shadow-claw-bg-secondary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-text-primary);
}

@media (max-width: 640px) {
  .modal-cancel-btn .btn-label,
  .modal-save-btn .btn-label {
    display: none;
  }
}

@media (max-width: 480px) {
  .btn-label {
    display: none;
  }

  .modal-header-actions {
    gap: 0.25rem;
  }
}

.modal-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  position: relative;
}

.modal-body.modal-body--editing {
  overflow: hidden;
}

.file-content {
  color: var(--shadow-claw-text-primary);
  flex: 1;
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0.75rem;
  white-space: pre-wrap;
  word-break: break-all;
}

.file-content--preview {
  font-family: var(--shadow-claw-font-sans);
  font-size: var(--shadow-claw-font-size-sm);
  line-height: 1.5;
  overflow-wrap: anywhere;
  padding: 0.75rem 1rem;
  user-select: text !important;
  white-space: normal;
  word-break: break-word;
}

.file-content--preview *,
.file-content--preview pre,
.file-content--preview code {
  user-select: text !important;
}

.file-content--preview > :first-child {
  margin-top: 0;
}

.file-content--preview > :last-child {
  margin-bottom: 0;
}

.file-content--preview pre {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  margin: 0.75rem 0;
  overflow-x: auto;
  padding: 0;
}

.file-content--preview pre code.hljs {
  background-color: transparent;
  display: block;
  font-size: 0.8125rem;
  line-height: 1.6;
  padding: 0.75rem;
}

.file-content--preview code:not(pre code) {
  background: var(--shadow-claw-bg-tertiary);
  border-radius: var(--shadow-claw-radius-s);
  font-size: 0.85em;
  padding: 0.125rem 0.3rem;
}

.file-content--preview img {
  height: auto;
  max-width: 100%;
}

.file-content--preview table {
  border-collapse: collapse;
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

.file-content--preview th,
.file-content--preview td {
  border: 0.0625rem solid var(--shadow-claw-border-color);
  padding: 0.375rem 0.75rem;
  text-align: left;
}

.file-content--preview th {
  background: var(--shadow-claw-bg-secondary);
  font-weight: 600;
}

.file-content--preview blockquote {
  border-left: 0.25rem solid var(--shadow-claw-border-color);
  color: var(--shadow-claw-text-secondary);
  margin: 0.75rem 0;
  padding: 0.25rem 1rem;
}

.file-content--preview a {
  color: var(--shadow-claw-accent-primary);
}

.file-content--preview h1,
.file-content--preview h2 {
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  padding-bottom: 0.375rem;
}

.file-content--preview ul,
.file-content--preview ol {
  padding-left: 1.5rem;
}

.file-content--iframe {
  height: 100%;
  margin: 0;
  overflow: auto;
  padding: 0;
  width: 100%;
}

.file-content-iframe {
  background-color: var(--shadow-claw-bg-primary);
  border: none;
  border-radius: var(--shadow-claw-radius-s);
  display: block;
  min-height: 100%;
  width: 100%;
}

.file-editor-container {
  background-color: var(--shadow-claw-hljs-background-color, rgb(40, 44, 52));
  display: none;
  flex: 1;
  margin: 0.75rem;
  min-height: 0;
  min-width: 0;
  position: relative;
}

.file-editor-container.active {
  display: block;
}

.file-editor {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  caret-color: #abb2bf !important;
  color: transparent;
  font-family: var(--shadow-claw-font-mono), monospace !important;
  font-size: 1rem !important;
  font-variant-ligatures: none !important;
  height: 100%;
  left: 0;
  line-height: 1.5 !important;
  overflow: auto;
  padding: 0.625rem;
  position: absolute;
  resize: none;
  tab-size: 2;
  top: 0;
  white-space: pre;
  width: 100%;
  z-index: 1;
}

.file-editor-container pre.file-editor-overlay {
  border: 0.0625rem solid transparent !important;
  border-radius: var(--shadow-claw-radius-s);
  box-sizing: border-box !important;
  font-family: var(--shadow-claw-font-mono), monospace !important;
  font-size: 1rem !important;
  font-variant-ligatures: none !important;
  height: 100% !important;
  left: 0 !important;
  line-height: 1.5 !important;
  margin: 0 !important;
  overflow: hidden !important;
  padding: 0.625rem !important;
  pointer-events: none;
  position: absolute !important;
  tab-size: 2 !important;
  top: 0 !important;
  white-space: pre !important;
  width: 100% !important;
  z-index: 0;
}

.file-editor-container pre.file-editor-overlay code,
.file-editor-container pre.file-editor-overlay code.hljs {
  display: block !important;
  font-family: inherit !important;
  font-size: inherit !important;
  font-variant-ligatures: none !important;
  /* hljs CSS injects overflow-x:auto on pre code.hljs via a constructed stylesheet.
  Inside the overlay (pointer-events:none) this would create an unclickable ghost scrollbar.
  Use overflow:visible so the code content extends into the pre's scroll area.
  The pre (overflow:hidden) handles visual clipping; JS sync scrolls the pre.
  visible never generates a scrollbar, so no ghost scrollbar appears. */
  overflow: visible !important;
  line-height: inherit !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: inherit !important;
  word-break: normal !important;
  word-wrap: normal !important;
}

.file-editor:focus {
  border-color: var(--shadow-claw-accent-primary);
  box-shadow: 0 0 0 0.125rem var(--shadow-claw-bg-tertiary);
  outline: none;
}

.code-line {
  border-left: 0.1875rem solid transparent;
  display: inline-block;
  padding-left: 0.5rem;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  width: 100%;
}

.code-line.highlighted {
  background-color: var(--shadow-claw-bg-tertiary);
  border-left: 0.1875rem solid var(--shadow-claw-accent-primary);
}
`);const j=new DOMParser().parseFromString(`<template>
  <shadow-claw-dialog dialog-class="file-modal" dialog-aria-label="File viewer">
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">File:</h3>
        <div class="modal-header-actions">
          <button
            aria-label="Share file"
            class="modal-share-btn hidden"
            type="button"
          >
            ↗<span class="btn-label"> Share</span>
          </button>
          <div class="modal-view-modes">
            <button
              aria-pressed="false"
              aria-label="Edit file"
              class="modal-edit-btn"
              title="Edit"
              type="button"
            >
              ✏️<span class="btn-label"> Edit</span>
            </button>
            <button
              aria-pressed="false"
              aria-label="Toggle preview mode"
              class="modal-preview-btn"
              title="Preview"
              type="button"
            >
              👁️<span class="btn-label"> Preview</span>
            </button>
            <button
              aria-pressed="false"
              aria-label="Enter fullscreen"
              class="modal-fullscreen-btn"
              title="Fullscreen"
              type="button"
            >
              ⛶<span class="btn-label"> Fullscreen</span>
            </button>
          </div>
          <button
            aria-label="Discard changes"
            class="modal-cancel-btn hidden"
            title="Discard unsaved changes"
            type="button"
          >
            ✕<span class="btn-label"> Cancel</span>
          </button>
          <button
            aria-label="Save file"
            class="modal-save-btn hidden"
            type="button"
          >
            💾<span class="btn-label"> Save</span>
          </button>
          <button
            aria-label="Close file viewer"
            class="modal-close-btn"
            type="button"
          >
            &times;
          </button>
        </div>
      </div>
      <div class="modal-body">
        <div class="file-content file-content--raw"></div>
        <div class="file-editor-container">
          <pre
            class="file-editor-overlay"
            aria-hidden="true"
          ><code class="hljs"></code></pre>
          <textarea
            aria-label="File editor"
            class="file-editor"
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    </div>
  </shadow-claw-dialog>
</template>
`,`text/html`),M=j.querySelector(`template`);let N=[];N=M?Array.from(M.content.children):Array.from(j.head.children).concat(Array.from(j.body.children));var P=N;const F=`shadow-claw-file-viewer`,I=`components/${F}/highlightjs-atom-one-dark.min.css`,L=`pre code.hljs, code.hljs, .hljs { font-family: var(--shadow-claw-font-mono) !important; }`,R={ALLOWED_URI_REGEXP:/^(?:(?:https?|mailto|ftp|tel|file|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,ADD_TAGS:[`iframe`,`figure`,`figcaption`],CUSTOM_ELEMENT_HANDLING:{tagNameCheck:e=>m(e),attributeNameCheck:()=>!0,allowCustomizedBuiltInElements:!1},ADD_ATTR:[`allow`,`allowfullscreen`,`frameborder`,`scrolling`,`referrerpolicy`,`loading`]};function z(e,t){return!e||typeof e.transaction!=`function`||n(e,t).then(e=>D(e,!0)).catch(()=>!0)}var B=class extends x{static styles=A;static template=P;currentImageObjectUrls=[];currentObjectUrl=null;db=null;editorDraftContent=null;isEditorDirty=!1;isFileEditMode=!1;isFilePreviewMode=!1;isFullscreenMode=!1;lastOpenedFileName=``;previewFrameWindow=null;themeObserver=null;viewRenderToken=0;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);this.setupEffects(),this.bindEventListeners(),window.addEventListener(`message`,this.handleIframeMessage),document.addEventListener(`fullscreenchange`,this.handleFullscreenChange),this.themeObserver=new MutationObserver(e=>{for(let t of e)t.type===`attributes`&&t.attributeName===`class`&&this.syncIframeTheme()}),this.themeObserver.observe(document.documentElement,{attributes:!0,attributeFilter:[`class`]}),this.db=await t();try{let e=await fetch(I).then(e=>e.text());this.applyHighlightStyles(e)}catch(e){console.warn(`Failed to load highlight.js styles:`,e)}}disconnectedCallback(){window.removeEventListener(`message`,this.handleIframeMessage),document.removeEventListener(`fullscreenchange`,this.handleFullscreenChange),this.themeObserver&&=(this.themeObserver.disconnect(),null),this.revokeObjectUrl()}applyFullscreenMode(e){let t=e.querySelector(`.modal-content`);t instanceof HTMLElement&&t.classList.toggle(`modal-content--fullscreen`,this.isFullscreenMode);let n=e.querySelector(`.modal-fullscreen-btn`);n instanceof HTMLButtonElement&&(n.setAttribute(`aria-pressed`,String(this.isFullscreenMode)),n.setAttribute(`aria-label`,this.isFullscreenMode?`Exit fullscreen`:`Enter fullscreen`),n.title=this.isFullscreenMode?`Exit fullscreen`:`Fullscreen`)}applyHighlightStyles(e){let t=this.shadowRoot;if(!t)return;if(typeof CSSStyleSheet<`u`&&typeof CSSStyleSheet.prototype.replaceSync==`function`&&`adoptedStyleSheets`in t)try{let n=new CSSStyleSheet;n.replaceSync(e);let r=new CSSStyleSheet;r.replaceSync(L),t.adoptedStyleSheets=[...t.adoptedStyleSheets?Array.from(t.adoptedStyleSheets):[],n,r];return}catch{}let n=document.createElement(`style`);n.setAttribute(`data-shadow-claw-highlight-theme`,`true`),n.textContent=`${e}\n${L}`,t.appendChild(n)}bindEventListeners(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.file-modal`);t?.addEventListener(`cancel`,e=>{e.preventDefault(),this.requestCloseViewer()}),t?.addEventListener(`close`,()=>{E.file&&E.closeFile()}),e.querySelector(`.modal-close-btn`)?.addEventListener(`click`,()=>void this.requestCloseViewer()),e.querySelector(`.modal-preview-btn`)?.addEventListener(`click`,async()=>{this.isFilePreviewMode=!this.isFilePreviewMode,this.isFileEditMode=!1,await this.updateView()}),e.querySelector(`.modal-fullscreen-btn`)?.addEventListener(`click`,()=>{t&&this.toggleFullscreenMode(t)}),e.querySelector(`.modal-share-btn`)?.addEventListener(`click`,async()=>{await this.handleShareFile()}),e.querySelector(`.modal-edit-btn`)?.addEventListener(`click`,async()=>{this.isFileEditMode=!this.isFileEditMode,this.isFileEditMode&&(this.isFilePreviewMode=!1),await this.updateView()}),e.querySelector(`.modal-save-btn`)?.addEventListener(`click`,()=>this.handleSave()),e.querySelector(`.modal-cancel-btn`)?.addEventListener(`click`,async()=>{this.isEditorDirty=!1,this.editorDraftContent=null,this.isFileEditMode=!1,await this.updateView()});let n=e.querySelector(`.file-editor`);if(n?.addEventListener(`input`,()=>{n instanceof HTMLTextAreaElement&&(this.editorDraftContent=n.value,this.updateEditorHighlight(n.value)),this.isEditorDirty=!0,this.updateView()}),n instanceof HTMLTextAreaElement){let t=()=>{let t=e.querySelector(`.file-editor-overlay`);t&&(t.scrollTop=n.scrollTop,t.scrollLeft=n.scrollLeft)};n.addEventListener(`scroll`,t),n.addEventListener(`focus`,t),n.addEventListener(`click`,t),n.addEventListener(`keyup`,t),n.addEventListener(`mouseup`,t),e.querySelector(`.modal-body`)?.addEventListener(`scroll`,t)}}buildWebShareFile(e){if(e?.nativeFile instanceof File)return e.nativeFile;let t=e?.binaryContent;if(!(t instanceof Uint8Array)||t.length===0)return null;let n=new Uint8Array(t.byteLength);return n.set(t),new File([n],e.name||`shared-file`,{type:e?.mimeType||`application/octet-stream`})}canShareCurrentFile(e){if(!e||!this.isWebShareAvailable())return!1;if(e.kind===`text`)return!0;let t=this.buildWebShareFile(e);if(!t||typeof navigator.canShare!=`function`)return!1;try{return navigator.canShare({files:[t]})}catch{return!1}}canUseNativeFullscreen(e){return document.fullscreenEnabled===!0&&(typeof e.requestFullscreen==`function`||typeof e.webkitRequestFullscreen==`function`)&&(typeof document.exitFullscreen==`function`||typeof document.webkitExitFullscreen==`function`)}getCurrentFullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null}getFullscreenTarget(e){let t=e.querySelector(`.modal-content`);return t instanceof HTMLElement?t:null}getIframeBridgeScriptUrl(){return o(`/assets/file-viewer-preview-bridge.js`)}getIframeSandboxPermissions(e){return/\.svg$/i.test(e)?`allow-modals allow-popups allow-popups-to-escape-sandbox`:u()}getLanguageFromFilename(e){return{bash:`bash`,cjs:`javascript`,css:`css`,html:`xml`,java:`java`,javascript:`javascript`,js:`javascript`,json:`json`,jsx:`jsx`,markdown:`markdown`,md:`markdown`,mjs:`javascript`,php:`php`,python:`python`,py:`python`,ruby:`ruby`,rb:`ruby`,rust:`rust`,rs:`rust`,sh:`bash`,sql:`sql`,svg:`xml`,ts:`typescript`,tsx:`tsx`,xml:`xml`,yaml:`yaml`,yml:`yaml`}[e.toLowerCase().split(`.`).pop()||``]||``}getPreviewSourceFile(e,t){return this.getWorkingSourceFile(e,t)}getWorkingSourceFile(e,t){if(!this.isEditorDirty||e?.kind!==`text`)return e;if(typeof this.editorDraftContent==`string`)return{...e,content:this.editorDraftContent};let n=t.querySelector(`.file-editor`);return n instanceof HTMLTextAreaElement?{...e,content:n.value}:e}getWorkspaceRouteTarget(e,t={}){let{allowCrossGroup:n=!1}=t,i=e.split(/[?#]/,1)[0].trim();if(!i)return null;if(/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(i)||i.startsWith(`//`)){let e;try{e=new URL(i,window.location.href)}catch{return null}if(e.origin!==window.location.origin)return null;i=e.pathname}let a=i.replace(/^(?:\.\/)+/u,``),o=[];if(a.startsWith(`files/`)&&o.push(`/${a}`),i.startsWith(`/`)){let e=i.lastIndexOf(`/files/`);e>0&&o.push(i.slice(e)),o.push(i)}for(let e of o){let t=r(e);if(!t)continue;let i=this.resolveRouteGroupId(t.groupId);if(i&&!(!n&&i!==_.activeGroupId))return{groupId:i,path:t.path}}return null}handleAnchorNavigation(e){let t=this.shadowRoot;if(!t)return!1;let n=t.querySelector(`.file-content`);if(!n)return!1;n.querySelectorAll(`.code-line.highlighted`).forEach(e=>{e.classList.remove(`highlighted`)});let r=e.match(/^#?L(\d+)(?:-L?(\d+))?$/i);if(r){let e=parseInt(r[1],10),t=r[2]?parseInt(r[2],10):e,i=null;return n.querySelectorAll(`.code-line`).forEach(n=>{let r=parseInt(n.getAttribute(`data-line`)||`0`,10);r>=e&&r<=t&&(n.classList.add(`highlighted`),i||=n)}),i?(i.scrollIntoView({behavior:`smooth`,block:`center`}),!0):!1}else{let t=e.replace(/^#/,``),r=n.querySelector(`[id="${t}"]`)||n.querySelector(`a[name="${t}"]`);return r?(r.scrollIntoView({behavior:`smooth`,block:`start`}),!0):!1}}handleFullscreenChange=()=>{let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.file-modal`);if(!(t instanceof HTMLElement))return;let n=this.getFullscreenTarget(t);this.isFullscreenMode=this.isTargetInFullscreen(n),this.applyFullscreenMode(t)};handleIframeMessage=e=>{if(!e.data||typeof e.data!=`object`)return;let t=e.data;if(t.type===`shadow-claw-iframe-resize`&&typeof t.height==`number`){let n=this.shadowRoot?.querySelector(`.file-content-iframe`);n instanceof HTMLIFrameElement&&(!this.previewFrameWindow||e.source===this.previewFrameWindow||n.contentWindow&&e.source===n.contentWindow)&&(this.previewFrameWindow=n.contentWindow,n.style.setProperty(`height`,`${t.height}px`,`important`));return}if(!this.db||t.type!==`shadow-claw-file-viewer-link`||typeof t.href!=`string`||this.previewFrameWindow&&e.source!==this.previewFrameWindow)return;let n=E.file,r=n?.path||n?.name||``,o=i(_.activeGroupId,r),c=a(t.href,o,window.location.origin);if(!c)return;if(!(c.origin===window.location.origin&&(s(c.pathname)||this.resolveWorkspaceLinkPath(t.href,r)))){window.open(c.href,`_blank`,`noopener,noreferrer`);return}let l=`${c.pathname}${c.search}${c.hash}`,u=window.navigation;if(u&&typeof u.navigate==`function`){u.navigate(l);return}window.history.pushState({},``,l),window.dispatchEvent(new PopStateEvent(`popstate`))};hasUnsavedChanges(){return this.isEditorDirty}isIframePreviewFile(e){return/\.(?:html?|svg)$/i.test(e)}isMarkdownLikeFile(e){return/(?:^readme$|\.mdx?$|\.markdown$|\.mdown$)/i.test(e)}isNodeInComposedTree(e,t){let n=e;for(;n;){if(n===t)return!0;if(n.parentNode){n=n.parentNode;continue}let e=n.getRootNode?.();if(e instanceof ShadowRoot&&e.host){n=e.host;continue}n=null}return!1}isRenderTokenCurrent(e){return this.viewRenderToken===e}isTargetInFullscreen(e){if(!e)return!1;let t=this.getCurrentFullscreenElement();return t?t===e||this.isNodeInComposedTree(e,t)||this.isNodeInComposedTree(t,e):!1}isWebShareAvailable(){return typeof navigator<`u`&&typeof navigator.share==`function`}mimeTypeForImageExt(e){return{apng:`image/apng`,avif:`image/avif`,gif:`image/gif`,jpg:`image/jpeg`,jpeg:`image/jpeg`,png:`image/png`,svg:`image/svg+xml`,webp:`image/webp`}[e]??`image/jpeg`}renderBinaryPreview(e,t){let n=t.mimeType||`application/octet-stream`;if(t.nativeFile instanceof File)this.currentObjectUrl=URL.createObjectURL(t.nativeFile);else{let r=t.binaryContent;if(!(r instanceof Uint8Array)||r.length===0){e.classList.remove(`file-content--raw`,`file-content--iframe`),e.classList.add(`file-content--preview`),e.textContent=`Binary content unavailable.`;return}let i=new Uint8Array(r.byteLength);i.set(r);let a=new Blob([i],{type:n});this.currentObjectUrl=URL.createObjectURL(a)}if(e.classList.remove(`file-content--raw`,`file-content--preview`),e.classList.add(`file-content--iframe`),n.startsWith(`image/`)){let n=document.createElement(`img`);n.className=`file-content-iframe`,n.alt=`Preview: ${t.name}`,n.src=this.currentObjectUrl,n.style.objectFit=`contain`,e.replaceChildren(n);return}if(n.startsWith(`video/`)){let t=document.createElement(`video`);t.className=`file-content-iframe`,t.controls=!0,t.src=this.currentObjectUrl,t.style.backgroundColor=`black`,e.replaceChildren(t);return}if(n.startsWith(`audio/`)){let n=document.createElement(`div`);n.className=`file-content file-content--preview`,n.style.padding=`1rem`;let r=document.createElement(`p`);r.textContent=t.name;let i=document.createElement(`audio`);i.controls=!0,i.src=this.currentObjectUrl,i.style.width=`100%`,n.replaceChildren(r,i),e.replaceChildren(n),e.classList.remove(`file-content--iframe`);return}let r=document.createElement(`iframe`);r.className=`file-content-iframe`,r.setAttribute(`title`,`Preview: ${t.name}`),r.setAttribute(`referrerpolicy`,`no-referrer`),r.src=this.currentObjectUrl,e.replaceChildren(r)}resetContent(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`.file-modal`);if(!(t instanceof HTMLElement))return;let n=this.getFullscreenTarget(t);n&&this.isTargetInFullscreen(n)&&this.exitNativeFullscreen().catch(()=>{}),this.isFullscreenMode=!1,this.applyFullscreenMode(t);let r=t.querySelector(`.file-content`),i=t.querySelector(`.modal-preview-btn`);i instanceof HTMLButtonElement&&(i.setAttribute(`aria-pressed`,`false`),i.setAttribute(`aria-label`,`Switch to preview mode`));let a=t.querySelector(`.modal-edit-btn`);a instanceof HTMLButtonElement&&(a.setAttribute(`aria-pressed`,`false`),a.setAttribute(`aria-label`,`Edit file`),a.classList.remove(`hidden`));let o=t.querySelector(`.modal-close-btn`);o instanceof HTMLButtonElement&&(o.disabled=!1,o.setAttribute(`aria-label`,`Close file viewer`),o.title=`Close`),t.querySelector(`.modal-save-btn`)?.classList.add(`hidden`),t.querySelector(`.file-editor-container`)?.classList.remove(`active`),t.querySelector(`.modal-body`)?.classList.remove(`modal-body--editing`);let s=t.querySelector(`.file-editor`);s instanceof HTMLTextAreaElement&&(s.value=``,s.removeAttribute(`language`));let c=t.querySelector(`.file-editor-overlay code`);c&&(c.innerHTML=``,c.className=`hljs`),this.isFileEditMode=!1,this.editorDraftContent=null,r instanceof HTMLElement&&(this.revokeObjectUrl(),r.classList.remove(`hidden`),r.classList.add(`file-content--raw`),r.classList.remove(`file-content--preview`,`file-content--iframe`),r.textContent=``)}resolveRouteGroupId(e){let t=_.activeGroupId;if(e===t||this.routeGroupMatches(e,t))return t;let n=Array.isArray(_.groups)?_.groups:[],r=n.find(t=>t.groupId===e);if(r)return r.groupId;let i=n.find(t=>this.routeGroupMatches(e,t.groupId));return i?i.groupId:e||null}resolveWorkspaceLinkPath(e,t=``){let n=e.trim();if(!n||n.startsWith(`#`))return null;let r=n,i=/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(n);if(i||n.startsWith(`//`)){let e;try{e=new URL(n,window.location.href)}catch{return null}if(!(e.protocol===`http:`||e.protocol===`https:`)||e.host!==window.location.host)return null;r=`${e.pathname}${e.search}${e.hash}`}let a=this.getWorkspaceRouteTarget(r);if(a)return a.path;let o=r.split(/[?#]/,1)[0].replace(/\\/g,`/`),s=o.startsWith(`/`);if(i||s||(o=o.replace(/^\/+/,``),!o))return null;let c=[];if(!s){let e=t.replace(/\\/g,`/`).replace(/^\/+/,``).split(`/`).filter(Boolean);e.pop(),c.push(...e)}for(let e of o.split(`/`))if(!(!e||e===`.`)){if(e===`..`){if(c.length===0)return null;c.pop();continue}c.push(e)}return c.length>0?c.join(`/`):null}revokeObjectUrl(){this.previewFrameWindow=null,this.currentObjectUrl&&=(URL.revokeObjectURL(this.currentObjectUrl),null);for(let e of this.currentImageObjectUrls)URL.revokeObjectURL(e);this.currentImageObjectUrls=[]}rewriteWorkspacePreviewHtml(e,t){if(!e)return e;let n=i(_.activeGroupId,t),r=new DOMParser().parseFromString(e,`text/html`),o=(e,i)=>{let o=Array.from(r.querySelectorAll(e));for(let e of o){let r=(e.getAttribute(i)||``).trim();if(!r||r.startsWith(`#`)||r.startsWith(`javascript:`))continue;let o=a(r,n,window.location.origin);!o||o.origin!==window.location.origin||i===`href`&&!(s(o.pathname)||this.resolveWorkspaceLinkPath(r,t))||e.setAttribute(i,`${o.pathname}${o.search}${o.hash}`)}};return o(`a[href]`,`href`),o(`img[src]`,`src`),o(`audio[src]`,`src`),o(`video[src]`,`src`),o(`source[src]`,`src`),r.body.innerHTML}routeGroupMatches(e,t){if(e===t||e===`main`&&t===`br:main`||e===`br:main`&&t===`main`)return!0;if(!e.includes(`:`)&&!t.includes(`:`))return!1;let n=e=>e.trim().replace(/:/g,`-`);return n(e)===n(t)}setupEffects(){S(()=>{let e=E.file,t=++this.viewRenderToken,n=this.shadowRoot;if(!n)return;let r=n.querySelector(`shadow-claw-dialog`);r&&typeof r.ensureDialog==`function`&&r.ensureDialog();let i=n.querySelector(`.file-modal`);if(e){r&&typeof r.showModal==`function`&&!r.open?r.showModal():i instanceof HTMLDialogElement&&!i.open&&i.showModal();let a=n.querySelector(`.modal-title`);a instanceof HTMLElement&&(a.textContent=`File: ${e.name}`),this.lastOpenedFileName!==e.name&&(this.lastOpenedFileName=e.name,this.isFilePreviewMode=this.shouldAutoPreview(e),this.isFileEditMode=!1,this.isEditorDirty=!1,this.editorDraftContent=null),this.updateView(t)}else r&&typeof r.close==`function`&&r.open?r.close():i instanceof HTMLDialogElement&&i.open&&i.close(),this.lastOpenedFileName=``,this.isFilePreviewMode=!1,this.isEditorDirty=!1,this.editorDraftContent=null,this.resetContent()})}shouldAutoPreview(e){return!e||typeof e!=`object`?!1:e.kind===`pdf`||e.kind===`binary`?!0:e.kind===`text`?this.isIframePreviewFile(e.name)||this.isMarkdownLikeFile(e.name):!1}toPreviewMarkdown(e){return this.isMarkdownLikeFile(e.name)?e.content:"```"+this.getLanguageFromFilename(e.name)+`
`+e.content+"\n```"}updateEditorHighlight(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`.file-editor-overlay code`);if(!n)return;let r=E.file,i=this.getLanguageFromFilename(r?.name||``),a=``;try{a=i&&w.getLanguage(i)?w.highlight(e,{language:i}).value:w.highlightAuto(e).value}catch{a=e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}n.className=i?`hljs language-${i}`:`hljs`,n.innerHTML=f(a+`<br>`)}wrapCodeLines(e){e.querySelectorAll(`pre code`).forEach(e=>{let t=e.innerHTML.split(/\r?\n/u);t.length>1&&t[t.length-1]===``&&t.pop(),c(e,t.map((e,t)=>`<span class="code-line" data-line="${t+1}">${e||`&nbsp;`}</span>`).join(`
`))})}stripHtmlFrontmatter(e){if(typeof e!=`string`||!e.trimStart().startsWith(`---`))return e;let t=C(e);return Object.keys(t.data||{}).length===0?e:t.content||``}async buildIframePreviewSrcdoc(e){if(/\.svg$/i.test(e.name))return e.content;let t=e.path||e.name||``,n=this.stripHtmlFrontmatter(e.content||``),r=this.rewriteWorkspacePreviewHtml(n,t),a=h(await this.resolveRelativeImagesInHtml(r,t),R),s=crypto.randomUUID().replace(/-/g,``),c=this.getIframeBridgeScriptUrl(),l=d(),u=p(s),f=typeof document<`u`?document.getElementById(`shadow-claw-site-config`):null,m=f&&f.textContent?`<script id="shadow-claw-site-config" type="application/json">${f.textContent}<\/script>`:``,g=l.map(e=>`<script type="module" src="${e.startsWith(`http://`)||e.startsWith(`https://`)||e.startsWith(`//`)?e:o(e.startsWith(`/`)?e:`/${e.replace(/^pages\/main\//,``)}`)}" nonce="${s}"><\/script>`).join(`
`),v=`<link rel="stylesheet" href="${o(`/theme.css`)}">`;return[`<!doctype html>`,`<html class="${k()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`,`<meta http-equiv="Content-Security-Policy" content="${u}">`,`<base href="${o(i(_.activeGroupId,t))}" target="_blank">`,m,`<script src="${c}" nonce="${s}"><\/script>`,O(),v,g,`</head><body>`,a,`</body></html>`].join(``)}async canDismissViewer(){if(!this.hasUnsavedChanges())return!0;let e=await this.requestConfirmation({title:`Discard Unsaved Changes`,message:`You have unsaved changes. Discard them and close?`,confirmLabel:`Discard`,cancelLabel:`Keep Editing`});return e&&(this.isEditorDirty=!1,this.editorDraftContent=null),e}async exitFullscreenIfActive(e){let t=this.shadowRoot,n=e||t?.querySelector(`.file-modal`);if(!n)return;let r=this.getFullscreenTarget(n);if(!(!r||!this.isTargetInFullscreen(r)))try{await this.exitNativeFullscreen()}catch{}}async exitNativeFullscreen(){let e=document.exitFullscreen||document.webkitExitFullscreen;if(typeof e!=`function`)throw Error(`Native fullscreen exit unavailable`);await Promise.resolve(e.call(document))}async handlePreviewLinkClick(e){if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;let t=e.target;if(!(t instanceof Element))return;let n=t.closest(`a`);if(!(n instanceof HTMLAnchorElement)||!this.db)return;let r=E.file,o=r?.path||r?.name||``,c=n.getAttribute(`href`)||``,l=a(c,i(_.activeGroupId,o),window.location.origin);if(l&&l.origin===window.location.origin&&(s(l.pathname)||this.resolveWorkspaceLinkPath(c,o))&&l){e.preventDefault();let t=`${l.pathname}${l.search}${l.hash}`,n=window.navigation;n&&typeof n.navigate==`function`?n.navigate(t):(window.history.pushState({},``,t),window.dispatchEvent(new PopStateEvent(`popstate`)));return}let u=c.trim();if(u&&!u.startsWith(`#`)&&!u.startsWith(`javascript:`)){let t=n.getAttribute(`target`)||`_blank`,r=t===`_self`||t===`_top`||t===`_parent`?`_blank`:t;try{new URL(u,window.location.href).host!==window.location.host&&(e.preventDefault(),window.open(u,r,`noopener,noreferrer`))}catch{/^[a-zA-Z][a-zA-Z\d+.-]*:/u.test(u)&&(e.preventDefault(),window.open(u,r,`noopener,noreferrer`))}}}async handleSave(){let e=E.file;if(!e||!this.db)return;let t=this.shadowRoot,n=t?.querySelector(`.modal-save-btn`),r=t?.querySelector(`.file-editor`);if(r instanceof HTMLTextAreaElement)try{n instanceof HTMLButtonElement&&(n.disabled=!0,n.textContent=`⏳ saving...`);let t=r.value,i=_.currentPath===`.`?e.name:`${_.currentPath}/${e.name}`;await v(this.db,_.activeGroupId,i,t),y(`Saved ${e.name}`),await _.loadFiles(this.db),e.content=t,this.isFileEditMode=!1,this.isEditorDirty=!1,this.editorDraftContent=null,await this.updateView()}catch(e){b(`Failed to save file: ${e instanceof Error?e.message:String(e)}`)}finally{n instanceof HTMLButtonElement&&(n.disabled=!1,n.textContent=`💾 Save`)}}async handleShareFile(){let e=E.file;if(!e||!this.canShareCurrentFile(e)){b(`Sharing is not supported for this file on this device.`,4500);return}try{if(e.kind===`text`)await navigator.share({title:e.name,text:e.content||``});else{let t=this.buildWebShareFile(e);if(!t||!navigator.canShare?.({files:[t]})){b(`File sharing is not supported on this device.`,4500);return}await navigator.share({title:e.name,files:[t]})}y(`Shared ${e.name}`)}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return;b(`Failed to share file: ${e instanceof Error?e.message:String(e)}`,5e3)}}async openFolderInFilesView(e){if(!this.db)return;let t=e.replace(/^\/+|\/+$/g,``);if(t)try{await _.setCurrentPath(this.db,t),E.closeFile();let e=window?.shadowclaw?.ui;e&&typeof e.showPage==`function`&&e.showPage(`files`)}catch(e){b(`Failed to open linked folder: ${e instanceof Error?e.message:String(e)}`,5e3)}}async openWorkspaceLink(e,t){if(!this.db)return;let n=this.resolveWorkspaceLinkPath(e,t);if(!n)return;let r=n.split(`/`).filter(Boolean).pop()||``;if(!/\.[^./]+$/u.test(r)){try{await E.openFile(this.db,n,_.activeGroupId);return}catch(e){let t=e instanceof DOMException&&e.name===`NotFoundError`,n=e instanceof DOMException&&e.name===`TypeMismatchError`;if(!t&&!n){b(`Failed to open linked file: ${e instanceof Error?e.message:String(e)}`,5e3);return}}await this.openFolderInFilesView(n);return}try{await E.openFile(this.db,n,_.activeGroupId)}catch(e){b(`Failed to open linked file: ${e instanceof Error?e.message:String(e)}`,5e3)}}async renderPreview(t,n,r=this.viewRenderToken){if(!this.isRenderTokenCurrent(r))return;if(this.revokeObjectUrl(),this.previewFrameWindow=null,n.kind===`pdf`){t.classList.remove(`file-content--raw`,`file-content--preview`,`file-content--iframe`),import(`./shadow-claw-pdf-viewer-YzgHr4Oo.js`).then(()=>{let e=document.createElement(`shadow-claw-pdf-viewer`);e.file=n,t.replaceChildren(e)}).catch(console.error);return}if(n.kind===`binary`){this.renderBinaryPreview(t,n);return}if(this.isIframePreviewFile(n.name)){t.classList.remove(`file-content--raw`,`file-content--preview`),t.classList.add(`file-content--iframe`);let e=document.createElement(`iframe`);e.className=`file-content-iframe`,e.setAttribute(`title`,`Preview: ${n.name}`),e.setAttribute(`sandbox`,this.getIframeSandboxPermissions(n.name)),e.setAttribute(`allow`,`fullscreen`),e.setAttribute(`allowfullscreen`,`true`),e.setAttribute(`referrerpolicy`,`no-referrer`),l(e,await this.buildIframePreviewSrcdoc(n)),e.addEventListener(`load`,()=>{this.previewFrameWindow=e.contentWindow,this.syncIframeTheme()}),t.replaceChildren(e);return}t.classList.remove(`file-content--raw`),t.classList.add(`file-content--preview`);let i=E.file,a=i?.path||i?.name||``,o=this.toPreviewMarkdown(n),s=z(this.db,e.MARKDOWN_FRONTMATTER_FILE_VIEWER),u=await T(o,{renderFrontmatter:typeof s==`boolean`?s:await s});if(!this.isRenderTokenCurrent(r))return;let d=this.rewriteWorkspacePreviewHtml(u,a);this.isRenderTokenCurrent(r)&&(c(t,d,R),this.wrapCodeLines(t),await this.resolveMarkdownImages(t,a))}async requestCloseViewer(){return await this.canDismissViewer()?(await this.exitFullscreenIfActive(),E.closeFile(),!0):!1}async requestConfirmation(e){let t=document.querySelector(`shadow-claw`);return t&&typeof t.requestDialog==`function`?await t.requestDialog({mode:`confirm`,...e}):!1}async requestNativeFullscreen(e){let t=e.requestFullscreen||e.webkitRequestFullscreen;if(typeof t!=`function`)throw Error(`Native fullscreen unavailable`);await Promise.resolve(t.call(e))}async resolveMarkdownImages(e,t){if(!this.db)return;let n=Array.from(e.querySelectorAll(`img`));n.length!==0&&await Promise.all(n.map(async e=>{let n=e.getAttribute(`src`)||``;if(!n||/^(?:blob:|data:|#)/u.test(n))return;let r=this.getWorkspaceRouteTarget(n,{allowCrossGroup:!0})||(()=>{let e=this.resolveWorkspaceLinkPath(n,t);return e?{groupId:_.activeGroupId,path:e}:null})();if(r)try{let t=await g(this.db,r.groupId,r.path),n=r.path.split(`.`).pop()?.toLowerCase()||``,i=this.mimeTypeForImageExt(n),a=new Uint8Array(t.byteLength);a.set(t),e.src=await new Promise((e,t)=>{let n=new FileReader;n.onload=()=>e(n.result),n.onerror=t,n.readAsDataURL(new Blob([a],{type:i}))})}catch{}}))}async resolveRelativeImagesInHtml(e,t){if(!this.db||!e)return e;let n=new DOMParser().parseFromString(e,`text/html`),r=Array.from(n.querySelectorAll(`img`));return r.length===0?e:(await Promise.all(r.map(async e=>{let n=e.getAttribute(`src`)||``;if(!n||/^(?:blob:|data:|#)/u.test(n))return;let r=this.getWorkspaceRouteTarget(n,{allowCrossGroup:!0})||(()=>{let e=this.resolveWorkspaceLinkPath(n,t);return e?{groupId:_.activeGroupId,path:e}:null})();if(r)try{let t=await g(this.db,r.groupId,r.path),n=r.path.split(`.`).pop()?.toLowerCase()||``,i=this.mimeTypeForImageExt(n),a=new Uint8Array(t.byteLength);a.set(t);let o=await new Promise((e,t)=>{let n=new FileReader;n.onload=()=>e(n.result),n.onerror=t,n.readAsDataURL(new Blob([a],{type:i}))});e.setAttribute(`src`,o)}catch{}})),n.body.innerHTML)}async toggleFullscreenMode(e){let t=this.getFullscreenTarget(e);if(t){if(this.canUseNativeFullscreen(t)){let n=this.isTargetInFullscreen(t);try{n?(await this.exitNativeFullscreen(),this.isFullscreenMode=!1):(await this.requestNativeFullscreen(t),this.isFullscreenMode=!0)}catch{this.isFullscreenMode=!this.isFullscreenMode}this.applyFullscreenMode(e);return}this.isFullscreenMode=!this.isFullscreenMode,this.applyFullscreenMode(e)}}async updateView(e=this.viewRenderToken){let t=E.file,n=this.shadowRoot;if(!n||!t)return;let r=n.querySelector(`.file-modal`);if(!(r instanceof HTMLElement))return;this.applyFullscreenMode(r);let i=r.querySelector(`.file-content`),a=r.querySelector(`.modal-preview-btn`),o=r.querySelector(`.modal-body`);if(!(i instanceof HTMLElement))return;i.classList.remove(`file-content--iframe`);let s=this.getWorkingSourceFile(t,r),c=t.kind===`text`;a instanceof HTMLButtonElement&&(a.setAttribute(`aria-pressed`,String(this.isFilePreviewMode)),a.setAttribute(`aria-label`,this.isFilePreviewMode?`Switch to raw text view`:`Switch to preview mode`));let l=r.querySelector(`.file-editor-container`),u=r.querySelector(`.modal-edit-btn`),d=r.querySelector(`.modal-save-btn`),f=r.querySelector(`.modal-share-btn`),p=r.querySelector(`.modal-close-btn`),m=r.querySelector(`.modal-cancel-btn`);if(f instanceof HTMLButtonElement){let e=this.canShareCurrentFile(t);f.classList.toggle(`hidden`,!e),f.disabled=!e}if(p instanceof HTMLButtonElement){let e=this.hasUnsavedChanges();p.disabled=!1,p.setAttribute(`aria-label`,e?`Close file viewer (unsaved changes)`:`Close file viewer`),p.title=e?`Close (you have unsaved changes)`:`Close`}let h=this.hasUnsavedChanges();if(d instanceof HTMLButtonElement&&d.classList.toggle(`hidden`,!h),m instanceof HTMLButtonElement&&m.classList.toggle(`hidden`,!h),this.isFilePreviewMode){o?.classList.remove(`modal-body--editing`),i.classList.remove(`hidden`),l?.classList.remove(`active`),u instanceof HTMLButtonElement&&(u.setAttribute(`aria-pressed`,`false`),u.setAttribute(`aria-label`,`Edit file`),u.classList.toggle(`hidden`,!c)),await this.renderPreview(i,s,e);return}if(this.isRenderTokenCurrent(e))if(this.isFileEditMode&&c){o?.classList.add(`modal-body--editing`),i.classList.add(`hidden`),l?.classList.add(`active`),u instanceof HTMLButtonElement&&(u.setAttribute(`aria-pressed`,`true`),u.setAttribute(`aria-label`,`Switch to raw text view`),u.classList.remove(`hidden`));let e=l?.querySelector(`.file-editor`);if(e instanceof HTMLTextAreaElement){e.setAttribute(`tab-size`,`2`);let n=this.getLanguageFromFilename(t.name);if(n?e.setAttribute(`language`,n):e.removeAttribute(`language`),this.isEditorDirty)typeof s?.content==`string`&&(e.value!==s.content&&(e.value=s.content),this.updateEditorHighlight(e.value));else{let n=t.content||``;e.value!==n&&(e.value=n),this.updateEditorHighlight(e.value)}e.dispatchEvent(new Event(`scroll`))}}else o?.classList.remove(`modal-body--editing`),i.classList.remove(`hidden`),l?.classList.remove(`active`),u instanceof HTMLButtonElement&&(u.setAttribute(`aria-pressed`,`false`),u.setAttribute(`aria-label`,`Edit file`),u.classList.toggle(`hidden`,!c)),i.classList.add(`file-content--raw`),i.classList.remove(`file-content--preview`,`file-content--iframe`),t.kind===`binary`?i.textContent=`Binary file (${t.mimeType||`application/octet-stream`}). Switch to Preview to view.`:i.textContent=s.content||``}syncIframeTheme(){if(!this.previewFrameWindow)return;let e=document.documentElement.classList.contains(`dark-mode`),t=getComputedStyle(document.documentElement),n={};for(let e=0;e<t.length;e++){let r=t[e];r.startsWith(`--`)&&(n[r]=t.getPropertyValue(r))}this.previewFrameWindow.postMessage({type:`shadow-claw-theme-update`,theme:e?`dark`:`light`,customProperties:n},`*`)}};customElements.get(F)||customElements.define(F,B);export{B as ShadowClawFileViewer};