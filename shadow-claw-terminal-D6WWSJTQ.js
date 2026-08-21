import{C as e,S as t,t as n,x as r}from"./orchestrator-DrMg2dnI.js";import{t as i}from"./shadow-claw-element-na_3JW5e.js";function a(e){if(!e)return``;let t=e.split(`
`);for(let e=t.length-1;e>=0;--e){let n=t[e]||``;if(/[#$](?:\s|$)/.test(n))return n}return``}function o(e){return e.scrollHeight-(e.scrollTop+e.clientHeight)<=12}function s(e,t){let n=e[t+1];if(n===void 0)return{action:`ignore`,nextIndex:t+1,incomplete:!0};if(n===`[`){let n=t+2;for(;n<e.length;){let t=e.charCodeAt(n);if(t>=64&&t<=126){let t=e[n];return t===`J`?{action:`clear-screen`,nextIndex:n+1}:t===`K`?{action:`clear-line`,nextIndex:n+1}:{action:`ignore`,nextIndex:n+1}}n+=1}return{action:`ignore`,nextIndex:e.length,incomplete:!0}}if(n===`]`){let n=t+2;for(;n<e.length;){let t=e[n];if(t===`\x07`)return{action:`ignore`,nextIndex:n+1};if(t===`\x1B`&&e[n+1]===`\\`)return{action:`ignore`,nextIndex:n+2};n+=1}return{action:`ignore`,nextIndex:e.length,incomplete:!0}}return{action:`ignore`,nextIndex:Math.min(t+2,e.length)}}function c(e){return e.replace(/(?:^|\n)[^\n]*mkdir -p \/home\/user 2>&1; echo "?__BCDONE_\d+__\$\?"?[^\n]*(?:\n|$)/g,`
`).replace(/(?:^|\n)\s*__BCDONE_\d+__(?:\d+|\$\?)?\s*(?:\n|$)/g,`
`).replace(/^\n+(?=\S)/,``)}function l(e,t,n=``,r){let i=r?.respectEraseSequences??!0,a=n+t,o=e;for(let e=0;e<a.length;e++){let t=a[e];if(t===`\x1B`){let t=s(a,e);if(t.incomplete)return{text:o,pending:a.slice(e)};if(t.action===`clear-screen`&&i&&(o=``),t.action===`clear-line`&&i){let e=o.lastIndexOf(`
`);o=e===-1?``:o.slice(0,e+1)}e=t.nextIndex-1;continue}if(t===`\r`){let t=a[e+1];if(t===`
`)continue;if(t!==void 0){let e=o.lastIndexOf(`
`);o=e===-1?``:o.slice(0,e+1);continue}return{text:o,pending:`\r`}}if(t===`\b`||t===``){o=o.slice(0,-1);continue}t<` `&&t!==`
`&&t!==`	`||t===`\x07`||(o+=t)}return o=c(o),{text:o,pending:``}}const u=new CSSStyleSheet;u.replaceSync(`*,
*::before,
*::after {
  font-family: var(--shadow-claw-font-sans);
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
  display: block;
}

.terminal {
  background:
    radial-gradient(circle at top, rgba(222, 51, 65, 0.12), transparent 45%),
    linear-gradient(180deg, rgba(17, 17, 17, 0.98), rgba(5, 5, 5, 0.98));
  border: 0.0625rem solid rgba(255, 255, 255, 0.15);
  border-radius: var(--shadow-claw-radius-l, 1.5rem);
  box-shadow:
    inset 0 0.0625rem 0 rgba(255, 255, 255, 0.05),
    0 1.25rem 2.5rem rgba(0, 0, 0, 0.3);
  color: var(--shadow-claw-on-primary);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 16rem;
  overflow: hidden;
  padding: 0.875rem;
}

.terminal__header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}

.terminal__title-group {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.terminal__badge {
  background: rgba(222, 51, 65, 0.16);
  border: 0.0625rem solid rgba(222, 51, 65, 0.3);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-important-color);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 0.25rem 0.55rem;
  text-transform: uppercase;
}

.terminal__title {
  color: var(--shadow-claw-text-secondary);
  font-size: 0.9375rem;
  font-weight: 600;
}

.terminal__status {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8125rem;
}

.terminal__status[data-state="ready"] {
  color: var(--shadow-claw-success-color);
}

.terminal__status[data-state="booting"] {
  color: var(--shadow-claw-on-primary);
}

.terminal__status[data-state="error"] {
  color: var(--shadow-claw-error-color);
}

.terminal__actions {
  display: flex;
  gap: 0.5rem;
}

.terminal__button {
  background: rgba(255, 255, 255, 0.08);
  border: 0.0625rem solid rgba(255, 255, 255, 0.2);
  border-radius: var(--shadow-claw-radius-m, 1rem);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.45rem 0.7rem;
  transition: all 0.15s;
}

.terminal__button:hover,
.terminal__button:focus-visible {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.35);
  box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.45);
  outline: none;
}

.terminal__button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.terminal__screen {
  background: linear-gradient(
    180deg,
    rgba(17, 17, 17, 0.84),
    rgba(5, 5, 5, 0.92)
  );
  border: 0.0625rem solid rgba(35, 35, 35, 0.9);
  border-radius: var(--shadow-claw-radius-m, 1rem);
  flex: 1;
  height: 11rem;
  max-height: 11rem;
  min-height: 11rem;
  overflow: auto;
  overflow: auto;
  padding: 0.875rem;
}

.terminal__output {
  color: rgba(255, 255, 255, 0.88);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
  line-height: 1.5;
  margin: 0;
  min-height: 100%;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal__composer {
  align-items: center;
  background: rgba(17, 17, 17, 0.72);
  border: 0.0625rem solid rgba(35, 35, 35, 0.95);
  border-radius: var(--shadow-claw-radius-m, 1rem);
  display: grid;
  gap: 0.625rem;
  grid-template-columns: auto 1fr auto;
  padding: 0.625rem 0.75rem;
}

.terminal__prompt {
  color: var(--shadow-claw-important-color);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
}

.terminal__input {
  background: transparent;
  border: none;
  color: var(--shadow-claw-on-primary);
  font-family: var(--shadow-claw-font-mono);
  font-size: 0.8125rem;
  min-width: 0;
}

.terminal__input:disabled {
  color: var(--shadow-claw-text-tertiary);
}

.terminal__input:focus {
  outline: none;
}

.terminal__input::placeholder {
  color: var(--shadow-claw-text-secondary);
}

.terminal__run {
  background: rgba(255, 255, 255, 0.12);
  border: 0.0625rem solid rgba(255, 255, 255, 0.2);
  border-radius: var(--shadow-claw-radius-pill);
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.5rem 0.85rem;
  transition: all 0.15s;
}

.terminal__run:hover,
.terminal__run:focus-visible {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 1);
  outline: none;
}

.terminal__run:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 47.99rem) {
  .terminal__header,
  .terminal__composer {
    grid-template-columns: 1fr;
  }

  .terminal__actions {
    width: 100%;
  }

  .terminal__button,
  .terminal__run {
    flex: 1;
  }

  .terminal__composer {
    align-items: stretch;
  }
}
`);const d=new DOMParser().parseFromString(`<template>
  <section class="terminal" aria-label="WebVM terminal">
    <div class="terminal__header">
      <div class="terminal__title-group">
        <span class="terminal__badge">WebVM</span>
        <span class="terminal__title">Alpine Console</span>
        <span class="terminal__status" data-role="status" data-state="booting">
          Booting WebVM...
        </span>
      </div>
      <div class="terminal__actions">
        <button
          class="terminal__button"
          data-action="interrupt"
          disabled
          type="button"
        >
          Ctrl+C
        </button>
        <button class="terminal__button" data-action="clear" type="button">
          Clear
        </button>
      </div>
    </div>
    <div class="terminal__screen" data-role="screen">
      <pre class="terminal__output" data-role="output"></pre>
    </div>
    <form class="terminal__composer" data-role="composer">
      <span class="terminal__prompt">#</span>
      <input
        autocomplete="off"
        class="terminal__input"
        data-role="input"
        disabled
        placeholder="Booting WebVM..."
        spellcheck="false"
        type="text"
      />
      <button class="terminal__run" data-action="run" disabled type="submit">
        Run
      </button>
    </form>
  </section>
</template>
`,`text/html`),f=d.querySelector(`template`);let p=[];p=f?Array.from(f.content.children):Array.from(d.head.children).concat(Array.from(d.body.children));var m=p;const h=12;var g=class extends i{static styles=u;static template=m;autoScrollEnabled;bootRequested;connectedToWorkerTerminal;isApplyingAutoScroll;orchestrator;outputBuffer;pendingAutoScrollFrame;pendingEscape;screenResizeObserver;session;terminalAttachRequested;vmStatus;constructor(){super(),this.session=null,this.outputBuffer=``,this.pendingEscape=``,this.bootRequested=!1,this.orchestrator=n.orchestrator,this.vmStatus={ready:!1,booting:!1,bootAttempted:!1,error:null},this.connectedToWorkerTerminal=!1,this.terminalAttachRequested=!1,this.autoScrollEnabled=!0,this.isApplyingAutoScroll=!1,this.pendingAutoScrollFrame=null,this.screenResizeObserver=null}async connectedCallback(){await this.render(),this.renderOutput(),this.bindEventListeners(),this.bindResizeObserver(),this.connectOrchestrator(),this.startTerminal()}disconnectedCallback(){this.pendingAutoScrollFrame!==null&&(cancelAnimationFrame(this.pendingAutoScrollFrame),this.pendingAutoScrollFrame=null),this.screenResizeObserver?.disconnect(),this.screenResizeObserver=null,super.disconnectedCallback(),this.connectedToWorkerTerminal=!1,this.terminalAttachRequested=!1,this.orchestrator&&r(this.orchestrator,n.activeGroupId)}appendOutput(e){let t=l(this.outputBuffer,e,this.pendingEscape,{respectEraseSequences:this.vmStatus.ready});this.outputBuffer=t.text,this.pendingEscape=t.pending,this.outputBuffer.length>8e4&&(this.outputBuffer=this.outputBuffer.slice(-8e4)),this.renderOutput()}attachSession(){if(!(this.connectedToWorkerTerminal||this.terminalAttachRequested)){if(this.vmStatus.ready||this.clearOutput(),!this.orchestrator){console.warn(`[ShadowClawTerminal] Cannot attach session: orchestrator not initialized.`);return}this.terminalAttachRequested=!0,t(this.orchestrator,n.activeGroupId)}}bindEventListeners(){let e=this.shadowRoot;e&&(e.querySelector(`[data-role="composer"]`)?.addEventListener(`submit`,e=>{e.preventDefault(),this.runCommand()}),e.querySelector(`[data-action="clear"]`)?.addEventListener(`click`,()=>this.clearOutput()),e.querySelector(`[data-action="interrupt"]`)?.addEventListener(`click`,()=>this.interrupt()),e.querySelector(`[data-role="screen"]`)?.addEventListener(`click`,()=>{this.getInput()?.focus()}),e.querySelector(`[data-role="screen"]`)?.addEventListener(`scroll`,()=>this.handleScreenScroll()))}bindResizeObserver(){if(typeof ResizeObserver>`u`)return;let e=this.getScreen();e&&(this.screenResizeObserver=new ResizeObserver(()=>{this.autoScrollEnabled&&this.scheduleAutoScroll()}),this.screenResizeObserver.observe(e))}clearOutput(){let e=this.vmStatus.ready&&this.connectedToWorkerTerminal?a(this.outputBuffer):``;this.outputBuffer=``,this.pendingEscape=``,this.autoScrollEnabled=!0,e&&(this.outputBuffer=e),this.renderOutput()}connectOrchestrator(){if(!this.orchestrator)return;let e=e=>{this.vmStatus=e,this.updateStatus(e),!e.error&&!this.connectedToWorkerTerminal&&!this.terminalAttachRequested&&this.attachSession()},t=({chunk:e})=>{this.appendOutput(e)},n=()=>{this.connectedToWorkerTerminal=!0,this.terminalAttachRequested=!1,this.updateStatus(this.vmStatus),this.getInput()?.focus()},r=()=>{this.connectedToWorkerTerminal=!1,this.terminalAttachRequested=!1,this.updateStatus(this.vmStatus)},i=({error:e})=>{this.connectedToWorkerTerminal=!1,this.terminalAttachRequested=!1,this.vmStatus={...this.vmStatus,error:typeof e==`string`?e:`WebVM terminal error`},this.updateStatus(this.vmStatus)};this.orchestrator.events.on(`vm-status`,e),this.orchestrator.events.on(`vm-terminal-output`,t),this.orchestrator.events.on(`vm-terminal-opened`,n),this.orchestrator.events.on(`vm-terminal-closed`,r),this.orchestrator.events.on(`vm-terminal-error`,i),this.addCleanup(()=>this.orchestrator?.events?.off?.(`vm-status`,e)),this.addCleanup(()=>this.orchestrator?.events?.off?.(`vm-terminal-output`,t)),this.addCleanup(()=>this.orchestrator?.events?.off?.(`vm-terminal-opened`,n)),this.addCleanup(()=>this.orchestrator?.events?.off?.(`vm-terminal-closed`,r)),this.addCleanup(()=>this.orchestrator?.events?.off?.(`vm-terminal-error`,i)),this.vmStatus=this.orchestrator.vmStatus||this.vmStatus,this.updateStatus(this.vmStatus)}getInput(){let e=this.shadowRoot?.querySelector(`[data-role="input"]`);return e instanceof HTMLInputElement?e:null}getScreen(){let e=this.shadowRoot?.querySelector(`[data-role="screen"]`);return e instanceof HTMLElement?e:null}handleScreenScroll(){if(this.isApplyingAutoScroll)return;let e=this.getScreen();e&&(this.autoScrollEnabled=o(e))}interrupt(){this.orchestrator&&e(this.orchestrator,``)}renderOutput(){let e=this.shadowRoot;if(!e)return;let t=e.querySelector(`[data-role="output"]`),n=e.querySelector(`[data-role="screen"]`);!(t instanceof HTMLElement)||!(n instanceof HTMLElement)||(t.textContent=this.outputBuffer,this.autoScrollEnabled&&this.scheduleAutoScroll())}runCommand(){let t=this.getInput();if(!t||!this.connectedToWorkerTerminal)return;let n=t.value;n.trim()&&(this.orchestrator&&e(this.orchestrator,`${n}\n`),t.value=``)}scheduleAutoScroll(){this.pendingAutoScrollFrame!==null&&cancelAnimationFrame(this.pendingAutoScrollFrame),this.pendingAutoScrollFrame=requestAnimationFrame(()=>{this.pendingAutoScrollFrame=null,this.scrollScreenToBottom()})}scrollScreenToBottom(){let e=this.getScreen();e&&(this.isApplyingAutoScroll=!0,e.scrollTop=e.scrollHeight,this.isApplyingAutoScroll=!1,this.autoScrollEnabled=o(e))}updateStatus(e){let t=this.shadowRoot;if(!t)return;let n=t.querySelector(`[data-role="status"]`),r=this.getInput(),i=t.querySelector(`[data-action="run"]`),a=t.querySelector(`[data-action="interrupt"]`);!(n instanceof HTMLElement)||!(i instanceof HTMLButtonElement)||!(a instanceof HTMLButtonElement)||(e.ready?(n.dataset.state=`ready`,n.textContent=this.connectedToWorkerTerminal?`Connected to Alpine WebVM`:`WebVM ready. Connecting terminal...`):e.error?(n.dataset.state=`error`,n.textContent=`WebVM unavailable: ${e.error}`):(n.dataset.state=`booting`,n.textContent=e.booting?`Booting WebVM...`:`Waiting for WebVM...`),r instanceof HTMLInputElement&&(r.disabled=!(e.ready&&this.connectedToWorkerTerminal),r.placeholder=e.ready&&this.connectedToWorkerTerminal?`Type a shell command`:e.ready?`Connecting to WebVM terminal...`:e.error?`WebVM unavailable`:`Booting WebVM...`),i.disabled=!(e.ready&&this.connectedToWorkerTerminal),a.disabled=!(e.ready&&this.connectedToWorkerTerminal))}async startTerminal(){let e=this.vmStatus;if(!this.orchestrator){this.updateStatus({ready:!1,booting:!1,bootAttempted:!1,error:`Terminal bridge is unavailable.`});return}if(e.ready){this.attachSession();return}if(e.error){this.updateStatus(e);return}if(this.bootRequested||(this.bootRequested=!0,this.attachSession()),!this.isConnected||!this.connectedToWorkerTerminal){this.updateStatus(this.vmStatus);return}this.attachSession()}};customElements.define(`shadow-claw-terminal`,g);export{h as AUTO_SCROLL_BOTTOM_THRESHOLD_PX,g as ShadowClawTerminal};