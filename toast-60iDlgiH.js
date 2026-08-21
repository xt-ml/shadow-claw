var e=Object.defineProperty,t=(t,n,r)=>n in t?e(t,n,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[n]=r,n=(e,n,r)=>(t(e,typeof n==`symbol`?n:n+``,r),r),r=(e,t,n)=>{if(!t.has(e))throw TypeError(`Cannot `+n)},i=(e,t)=>{if(Object(t)!==t)throw TypeError(`Cannot use the "in" operator on this value`);return e.has(t)},a=(e,t,n)=>{if(t.has(e))throw TypeError(`Cannot add the same private member more than once`);t instanceof WeakSet?t.add(e):t.set(e,n)},o=(e,t,n)=>(r(e,t,`access private method`),n);
/**
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
function s(e,t){return Object.is(e,t)}
/**
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
let c=null,l=!1,u=1;const d=Symbol(`SIGNAL`);function f(e){let t=c;return c=e,t}function p(){return c}function m(){return l}const h={version:0,lastCleanEpoch:0,dirty:!1,producerNode:void 0,producerLastReadVersion:void 0,producerIndexOfThis:void 0,nextProducerIndex:0,liveConsumerNode:void 0,liveConsumerIndexOfThis:void 0,consumerAllowSignalWrites:!1,consumerIsAlwaysLive:!1,producerMustRecompute:()=>!1,producerRecomputeValue:()=>{},consumerMarkedDirty:()=>{},consumerOnSignalRead:()=>{}};function g(e){if(l)throw Error(typeof ngDevMode<`u`&&ngDevMode?`Assertion error: signal read during notification phase`:``);if(c===null)return;c.consumerOnSignalRead(e);let t=c.nextProducerIndex++;if(O(c),t<c.producerNode.length&&c.producerNode[t]!==e&&D(c)){let e=c.producerNode[t];E(e,c.producerIndexOfThis[t])}c.producerNode[t]!==e&&(c.producerNode[t]=e,c.producerIndexOfThis[t]=D(c)?T(e,c,t):0),c.producerLastReadVersion[t]=e.version}function _(){u++}function v(e){if(!(!e.dirty&&e.lastCleanEpoch===u)){if(!e.producerMustRecompute(e)&&!w(e)){e.dirty=!1,e.lastCleanEpoch=u;return}e.producerRecomputeValue(e),e.dirty=!1,e.lastCleanEpoch=u}}function y(e){if(e.liveConsumerNode===void 0)return;let t=l;l=!0;try{for(let t of e.liveConsumerNode)t.dirty||x(t)}finally{l=t}}function b(){return c?.consumerAllowSignalWrites!==!1}function x(e){var t;e.dirty=!0,y(e),(t=e.consumerMarkedDirty)==null||t.call(e.wrapper??e)}function S(e){return e&&(e.nextProducerIndex=0),f(e)}function C(e,t){if(f(t),!(!e||e.producerNode===void 0||e.producerIndexOfThis===void 0||e.producerLastReadVersion===void 0)){if(D(e))for(let t=e.nextProducerIndex;t<e.producerNode.length;t++)E(e.producerNode[t],e.producerIndexOfThis[t]);for(;e.producerNode.length>e.nextProducerIndex;)e.producerNode.pop(),e.producerLastReadVersion.pop(),e.producerIndexOfThis.pop()}}function w(e){O(e);for(let t=0;t<e.producerNode.length;t++){let n=e.producerNode[t],r=e.producerLastReadVersion[t];if(r!==n.version||(v(n),r!==n.version))return!0}return!1}function T(e,t,n){var r;if(k(e),O(e),e.liveConsumerNode.length===0){(r=e.watched)==null||r.call(e.wrapper);for(let t=0;t<e.producerNode.length;t++)e.producerIndexOfThis[t]=T(e.producerNode[t],e,t)}return e.liveConsumerIndexOfThis.push(n),e.liveConsumerNode.push(t)-1}function E(e,t){var n;if(k(e),O(e),typeof ngDevMode<`u`&&ngDevMode&&t>=e.liveConsumerNode.length)throw Error(`Assertion error: active consumer index ${t} is out of bounds of ${e.liveConsumerNode.length} consumers)`);if(e.liveConsumerNode.length===1){(n=e.unwatched)==null||n.call(e.wrapper);for(let t=0;t<e.producerNode.length;t++)E(e.producerNode[t],e.producerIndexOfThis[t])}let r=e.liveConsumerNode.length-1;if(e.liveConsumerNode[t]=e.liveConsumerNode[r],e.liveConsumerIndexOfThis[t]=e.liveConsumerIndexOfThis[r],e.liveConsumerNode.length--,e.liveConsumerIndexOfThis.length--,t<e.liveConsumerNode.length){let n=e.liveConsumerIndexOfThis[t],r=e.liveConsumerNode[t];O(r),r.producerIndexOfThis[n]=t}}function D(e){return e.consumerIsAlwaysLive||(e?.liveConsumerNode?.length??0)>0}function O(e){e.producerNode??=[],e.producerIndexOfThis??=[],e.producerLastReadVersion??=[]}function k(e){e.liveConsumerNode??=[],e.liveConsumerIndexOfThis??=[]}
/**
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
function A(e){if(v(e),g(e),e.value===P)throw e.error;return e.value}function j(e){let t=Object.create(F);t.computation=e;let n=()=>A(t);return n[d]=t,n}const M=Symbol(`UNSET`),N=Symbol(`COMPUTING`),P=Symbol(`ERRORED`),F={...h,value:M,dirty:!0,error:null,equal:s,producerMustRecompute(e){return e.value===M||e.value===N},producerRecomputeValue(e){if(e.value===N)throw Error(`Detected cycle in computations.`);let t=e.value;e.value=N;let n=S(e),r,i=!1;try{r=e.computation.call(e.wrapper),i=t!==M&&t!==P&&e.equal.call(e.wrapper,t,r)}catch(t){r=P,e.error=t}finally{C(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};
/**
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
function I(){throw Error()}let L=I;function R(){L()}
/**
* @license
* Copyright Google LLC All Rights Reserved.
*
* Use of this source code is governed by an MIT-style license that can be
* found in the LICENSE file at https://angular.io/license
*/
function z(e){let t=Object.create(H);t.value=e;let n=()=>(g(t),t.value);return n[d]=t,n}function B(){return g(this),this.value}function V(e,t){b()||R(),e.equal.call(e.wrapper,e.value,t)||(e.value=t,U(e))}const H={...h,equal:s,value:void 0};function U(e){e.version++,_(),y(e)}
/**
* @license
* Copyright 2024 Bloomberg Finance L.P.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const W=Symbol(`node`);var G;(e=>{var t,r,s,c;class l{constructor(i,o={}){a(this,r),n(this,t);let s=z(i)[d];if(this[W]=s,s.wrapper=this,o){let t=o.equals;t&&(s.equal=t),s.watched=o[e.subtle.watched],s.unwatched=o[e.subtle.unwatched]}}get(){if(!(0,e.isState)(this))throw TypeError(`Wrong receiver type for Signal.State.prototype.get`);return B.call(this[W])}set(t){if(!(0,e.isState)(this))throw TypeError(`Wrong receiver type for Signal.State.prototype.set`);if(m())throw Error(`Writes to signals not permitted during Watcher callback`);let n=this[W];V(n,t)}}t=W,r=new WeakSet,e.isState=e=>typeof e==`object`&&i(r,e),e.State=l;class u{constructor(t,r){a(this,c),n(this,s);let i=j(t)[d];if(i.consumerAllowSignalWrites=!0,this[W]=i,i.wrapper=this,r){let t=r.equals;t&&(i.equal=t),i.watched=r[e.subtle.watched],i.unwatched=r[e.subtle.unwatched]}}get(){if(!(0,e.isComputed)(this))throw TypeError(`Wrong receiver type for Signal.Computed.prototype.get`);return A(this[W])}}s=W,c=new WeakSet,e.isComputed=e=>typeof e==`object`&&i(c,e),e.Computed=u,(t=>{var r,s,c,l;function u(e){let t,n=null;try{n=f(null),t=e()}finally{f(n)}return t}t.untrack=u;function d(t){if(!(0,e.isComputed)(t)&&!(0,e.isWatcher)(t))throw TypeError(`Called introspectSources without a Computed or Watcher argument`);return t[W].producerNode?.map(e=>e.wrapper)??[]}t.introspectSources=d;function m(t){if(!(0,e.isComputed)(t)&&!(0,e.isState)(t))throw TypeError(`Called introspectSinks without a Signal argument`);return t[W].liveConsumerNode?.map(e=>e.wrapper)??[]}t.introspectSinks=m;function _(t){if(!(0,e.isComputed)(t)&&!(0,e.isState)(t))throw TypeError(`Called hasSinks without a Signal argument`);let n=t[W].liveConsumerNode;return n?n.length>0:!1}t.hasSinks=_;function v(t){if(!(0,e.isComputed)(t)&&!(0,e.isWatcher)(t))throw TypeError(`Called hasSources without a Computed or Watcher argument`);let n=t[W].producerNode;return n?n.length>0:!1}t.hasSources=v;class y{constructor(e){a(this,s),a(this,c),n(this,r);let t=Object.create(h);t.wrapper=this,t.consumerMarkedDirty=e,t.consumerIsAlwaysLive=!0,t.consumerAllowSignalWrites=!1,t.producerNode=[],this[W]=t}watch(...t){if(!(0,e.isWatcher)(this))throw TypeError(`Called unwatch without Watcher receiver`);o(this,c,l).call(this,t);let n=this[W];n.dirty=!1;let r=f(n);for(let e of t)g(e[W]);f(r)}unwatch(...t){if(!(0,e.isWatcher)(this))throw TypeError(`Called unwatch without Watcher receiver`);o(this,c,l).call(this,t);let n=this[W];O(n);for(let e=n.producerNode.length-1;e>=0;e--)if(t.includes(n.producerNode[e].wrapper)){E(n.producerNode[e],n.producerIndexOfThis[e]);let t=n.producerNode.length-1;if(n.producerNode[e]=n.producerNode[t],n.producerIndexOfThis[e]=n.producerIndexOfThis[t],n.producerNode.length--,n.producerIndexOfThis.length--,n.nextProducerIndex--,e<n.producerNode.length){let t=n.producerIndexOfThis[e],r=n.producerNode[e];k(r),r.liveConsumerIndexOfThis[t]=e}}}getPending(){if(!(0,e.isWatcher)(this))throw TypeError(`Called getPending without Watcher receiver`);return this[W].producerNode.filter(e=>e.dirty).map(e=>e.wrapper)}}r=W,s=new WeakSet,c=new WeakSet,l=function(t){for(let n of t)if(!(0,e.isComputed)(n)&&!(0,e.isState)(n))throw TypeError(`Called watch/unwatch without a Computed or State argument`)},e.isWatcher=e=>i(s,e),t.Watcher=y;function b(){return p()?.wrapper}t.currentComputed=b,t.watched=Symbol(`watched`),t.unwatched=Symbol(`unwatched`)})(e.subtle||={})})(G||={});const K=new class{#e=new G.State(0);#t=new Map;#n=new G.State([]);clear(){this.#t.forEach((e,t)=>this.clearTimer(t)),this.#t.clear(),this.#n.set([])}clearTimer(e){let t=this.#t.get(e);t?.timeoutId&&clearTimeout(t.timeoutId),this.#t.delete(e)}dismiss(e){this.clearTimer(e),this.#n.set(this.#n.get().filter(t=>t.id!==e))}pause(e){let t=this.#t.get(e);!t||!t.timeoutId||(clearTimeout(t.timeoutId),t.timeoutId=void 0,t.remaining=Math.max(0,t.remaining-(Date.now()-t.startedAt)),this.#t.set(e,t))}resolveAction(e){if(!(!e||typeof e.label!=`string`||typeof e.onClick!=`function`))return e}resolveDuration(e){return typeof e!=`number`||Number.isNaN(e)||e<0?4e3:e}resolveType(e){return e&&[`success`,`warning`,`error`,`info`].includes(e)?e:`info`}resume(e){let t=this.#t.get(e);!t||t.timeoutId||t.remaining<=0||this.scheduleDismiss(e,t.remaining)}scheduleDismiss(e,t){this.clearTimer(e);let n=globalThis.setTimeout(()=>{this.dismiss(e)},t);this.#t.set(e,{timeoutId:n,remaining:t,startedAt:Date.now()})}show(e,t={}){let n=this.#e.get()+1;this.#e.set(n);let r={id:n,message:e,type:this.resolveType(t.type),duration:this.resolveDuration(t.duration),action:this.resolveAction(t.action),createdAt:Date.now()},i=[...this.#n.get(),r];if(i.length>5){let e=i[0];this.clearTimer(e.id),this.#n.set(i.slice(1))}else this.#n.set(i);return r.duration>0&&this.scheduleDismiss(r.id,r.duration),r.id}get toasts(){return this.#n.get()}async runAction(e){let t=this.#n.get().find(t=>t.id===e);t?.action&&await t.action.onClick()}};export{G as n,K as t};