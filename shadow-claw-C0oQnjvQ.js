import{r as e}from"./config-64zJ5TLN.js";import{r as t}from"./txPromise-EBECky1b.js";import{t as n}from"./getConfig-D89uJgo5.js";import{c as r,n as i,o as a,r as o}from"./app-routes-CA-uT3Nk.js";import{n as s}from"./toast-60iDlgiH.js";import{En as c,Gt as l,P as u,_t as d,at as f,b as p,mt as m,rt as h,t as g,tn as ee}from"./orchestrator-DrMg2dnI.js";import{t as te}from"./setConfig-DFMYnYLE.js";import{t as _}from"./ulid-BY7rQVLN.js";import{r as v,t as y}from"./toast-D3gxhZpN.js";import{n as ne,r as re,t as ie}from"./constants-DiETpg52.js";import{t as ae}from"./shadow-claw-element-na_3JW5e.js";import{t as b}from"./effect-BEsuusE8.js";import{t as oe}from"./prompt-api-CyfgoCqW.js";import{t as x}from"./configurePeerJs-BxhLXOtN.js";import{t as S}from"./file-viewer-C3DgeHSd.js";const C={Light:`light`,Dark:`dark`,System:`system`},w=`shadow-claw-theme`;function T(){return typeof window.matchMedia==`function`&&window.matchMedia(`(prefers-color-scheme: dark)`).matches?`dark`:`light`}function E(e){return e===`system`?T():e}function D(e){let t=document.documentElement;e===`dark`?(t.classList.add(`dark-mode`),t.classList.remove(`light-mode`)):(t.classList.add(`light-mode`),t.classList.remove(`dark-mode`));let n=document.querySelector(`shadow-claw`);n&&(e===`dark`?(n.classList.add(`dark-mode`),n.classList.remove(`light-mode`)):(n.classList.add(`light-mode`),n.classList.remove(`dark-mode`))),window.dispatchEvent(new CustomEvent(`shadow-claw-theme-change`,{detail:{theme:e}}))}const se=localStorage.getItem(w)||`system`,O=E(se);D(O);const k=new class{_resolved;_theme;constructor(){this._theme=new s.State(se),this._resolved=new s.State(O)}getTheme(){return{theme:this.theme,resolved:this.resolved}}init(){typeof window.matchMedia==`function`&&window.matchMedia(`(prefers-color-scheme: dark)`).addEventListener(`change`,()=>{let e=T();localStorage.setItem(w,`system`),D(e),this._theme.set(`system`),this._resolved.set(e)}),window.addEventListener(`storage`,e=>{e.key===w&&e.newValue&&this.setTheme(e.newValue)})}get resolved(){return this._resolved.get()}setTheme(e){let t=E(e);localStorage.setItem(w,e),D(t),this._theme.set(e),this._resolved.set(t)}get theme(){return this._theme.get()}};k.init();async function A(e,t=3){for(let n=0;n<t;n++){if(e())return;await new Promise(e=>{requestAnimationFrame(()=>e())})}}function j(e,t){let n=e.sidebarDefaultPage,r=[n,`pages`,`chat`,`tasks`,`files`];if(!t)return n===`pages`||n===`chat`||n===`tasks`||n===`files`?n:`chat`;for(let e of r){if(e===`pages`&&!t.pagesSidebarHidden)return`pages`;if(e===`chat`&&!t.chatSidebarHidden)return`chat`;if(e===`tasks`&&!t.tasksSidebarHidden)return`tasks`;if(e===`files`&&!t.filesSidebarHidden)return`files`}return`pages`}function ce(e,t,n){return n&&t===`pages`?j(e):t}function le(e,t){if(!e||![`chat`,`tasks`,`files`].includes(t))return null;let n=e.querySelector(`[data-page-id="${t}"]`);if(!(n instanceof HTMLElement))return null;let r=n.querySelector(`shadow-claw-chat, shadow-claw-tasks, shadow-claw-files`),i=r instanceof HTMLElement?r.shadowRoot?.querySelector(`[data-terminal-slot]`):null;return i instanceof HTMLElement?i:null}function ue(e,t,n,r){let i=n;if(!i)return;let a=le(e,t);if(!a)return;i.parentElement!==a&&a.appendChild(i);let o=!r;i.hidden=o,o?(a.setAttribute(`hidden`,`hidden`),e?.querySelector(`shadow-claw-terminal`)?.setAttribute(`hidden`,`hidden`)):(a.removeAttribute(`hidden`),e?.querySelector(`shadow-claw-terminal`)?.removeAttribute(`hidden`))}const de={pages:()=>import(`./shadow-claw-pages-1KIS5CvR.js`),chat:()=>import(`./shadow-claw-chat-CoH4r1u1.js`),tasks:()=>import(`./shadow-claw-tasks-3zww_c6q.js`),files:()=>import(`./shadow-claw-files-BaJLjHt4.js`),settings:()=>import(`./shadow-claw-settings-ug0trIkl.js`),tools:()=>import(`./shadow-claw-tools-D7uzwtU6.js`),channels:()=>import(`./shadow-claw-channels-COKotkgZ.js`),terminal:()=>import(`./shadow-claw-terminal-D6WWSJTQ.js`),"file-viewer":()=>import(`./shadow-claw-file-viewer-DziqI_J0.js`),"pdf-viewer":()=>import(`./shadow-claw-pdf-viewer-YzgHr4Oo.js`)},M=new Map;async function N(e){let t=M.get(e);if(!t){let n=de[e];n?(t=n().then(()=>void 0),M.set(e,t)):t=Promise.resolve()}await t}function P(e,t,n,r,i){r&&N(`terminal`).catch(console.error),i!==null&&cancelAnimationFrame(i),i=requestAnimationFrame(()=>{i=null,ue(e,t,n,r)})}function fe(e){if(!e)return[];let t=[`shadow-claw-chat`,`shadow-claw-tasks`,`shadow-claw-files`,`shadow-claw-pages`,`shadow-claw-settings`,`shadow-claw-tools`,`shadow-claw-channels`],n=[];for(let r of t){let t=e.querySelector(r);if(!(t instanceof HTMLElement))continue;let i=t.shadowRoot?.querySelector(`shadow-claw-page-header`);i instanceof HTMLElement&&n.push(i)}return n}function F(e,t){if(e)for(let n of fe(e))n.setMainCollapsedOverride?.(t)}function I(e,t,n){if(!e)return;let r=e.querySelector(`.activity-log-toggle`);r instanceof HTMLButtonElement&&(r.hidden=t!==`chat`||n===0)}function L(e){if(!e)return null;let t=e.querySelector(`.page.active`);if(!(t instanceof HTMLElement))return null;let n=t.querySelector(`shadow-claw-chat, shadow-claw-tasks, shadow-claw-files, shadow-claw-pages, shadow-claw-settings, shadow-claw-tools, shadow-claw-channels`);if(!(n instanceof HTMLElement))return null;let r=n.shadowRoot?.querySelector(`shadow-claw-page-header`);return r instanceof HTMLElement?r:null}function R(e,t){if(!e)return;let n=e.querySelector(`.header-main-toggle`);if(!(n instanceof HTMLButtonElement))return;let r=typeof t==`boolean`?t:L(e)?.isMainCollapsed?.()??!1;n.setAttribute(`aria-label`,r?`Show action header`:`Hide action header`),n.setAttribute(`title`,r?`Show action header`:`Hide action header`),n.setAttribute(`aria-pressed`,String(r))}function z(e,t,n,r){if(!e)return;let i=e.querySelector(`.webvm-toggle`);if(!(i instanceof HTMLButtonElement))return;let a=t===`chat`||t===`files`;if(i.hidden=!a,i.classList.toggle(`hidden`,!a),i.classList.remove(`webvm-toggle--hidden`,`webvm-toggle--visible`,`webvm-toggle--booting`,`webvm-toggle--ready`,`webvm-toggle--error`),!a){i.classList.add(`webvm-toggle--error`);return}i.classList.add(n?`webvm-toggle--visible`:`webvm-toggle--hidden`),r.ready?i.classList.add(`webvm-toggle--ready`):(r.booting||r.bootAttempted)&&i.classList.add(`webvm-toggle--booting`),i.setAttribute(`aria-label`,n?`Hide WebVM terminal`:`Show WebVM terminal`),i.setAttribute(`title`,n?`Hide WebVM terminal`:`Show WebVM terminal`),i.setAttribute(`aria-pressed`,String(n))}const B={chat:`shadow-claw-chat`,tasks:`shadow-claw-tasks`,files:`shadow-claw-files`,settings:`shadow-claw-settings`,tools:`shadow-claw-tools`,channels:`shadow-claw-channels`};function V(e,t){let n=B[t];if(!n)return;let r=e.querySelector(`[data-page-id="${t}"]`);!r||r.children.length>0||r.appendChild(document.createElement(n))}function H(e,t,n,r,i,a=!0){if(!e)return;let o=ce(r,i,t.pagesSidebarHidden),s=B[o];s&&customElements.get(s)?V(e,o):N(o).then(()=>{e&&V(e,o)}).catch(console.error),e.querySelectorAll(`.page`).forEach(e=>{e.classList.remove(`active`)}),e.querySelectorAll(`.nav-item`).forEach(e=>{e.classList.remove(`active`)});let c=e.querySelector(`[data-page-id="${o}"]`);c&&c.classList.add(`active`);let l=e.querySelector(`[data-page="${o}"]`);l&&l.classList.add(`active`),t.currentPage=o,a&&n&&r.setActivePage(n,o).catch(console.error),P(e,t.currentPage,t.terminalElement,t.terminalVisible,t.terminalPlacementFrame),F(e,t.headerMainCollapsedOverride),R(e,t.headerMainCollapsedOverride),I(e,t.currentPage,r.activityLog.length),z(e,t.currentPage,t.terminalVisible,t.vmStatus);let u=e.querySelector(`.page.active`);if(u){let e=u;typeof e.scrollTo==`function`&&e.scrollTo(0,0)}if(o===`chat`){let t=e.querySelector(`shadow-claw-chat`);t&&typeof t.checkPromptApiOnboarding==`function`&&t.checkPromptApiOnboarding()}if(o===`files`&&n&&r.loadFiles(n).catch(console.error),o===`pages`){let t=e.querySelector(`shadow-claw-pages`);t&&typeof t.renderSelectedPage==`function`&&(t.renderSelectedPage(),typeof t.setupAutoRefreshTimer==`function`&&t.setupAutoRefreshTimer())}}async function U(e,t,n,r,i,a){let{page:o,groupId:s,path:c,anchor:l}=a;if(!n)return;let u=o?String(o).toLowerCase():``;if(u&&r.file&&!(u===`files`&&c&&c===r.file.path&&(!s||s===i.activeGroupId))){let t=e?.querySelector(`shadow-claw-file-viewer`);if(t&&typeof t.requestCloseViewer==`function`){if(!await t.requestCloseViewer())return}else r.closeFile()}if(s&&s!==i.activeGroupId?await i.switchConversation(n,s,u===`chat`):s&&(i.loadHistory(),(u===`tasks`||u===`files`)&&n&&i.loadFiles(n)),u&&H(e,t,n,i,u),u===`files`&&c)if(/\.[^./]+$/u.test(c))try{await r.openFile(n,c,s||i.activeGroupId),l&&await A(()=>{let t=e?.querySelector(`shadow-claw-file-viewer`);return t&&typeof t.handleAnchorNavigation==`function`?!!t.handleAnchorNavigation(l):!1})}catch(e){console.error(`Failed to open file via route navigation:`,c,e)}else try{await i.setCurrentPath(n,c),r.closeFile()}catch(e){console.error(`Failed to open folder via route navigation:`,c,e)}if(u===`pages`){if(typeof customElements<`u`&&await customElements.whenDefined(`shadow-claw-pages`),c)await i.setActivePinnedPage(n,{groupId:s||i.activeGroupId||`br:main`,path:c});else{let e=i.effectiveDefaultPage||i.pages&&i.pages[0]||null;e&&await i.setActivePinnedPage(n,e)}let t=e?.querySelector(`shadow-claw-pages`);t&&typeof t.renderSelectedPage==`function`&&(await t.renderSelectedPage(),typeof t.setupAutoRefreshTimer==`function`&&t.setupAutoRefreshTimer(),l&&await A(()=>typeof t.handleAnchorNavigation==`function`&&!!t.handleAnchorNavigation(l)))}}async function W(e,t,n,i,a,o){let s=await r(o,a.activeGroupId);s&&await U(e,t,n,i,a,s)}function G(e,t){let n=e?.querySelector(`.app-body`);if(!(n instanceof HTMLElement))return Math.max(200,Math.min(560,t));let r=Math.max(200,n.getBoundingClientRect().width-260);return Math.max(200,Math.min(Math.min(560,r),t))}async function K(t,n){if(t)try{await te(t,e.SIDEBAR_WIDTH,n)}catch{}}function q(e,t){let n=e?.querySelector(`.app-body`);if(!(n instanceof HTMLElement))return;let r=G(e,t);n.style.setProperty(`--sidebar-width`,`${r}px`)}async function pe(t,r,i,a){if(!t)return;let o=t.querySelector(`.sidebar-resize-handle`);if(!(o instanceof HTMLElement))return;o.setAttribute(`tabindex`,`0`),o.setAttribute(`role`,`separator`),o.setAttribute(`aria-orientation`,`vertical`),o.setAttribute(`aria-label`,`Resize sidebar width`);let s=()=>{let e=t.querySelector(`.app-body`);if(!(e instanceof HTMLElement))return 250;let n=parseFloat(e.style.getPropertyValue(`--sidebar-width`));return Number.isFinite(n)&&n>0?n:i.getBoundingClientRect().width||250},c=()=>{let e=Math.round(G(t,s())),n=Math.round(G(t,2**53-1));o.setAttribute(`aria-valuemin`,`200`),o.setAttribute(`aria-valuemax`,String(n)),o.setAttribute(`aria-valuenow`,String(e))};try{let r=a?await n(a,e.SIDEBAR_WIDTH):void 0;typeof r==`number`&&Number.isFinite(r)&&r>0?q(t,r):q(t,250)}catch{q(t,250)}let l=null,u=0,d=0,f=e=>{if(e.pointerId!==l)return;let n=e.clientX-u;q(t,d+n),c()},p=()=>{if(l===null)return;l=null,o.classList.remove(`active`),document.removeEventListener(`pointermove`,f);let e=t.querySelector(`.app-body`);if(e instanceof HTMLElement){let t=parseFloat(e.style.getPropertyValue(`--sidebar-width`));Number.isFinite(t)&&t>0&&a&&K(a,t)}},m=e=>{e.pointerId===l&&p()};o.addEventListener(`pointerdown`,e=>{e.pointerType===`mouse`&&e.button!==0&&e.button!==-1||window.innerWidth<896||(e.preventDefault(),l=e.pointerId,u=e.clientX,d=i.getBoundingClientRect().width,o.classList.add(`active`),o.setPointerCapture(e.pointerId),document.addEventListener(`pointermove`,f))}),o.addEventListener(`pointerup`,m),o.addEventListener(`pointercancel`,p),o.addEventListener(`dblclick`,()=>{q(t,250),a&&K(a,250),c()}),o.addEventListener(`keydown`,e=>{if(window.innerWidth<896)return;let n=e.shiftKey?32:12,r=s(),i=null;e.key===`ArrowRight`?i=r+n:e.key===`ArrowLeft`?i=r-n:e.key===`Home`?i=200:e.key===`End`&&(i=G(t,2**53-1)),i!==null&&(e.preventDefault(),q(t,i),c(),a&&K(a,G(t,s())))}),c(),r.addCleanup(()=>{p(),o.removeEventListener(`pointerup`,m),o.removeEventListener(`pointercancel`,p)})}async function J(e,t,n){if(!t)return!1;let r=t.querySelector(`.app-dialog`),i=t.querySelector(`.app-dialog__title`),a=t.querySelector(`.app-dialog__message`),o=t.querySelector(`.app-dialog__details`),s=t.querySelector(`.app-dialog__links`),c=t.querySelector(`.app-dialog__btn--confirm`),l=t.querySelector(`.app-dialog__btn--cancel`);if(!r||!i||!a||!o||!s||!c||!l)return!1;r.open&&r.close(),i.textContent=n.title,a.textContent=n.message,o.replaceChildren(),s.replaceChildren();let u=Array.isArray(n.details)?n.details:[];o.hidden=u.length===0;for(let t of u){let n=e.createElement(`li`);n.textContent=t,o.appendChild(n)}let d=Array.isArray(n.links)?n.links:[];s.hidden=d.length===0;for(let t of d){let n=e.createElement(`a`);n.className=`app-dialog__link`,n.href=t.href,n.rel=`noreferrer`,n.target=`_blank`,n.textContent=t.label,s.appendChild(n)}let f=n.mode||`confirm`;return c.textContent=n.confirmLabel||(f===`info`?`OK`:`Confirm`),l.textContent=n.cancelLabel||`Cancel`,l.hidden=f===`info`,r.returnValue=``,await new Promise(e=>{let t=()=>{r.removeEventListener(`close`,t),e(r.returnValue===`confirm`)};r.addEventListener(`close`,t),r.showModal()})}function me(e){if(typeof e==`boolean`)return e;if(typeof e==`number`)return e===1;if(typeof e==`string`){let t=e.trim().toLowerCase();return t===`true`||t===`1`}return!1}const he={pages:e.SIDEBAR_PAGES_HIDDEN,chat:e.SIDEBAR_CHAT_HIDDEN,tasks:e.SIDEBAR_TASKS_HIDDEN,files:e.SIDEBAR_FILES_HIDDEN};function Y(e,t,n){if(!e)return;let r=e.querySelector(`.nav-item[data-page="${t}"]`);r&&(r.hidden=n,r.setAttribute(`aria-hidden`,String(n)))}function ge(e){switch(e){case`pages`:return`pagesSidebarHidden`;case`chat`:return`chatSidebarHidden`;case`tasks`:return`tasksSidebarHidden`;case`files`:return`filesSidebarHidden`}}async function _e(e,t,r,i){for(let[r,a]of Object.entries(he)){let o=r,s=!1;if(i)try{s=me(await n(i,a))}catch{s=!1}let c=ge(o);t[c]=s,Y(e,o,s)}}function X(e,t,n,r,i,a){switch(i){case`pages`:t.pagesSidebarHidden=a;break;case`chat`:t.chatSidebarHidden=a;break;case`tasks`:t.tasksSidebarHidden=a;break;case`files`:t.filesSidebarHidden=a;break}Y(e,i,a),a&&t.currentPage===i&&H(e,t,r,n,j(n,t))}function ve(e,t,n,r,i){X(e,t,n,r,`pages`,i)}function Z(){let e=window.navigation;return!!(e&&typeof e.addEventListener==`function`&&typeof e.navigate==`function`)}function ye(e,t){if(!e)return;let n=e.querySelector(`shadow-claw-chat`);n&&typeof n.setActivityLogCollapsedOverride==`function`&&n.setActivityLogCollapsedOverride(t)}function be(e,t){if(!e)return;let n=e.querySelector(`.activity-log-toggle`);if(!(n instanceof HTMLButtonElement))return;let r=typeof globalThis.matchMedia==`function`&&!globalThis.matchMedia(`(min-width: 56rem) and (min-height: 401px)`).matches,i=typeof t==`boolean`?t:r;n.setAttribute(`aria-label`,i?`Show activity log`:`Hide activity log`),n.setAttribute(`title`,i?`Show activity log`:`Hide activity log`),n.setAttribute(`aria-pressed`,String(i))}function xe(e){let t=typeof globalThis.matchMedia==`function`&&!globalThis.matchMedia(`(min-width: 56rem) and (min-height: 401px)`).matches;e.activityLogCollapsedOverride=!(typeof e.activityLogCollapsedOverride==`boolean`?e.activityLogCollapsedOverride:t),ye(e.shadowRoot,e.activityLogCollapsedOverride),be(e.shadowRoot,e.activityLogCollapsedOverride)}function Se(e){e.headerMainCollapsedOverride=!(typeof e.headerMainCollapsedOverride==`boolean`?e.headerMainCollapsedOverride:L(e.shadowRoot)?.isMainCollapsed?.()??!1),F(e.shadowRoot,e.headerMainCollapsedOverride),R(e.shadowRoot,e.headerMainCollapsedOverride)}function Ce(e,t){t.terminalVisible=!t.terminalVisible,z(e,t.currentPage,t.terminalVisible,t.vmStatus),P(e,t.currentPage,t.terminalElement,t.terminalVisible,t.terminalPlacementFrame)}function we(e,t){e===C.Dark?(t.add(`dark-mode`),t.remove(`light-mode`)):(t.add(`light-mode`),t.remove(`dark-mode`))}function Te(e,t){if(!e)return;let n=e.querySelector(`.sun-icon`),r=e.querySelector(`.moon-icon`);n&&r&&(t===C.Dark?(n.style.display=`block`,n.removeAttribute(`hidden`),n.classList.remove(`hidden`),r.style.display=`none`,r.setAttribute(`hidden`,`hidden`),r.classList.add(`hidden`)):(n.style.display=`none`,n.setAttribute(`hidden`,`hidden`),n.classList.add(`hidden`),r.style.display=`block`,r.removeAttribute(`hidden`),r.classList.remove(`hidden`)))}function Ee(e,t,n,r,i,a,o,s,c){if(!n||!e||!t)return;n.querySelectorAll(`.nav-item[data-page]`).forEach(e=>{let r=e;r.addEventListener(`click`,()=>{let e=r.dataset.page||j(a);n.querySelectorAll(`.nav-item`).forEach(e=>e.classList.remove(`active`)),r.classList.add(`active`),setTimeout(()=>{t.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:e},bubbles:!0,composed:!0}))},0)})});let l=n.getElementById(`menu-button`),u=n.querySelector(`.sidebar`);if(l&&u){l.addEventListener(`click`,()=>{u.classList.toggle(`open`)}),n.querySelectorAll(`.nav-item, .settings-btn`).forEach(t=>{t.addEventListener(`click`,()=>{e.innerWidth<896&&u.classList.remove(`open`)})}),t.addEventListener(`click`,t=>{let n=t.composedPath();e.innerWidth<896&&u.classList.contains(`open`)&&!n.includes(u)&&!n.includes(l)&&u.classList.remove(`open`)});let a=e.matchMedia?e.matchMedia(`(min-width: 56rem)`):{matches:!1,addEventListener:()=>{},removeEventListener:()=>{}},o=e=>{e.matches&&u.classList.remove(`open`)};o(a),a.addEventListener(`change`,o),pe(n,r,u,i)}let d=n.querySelector(`[data-action="show-settings"]`);d&&d.addEventListener(`click`,()=>{t.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`settings`},bubbles:!0,composed:!0}))}),n.querySelector(`.header-main-toggle`)?.addEventListener(`click`,()=>{Se(r)}),n.querySelector(`.activity-log-toggle`)?.addEventListener(`click`,()=>{xe(r)}),n.addEventListener(`navigate`,e=>{let n=e.detail?.page;n&&t.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:n},bubbles:!0,composed:!0}))}),n.addEventListener(`sidebar-pages-visibility-change`,e=>{ve(n,r,a,i,!!e.detail?.hidden)}),n.addEventListener(`sidebar-chat-visibility-change`,e=>{X(n,r,a,i,`chat`,!!e.detail?.hidden)}),n.addEventListener(`sidebar-tasks-visibility-change`,e=>{X(n,r,a,i,`tasks`,!!e.detail?.hidden)}),n.addEventListener(`sidebar-files-visibility-change`,e=>{X(n,r,a,i,`files`,!!e.detail?.hidden)}),n.addEventListener(`navigate-back`,()=>t.dispatchEvent(new CustomEvent(`shadow-claw-navigate`,{detail:{page:`settings`},bubbles:!0,composed:!0})));let f=n.querySelector(`.theme-mode-toggle`);f&&f.addEventListener(`click`,()=>{let{resolved:e}=s.getTheme(),t=e===C.Dark?C.Light:C.Dark;s.setTheme(t)}),n.querySelector(`.webvm-toggle`)?.addEventListener(`click`,()=>Ce(n,r)),n.addEventListener(`shadow-claw-terminal-slot-ready`,()=>{P(n,r.currentPage,r.terminalElement,r.terminalVisible,r.terminalPlacementFrame),F(n,r.headerMainCollapsedOverride),R(n,r.headerMainCollapsedOverride)}),e.addEventListener(`resize`,()=>{r.headerMainCollapsedOverride===null&&R(n,r.headerMainCollapsedOverride)}),t.addEventListener(`shadow-claw-navigate`,r.shadowClawNav),Z()?(e.navigation.addEventListener(`navigate`,r.handleNavigationApiNavigate),r.navigationListenerAttached=!0):(r.popstateListener=()=>{W(n,r,i,o,a,new URL(e.location.href))},e.addEventListener(`popstate`,r.popstateListener),t.addEventListener(`click`,r.fallbackClickListener),r.fallbackClickListenerAttached=!0),e.addEventListener(`shadow-claw-theme-change`,e=>{let t=e.detail.theme;Te(n,t),we(t,r.classList)}),e.addEventListener(`shadow-claw-peer-error`,e=>{let r=e.detail,i=r.remotePeerId,a=r.error;J(t,n,{mode:`info`,title:`Peer Connection Error`,message:i?`Failed to communicate with peer ${i}: ${a}`:`PeerJS error: ${a}`,confirmLabel:`Dismiss`})});let p=s.resolved;Te(n,p),we(p,r.classList)}function De(e){if(e===void 0)return;e.documentElement.classList.remove(ne,`sc-prerender-override`);let t=e.querySelector(`shadow-claw`);t?.removeAttribute(ie),t?.removeAttribute(re)}function Oe(e,t){if(!e)return;let n=t;if(n.navigationType===`reload`)return;let r=n?.destination?.url;if(typeof r!=`string`)return;let i=new URL(r);if(i.origin===window.location.origin&&a(i.pathname))return{parsedUrl:i,navigateEvent:n}}function ke(e,t){if(t.defaultPrevented||t.button!==0||t.metaKey||t.ctrlKey||t.shiftKey||t.altKey)return null;let n=t.composedPath(),r=null;for(let e of n)if(e instanceof HTMLAnchorElement){r=e;break}if(!r)return null;let i=r.getAttribute(`href`)||``;return!i||i.startsWith(`javascript:`)||i.startsWith(`mailto:`)||i.startsWith(`tel:`)||r.target&&r.target!==`_self`||r.origin!==e.origin||!a(r.pathname)||r.pathname===e.pathname&&r.search===e.search&&r.hash!==e.hash?null:(t.preventDefault(),`${r.pathname}${r.search}${r.hash}`)}async function Ae(e,t,n){if(!t)return null;let r=t.querySelector(`.app-prompt-dialog`),i=t.querySelector(`.app-prompt-dialog__message`),a=t.querySelector(`.app-prompt-dialog__input-area`);if(!r||!i||!a)return null;if(r.open&&r.close(),i.textContent=n.question,a.replaceChildren(),Array.isArray(n.options)&&n.options.length>0){let t=e.createElement(`select`);t.className=`app-prompt-dialog__input`,t.name=`prompt-response`;for(let r of n.options){let n=e.createElement(`option`);n.value=r,n.textContent=r,t.appendChild(n)}a.appendChild(t)}else{let t=e.createElement(`input`);t.type=`text`,t.className=`app-prompt-dialog__input`,t.name=`prompt-response`,t.placeholder=`Enter your response...`,t.autocomplete=`off`,a.appendChild(t),setTimeout(()=>t.focus(),50)}return r.returnValue=``,await new Promise(e=>{let t=()=>{if(r.removeEventListener(`close`,t),r.returnValue===`submit`){let t=a.querySelector(`[name='prompt-response']`);e(t?t.value:null)}else e(null)};r.addEventListener(`close`,t),r.showModal()})}async function je(e,t,n,r){let i=await Ae(e,t,r);p(n.orchestrator,r.id,i)}async function Me(e,t,n,r){let i=r.path,a=r.groupId||t.activeGroupId;if(!(!i||!e))for(let t=0;t<=3;t++)try{await n.openFile(e,i,a);return}catch(e){let n=e instanceof DOMException&&e.name===`NotFoundError`;if(t<3&&n){await new Promise(e=>setTimeout(e,150*(t+1)));continue}y(`Failed to open file from tool: ${e instanceof Error?e.message:String(e)}`,5e3);return}}async function Ne(e,t,n){n?.providerId===`llamafile`?await J(e,t,f(n.reason)):n?.providerId===`transformers_js_local`?await J(e,t,h(n.reason)):n?.providerId===`prompt_api`?await J(e,t,oe(n.reason)):n?.providerId&&n.helpType&&await J(e,t,c(n.providerId,n.helpType,n.reason))}async function Pe(e,t,n,r,i,a){if(!(!r||!a?.roomId||!a?.hostPeerId)&&await J(e,t,{mode:`confirm`,title:`Room invitation`,message:`${a.fromAlias||a.fromPeerId} invited you to join "${a.roomName}".`,confirmLabel:`Join`,cancelLabel:`Decline`}))try{u(n.orchestrator,a.roomId,a.hostPeerId,a.roomName),await i.switchConversation(r,`room:${a.roomId}`),H(t,n,r,i,`chat`),v(`Joined room "${a.roomName}"`)}catch(e){y(`Failed to join room: ${e instanceof Error?e.message:String(e)}`,6e3)}}function Fe(e,t,n){let r=n.useTrailingSlash&&!t.includes(`#`)?t.endsWith(`/`)?t:t+`/`:t;n.replace?e.replaceState({},``,r):e.pushState({},``,r)}async function Ie(e,t,n,r,a,s,c={replace:!1}){let l=i(o(s));if(Z()){window.navigation.navigate(l,{history:c.replace?`replace`:`push`});return}l!==window.location.pathname&&Fe(globalThis.history,l,{...c,useTrailingSlash:!1}),await U(e,t,n,r,a,s)}function Le(e){let t=String(e||`chat`).toLowerCase();return t===`chat`||t===`files`||t===`tasks`||t===`pages`||t===`settings`||t===`tools`||t===`channels`?t:`chat`}async function Re(e,t,n,r,i,a){let o=a.detail;o&&await Ie(e,t,n,r,i,{page:Le(String(o.page||`chat`)),groupId:o.groupId,path:o.path,anchor:o.anchor})}async function ze(e,t,n,r){await _e(e,t,n,r)}async function Be(e,t,n,r){if(!n)return;let i=new URL(window.location?.href||`http://localhost/`),a=i.searchParams.get(`peer`);if(!a)return;let o=a.trim();if(o)try{let a=m(r),s=a.myPeerId;s||=_().toLowerCase();let c=new Set(a.trustedPeerIds);c.add(o),await x(r,n,s,Array.from(c),a.serverHost,a.serverPort,a.serverPath,a.serverSecure),a.enabled||await d(r,n,`peerjs`,!0);let l=await g.ensurePeerConversation(n,o);await g.switchConversation(n,l),H(e,t,n,g,`chat`),i.searchParams.delete(`peer`);let u=`${i.pathname}${i.search}${i.hash}`;window.history.replaceState({},``,u||`/`),v(`Connected to Peer: ${o.substring(0,8)}`)}catch(e){y(`Failed to process peer parameter: ${e instanceof Error?e.message:String(e)}`,6e3)}}const Ve=`pendingShares`;function He(e){return{id:typeof e?.id==`string`?e.id:``,createdAt:typeof e?.createdAt==`number`?e.createdAt:0,title:typeof e?.title==`string`?e.title:``,text:typeof e?.text==`string`?e.text:``,url:typeof e?.url==`string`?e.url:``,fileName:typeof e?.fileName==`string`?e.fileName:``,fileType:typeof e?.fileType==`string`?e.fileType:``,fileBytes:e?.fileBytes instanceof ArrayBuffer?e.fileBytes:null}}async function Ue(e){return!e||typeof e.transaction!=`function`?[]:new Promise((t,n)=>{let r;try{r=e.transaction(Ve,`readwrite`)}catch(e){if(e instanceof DOMException&&e.name===`NotFoundError`){t([]);return}n(e);return}let i=r.objectStore(Ve),a=i.getAll();a.onerror=()=>{n(a.error||Error(`Failed to read pending shares`))},a.onsuccess=()=>{let e=Array.isArray(a.result)?a.result.map(He).filter(e=>typeof e.id==`string`&&e.id.length>0).sort((e,t)=>e.createdAt-t.createdAt):[],r=i.clear();r.onerror=()=>{n(r.error||Error(`Failed to clear pending shares`))},r.onsuccess=()=>{t(e)}},r.onabort=()=>{n(r.error||Error(`Pending share transaction aborted`))}})}function We(e){let t=[`# Shared Content`,``];return e.title&&t.push(`Title: ${e.title}`),e.url&&t.push(`URL: ${e.url}`),e.text&&t.push(``,e.text),t.join(`
`).trim()+`
`}async function Ge(e,t){let n=new Date,r=`Shared Files ${`${String(n.getFullYear())}-${String(n.getMonth()+1).padStart(2,`0`)}-${String(n.getDate()).padStart(2,`0`)}`}`,i=t.groups.find(e=>e.name===r);return i?(await t.switchConversation(e,i.groupId),i.groupId):(await t.createConversation(e,r)).groupId}function Ke(e,t){return(e.replace(/\\/g,`/`).split(`/`).filter(Boolean).pop()||``).replace(/\s+/g,`-`).replace(/[^A-Za-z0-9._-]/g,`-`).replace(/-+/g,`-`).replace(/^-+|-+$/g,``)||`${t}.txt`}async function qe(e,t,n,r,i,a,o){if(!a)return;let s=await Ue(a);if(s.length!==0)try{let c=await Ge(a,r),u=[];for(let e=0;e<s.length;e++){let t=s[e],n=`shared-${Date.now()}-${e+1}`;if(t.fileBytes instanceof ArrayBuffer){let e=Ke(t.fileName||(t.fileType===`application/pdf`?`${n}.pdf`:`${n}.bin`),n);await l(a,c,e,new Uint8Array(t.fileBytes)),u.push(e);continue}let r=Ke(t.fileName||`${n}.md`,n);await ee(a,c,r,We(t)),u.push(r)}await r.loadFiles(a),H(t,n,a,r,`files`),u.length>0&&await i.openFile(a,u[0],c),v(`Imported ${u.length} shared item${u.length===1?``:`s`}.`);let d=o;if(d.searchParams.has(`share-target`)){d.searchParams.delete(`share-target`);let t=`${d.pathname}${d.search}${d.hash}`;e.history.replaceState({},``,t||`/`)}}catch(e){y(`Failed to import shared content: ${e instanceof Error?e.message:String(e)}`,6e3)}}async function Je(e,t,n,r,i,a){if(!r)return;let o=new URL(window.location?.href||`http://localhost/`),s=(o.searchParams.get(`room`)||``).trim(),c=(o.searchParams.get(`host`)||``).trim(),l=(o.searchParams.get(`name`)||``).trim()||`Room`;if(!(!s||!c))try{let f=m(i),p=f.myPeerId;p||=_().toLowerCase();let h=new Set(f.trustedPeerIds);h.add(c),await x(i,r,p,Array.from(h),f.serverHost,f.serverPort,f.serverPath,f.serverSecure),f.enabled||await d(i,r,`peerjs`,!0),u(i,s,c,l),await a.switchConversation(r,`room:${s}`),H(t,n,r,a,`chat`),o.searchParams.delete(`room`),o.searchParams.delete(`host`),o.searchParams.delete(`name`);let g=`${o.pathname}${o.search}${o.hash}`;e.history.replaceState({},``,g||`/`),v(`Joined room "${l}"`)}catch(e){y(`Failed to join room: ${e instanceof Error?e.message:String(e)}`,6e3)}}function Ye(e,t,n,r){e&&(b(()=>{let t=S.file;t&&(N(`file-viewer`).then(()=>{if(e&&!e.querySelector(`shadow-claw-file-viewer`)){let t=e.querySelector(`.main-content`);if(t){let e=document.createElement(`shadow-claw-file-viewer`);e.id=`file-viewer`,t.appendChild(e)}}}).catch(console.error),t.kind===`pdf`&&N(`pdf-viewer`).catch(console.error))}),b(()=>{let e=r.state;e===`idle`&&(t.previousOrchestratorState===`thinking`||t.previousOrchestratorState===`responding`)&&v(`Response complete`,2500),t.previousOrchestratorState=e}),b(()=>{let i=r.activePage;i!==t.currentPage&&H(e,t,n,r,i,!1)}),b(()=>{r.activityLog,I(e,t.currentPage,r.activityLog.length)}))}const Xe=new CSSStyleSheet;Xe.replaceSync(`*,
*::before,
*::after {
  box-sizing: border-box;
}

.hidden,
[hidden] {
  display: none !important;
}

a {
  color: var(--shadow-claw-link);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

a:hover {
  color: var(--shadow-claw-link-hover);
}

.header {
  align-items: center;
  background-color: var(--shadow-claw-bg-secondary);
  border-bottom: 0.0625rem solid var(--shadow-claw-border-color);
  display: flex;
  gap: 0.5rem;
  height: 4rem;
  justify-content: start;
  max-height: 4rem;
  padding: 0.5rem 1rem;
  width: 100%;
}

.header h1 {
  align-items: center;
  color: var(--shadow-claw-text-primary);
  display: flex;
  flex-direction: row;
  margin: 0;
  width: 100%;
}

#menu-button {
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}

#menu-button:hover,
.theme-toggle:hover {
  background-color: var(--shadow-claw-bg-tertiary);
  color: var(--shadow-claw-text-primary);
}

.header-actions {
  align-items: center;
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.theme-toggle {
  align-items: center;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  display: flex;
  justify-content: center;
  padding: 0.5rem;
}

.theme-mode-toggle .sun-icon {
  display: none;
}

.theme-mode-toggle .moon-icon {
  display: block;
}

.theme-toggle svg {
  transition: transform 0.2s ease;
}

.header-main-toggle[aria-pressed="true"],
.activity-log-toggle[aria-pressed="true"] {
  box-shadow: 0 0 0.5rem
    color-mix(
      in srgb,
      var(--shadow-claw-warning-color, #d97706) 50%,
      transparent
    );
  color: var(--shadow-claw-warning-color, #d97706);
}

.header-main-toggle[aria-pressed="true"] svg {
  transform: rotate(180deg);
}

.activity-log-toggle[aria-pressed="true"] svg {
  transform: rotate(180deg);
}

.webvm-toggle--booting,
.webvm-toggle--ready,
.webvm-toggle--visible {
  color: var(--shadow-claw-success-color);
}

.webvm-toggle--error {
  color: var(--shadow-claw-error-color);
}

.app {
  background-color: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
  display: flex;
  flex-direction: column;
  font-family: var(--shadow-claw-font-sans);
  /* Punch through the \`visibility: hidden\` set on the shadow-claw host
     by the sc-prerender-override global CSS rule. The existing boot-pending
     opacity rules still hide the real pre-rendered content; the skeleton
     overlays and header remain fully visible. */
  visibility: visible;
  width: 100%;
}

.app-body {
  --sidebar-width: 15.625rem;
  display: flex;
  flex: 1;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  background-color: var(--shadow-claw-bg-secondary);
  border-right: 0.0625rem solid var(--shadow-claw-bg-tertiary);
  display: flex;
  flex: none;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
  width: var(--sidebar-width);
}

.sidebar-resize-handle {
  background: transparent;
  cursor: col-resize;
  flex: none;
  outline: none;
  position: relative;
  touch-action: none;
  user-select: none;
  width: 0.75rem;
}

.sidebar-resize-handle::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-bg-secondary) 72%,
    var(--shadow-claw-border-color)
  );
  border: 0.0625rem solid
    color-mix(in srgb, var(--shadow-claw-border-color) 80%, transparent);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 4.25rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition:
    background-color 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
  width: 0.5625rem;
}

.sidebar-resize-handle::after {
  background: var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  content: "";
  height: 2.75rem;
  left: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  transition: background-color 0.15s;
  width: 0.1875rem;
}

.sidebar-resize-handle:hover::before,
.sidebar-resize-handle.active::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 20%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 45%,
    transparent
  );
  box-shadow: 0 0 0.5rem
    color-mix(in srgb, var(--shadow-claw-accent-primary) 18%, transparent);
}

.sidebar-resize-handle:hover::after,
.sidebar-resize-handle.active::after {
  background: var(--shadow-claw-accent-primary);
}

.sidebar-resize-handle:focus-visible::before {
  background: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 20%,
    var(--shadow-claw-bg-secondary)
  );
  border-color: color-mix(
    in srgb,
    var(--shadow-claw-accent-primary) 45%,
    transparent
  );
  box-shadow: 0 0 0.5rem
    color-mix(in srgb, var(--shadow-claw-accent-primary) 18%, transparent);
}

.sidebar-resize-handle:focus-visible::after {
  background: var(--shadow-claw-accent-primary);
}

.sidebar-resize-handle:focus-visible {
  outline: 0.125rem solid
    color-mix(in srgb, var(--shadow-claw-accent-primary) 60%, transparent);
  outline-offset: 0.0625rem;
}

@media (max-width: 55.9375rem) {
  .sidebar {
    display: none;
  }

  .sidebar.open {
    border-radius: 0 var(--shadow-claw-radius-m) var(--shadow-claw-radius-m) 0;
    box-shadow: var(--shadow-claw-shadow-lg);
    display: flex;
    height: calc(100vh - 4rem);
    height: calc(100dvh - 4rem);
    position: absolute;
    width: min(85vw, 20rem);
    z-index: 100;
  }

  .sidebar-resize-handle {
    display: none;
  }
}

@media (min-width: 56rem) {
  #menu-button {
    display: none;
  }
}

.nav-menu {
  flex: none;
  list-style: none;
  margin: 0;
  padding: 0.5rem;
}

.sidebar-spacer {
  flex: 1;
}

shadow-claw-conversations {
  display: flex;
  flex: none;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.nav-item {
  border-radius: var(--shadow-claw-radius-m);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 500;
  margin-bottom: 0.5rem;
  padding: 0.625rem 0.75rem;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.nav-item:hover {
  background-color: var(--shadow-claw-text-secondary);
  color: var(--shadow-claw-on-primary);
}

.nav-item.active {
  background-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.sidebar-footer {
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  flex: none;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
}

.settings-btn {
  background-color: transparent;
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-pill);
  color: var(--shadow-claw-text-secondary);
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 0.625rem 0.75rem;
  transition: all var(--shadow-claw-duration-min) var(--shadow-claw-ease-out);
  width: 100%;
}

.settings-btn:hover {
  border-color: var(--shadow-claw-text-primary);
  box-shadow: var(--shadow-claw-shadow-md);
  color: var(--shadow-claw-text-primary);
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: calc(100vh - 4rem);
  height: calc(100dvh - 4rem);
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.page {
  display: flex;
  display: none;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.page.active {
  display: flex;
}

.app-dialog {
  background: var(--shadow-claw-bg-secondary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-l);
  box-shadow: var(--shadow-claw-shadow-lg);
  color: var(--shadow-claw-text-primary);
  max-width: min(90vw, 28rem);
  padding: 0;
}

.app-dialog::backdrop {
  background: color-mix(in srgb, black 50%, transparent);
}

.app-confirm-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 1rem;
}

.app-dialog__title {
  font-size: 1rem;
  margin: 0;
}

.app-dialog__message {
  color: var(--shadow-claw-text-secondary);
  margin: 0;
}

.app-dialog__details {
  color: var(--shadow-claw-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
  padding-left: 1rem;
}

.app-dialog__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.app-dialog__link {
  color: var(--shadow-claw-accent-primary);
  font-size: 0.9375rem;
  text-decoration: none;
}

.app-dialog__link:hover,
.app-dialog__link:focus-visible {
  text-decoration: underline;
}

.app-confirm-dialog__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.app-dialog__btn {
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-m);
  cursor: pointer;
  font: inherit;
  padding: 0.5rem 0.75rem;
}

.app-dialog__btn--cancel {
  background: var(--shadow-claw-bg-primary);
  color: var(--shadow-claw-text-primary);
}

.app-dialog__btn--confirm {
  background: var(--shadow-claw-accent-primary);
  border-color: var(--shadow-claw-accent-primary);
  color: var(--shadow-claw-on-primary);
}

.app-prompt-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 1rem;
}

.app-prompt-dialog__title {
  font-size: 1rem;
  margin: 0;
}

.app-prompt-dialog__message {
  color: var(--shadow-claw-text-secondary);
  margin: 0;
}

.app-prompt-dialog__input-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.app-prompt-dialog__input {
  background: var(--shadow-claw-bg-primary);
  border: 0.0625rem solid var(--shadow-claw-border-color);
  border-radius: var(--shadow-claw-radius-s);
  color: var(--shadow-claw-text-primary);
  font: inherit;
  padding: 0.5rem;
  width: 100%;
}

.app-prompt-dialog__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.chat-page {
  flex-direction: column;
}

:host([data-prerender-no-seed="true"]) .nav-item,
:host([data-prerender-no-seed="true"]) shadow-claw-conversations,
:host([data-prerender-no-seed="true"]) .sidebar-footer,
:host([data-prerender-no-seed="true"]) .page.active,
:host([data-prerender-no-seed="true"]) shadow-claw-file-viewer,
:host([data-prerender-no-seed="true"]) shadow-claw-toast {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity var(--shadow-claw-duration-min) var(--shadow-claw-ease-out),
    transform var(--shadow-claw-duration-min) var(--shadow-claw-ease-out);
}

:host([data-prerender-no-seed="true"][data-hydration-pending="true"]) .nav-item,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  shadow-claw-conversations,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  .sidebar-footer,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  .page.active,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  shadow-claw-file-viewer,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  shadow-claw-toast,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"]) .nav-item,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  shadow-claw-conversations,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  .sidebar-footer,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  .page.active,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  shadow-claw-file-viewer,
:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  shadow-claw-toast {
  opacity: 0;
  pointer-events: none;
  transform: translateY(0.25rem);
}

@media (prefers-reduced-motion: reduce) {
  :host([data-prerender-no-seed="true"]) .nav-item,
  :host([data-prerender-no-seed="true"]) shadow-claw-conversations,
  :host([data-prerender-no-seed="true"]) .sidebar-footer,
  :host([data-prerender-no-seed="true"]) .page.active,
  :host([data-prerender-no-seed="true"]) shadow-claw-file-viewer,
  :host([data-prerender-no-seed="true"]) shadow-claw-toast {
    transform: none;
    transition: none;
  }
}

/* Premium Loading & Hydration Skeletons */
.sidebar-boot-skeleton {
  background-color: var(--shadow-claw-bg-secondary);
  bottom: 0;
  display: flex;
  flex-direction: column;
  left: 0;
  opacity: 0;
  padding: 1rem 0.75rem;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  transition:
    opacity var(--shadow-claw-duration-regular) var(--shadow-claw-ease-out),
    visibility var(--shadow-claw-duration-regular) var(--shadow-claw-ease-out);
  visibility: hidden;
  z-index: 10;
}

:host([data-js-boot-pending="true"]) .sidebar-boot-skeleton,
:host([data-hydration-pending="true"]) .sidebar-boot-skeleton {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.skeleton-nav-wrapper {
  display: none;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

:host([data-prerender-no-seed="true"]) .skeleton-nav-wrapper {
  display: flex;
}

.skeleton-divider {
  border-top: 0.0625rem solid var(--shadow-claw-border-color);
  display: none;
  margin: 0.75rem 0;
}

:host([data-prerender-no-seed="true"]) .skeleton-divider {
  display: block;
}

.skeleton-convo-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.skeleton-item {
  animation: skeleton-pulse 1.8s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    var(--shadow-claw-bg-secondary) 25%,
    var(--shadow-claw-bg-tertiary) 50%,
    var(--shadow-claw-bg-secondary) 75%
  );
  background-size: 200% 100%;
}

.skeleton-nav {
  border-radius: var(--shadow-claw-radius-m);
  height: 2.25rem;
  width: 100%;
}

/* Give items dynamic-looking varied widths for extra premium feel */
.skeleton-nav:nth-child(1) {
  width: 85%;
}

.skeleton-nav:nth-child(2) {
  width: 90%;
}

.skeleton-nav:nth-child(3) {
  width: 75%;
}

.skeleton-nav:nth-child(4) {
  width: 80%;
}

.skeleton-convo {
  border-radius: var(--shadow-claw-radius-m);
  height: 3.5rem;
  width: 100%;
}

.main-content-boot-skeleton {
  align-items: center;
  background-color: var(--shadow-claw-bg-primary);
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  left: 0;
  opacity: 0;
  padding: 2rem;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  transition:
    opacity var(--shadow-claw-duration-regular) var(--shadow-claw-ease-out),
    visibility var(--shadow-claw-duration-regular) var(--shadow-claw-ease-out);
  visibility: hidden;
  z-index: 10;
}

:host([data-prerender-no-seed="true"][data-js-boot-pending="true"])
  .main-content-boot-skeleton,
:host([data-prerender-no-seed="true"][data-hydration-pending="true"])
  .main-content-boot-skeleton {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}

.boot-loading-svg {
  color: var(--shadow-claw-text-secondary);
  height: 4.5rem;
  opacity: 0.85;
  transition: color var(--shadow-claw-duration-min) var(--shadow-claw-ease-out);
  width: 4.5rem;
}

.boot-loading-text {
  color: var(--shadow-claw-text-secondary);
  font-size: var(--shadow-claw-font-size-sm);
  font-weight: 600;
  letter-spacing: 0.075em;
  margin-top: 1.25rem;
  text-transform: uppercase;
}

@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
`);const Q=new DOMParser().parseFromString(`<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <button aria-label="Open menu" title="Open menu" id="menu-button">
        <svg
          height="1.5rem"
          fill="currentColor"
          viewBox="0 -960 960 960"
          width="1.5rem"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M120-680v-80h720v80zm0 480v-80h720v80zm0-240v-80h720v80z" />
        </svg>
      </button>
      <h1>
        <slot name="header-title-link"></slot>
        <div class="header-actions">
          <button
            aria-label="Toggle theme"
            title="Toggle theme"
            class="theme-toggle theme-mode-toggle"
          >
            <svg
              class="sun-icon"
              height="1.5rem"
              fill="currentColor"
              hidden
              viewBox="0 -960 960 960"
              width="1.5rem"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M480-360q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35zm0 80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280zM200-440H40v-80h160v80zm720 0H760v-80h160v80zM440-760v-160h80v160h-80zm0 720v-160h80v160h-80zM256-650l-101-97 57-59 96 100-52 56zm492 496-97-101 53-55 101 97-57 59zm-98-550 97-101 59 57-101 97-55-53zM158-190l97-101 55 53-101 97-51-49z"
              />
            </svg>
            <svg
              class="moon-icon"
              height="1.5rem"
              fill="currentColor"
              viewBox="0 -960 960 960"
              width="1.5rem"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q14 0 27.5 1t26.5 3q-41 29-65.5 75.5T444-660q0 90 63 153t153 63q52 0 99-24.5t75-65.5q2 13 3 26.5t1 27.5q0 150-105 255T480-120zm0-80q88 0 158-48.5T740-375q-20 5-40 8t-40 3q-123 0-209.5-86.5T364-660q0-20 3-40t8-40q-74 30-122.5 100T204-480q0 116 82 198t194 82zm-12-274z"
              />
            </svg>
          </button>
          <button
            aria-label="Hide action header"
            title="Hide action header"
            aria-pressed="false"
            class="theme-toggle header-main-toggle"
            type="button"
          >
            <svg
              height="1.5rem"
              fill="currentColor"
              viewBox="0 -960 960 960"
              width="1.5rem"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M280-200h400v-80H280v80Zm200-200L280-600l56-56 104 104v-328h80v328l104-104 56 56-200 200Z"
              />
            </svg>
          </button>
          <button
            aria-label="Hide activity log"
            title="Hide activity log"
            aria-pressed="false"
            class="theme-toggle activity-log-toggle"
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="currentColor"
            >
              <path
                d="M80-600v-160q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v160h-80v-160H160v160H80Zm80 360q-33 0-56.5-23.5T80-320v-200h80v200h640v-200h80v200q0 33-23.5 56.5T800-240H160ZM40-120v-80h880v80H40Zm440-420ZM80-520v-80h240q11 0 21 6t15 16l47 93 123-215q5-9 14-14.5t20-5.5q11 0 21 5.5t15 16.5l49 98h235v80H620q-11 0-21-5.5T584-542l-26-53-123 215q-5 10-15 15t-21 5q-11 0-20.5-6T364-382l-69-138H80Z"
              />
            </svg>
          </button>
          <button
            aria-label="Hide WebVM terminal"
            title="Hide WebVM terminal"
            aria-pressed="true"
            class="theme-toggle webvm-toggle"
            type="button"
          >
            <svg
              height="1.5rem"
              fill="currentColor"
              viewBox="0 -960 960 960"
              width="1.5rem"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M320-280 120-480l200-200 56 56-104 104h568v80H272l104 104-56 56Zm320 0-56-56 104-104H120v-80h568L584-624l56-56 200 200-200 200Z"
              />
            </svg>
          </button>
          <slot name="header-actions-logo"></slot>
        </div>
      </h1>
    </header>

    <!-- Main Body -->
    <div class="app-body">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-boot-skeleton" aria-hidden="true">
          <div class="skeleton-nav-wrapper">
            <div class="skeleton-item skeleton-nav"></div>
            <div class="skeleton-item skeleton-nav"></div>
            <div class="skeleton-item skeleton-nav"></div>
            <div class="skeleton-item skeleton-nav"></div>
          </div>
          <div class="skeleton-divider"></div>
          <div class="skeleton-convo-wrapper">
            <div class="skeleton-item skeleton-convo"></div>
            <div class="skeleton-item skeleton-convo"></div>
            <div class="skeleton-item skeleton-convo"></div>
          </div>
        </div>

        <nav>
          <ul class="nav-menu">
            <li class="nav-item active" data-page="pages">📚 Pages</li>
            <li class="nav-item" data-page="chat">💬 Chat</li>
            <li class="nav-item" data-page="tasks">&nbsp;✓&nbsp;Tasks</li>
            <li class="nav-item" data-page="files">📁 Files</li>
          </ul>
        </nav>
        <div class="sidebar-spacer"></div>
        <shadow-claw-conversations></shadow-claw-conversations>
        <div class="sidebar-footer">
          <button class="settings-btn" data-action="show-settings">
            ⚙️ Settings
          </button>
        </div>
      </aside>
      <div class="sidebar-resize-handle" title="Drag to resize sidebar"></div>

      <!-- Main Content -->
      <main class="main-content">
        <div class="main-content-boot-skeleton" aria-hidden="true">
          <svg
            class="boot-loading-svg"
            viewBox="0 0 44 44"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g
              fill="none"
              fill-rule="evenodd"
              stroke-width="2"
              stroke="currentColor"
            >
              <circle cx="22" cy="22" r="1">
                <animate
                  attributeName="r"
                  begin="0s"
                  dur="1.8s"
                  values="1; 20"
                  calcMode="spline"
                  keyTimes="0; 1"
                  keySplines="0.165, 0.84, 0.44, 1"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  begin="0s"
                  dur="1.8s"
                  values="1; 0"
                  calcMode="spline"
                  keyTimes="0; 1"
                  keySplines="0.3, 0.61, 0.355, 1"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="22" cy="22" r="1">
                <animate
                  attributeName="r"
                  begin="-0.9s"
                  dur="1.8s"
                  values="1; 20"
                  calcMode="spline"
                  keyTimes="0; 1"
                  keySplines="0.165, 0.84, 0.44, 1"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  begin="-0.9s"
                  dur="1.8s"
                  values="1; 0"
                  calcMode="spline"
                  keyTimes="0; 1"
                  keySplines="0.3, 0.61, 0.355, 1"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </svg>
          <div class="boot-loading-text">Preparing workspace...</div>
        </div>

        <!-- Chat Page — element stamped on first navigation via showPage() -->
        <div class="page chat-page" data-page-id="chat"></div>

        <!-- Tasks Page — element stamped on first navigation via showPage() -->
        <div class="page" data-page-id="tasks"></div>

        <!-- Files Page — element stamped on first navigation via showPage() -->
        <div class="page" data-page-id="files"></div>

        <!-- Pages Page — pre-stamped: this is the default landing route -->
        <div class="page active" data-page-id="pages">
          <shadow-claw-pages></shadow-claw-pages>
        </div>

        <!-- Settings Page — element stamped on first navigation via showPage() -->
        <div class="page" data-page-id="settings"></div>

        <!-- Tools Config Page — element stamped on first navigation via showPage() -->
        <div class="page" data-page-id="tools"></div>

        <!-- Channels Config Page — element stamped on first navigation via showPage() -->
        <div class="page" data-page-id="channels"></div>

        <!-- file-viewer is stamped lazily by setupEffects when a file is opened -->
        <shadow-claw-toast></shadow-claw-toast>
      </main>
    </div>

    <shadow-claw-dialog
      dialog-class="app-dialog"
      dialog-aria-labelledby="appDialogTitle"
    >
      <form
        method="dialog"
        class="app-confirm-dialog__form"
        toolname="confirmAction"
        tooldescription="Confirms a pending action or dialogue."
      >
        <h2 id="appDialogTitle" class="app-dialog__title">Confirm</h2>
        <p class="app-dialog__message"></p>
        <ul class="app-dialog__details" hidden></ul>
        <div class="app-dialog__links" hidden></div>
        <div class="app-confirm-dialog__actions">
          <button
            type="submit"
            value="cancel"
            class="app-dialog__btn app-dialog__btn--cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            value="confirm"
            class="app-dialog__btn app-dialog__btn--confirm"
          >
            Confirm
          </button>
        </div>
      </form>
    </shadow-claw-dialog>

    <shadow-claw-dialog
      dialog-class="app-dialog app-prompt-dialog"
      dialog-aria-labelledby="appPromptTitle"
    >
      <form
        method="dialog"
        class="app-prompt-dialog__form"
        toolname="answerAgentQuestion"
        tooldescription="Answers a question or prompt presented by the agent."
      >
        <h2 id="appPromptTitle" class="app-prompt-dialog__title">
          Agent Question
        </h2>
        <p class="app-prompt-dialog__message"></p>

        <div class="app-prompt-dialog__input-area">
          <!-- Will be populated dynamically with either a select or text input -->
        </div>

        <div class="app-prompt-dialog__actions">
          <button
            type="submit"
            value="submit"
            class="app-dialog__btn app-dialog__btn--confirm app-prompt-dialog__submit"
          >
            Submit
          </button>
        </div>
      </form>
    </shadow-claw-dialog>
  </div>
</template>
`,`text/html`),Ze=Q.querySelector(`template`);let Qe=[];Qe=Ze?Array.from(Ze.content.children):Array.from(Q.head.children).concat(Array.from(Q.body.children));var $e=Qe;const $=`shadow-claw`;var et=class extends ae{static styles=Xe;static template=$e;activityLogCollapsedOverride=null;currentPage=g.sidebarDefaultPage;db=null;fallbackClickListenerAttached=!1;headerMainCollapsedOverride=null;navigationListenerAttached=!1;orchestrator;pagesSidebarHidden=!1;chatSidebarHidden=!1;tasksSidebarHidden=!1;filesSidebarHidden=!1;popstateListener=null;previousOrchestratorState=`idle`;terminalElement=null;terminalPlacementFrame=null;terminalVisible=!1;vmStatus={ready:!1,booting:!1,bootAttempted:!1,error:null};vmStatusCleanup=null;constructor(){super()}async connectedCallback(){if(!this.shadowRoot)throw Error(`shadowRoot not found`);try{let{Orchestrator:e}=await import(`./orchestrator-CqsvTS_B.js`);Promise.all([import(`./shadow-claw-conversations-KlRAcoc4.js`),import(`./shadow-claw-dialog-n4xdcUp-.js`),import(`./shadow-claw-toast-CoPwgODb.js`)]).catch(console.error),await new Promise(e=>{`requestIdleCallback`in window?window.requestIdleCallback(()=>e(null)):setTimeout(e,0)}),this.orchestrator||=new e,this.db=await this.orchestrator.init(),await g.init(this.db,this.orchestrator),t(this.db),await this.render();let n=g.activePage===`pages`&&this.pagesSidebarHidden||g.activePage===`chat`&&this.chatSidebarHidden||g.activePage===`tasks`&&this.tasksSidebarHidden||g.activePage===`files`&&this.filesSidebarHidden;g.hadPersistedActivePage&&!n?H(this.shadowRoot,this,this.db,g,g.activePage,!1):n?H(this.shadowRoot,this,this.db,g,j(g,this),!1):H(this.shadowRoot,this,this.db,g,g.activePage,!1),await W(this.shadowRoot,this,this.db,S,g,new URL(window.location.href)),await Be(this.shadowRoot,this,this.db,this.orchestrator),await Je(window,this.shadowRoot,this,this.db,this.orchestrator,g),await qe(window,this.shadowRoot,this,g,S,this.db,new URL(window.location.href)),console.log(`ShadowClaw UI initialized`),typeof customElements<`u`&&await customElements.whenDefined(`shadow-claw-${this.currentPage}`);let{isMemoryStorageFallbackActive:r}=await import(`./memoryStorage-YtHGql0q.js`).then(e=>e.n);if(r()){let{showWarning:e}=await import(`./toast-D3gxhZpN.js`).then(e=>e.o);e(`Private Browsing / Limited Storage: Operating in temporary in-memory mode. Files and changes will not persist across page reloads.`,7e3)}g.setReady()}finally{De(document)}}disconnectedCallback(){if(super.disconnectedCallback(),this.vmStatusCleanup&&=(this.vmStatusCleanup(),null),this.terminalPlacementFrame!==null&&(cancelAnimationFrame(this.terminalPlacementFrame),this.terminalPlacementFrame=null),document.removeEventListener(`shadow-claw-navigate`,this.shadowClawNav),this.popstateListener&&=(window.removeEventListener(`popstate`,this.popstateListener),null),this.fallbackClickListenerAttached&&=(document.removeEventListener(`click`,this.fallbackClickListener),!1),this.navigationListenerAttached){let e=window.navigation;e&&typeof e.removeEventListener==`function`&&e.removeEventListener(`navigate`,this.handleNavigationApiNavigate),this.navigationListenerAttached=!1}}addCleanup(e){super.addCleanup(e)}fallbackClickListener=e=>{if(typeof window>`u`||!window.location)return;let t=ke(window.location,e);t&&(Fe(globalThis.history,t,{replace:!1,useTrailingSlash:!1}),W(this.shadowRoot,this,this.db,S,g,new URL(window.location.href)))};handleNavigationApiNavigate=e=>{let{parsedUrl:t,navigateEvent:n}=Oe(this.db,e)??{};!t||!n||typeof n.intercept==`function`&&n.intercept({handler:async()=>{let{parseRouteFromUrlAsync:e}=await import(`./app-routes-CA-uT3Nk.js`).then(e=>e.t),n=await e(t,g.activeGroupId);n&&await U(this.shadowRoot,this,this.db,S,g,n)}})};shadowClawNav=e=>{!this.shadowRoot||!this.db||Re(this.shadowRoot,this,this.db,S,g,e)};async render(){Ee(window,document,this.shadowRoot,this,this.db,g,S,k,new URL(window.location.href)),await ze(this.shadowRoot,this,g,this.db),this.terminalElement=document.createElement(`shadow-claw-terminal`),this.terminalElement&&(this.terminalElement.orchestrator=this.orchestrator),z(this.shadowRoot,this.currentPage,this.terminalVisible,this.vmStatus),P(this.shadowRoot,this.currentPage,this.terminalElement,this.terminalVisible,this.terminalPlacementFrame),F(this.shadowRoot,this.headerMainCollapsedOverride),R(this.shadowRoot,this.headerMainCollapsedOverride),I(this.shadowRoot,this.currentPage,g.activityLog.length);let e=e=>{this.vmStatus=e,e.error&&this.terminalVisible&&(this.terminalVisible=!1,this.terminalElement&&(this.terminalElement.hidden=!0),P(this.shadowRoot,this.currentPage,this.terminalElement,this.terminalVisible,this.terminalPlacementFrame)),z(this.shadowRoot,this.currentPage,this.terminalVisible,this.vmStatus)};this.vmStatus=this.orchestrator.vmStatus||this.vmStatus,z(this.shadowRoot,this.currentPage,this.terminalVisible,this.vmStatus),this.orchestrator.events.on?.(`vm-status`,e),this.vmStatusCleanup=()=>{this.orchestrator.events.off?.(`vm-status`,e)},this.orchestrator.events.on(`open-file`,e=>Me(this.db,g,S,e)),this.orchestrator.events.on(`provider-help`,e=>Ne(document,this.shadowRoot,e)),this.orchestrator.events.on(`room-invite`,e=>Pe(document,this.shadowRoot,this,this.db,g,e)),this.orchestrator.events.on(`ask-user`,e=>je(document,this.shadowRoot,this,e)),Ye(this.shadowRoot,this,this.db,g)}async requestDialog(e){return J(document,this.shadowRoot,e)}};customElements.get($)||customElements.define($,et);