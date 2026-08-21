import{i as e}from"./rolldown-runtime-aKtaBQYM.js";import{t}from"./browser-nBz_r6l4.js";import{n,t as r}from"./defaults-DwNb0lWM-Drx4e34U.js";var i=e(t());const a=()=>void 0,o=function(e){
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
let t=[],n=0;for(let r=0;r<e.length;r++){let i=e.charCodeAt(r);i<128?t[n++]=i:i<2048?(t[n++]=i>>6|192,t[n++]=i&63|128):(i&64512)==55296&&r+1<e.length&&(e.charCodeAt(r+1)&64512)==56320?(i=65536+((i&1023)<<10)+(e.charCodeAt(++r)&1023),t[n++]=i>>18|240,t[n++]=i>>12&63|128,t[n++]=i>>6&63|128,t[n++]=i&63|128):(t[n++]=i>>12|224,t[n++]=i>>6&63|128,t[n++]=i&63|128)}return t},s=function(e){let t=[],n=0,r=0;for(;n<e.length;){let i=e[n++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){let a=e[n++];t[r++]=String.fromCharCode((i&31)<<6|a&63)}else if(i>239&&i<365){let a=e[n++],o=e[n++],s=e[n++],c=((i&7)<<18|(a&63)<<12|(o&63)<<6|s&63)-65536;t[r++]=String.fromCharCode(55296+(c>>10)),t[r++]=String.fromCharCode(56320+(c&1023))}else{let a=e[n++],o=e[n++];t[r++]=String.fromCharCode((i&15)<<12|(a&63)<<6|o&63)}}return t.join(``)},c={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`,get ENCODED_VALS(){return this.ENCODED_VALS_BASE+`+/=`},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+`-_.`},HAS_NATIVE_SUPPORT:typeof atob==`function`,encodeByteArray(e,t){if(!Array.isArray(e))throw Error(`encodeByteArray takes an array as a parameter`);this.init_();let n=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let t=0;t<e.length;t+=3){let i=e[t],a=t+1<e.length,o=a?e[t+1]:0,s=t+2<e.length,c=s?e[t+2]:0,l=i>>2,u=(i&3)<<4|o>>4,d=(o&15)<<2|c>>6,f=c&63;s||(f=64,a||(d=64)),r.push(n[l],n[u],n[d],n[f])}return r.join(``)},encodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(e):this.encodeByteArray(o(e),t)},decodeString(e,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(e):s(this.decodeStringToByteArray(e,t))},decodeStringToByteArray(e,t){this.init_();let n=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let t=0;t<e.length;){let i=n[e.charAt(t++)],a=t<e.length?n[e.charAt(t)]:0;++t;let o=t<e.length?n[e.charAt(t)]:64;++t;let s=t<e.length?n[e.charAt(t)]:64;if(++t,i==null||a==null||o==null||s==null)throw new l;let c=i<<2|a>>4;if(r.push(c),o!==64){let e=a<<4&240|o>>2;if(r.push(e),s!==64){let e=o<<6&192|s;r.push(e)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let e=0;e<this.ENCODED_VALS.length;e++)this.byteToCharMap_[e]=this.ENCODED_VALS.charAt(e),this.charToByteMap_[this.byteToCharMap_[e]]=e,this.byteToCharMapWebSafe_[e]=this.ENCODED_VALS_WEBSAFE.charAt(e),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[e]]=e,e>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(e)]=e,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(e)]=e)}}};var l=class extends Error{constructor(){super(...arguments),this.name=`DecodeBase64StringError`}};const u=function(e){let t=o(e);return c.encodeByteArray(t,!0)},d=function(e){return u(e).replace(/\./g,``)},f=function(e){try{return c.decodeString(e,!0)}catch(e){console.error(`base64Decode failed: `,e)}return null};
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2022 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function ee(){if(typeof self<`u`)return self;if(typeof window<`u`)return window;if(typeof globalThis<`u`)return globalThis;throw Error(`Unable to locate globalThis object.`)}
/**
* @license
* Copyright 2022 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const te=()=>ee().__FIREBASE_DEFAULTS__,ne=()=>{if(i.default===void 0||i.default.env===void 0)return;let e=i.default.env.__FIREBASE_DEFAULTS__;if(e)return JSON.parse(e)},re=()=>{if(typeof document>`u`)return;let e;try{e=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}let t=e&&f(e[1]);return t&&JSON.parse(t)},ie=()=>{try{return a()||te()||ne()||re()}catch(e){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${e}`);return}},ae=()=>ie()?.config;
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var p=class{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,n)=>{t?this.reject(t):this.resolve(n),typeof e==`function`&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,n))}}};
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function m(){try{return typeof indexedDB==`object`}catch{return!1}}function oe(){return new Promise((e,t)=>{try{let n=!0,r=`validate-browser-context-for-indexeddb-analytics-module`,i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),n||self.indexedDB.deleteDatabase(r),e(!0)},i.onupgradeneeded=()=>{n=!1},i.onerror=()=>{t(i.error?.message||``)}}catch(e){t(e)}})}
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var h=class e extends Error{constructor(t,n,r){super(n),this.code=t,this.customData=r,this.name=`FirebaseError`,Object.setPrototypeOf(this,e.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,se.prototype.create)}},se=class{constructor(e,t,n){this.service=e,this.serviceName=t,this.errors=n}create(e,...t){let n=t[0]||{},r=`${this.service}/${e}`,i=this.errors[e],a=i?ce(i,n):`Error`;return new h(r,`${this.serviceName}: ${a} (${r}).`,n)}};function ce(e,t){try{let n=0,r=``;for(;n<e.length;){let i=e.indexOf(`{$`,n);if(i===-1){r+=e.substring(n);break}let a=e.indexOf(`}`,i+2);if(a===-1){r+=e.substring(n);break}let o=e.substring(i+2,a),s=t[o];r+=e.substring(n,i)+(s==null?`<${o}?>`:String(s)),n=a+1}return r}catch{return e}}
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function le(e,t){if(e===t)return!0;let n=Object.keys(e),r=Object.keys(t);for(let i of n){if(!r.includes(i))return!1;let n=e[i],a=t[i];if(ue(n)&&ue(a)){if(!le(n,a))return!1}else if(n!==a)return!1}for(let e of r)if(!n.includes(e))return!1;return!0}function ue(e){return typeof e==`object`&&!!e}
/**
* @license
* Copyright 2022 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function de(e,t=1e3,n=2){let r=t*n**+e,i=Math.round(.5*r*(Math.random()-.5)*2);return Math.min(144e5,r+i)}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function fe(e){return e&&e._delegate?e._delegate:e}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var g=class{constructor(e,t,n){this.name=e,this.instanceFactory=t,this.type=n,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode=`LAZY`,this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}};
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const _=`[DEFAULT]`;
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var pe=class{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){let t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){let e=new p;if(this.instancesDeferred.set(t,e),this.isInitialized(t)||this.shouldAutoInitialize())try{let n=this.getOrInitializeService({instanceIdentifier:t});n&&e.resolve(n)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){let t=this.normalizeInstanceIdentifier(e?.identifier),n=e?.optional??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(e){if(n)return null;throw e}else if(n)return null;else throw Error(`Service ${this.name} is not available`)}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,this.shouldAutoInitialize()){if(he(e))try{this.getOrInitializeService({instanceIdentifier:_})}catch{}for(let[e,t]of this.instancesDeferred.entries()){let n=this.normalizeInstanceIdentifier(e);try{let e=this.getOrInitializeService({instanceIdentifier:n});t.resolve(e)}catch{}}}}clearInstance(e=_){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){let e=Array.from(this.instances.values());await Promise.all([...e.filter(e=>`INTERNAL`in e).map(e=>e.INTERNAL.delete()),...e.filter(e=>`_delete`in e).map(e=>e._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=_){return this.instances.has(e)}getOptions(e=_){return this.instancesOptions.get(e)||{}}initialize(e={}){let{options:t={}}=e,n=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(n))throw Error(`${this.name}(${n}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);let r=this.getOrInitializeService({instanceIdentifier:n,options:t});for(let[e,t]of this.instancesDeferred.entries())n===this.normalizeInstanceIdentifier(e)&&t.resolve(r);return r}onInit(e,t){let n=this.normalizeInstanceIdentifier(t),r=this.onInitCallbacks.get(n)??new Set;r.add(e),this.onInitCallbacks.set(n,r);let i=this.instances.get(n);return i&&e(i,n),()=>{r.delete(e)}}invokeOnInitCallbacks(e,t){let n=this.onInitCallbacks.get(t);if(n)for(let r of n)try{r(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let n=this.instances.get(e);if(!n&&this.component&&(n=this.component.instanceFactory(this.container,{instanceIdentifier:me(e),options:t}),this.instances.set(e,n),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(n,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,n)}catch{}return n||null}normalizeInstanceIdentifier(e=_){return this.component?this.component.multipleInstances?e:_:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!==`EXPLICIT`}};function me(e){return e===_?void 0:e}function he(e){return e.instantiationMode===`EAGER`}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var ge=class{constructor(e){this.name=e,this.providers=new Map}addComponent(e){let t=this.getProvider(e.name);if(t.isComponentSet())throw Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);let t=new pe(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}};
/**
* @license
* Copyright 2017 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const _e=[];var v;(function(e){e[e.DEBUG=0]=`DEBUG`,e[e.VERBOSE=1]=`VERBOSE`,e[e.INFO=2]=`INFO`,e[e.WARN=3]=`WARN`,e[e.ERROR=4]=`ERROR`,e[e.SILENT=5]=`SILENT`})(v||={});const ve={debug:v.DEBUG,verbose:v.VERBOSE,info:v.INFO,warn:v.WARN,error:v.ERROR,silent:v.SILENT},ye=v.INFO,be={[v.DEBUG]:`log`,[v.VERBOSE]:`log`,[v.INFO]:`info`,[v.WARN]:`warn`,[v.ERROR]:`error`},xe=(e,t,...n)=>{if(t<e.logLevel)return;let r=new Date().toISOString(),i=be[t];if(i)console[i](`[${r}]  ${e.name}:`,...n);else throw Error(`Attempted to log a message with an invalid logType (value: ${t})`)};var y=class{constructor(e){this.name=e,this._logLevel=ye,this._logHandler=xe,this._userLogHandler=null,_e.push(this)}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in v))throw TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e==`string`?ve[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!=`function`)throw TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,v.DEBUG,...e),this._logHandler(this,v.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,v.VERBOSE,...e),this._logHandler(this,v.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,v.INFO,...e),this._logHandler(this,v.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,v.WARN,...e),this._logHandler(this,v.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,v.ERROR,...e),this._logHandler(this,v.ERROR,...e)}};const Se=(e,t)=>t.some(t=>e instanceof t);let Ce,we;function Te(){return Ce||=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction]}function Ee(){return we||=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey]}const De=new WeakMap,b=new WeakMap,Oe=new WeakMap,ke=new WeakMap,Ae=new WeakMap;function je(e){let t=new Promise((t,n)=>{let r=()=>{e.removeEventListener(`success`,i),e.removeEventListener(`error`,a)},i=()=>{t(x(e.result)),r()},a=()=>{n(e.error),r()};e.addEventListener(`success`,i),e.addEventListener(`error`,a)});return t.then(t=>{t instanceof IDBCursor&&De.set(t,e)}).catch(()=>{}),Ae.set(t,e),t}function Me(e){if(b.has(e))return;let t=new Promise((t,n)=>{let r=()=>{e.removeEventListener(`complete`,i),e.removeEventListener(`error`,a),e.removeEventListener(`abort`,a)},i=()=>{t(),r()},a=()=>{n(e.error||new DOMException(`AbortError`,`AbortError`)),r()};e.addEventListener(`complete`,i),e.addEventListener(`error`,a),e.addEventListener(`abort`,a)});b.set(e,t)}let Ne={get(e,t,n){if(e instanceof IDBTransaction){if(t===`done`)return b.get(e);if(t===`objectStoreNames`)return e.objectStoreNames||Oe.get(e);if(t===`store`)return n.objectStoreNames[1]?void 0:n.objectStore(n.objectStoreNames[0])}return x(e[t])},set(e,t,n){return e[t]=n,!0},has(e,t){return e instanceof IDBTransaction&&(t===`done`||t===`store`)||t in e}};function Pe(e){Ne=e(Ne)}function Fe(e){return e===IDBDatabase.prototype.transaction&&!(`objectStoreNames`in IDBTransaction.prototype)?function(t,...n){let r=e.call(Le(this),t,...n);return Oe.set(r,t.sort?t.sort():[t]),x(r)}:Ee().includes(e)?function(...t){return e.apply(Le(this),t),x(De.get(this))}:function(...t){return x(e.apply(Le(this),t))}}function Ie(e){return typeof e==`function`?Fe(e):(e instanceof IDBTransaction&&Me(e),Se(e,Te())?new Proxy(e,Ne):e)}function x(e){if(e instanceof IDBRequest)return je(e);if(ke.has(e))return ke.get(e);let t=Ie(e);return t!==e&&(ke.set(e,t),Ae.set(t,e)),t}const Le=e=>Ae.get(e);function Re(e,t,{blocked:n,upgrade:r,blocking:i,terminated:a}={}){let o=indexedDB.open(e,t),s=x(o);return r&&o.addEventListener(`upgradeneeded`,e=>{r(x(o.result),e.oldVersion,e.newVersion,x(o.transaction),e)}),n&&o.addEventListener(`blocked`,e=>n(e.oldVersion,e.newVersion,e)),s.then(e=>{a&&e.addEventListener(`close`,()=>a()),i&&e.addEventListener(`versionchange`,e=>i(e.oldVersion,e.newVersion,e))}).catch(()=>{}),s}const ze=[`get`,`getKey`,`getAll`,`getAllKeys`,`count`],Be=[`put`,`add`,`delete`,`clear`],Ve=new Map;function He(e,t){if(!(e instanceof IDBDatabase&&!(t in e)&&typeof t==`string`))return;if(Ve.get(t))return Ve.get(t);let n=t.replace(/FromIndex$/,``),r=t!==n,i=Be.includes(n);if(!(n in(r?IDBIndex:IDBObjectStore).prototype)||!(i||ze.includes(n)))return;let a=async function(e,...t){let a=this.transaction(e,i?`readwrite`:`readonly`),o=a.store;return r&&(o=o.index(t.shift())),(await Promise.all([o[n](...t),i&&a.done]))[0]};return Ve.set(t,a),a}Pe(e=>({...e,get:(t,n,r)=>He(t,n)||e.get(t,n,r),has:(t,n)=>!!He(t,n)||e.has(t,n)}));
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var Ue=class{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(e=>{if(We(e)){let t=e.getImmediate();return`${t.library}/${t.version}`}else return null}).filter(e=>e).join(` `)}};function We(e){return e.getComponent()?.type===`VERSION`}const Ge=`@firebase/app`,Ke=`0.16.0`,S=new y(`@firebase/app`),qe=`[DEFAULT]`,Je={[Ge]:`fire-core`,"@firebase/app-compat":`fire-core-compat`,"@firebase/analytics":`fire-analytics`,"@firebase/analytics-compat":`fire-analytics-compat`,"@firebase/app-check":`fire-app-check`,"@firebase/app-check-compat":`fire-app-check-compat`,"@firebase/auth":`fire-auth`,"@firebase/auth-compat":`fire-auth-compat`,"@firebase/database":`fire-rtdb`,"@firebase/data-connect":`fire-data-connect`,"@firebase/database-compat":`fire-rtdb-compat`,"@firebase/functions":`fire-fn`,"@firebase/functions-compat":`fire-fn-compat`,"@firebase/installations":`fire-iid`,"@firebase/installations-compat":`fire-iid-compat`,"@firebase/messaging":`fire-fcm`,"@firebase/messaging-compat":`fire-fcm-compat`,"@firebase/performance":`fire-perf`,"@firebase/performance-compat":`fire-perf-compat`,"@firebase/remote-config":`fire-rc`,"@firebase/remote-config-compat":`fire-rc-compat`,"@firebase/storage":`fire-gcs`,"@firebase/storage-compat":`fire-gcs-compat`,"@firebase/firestore":`fire-fst`,"@firebase/firestore-compat":`fire-fst-compat`,"@firebase/ai":`fire-vertex`,"fire-js":`fire-js`,firebase:`fire-js-all`},C=new Map,Ye=new Map,Xe=new Map
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
;function Ze(e,t){try{e.container.addComponent(t)}catch(n){S.debug(`Component ${t.name} failed to register with FirebaseApp ${e.name}`,n)}}function w(e){let t=e.name;if(Xe.has(t))return S.debug(`There were multiple attempts to register component ${t}.`),!1;Xe.set(t,e);for(let t of C.values())Ze(t,e);for(let t of Ye.values())Ze(t,e);return!0}function Qe(e,t){let n=e.container.getProvider(`heartbeat`).getImmediate({optional:!0});return n&&n.triggerHeartbeat(),e.container.getProvider(t)}function $e(e){return e!=null&&e.settings!==void 0}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const T=new se(`app`,`Firebase`,{"no-app":`No Firebase App '{$appName}' has been created - call initializeApp() first`,"bad-app-name":`Illegal App name: '{$appName}'`,"duplicate-app":`Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.`,"app-deleted":`Firebase App named '{$appName}' already deleted`,"server-app-deleted":`Firebase Server App has been deleted`,"no-options":`Need to provide options, when not being deployed to hosting via source.`,"invalid-app-argument":`firebase.{$appName}() takes either no argument or a Firebase App instance.`,"invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":`Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.`,"idb-get":`Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.`,"idb-set":`Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.`,"idb-delete":`Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.`,"finalization-registry-not-supported":`FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.`,"invalid-server-app-environment":`FirebaseServerApp is not for use in browser environments.`});
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var et=class{constructor(e,t,n){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=n,this.container.addComponent(new g(`app`,()=>this,`PUBLIC`))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw T.create(`app-deleted`,{appName:this._name})}};
/**
* @license
* Copyright 2023 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function tt(e,t={}){let n=e;typeof t!=`object`&&(t={name:t});let r={name:qe,automaticDataCollectionEnabled:!0,...t},i=r.name;if(typeof i!=`string`||!i)throw T.create(`bad-app-name`,{appName:String(i)});if(n||=ae(),!n)throw T.create(`no-options`);let a=C.get(i);if(a){if(!le(n,a.options))throw T.create(`duplicate-app`,{appName:i,mismatchedParam:`options`,oldValue:JSON.stringify(a.options),newValue:JSON.stringify(n)});if(le(r,a.config))return a;throw T.create(`duplicate-app`,{appName:i,mismatchedParam:`config`,oldValue:JSON.stringify(a.config),newValue:JSON.stringify(r)})}let o=new ge(i);for(let e of Xe.values())o.addComponent(e);let s=new et(n,r,o);return C.set(i,s),s}function nt(e=qe){let t=C.get(e);if(!t&&e===`[DEFAULT]`&&ae())return tt();if(!t)throw T.create(`no-app`,{appName:e});return t}function E(e,t,n){let r=Je[e]??e;n&&(r+=`-${n}`);let i=r.match(/\s|\//),a=t.match(/\s|\//);if(i||a){let e=[`Unable to register library "${r}" with version "${t}":`];i&&e.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&a&&e.push(`and`),a&&e.push(`version name "${t}" contains illegal characters (whitespace or "/")`),S.warn(e.join(` `));return}w(new g(`${r}-version`,()=>({library:r,version:t}),`VERSION`))}
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const D=`firebase-heartbeat-store`;let rt=null;function it(){return rt||=Re(`firebase-heartbeat-database`,1,{upgrade:(e,t)=>{switch(t){case 0:try{e.createObjectStore(D)}catch(e){console.warn(e)}}}}).catch(e=>{throw T.create(`idb-open`,{originalErrorMessage:e.message})}),rt}async function at(e){try{let t=(await it()).transaction(D),n=await t.objectStore(D).get(st(e));return await t.done,n}catch(e){if(e instanceof h)S.warn(e.message);else{let t=T.create(`idb-get`,{originalErrorMessage:e?.message});S.warn(t.message)}}}async function ot(e,t){try{let n=(await it()).transaction(D,`readwrite`);await n.objectStore(D).put(t,st(e)),await n.done}catch(e){if(e instanceof h)S.warn(e.message);else{let t=T.create(`idb-set`,{originalErrorMessage:e?.message});S.warn(t.message)}}}function st(e){return`${e.name}!${e.options.appId}`}
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var ct=class{constructor(e){this.container=e,this._heartbeatsCache=null;let t=this.container.getProvider(`app`).getImmediate();this._storage=new dt(t),this._heartbeatsCachePromise=this._storage.read().then(e=>(this._heartbeatsCache=e,e))}async triggerHeartbeat(){try{let e=this.container.getProvider(`platform-logger`).getImmediate().getPlatformInfoString(),t=lt();if(this._heartbeatsCache?.heartbeats==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null)||this._heartbeatsCache.lastSentHeartbeatDate===t||this._heartbeatsCache.heartbeats.some(e=>e.date===t))return;if(this._heartbeatsCache.heartbeats.push({date:t,agent:e}),this._heartbeatsCache.heartbeats.length>30){let e=pt(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(e,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(e){S.warn(e)}}async getHeartbeatsHeader(){try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,this._heartbeatsCache?.heartbeats==null||this._heartbeatsCache.heartbeats.length===0)return``;let e=lt(),{heartbeatsToSend:t,unsentEntries:n}=ut(this._heartbeatsCache.heartbeats),r=d(JSON.stringify({version:2,heartbeats:t}));return this._heartbeatsCache.lastSentHeartbeatDate=e,n.length>0?(this._heartbeatsCache.heartbeats=n,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),r}catch(e){return S.warn(e),``}}};function lt(){return new Date().toISOString().substring(0,10)}function ut(e,t=1024){let n=[],r=e.slice();for(let i of e){let e=n.find(e=>e.agent===i.agent);if(!e){if(n.push({agent:i.agent,dates:[i.date]}),ft(n)>t){n.pop();break}}else if(e.dates.push(i.date),ft(n)>t){e.dates.pop();break}r=r.slice(1)}return{heartbeatsToSend:n,unsentEntries:r}}var dt=class{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return m()?oe().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){let e=await at(this.app);return e?.heartbeats?e:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){let t=await this.read();return ot(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??t.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){let t=await this.read();return ot(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??t.lastSentHeartbeatDate,heartbeats:[...t.heartbeats,...e.heartbeats]})}else return}};function ft(e){return d(JSON.stringify({version:2,heartbeats:e})).length}function pt(e){if(e.length===0)return-1;let t=0,n=e[0].date;for(let r=1;r<e.length;r++)e[r].date<n&&(n=e[r].date,t=r);return t}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function mt(e){w(new g(`platform-logger`,e=>new Ue(e),`PRIVATE`)),w(new g(`heartbeat`,e=>new ct(e),`PRIVATE`)),E(Ge,Ke,e),E(Ge,Ke,`esm2020`),E(`fire-js`,``)}
/**
* @license
* Copyright 2019 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
mt(``),E(`firebase`,`12.17.1`,`app`);
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const O=new Map,ht={activated:!1,tokenObservers:[]},gt={initialized:!1,enabled:!1};function k(e){return O.get(e)||{...ht}}function _t(e,t){return O.set(e,t),O.get(e)}function A(){return gt}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const vt=`https://content-firebaseappcheck.googleapis.com/v1`,yt={RETRIAL_MIN_WAIT:30*1e3,RETRIAL_MAX_WAIT:960*1e3};
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var bt=class{constructor(e,t,n,r,i){if(this.operation=e,this.retryPolicy=t,this.getWaitDuration=n,this.lowerBound=r,this.upperBound=i,this.pending=null,this.nextErrorWaitInterval=r,r>i)throw Error(`Proactive refresh lower bound greater than upper bound!`)}start(){this.nextErrorWaitInterval=this.lowerBound,this.process(!0).catch(()=>{})}stop(){this.pending&&=(this.pending.reject(`cancelled`),null)}isRunning(){return!!this.pending}async process(e){this.stop();try{this.pending=new p,this.pending.promise.catch(e=>{}),await xt(this.getNextRun(e)),this.pending.resolve(),await this.pending.promise,this.pending=new p,this.pending.promise.catch(e=>{}),await this.operation(),this.pending.resolve(),await this.pending.promise,this.process(!0).catch(()=>{})}catch(e){this.retryPolicy(e)?this.process(!1).catch(()=>{}):this.stop()}}getNextRun(e){if(e)return this.nextErrorWaitInterval=this.lowerBound,this.getWaitDuration();{let e=this.nextErrorWaitInterval;return this.nextErrorWaitInterval*=2,this.nextErrorWaitInterval>this.upperBound&&(this.nextErrorWaitInterval=this.upperBound),e}}};function xt(e){return new Promise(t=>{setTimeout(t,e)})}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const j=new se(`appCheck`,`AppCheck`,{"already-initialized":`You have already called initializeAppCheck() for FirebaseApp {$appName} with different options. To avoid this error, call initializeAppCheck() with the same options as when it was originally called. This will return the already initialized instance.`,"use-before-activation":`App Check is being used before initializeAppCheck() is called for FirebaseApp {$appName}. Call initializeAppCheck() before instantiating other Firebase services.`,"fetch-network-error":`Fetch failed to connect to a network. Check Internet connection. Original error: {$originalErrorMessage}.`,"fetch-parse-error":`Fetch client could not parse response. Original error: {$originalErrorMessage}.`,"fetch-status-error":`Fetch server returned an HTTP error status. HTTP status: {$httpStatus}.`,"storage-open":`Error thrown when opening storage. Original error: {$originalErrorMessage}.`,"storage-get":`Error thrown when reading from storage. Original error: {$originalErrorMessage}.`,"storage-set":`Error thrown when writing to storage. Original error: {$originalErrorMessage}.`,"recaptcha-error":`ReCAPTCHA error.`,"initial-throttle":`{$httpStatus} error. Attempts allowed again after {$time}`,throttled:`Requests throttled due to previous {$httpStatus} error. Attempts allowed again after {$time}`});
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function St(e=!1){return e?self.grecaptcha?.enterprise:self.grecaptcha}function M(e){if(!k(e).activated)throw j.create(`use-before-activation`,{appName:e.name})}function Ct(e){let t=Math.round(e/1e3),n=Math.floor(t/(3600*24)),r=Math.floor((t-n*3600*24)/3600),i=Math.floor((t-n*3600*24-r*3600)/60),a=t-n*3600*24-r*3600-i*60,o=``;return n&&(o+=N(n)+`d:`),r&&(o+=N(r)+`h:`),o+=N(i)+`m:`+N(a)+`s`,o}function N(e){return e===0?`00`:e>=10?e.toString():`0`+e}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function P({url:e,body:t},n){let r={"Content-Type":`application/json`},i=n.getImmediate({optional:!0});if(i){let e=await i.getHeartbeatsHeader();e&&(r[`X-Firebase-Client`]=e)}let a={method:`POST`,body:JSON.stringify(t),headers:r},o;try{o=await fetch(e,a)}catch(e){throw j.create(`fetch-network-error`,{originalErrorMessage:e?.message})}if(o.status!==200)throw j.create(`fetch-status-error`,{httpStatus:o.status});let s;try{s=await o.json()}catch(e){throw j.create(`fetch-parse-error`,{originalErrorMessage:e?.message})}let c=s.ttl.match(/^([\d.]+)(s)$/);if(!c||!c[2]||isNaN(Number(c[1])))throw j.create(`fetch-parse-error`,{originalErrorMessage:`ttl field (timeToLive) is not in standard Protobuf Duration format: ${s.ttl}`});let l=Number(c[1])*1e3,u=Date.now();return{token:s.token,expireTimeMillis:u+l,issuedAtTimeMillis:u}}function wt(e,t){let{projectId:n,appId:r,apiKey:i}=e.options;return{url:`${vt}/projects/${n}/apps/${r}:exchangeRecaptchaEnterpriseToken?key=${i}`,body:{recaptcha_enterprise_token:t}}}function Tt(e,t){let{projectId:n,appId:r,apiKey:i}=e.options;return{url:`${vt}/projects/${n}/apps/${r}:exchangeDebugToken?key=${i}`,body:{debug_token:t}}}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const F=`firebase-app-check-store`,Et=`debug-token`;let Dt=null;function Ot(){return Dt||(Dt=new Promise((e,t)=>{try{let n=indexedDB.open(`firebase-app-check-database`,1);n.onsuccess=t=>{e(t.target.result)},n.onerror=e=>{t(j.create(`storage-open`,{originalErrorMessage:e.target.error?.message}))},n.onupgradeneeded=e=>{let t=e.target.result;switch(e.oldVersion){case 0:t.createObjectStore(F,{keyPath:`compositeKey`})}}}catch(e){t(j.create(`storage-open`,{originalErrorMessage:e?.message}))}}),Dt)}function kt(e){return Pt(Ft(e))}function At(e,t){return Nt(Ft(e),t)}function jt(e){return Nt(Et,e)}function Mt(){return Pt(Et)}async function Nt(e,t){let n=(await Ot()).transaction(F,`readwrite`),r=n.objectStore(F).put({compositeKey:e,value:t});return new Promise((e,t)=>{r.onsuccess=t=>{e()},n.onerror=e=>{t(j.create(`storage-set`,{originalErrorMessage:e.target.error?.message}))}})}async function Pt(e){let t=(await Ot()).transaction(F,`readonly`),n=t.objectStore(F).get(e);return new Promise((e,r)=>{n.onsuccess=t=>{let n=t.target.result;e(n?n.value:void 0)},t.onerror=e=>{r(j.create(`storage-get`,{originalErrorMessage:e.target.error?.message}))}})}function Ft(e){return`${e.options.appId}-${e.name}`}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const I=new y(`@firebase/app-check`);
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function It(e){if(m()){let t;try{t=await kt(e)}catch(e){I.warn(`Failed to read token from IndexedDB. Error: ${e}`)}return t}}function Lt(e,t){return m()?At(e,t).catch(e=>{I.warn(`Failed to write token to IndexedDB. Error: ${e}`)}):Promise.resolve()}async function Rt(){let e;try{e=await Mt()}catch{}if(e)return e;{let e=crypto.randomUUID();return jt(e).catch(e=>I.warn(`Failed to persist debug token to IndexedDB. Error: ${e}`)),e}}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function zt(){return A().enabled}async function Bt(){let e=A();if(e.enabled&&e.token)return e.token.promise;throw Error(`
            Can't get debug token in production mode.
        `)}function Vt(){let e=ee(),t=A();if(t.initialized=!0,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN!=`string`&&e.FIREBASE_APPCHECK_DEBUG_TOKEN!==!0)return;t.enabled=!0;let n=new p;t.token=n,typeof e.FIREBASE_APPCHECK_DEBUG_TOKEN==`string`?n.resolve(e.FIREBASE_APPCHECK_DEBUG_TOKEN):n.resolve(Rt())}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const Ht={error:`UNKNOWN_ERROR`};function Ut(e){return c.encodeString(JSON.stringify(e),!1)}async function Wt(e,t=!1,n=!1){let r=e.app;M(r);let i=k(r),a=i.token,o;if(a&&!L(a)&&(i.token=void 0,a=void 0),!a){let e=await i.cachedTokenPromise;e&&(L(e)?a=e:await Lt(r,void 0))}if(!t&&a&&L(a))return{token:a.token};let s=!1;if(zt())try{let t=await Bt();i.exchangeTokenPromise||(i.exchangeTokenPromise=P(Tt(r,t),e.heartbeatServiceProvider).finally(()=>{i.exchangeTokenPromise=void 0}),s=!0);let n=await i.exchangeTokenPromise;return await Lt(r,n),i.token=n,{token:n.token}}catch(e){return e.code===`appCheck/throttled`||e.code===`appCheck/initial-throttle`?I.warn(e.message):n&&I.error(e),Zt(e)}try{i.exchangeTokenPromise||(i.exchangeTokenPromise=i.provider.getToken().finally(()=>{i.exchangeTokenPromise=void 0}),s=!0),a=await k(r).exchangeTokenPromise}catch(e){e.code===`appCheck/throttled`||e.code===`appCheck/initial-throttle`?I.warn(e.message):n&&I.error(e),o=e}let c;return a?o?c=L(a)?{token:a.token,internalError:o}:Zt(o):(c={token:a.token},i.token=a,await Lt(r,a)):c=Zt(o),s&&Xt(r,c),c}async function Gt(e){let t=e.app;M(t);let{provider:n}=k(t);if(zt()){let n=Tt(t,await Bt());n.body.limited_use=!0;let{token:r}=await P(n,e.heartbeatServiceProvider);return{token:r}}else{let{token:e}=await n.getToken(!0);return{token:e}}}function Kt(e,t,n,r){let{app:i}=e,a=k(i),o={next:n,error:r,type:t};if(a.tokenObservers=[...a.tokenObservers,o],a.token&&L(a.token)){let t=a.token;Promise.resolve().then(()=>{n({token:t.token}),Jt(e)}).catch(()=>{})}a.cachedTokenPromise.then(()=>Jt(e))}function qt(e,t){let n=k(e),r=n.tokenObservers.filter(e=>e.next!==t);r.length===0&&n.tokenRefresher&&n.tokenRefresher.isRunning()&&n.tokenRefresher.stop(),n.tokenObservers=r}function Jt(e){let{app:t}=e,n=k(t),r=n.tokenRefresher;r||(r=Yt(e),n.tokenRefresher=r),!r.isRunning()&&n.isTokenAutoRefreshEnabled&&r.start()}function Yt(e){let{app:t}=e;return new bt(async()=>{let n=k(t),r;if(r=n.token?await Wt(e,!0):await Wt(e),r.error)throw r.error;if(r.internalError)throw r.internalError},()=>!0,()=>{let e=k(t);if(e.token){let t=e.token.issuedAtTimeMillis+(e.token.expireTimeMillis-e.token.issuedAtTimeMillis)*.5+300*1e3,n=e.token.expireTimeMillis-300*1e3;return t=Math.min(t,n),Math.max(0,t-Date.now())}else return 0},yt.RETRIAL_MIN_WAIT,yt.RETRIAL_MAX_WAIT)}function Xt(e,t){let n=k(e).tokenObservers;for(let e of n)try{e.type===`EXTERNAL`&&t.error!=null?e.error(t.error):e.next(t)}catch{}}function L(e){return e.expireTimeMillis-Date.now()>0}function Zt(e){return{token:Ut(Ht),error:e}}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var Qt=class{constructor(e,t){this.app=e,this.heartbeatServiceProvider=t}_delete(){let{tokenObservers:e}=k(this.app);for(let t of e)qt(this.app,t.next);return Promise.resolve()}};function $t(e,t){return new Qt(e,t)}function en(e){return{getToken:t=>Wt(e,t),getLimitedUseToken:()=>Gt(e),addTokenListener:t=>Kt(e,`INTERNAL`,t),removeTokenListener:t=>qt(e.app,t)}}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function tn(e,t){let n=new p,r=k(e);r.reCAPTCHAState={initialized:n};let i=rn(e),a=St(!0);return a?nn(e,t,a,i,n):sn(()=>{let r=St(!0);if(!r)throw Error(`no recaptcha`);nn(e,t,r,i,n)}),n.promise}function nn(e,t,n,r,i){n.ready(()=>{on(e,t,n,r),i.resolve(n)})}function rn(e){let t=`fire_app_check_${e.name}`,n=document.createElement(`div`);return n.id=t,n.style.display=`none`,document.body.appendChild(n),t}async function an(e){M(e);let t=await k(e).reCAPTCHAState.initialized.promise;return new Promise((n,r)=>{let i=k(e).reCAPTCHAState;t.ready(()=>{n(t.execute(i.widgetId,{action:`fire_app_check`}))})})}function on(e,t,n,r){let i=n.render(r,{sitekey:t,size:`invisible`,callback:()=>{k(e).reCAPTCHAState.succeeded=!0},"error-callback":()=>{k(e).reCAPTCHAState.succeeded=!1}}),a=k(e);a.reCAPTCHAState={...a.reCAPTCHAState,widgetId:i}}function sn(e){let t=document.createElement(`script`);t.src=`https://www.google.com/recaptcha/enterprise.js?render=explicit`,t.onload=e,document.head.appendChild(t)}
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var cn=class e{constructor(e){this._siteKey=e,this._throttleData=null}async getToken(e=!1){un(this._throttleData);let t=await an(this._app).catch(e=>{throw j.create(`recaptcha-error`)});if(!k(this._app).reCAPTCHAState?.succeeded)throw j.create(`recaptcha-error`);let n;try{let r=wt(this._app,t);e&&(r.body.limited_use=!0),n=await P(r,this._heartbeatServiceProvider)}catch(e){throw e.code?.includes(`fetch-status-error`)?(this._throttleData=ln(Number(e.customData?.httpStatus),this._throttleData),j.create(`initial-throttle`,{time:Ct(this._throttleData.allowRequestsAfter-Date.now()),httpStatus:this._throttleData.httpStatus})):e}return this._throttleData=null,n}initialize(e){this._app=e,this._heartbeatServiceProvider=Qe(e,`heartbeat`),tn(e,this._siteKey).catch(()=>{})}isEqual(t){return t instanceof e&&this._siteKey===t._siteKey}};function ln(e,t){if(e===404||e===403)return{backoffCount:1,allowRequestsAfter:Date.now()+864e5,httpStatus:e};{let n=t?t.backoffCount:0,r=de(n,1e3,2);return{backoffCount:n+1,allowRequestsAfter:Date.now()+r,httpStatus:e}}}function un(e){if(e&&Date.now()-e.allowRequestsAfter<=0)throw j.create(`throttled`,{time:Ct(e.allowRequestsAfter-Date.now()),httpStatus:e.httpStatus})}
/**
* @license
* Copyright 2020 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function dn(e=nt(),t){e=fe(e);let n=Qe(e,`app-check`);if(A().initialized||Vt(),zt()&&Bt().then(e=>console.log(`App Check debug token: ${e}. You will need to add it to your app's App Check settings in the Firebase console for it to work.`)),n.isInitialized()){let r=n.getImmediate(),i=n.getOptions();if(i&&!!i.isTokenAutoRefreshEnabled==!!t.isTokenAutoRefreshEnabled&&i.provider?.isEqual(t.provider))return r;throw j.create(`already-initialized`,{appName:e.name})}let r=n.initialize({options:t});return fn(e,t.provider,t.isTokenAutoRefreshEnabled),k(e).isTokenAutoRefreshEnabled&&Kt(r,`INTERNAL`,()=>{}),r}function fn(e,t,n=!1){let r=_t(e,{...ht});r.activated=!0,r.provider=t,r.cachedTokenPromise=It(e).then(t=>(t&&L(t)&&(r.token=t,Xt(e,{token:t.token})),t)),r.isTokenAutoRefreshEnabled=n&&e.automaticDataCollectionEnabled,!e.automaticDataCollectionEnabled&&n&&I.warn("`isTokenAutoRefreshEnabled` is true but `automaticDataCollectionEnabled` was set to false during `initializeApp()`. This blocks automatic token refresh."),r.provider.initialize(e)}
/**
* @license
* Copyright 2021 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const pn=`app-check-internal`;function mn(){w(new g(`app-check`,e=>$t(e.getProvider(`app`).getImmediate(),e.getProvider(`heartbeat`)),`PUBLIC`).setInstantiationMode(`EXPLICIT`).setInstanceCreatedCallback((e,t,n)=>{e.getProvider(pn).initialize()})),w(new g(pn,e=>en(e.getProvider(`app-check`).getImmediate()),`PUBLIC`).setInstantiationMode(`EXPLICIT`)),E(`@firebase/app-check`,`0.13.0`)}mn();var hn=`@firebase/ai`,gn=`2.14.0`;
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const R=`v1beta`,_n=gn;
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var z=class e extends h{constructor(t,n,r){let i=`AI: ${n} (${`AI/${t}`})`;super(t,i),this.code=t,this.customErrorData=r,Error.captureStackTrace&&Error.captureStackTrace(this,e),Object.setPrototypeOf(this,e.prototype),this.toString=()=>i}};
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const vn=[`user`,`model`,`function`,`system`],yn={HARM_SEVERITY_NEGLIGIBLE:`HARM_SEVERITY_NEGLIGIBLE`,HARM_SEVERITY_LOW:`HARM_SEVERITY_LOW`,HARM_SEVERITY_MEDIUM:`HARM_SEVERITY_MEDIUM`,HARM_SEVERITY_HIGH:`HARM_SEVERITY_HIGH`,HARM_SEVERITY_UNSUPPORTED:`HARM_SEVERITY_UNSUPPORTED`},B={STOP:`STOP`,MAX_TOKENS:`MAX_TOKENS`,SAFETY:`SAFETY`,RECITATION:`RECITATION`,OTHER:`OTHER`,BLOCKLIST:`BLOCKLIST`,PROHIBITED_CONTENT:`PROHIBITED_CONTENT`,SPII:`SPII`,MALFORMED_FUNCTION_CALL:`MALFORMED_FUNCTION_CALL`,IMAGE_SAFETY:`IMAGE_SAFETY`,IMAGE_PROHIBITED_CONTENT:`IMAGE_PROHIBITED_CONTENT`,IMAGE_OTHER:`IMAGE_OTHER`,NO_IMAGE:`NO_IMAGE`,IMAGE_RECITATION:`IMAGE_RECITATION`,LANGUAGE:`LANGUAGE`,UNEXPECTED_TOOL_CALL:`UNEXPECTED_TOOL_CALL`,TOO_MANY_TOOL_CALLS:`TOO_MANY_TOOL_CALLS`,MISSING_THOUGHT_SIGNATURE:`MISSING_THOUGHT_SIGNATURE`,MALFORMED_RESPONSE:`MALFORMED_RESPONSE`},V={PREFER_ON_DEVICE:`prefer_on_device`,ONLY_ON_DEVICE:`only_on_device`,ONLY_IN_CLOUD:`only_in_cloud`,PREFER_IN_CLOUD:`prefer_in_cloud`},H={ON_DEVICE:`on_device`,IN_CLOUD:`in_cloud`},U={ERROR:`error`,REQUEST_ERROR:`request-error`,RESPONSE_ERROR:`response-error`,FETCH_ERROR:`fetch-error`,SESSION_CLOSED:`session-closed`,INVALID_CONTENT:`invalid-content`,API_NOT_ENABLED:`api-not-enabled`,INVALID_SCHEMA:`invalid-schema`,NO_API_KEY:`no-api-key`,NO_APP_ID:`no-app-id`,NO_MODEL:`no-model`,NO_PROJECT_ID:`no-project-id`,PARSE_FAILED:`parse-failed`,UNSUPPORTED:`unsupported`},W={AGENT_PLATFORM:`AGENT_PLATFORM`,VERTEX_AI:`VERTEX_AI`,GOOGLE_AI:`GOOGLE_AI`}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
;
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var bn=class{constructor(e){this.backendType=e}},G=class extends bn{constructor(){super(W.GOOGLE_AI)}_getModelPath(e,t){return`/${R}/projects/${e}/${t}`}_getTemplatePath(e,t){return`/${R}/projects/${e}/templates/${t}`}},K=class extends bn{constructor(e){super(W.VERTEX_AI),this.location=`us-central1`,e&&(this.location=e)}_getModelPath(e,t){return`/${R}/projects/${e}/locations/${this.location}/${t}`}_getTemplatePath(e,t){return`/${R}/projects/${e}/locations/${this.location}/templates/${t}`}},xn=class extends bn{constructor(e){super(W.AGENT_PLATFORM),this.location=`globalThis`,e&&(this.location=e)}_getModelPath(e,t){return`/${R}/projects/${e}/locations/${this.location}/${t}`}_getTemplatePath(e,t){return`/${R}/projects/${e}/locations/${this.location}/templates/${t}`}};
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function Sn(e){if(e instanceof G)return`AI/googleai`;if(e instanceof K)return`AI/vertexai/${e.location}`;if(e instanceof xn)return`AI/agentplatform/${e.location}`;throw new z(U.ERROR,`Invalid backend: ${JSON.stringify(e.backendType)}`)}function Cn(e){let t=e.split(`/`);if(t[0]!==`AI`)throw new z(U.ERROR,`Invalid instance identifier, unknown prefix '${t[0]}'`);switch(t[1]){case`vertexai`:let n=t[2];if(!n)throw new z(U.ERROR,`Invalid instance identifier, unknown location '${e}'`);return new K(n);case`agentplatform`:let r=t[2];if(!r)throw new z(U.ERROR,`Invalid instance identifier, unknown location '${e}'`);return new xn(r);case`googleai`:return new G;default:throw new z(U.ERROR,`Invalid instance identifier string: '${e}'`)}}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const q=new y(`@firebase/vertexai`);var J;(function(e){e.UNAVAILABLE=`unavailable`,e.DOWNLOADABLE=`downloadable`,e.DOWNLOADING=`downloading`,e.AVAILABLE=`available`})(J||={});
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const wn={type:`text`,languages:[`en`]},Tn=[wn,{type:`image`}],En=[wn];var Dn=class e{constructor(e,t,n){this.languageModelProvider=e,this.mode=t,this.downloadPromise=null,this.onDeviceParams={createOptions:{expectedInputs:Tn,expectedOutputs:En}},n&&(this.onDeviceParams=n,this.onDeviceParams.createOptions?(this.onDeviceParams.createOptions.expectedInputs||(this.onDeviceParams.createOptions.expectedInputs=Tn),this.onDeviceParams.createOptions.expectedOutputs||(this.onDeviceParams.createOptions.expectedOutputs=En)):this.onDeviceParams.createOptions={expectedInputs:Tn,expectedOutputs:En})}async isAvailable(t){if(!this.mode)return q.debug(`On-device inference unavailable because mode is undefined.`),!1;if(this.mode===V.ONLY_IN_CLOUD)return q.debug(`On-device inference unavailable because mode is "only_in_cloud".`),!1;let n=await this.languageModelProvider?.availability(this.onDeviceParams.createOptions);if(this.mode===V.ONLY_ON_DEVICE){if(n===J.UNAVAILABLE)throw new z(U.API_NOT_ENABLED,`Local LanguageModel API not available in this environment.`);if(n===J.DOWNLOADABLE||n===J.DOWNLOADING){q.debug(`Waiting for download of LanguageModel to complete.`);try{await this.downloadPromise}catch(e){throw new z(U.ERROR,e.message)}return!0}return!0}return n===J.AVAILABLE?e.isOnDeviceRequest(t)?!0:(q.debug(`On-device inference unavailable because request is incompatible.`),!1):(q.debug(`On-device inference unavailable because availability is "${n}".`),!1)}async generateContent(t){let n=await this.createSession(),r=await Promise.all(t.contents.map(e.toLanguageModelMessage)),i=await n.prompt(r,this.onDeviceParams.promptOptions);return e.toResponse(i)}async generateContentStream(t){let n=await this.createSession(),r=await Promise.all(t.contents.map(e.toLanguageModelMessage)),i=n.promptStreaming(r,this.onDeviceParams.promptOptions);return e.toStreamResponse(i)}async countTokens(e){throw new z(U.REQUEST_ERROR,`Count Tokens is not yet available for on-device model.`)}static isOnDeviceRequest(t){if(t.contents.length===0)return q.debug(`Empty prompt rejected for on-device inference.`),!1;for(let n of t.contents){if(n.role===`function`)return q.debug(`"Function" role rejected for on-device inference.`),!1;for(let t of n.parts)if(t.inlineData&&e.SUPPORTED_MIME_TYPES.indexOf(t.inlineData.mimeType)===-1)return q.debug(`Unsupported mime type "${t.inlineData.mimeType}" rejected for on-device inference.`),!1}return!0}async downloadIfAvailable(e){let t=await this.languageModelProvider?.availability(this.onDeviceParams.createOptions);return(t===J.DOWNLOADABLE||t===J.DOWNLOADING)&&this.download(e),t}download(e){if(this.downloadPromise)return;let t={...this.onDeviceParams.createOptions};t&&!t.monitor&&e&&(t.monitor=t=>{t.addEventListener(`downloadprogress`,t=>{e(t.loaded)})}),this.downloadPromise=this.languageModelProvider?.create(t).finally(()=>{this.downloadPromise=null})}static async toLanguageModelMessage(t){let n=await Promise.all(t.parts.map(e.toLanguageModelMessageContent));return{role:e.toLanguageModelMessageRole(t.role),content:n}}static async toLanguageModelMessageContent(e){if(e.text)return{type:`text`,value:e.text};if(e.inlineData){let t=await(await fetch(`data:${e.inlineData.mimeType};base64,${e.inlineData.data}`)).blob();return{type:`image`,value:await createImageBitmap(t)}}throw new z(U.REQUEST_ERROR,`Processing of this Part type is not currently supported.`)}static toLanguageModelMessageRole(e){return e===`model`?`assistant`:`user`}async createSession(){if(!this.languageModelProvider)throw new z(U.UNSUPPORTED,`Chrome AI requested for unsupported browser version.`);let e=await this.languageModelProvider.create(this.onDeviceParams.createOptions);return this.oldSession&&this.oldSession.destroy(),this.oldSession=e,e}static toResponse(e){return{json:async()=>({candidates:[{content:{parts:[{text:e}]}}]})}}static toStreamResponse(e){let t=new TextEncoder;return{body:e.pipeThrough(new TransformStream({transform(e,n){let r=JSON.stringify({candidates:[{content:{role:`model`,parts:[{text:e}]}}]});n.enqueue(t.encode(`data: ${r}\n\n`))}}))}}};Dn.SUPPORTED_MIME_TYPES=[`image/jpeg`,`image/png`];function On(e,t,n){if(t!==void 0&&e)return new Dn(t.LanguageModel,e,n)}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var kn=class{constructor(e,t,n,r,i){this.app=e,this.backend=t,this.chromeAdapterFactory=i;let a=r?.getImmediate({optional:!0}),o=n?.getImmediate({optional:!0});this.auth=o||null,this.appCheck=a||null,t instanceof K||t instanceof xn?this.location=t.location:this.location=``}_delete(){return Promise.resolve()}set options(e){this._options=e}get options(){return this._options}};
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function An(e,{instanceIdentifier:t}){if(!t)throw new z(U.ERROR,`AIService instance identifier is undefined.`);let n=Cn(t);return new kn(e.getProvider(`app`).getImmediate(),n,e.getProvider(`auth-internal`),e.getProvider(`app-check-internal`),On)}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function jn(e){if(!e.app?.options?.apiKey)throw new z(U.NO_API_KEY,`The "apiKey" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid API key.`);if(!e.app?.options?.projectId)throw new z(U.NO_PROJECT_ID,`The "projectId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid project ID.`);if(!e.app?.options?.appId)throw new z(U.NO_APP_ID,`The "appId" field is empty in the local Firebase config. Firebase AI requires this field to contain a valid app ID.`);let t={apiKey:e.app.options.apiKey,project:e.app.options.projectId,appId:e.app.options.appId,automaticDataCollectionEnabled:e.app.automaticDataCollectionEnabled,location:e.location,backend:e.backend};if($e(e.app)&&e.app.settings.appCheckToken){let n=e.app.settings.appCheckToken;t.getAppCheckToken=()=>Promise.resolve({token:n})}else e.appCheck&&(e.options?.useLimitedUseAppCheckTokens?t.getAppCheckToken=()=>e.appCheck.getLimitedUseToken():t.getAppCheckToken=()=>e.appCheck.getToken());return e.auth&&(t.getAuthToken=()=>e.auth.getToken()),t}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var Mn=class e{constructor(t,n){this._apiSettings=jn(t),this.model=e.normalizeModelName(n,this._apiSettings.backend.backendType)}static normalizeModelName(t,n){return n===W.GOOGLE_AI?e.normalizeGoogleAIModelName(t):e.normalizeVertexAIModelName(t)}static normalizeGoogleAIModelName(e){return`models/${e}`}static normalizeVertexAIModelName(e){let t;return t=e.includes(`/`)?e.startsWith(`models/`)?`publishers/google/${e}`:e:`publishers/google/models/${e}`,t}};
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const Nn=`AbortError`;var Pn=class{constructor(e){this.params=e}toString(){let e=new URL(this.baseUrl);return e.pathname=this.pathname,e.search=this.queryParams.toString(),e.toString()}get pathname(){return this.params.templateId?`${this.params.apiSettings.backend._getTemplatePath(this.params.apiSettings.project,this.params.templateId)}:${this.params.task}`:`${this.params.apiSettings.backend._getModelPath(this.params.apiSettings.project,this.params.model)}:${this.params.task}`}get baseUrl(){return this.params.singleRequestOptions?.baseUrl??`https://firebasevertexai.googleapis.com`}get queryParams(){let e=new URLSearchParams;return this.params.stream&&e.set(`alt`,`sse`),e}};function Fn(e){let t=[];return t.push(`gl-js/${_n}`),t.push(`fire/${_n}`),(e.params.apiSettings.inferenceMode===V.PREFER_ON_DEVICE||e.params.apiSettings.inferenceMode===V.PREFER_IN_CLOUD)&&t.push(`hybrid`),t.join(` `)}async function In(e){let t=new Headers;if(t.append(`Content-Type`,`application/json`),t.append(`x-goog-api-client`,Fn(e)),t.append(`x-goog-api-key`,e.params.apiSettings.apiKey),e.params.apiSettings.automaticDataCollectionEnabled&&t.append(`X-Firebase-Appid`,e.params.apiSettings.appId),e.params.apiSettings.getAppCheckToken){let n=await e.params.apiSettings.getAppCheckToken();n&&(t.append(`X-Firebase-AppCheck`,n.token),n.error&&q.warn(`Unable to obtain a valid App Check token: ${n.error.message}`))}if(e.params.apiSettings.getAuthToken){let n=await e.params.apiSettings.getAuthToken();n&&t.append(`Authorization`,`Firebase ${n.accessToken}`)}return t}async function Ln(e,t){let n=new Pn(e),r,i=e.singleRequestOptions?.signal,a=e.singleRequestOptions?.timeout!=null&&e.singleRequestOptions.timeout>=0?e.singleRequestOptions.timeout:18e4,o=new AbortController,s=setTimeout(()=>{o.abort(new DOMException(`Timeout has expired.`,Nn)),q.debug(`Aborting request to ${n} due to timeout (${a}ms)`)},a),c=AbortSignal.any(i?[i,o.signal]:[o.signal]);if(i&&i.aborted)throw clearTimeout(s),new DOMException(i.reason??`Aborted externally before fetch`,Nn);try{let e={method:`POST`,headers:await In(n),signal:c,body:t};if(r=await fetch(n.toString(),e),!r.ok){let e=``,t;try{let n=await r.json();e=n.error.message,n.error.details&&(e+=` ${JSON.stringify(n.error.details)}`,t=n.error.details)}catch{}throw r.status===403&&t&&t.some(e=>e.reason===`SERVICE_DISABLED`)&&t.some(e=>e.links?.[0]?.description.includes(`Google developers console API activation`))?new z(U.API_NOT_ENABLED,`The Firebase AI SDK requires the Firebase AI API ('firebasevertexai.googleapis.com') to be enabled in your Firebase project. Enable this API by visiting the Firebase Console at https://console.firebase.google.com/project/${n.params.apiSettings.project}/ailogic/ and clicking "Get started". If you enabled this API recently, wait a few minutes for the action to propagate to our systems and then retry.`,{status:r.status,statusText:r.statusText,errorDetails:t}):new z(U.FETCH_ERROR,`Error fetching from ${n}: [${r.status} ${r.statusText}] ${e}`,{status:r.status,statusText:r.statusText,errorDetails:t})}}catch(e){let t=e;throw e.code!==U.FETCH_ERROR&&e.code!==U.API_NOT_ENABLED&&e instanceof Error&&e.name!==Nn&&(t=new z(U.ERROR,`Error fetching from ${n.toString()}: ${e.message}`),t.stack=e.stack),t}finally{clearTimeout(s)}return r}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function Y(e){if(e.candidates&&e.candidates.length>0){if(e.candidates.length>1&&q.warn(`This response had ${e.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`),Un(e.candidates[0]))throw new z(U.RESPONSE_ERROR,`Response error: ${Z(e)}. Response body stored in error.response`,{response:e});return!0}else return!1}function X(e,t=H.IN_CLOUD){e.candidates&&!e.candidates[0].hasOwnProperty(`index`)&&(e.candidates[0].index=0);let n=Rn(e);return n.inferenceSource=t,n}function Rn(e){return e.text=()=>{if(Y(e))return zn(e,e=>!e.thought);if(e.promptFeedback)throw new z(U.RESPONSE_ERROR,`Text not available. ${Z(e)}`,{response:e});return``},e.thoughtSummary=()=>{if(Y(e)){let t=zn(e,e=>!!e.thought);return t===``?void 0:t}else if(e.promptFeedback)throw new z(U.RESPONSE_ERROR,`Thought summary not available. ${Z(e)}`,{response:e})},e.inlineDataParts=()=>{if(Y(e))return Vn(e);if(e.promptFeedback)throw new z(U.RESPONSE_ERROR,`Data not available. ${Z(e)}`,{response:e})},e.functionCalls=()=>{if(Y(e))return Bn(e);if(e.promptFeedback)throw new z(U.RESPONSE_ERROR,`Function call not available. ${Z(e)}`,{response:e})},e}function zn(e,t){let n=[];if(e.candidates?.[0].content?.parts)for(let r of e.candidates?.[0].content?.parts)r.text&&t(r)&&n.push(r.text);return n.length>0?n.join(``):``}function Bn(e){if(!e)return;let t=[];if(e.candidates?.[0].content?.parts)for(let n of e.candidates?.[0].content?.parts)n.functionCall&&t.push(n.functionCall);if(t.length>0)return t}function Vn(e){let t=[];if(e.candidates?.[0].content?.parts)for(let n of e.candidates?.[0].content?.parts)n.inlineData&&t.push(n);if(t.length>0)return t}const Hn=[B.RECITATION,B.SAFETY,B.BLOCKLIST,B.PROHIBITED_CONTENT,B.SPII,B.MALFORMED_FUNCTION_CALL,B.IMAGE_SAFETY,B.IMAGE_PROHIBITED_CONTENT,B.IMAGE_OTHER,B.NO_IMAGE,B.IMAGE_RECITATION,B.LANGUAGE,B.UNEXPECTED_TOOL_CALL,B.TOO_MANY_TOOL_CALLS,B.MISSING_THOUGHT_SIGNATURE,B.MALFORMED_RESPONSE];function Un(e){return!!e.finishReason&&Hn.some(t=>t===e.finishReason)}function Z(e){let t=``;if((!e.candidates||e.candidates.length===0)&&e.promptFeedback)t+=`Response was blocked`,e.promptFeedback?.blockReason&&(t+=` due to ${e.promptFeedback.blockReason}`),e.promptFeedback?.blockReasonMessage&&(t+=`: ${e.promptFeedback.blockReasonMessage}`);else if(e.candidates?.[0]){let n=e.candidates[0];Un(n)&&(t+=`Candidate was blocked due to ${n.finishReason}`,n.finishMessage&&(t+=`: ${n.finishMessage}`))}return t}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function Wn(e){if(e.safetySettings?.forEach(e=>{if(e.method)throw new z(U.UNSUPPORTED,`SafetySetting.method is not supported in the the Gemini Developer API. Please remove this property.`)}),e.generationConfig?.topK){let t=Math.round(e.generationConfig.topK);t!==e.generationConfig.topK&&(q.warn(`topK in GenerationConfig has been rounded to the nearest integer to match the format for requests to the Gemini Developer API.`),e.generationConfig.topK=t)}return e}function Gn(e){return{candidates:e.candidates?qn(e.candidates):void 0,prompt:e.promptFeedback?Jn(e.promptFeedback):void 0,usageMetadata:e.usageMetadata}}function Kn(e,t){return{generateContentRequest:{model:t,...e}}}function qn(e){let t=[],n;return t&&e.forEach(e=>{let r;if(e.citationMetadata&&(r={citations:e.citationMetadata.citationSources}),e.safetyRatings&&(n=e.safetyRatings.map(e=>({...e,severity:e.severity??yn.HARM_SEVERITY_UNSUPPORTED,probabilityScore:e.probabilityScore??0,severityScore:e.severityScore??0}))),e.content?.parts?.some(e=>e?.videoMetadata))throw new z(U.UNSUPPORTED,`Part.videoMetadata is not supported in the Gemini Developer API. Please remove this property.`);let i={index:e.index,content:e.content,finishReason:e.finishReason,finishMessage:e.finishMessage,safetyRatings:n,citationMetadata:r,groundingMetadata:e.groundingMetadata,urlContextMetadata:e.urlContextMetadata};t.push(i)}),t}function Jn(e){let t=[];return e.safetyRatings.forEach(e=>{t.push({category:e.category,probability:e.probability,severity:e.severity??yn.HARM_SEVERITY_UNSUPPORTED,probabilityScore:e.probabilityScore??0,severityScore:e.severityScore??0,blocked:e.blocked})}),{blockReason:e.blockReason,safetyRatings:t,blockReasonMessage:e.blockReasonMessage}}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const Yn=/^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;async function Xn(e,t,n){let[r,i]=er(e.body.pipeThrough(new TextDecoderStream(`utf8`,{fatal:!0}))).tee(),{response:a,firstValue:o}=await Zn(i,t,n);return{stream:$n(r,t,n),response:a,firstValue:o}}async function Zn(e,t,n){let[r,i]=e.tee(),{value:a}=await r.getReader().read();return{firstValue:a,response:Qn(i,t,n)}}async function Qn(e,t,n){let r=[],i=e.getReader();for(;;){let{done:e,value:a}=await i.read();if(e){let e=tr(r);return t.backend.backendType===W.GOOGLE_AI&&(e=Gn(e)),X(e,n)}r.push(a)}}async function*$n(e,t,n){let r=e.getReader();for(;;){let{value:e,done:i}=await r.read();if(i)break;let a;a=t.backend.backendType===W.GOOGLE_AI?X(Gn(e),n):X(e,n);let o=a.candidates?.[0];!o?.content?.parts&&!o?.finishReason&&!o?.citationMetadata&&!o?.urlContextMetadata||(yield a)}}function er(e){let t=e.getReader();return new ReadableStream({start(e){let n=``;return r();function r(){return t.read().then(({value:t,done:i})=>{if(i){if(n.trim()){e.error(new z(U.PARSE_FAILED,`Failed to parse stream`));return}e.close();return}n+=t;let a=n.match(Yn),o;for(;a;){try{o=JSON.parse(a[1])}catch{e.error(new z(U.PARSE_FAILED,`Error parsing JSON response: "${a[1]}`));return}e.enqueue(o),n=n.substring(a[0].length),a=n.match(Yn)}return r()})}}})}function tr(e){let t={promptFeedback:e[e.length-1]?.promptFeedback};for(let n of e)if(n.candidates)for(let e of n.candidates){let n=e.index||0;t.candidates||=[],t.candidates[n]||(t.candidates[n]={index:e.index}),t.candidates[n].citationMetadata=e.citationMetadata,t.candidates[n].finishReason=e.finishReason,t.candidates[n].finishMessage=e.finishMessage,t.candidates[n].safetyRatings=e.safetyRatings,t.candidates[n].groundingMetadata=e.groundingMetadata;let r=e.urlContextMetadata;if(typeof r==`object`&&r&&Object.keys(r).length>0&&(t.candidates[n].urlContextMetadata=r),e.content){if(!e.content.parts)continue;t.candidates[n].content||(t.candidates[n].content={role:e.content.role||`user`,parts:[]});for(let r of e.content.parts){let e={...r};r.text!==``&&Object.keys(e).length>0&&t.candidates[n].content.parts.push(e)}}}return t}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const nr=[U.FETCH_ERROR,U.ERROR,U.API_NOT_ENABLED];async function rr(e,t,n,r){if(!t)return{response:await r(),inferenceSource:H.IN_CLOUD};switch(t.mode){case V.ONLY_ON_DEVICE:if(await t.isAvailable(e))return{response:await n(),inferenceSource:H.ON_DEVICE};throw new z(U.UNSUPPORTED,`Inference mode is ONLY_ON_DEVICE, but an on-device model is not available.`);case V.ONLY_IN_CLOUD:return{response:await r(),inferenceSource:H.IN_CLOUD};case V.PREFER_IN_CLOUD:try{return{response:await r(),inferenceSource:H.IN_CLOUD}}catch(r){if(r instanceof z&&nr.includes(r.code)&&await t.isAvailable(e))return{response:await n(),inferenceSource:H.ON_DEVICE};throw r}case V.PREFER_ON_DEVICE:return await t.isAvailable(e)?{response:await n(),inferenceSource:H.ON_DEVICE}:{response:await r(),inferenceSource:H.IN_CLOUD};default:throw new z(U.ERROR,`Unexpected infererence mode: ${t.mode}`)}}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function ir(e,t,n,r){return e.backend.backendType===W.GOOGLE_AI&&(n=Wn(n)),Ln({task:`streamGenerateContent`,model:t,apiSettings:e,stream:!0,singleRequestOptions:r},JSON.stringify(n))}async function ar(e,t,n,r,i){let a=await rr(n,r,()=>r.generateContentStream(n),()=>ir(e,t,n,i));return Xn(a.response,e,a.inferenceSource)}async function or(e,t,n,r){return e.backend.backendType===W.GOOGLE_AI&&(n=Wn(n)),Ln({model:t,task:`generateContent`,apiSettings:e,stream:!1,singleRequestOptions:r},JSON.stringify(n))}async function sr(e,t,n,r,i){let a=await rr(n,r,()=>r.generateContent(n),()=>or(e,t,n,i));return{response:X(await cr(a.response,e),a.inferenceSource)}}async function cr(e,t){let n=await e.json();return t.backend.backendType===W.GOOGLE_AI?Gn(n):n}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function lr(e){if(e!=null){if(typeof e==`string`)return{role:`system`,parts:[{text:e}]};if(e.text)return{role:`system`,parts:[e]};if(e.parts)return e.role?e:{role:`system`,parts:e.parts}}}function Q(e){let t=[];if(typeof e==`string`)t=[{text:e}];else for(let n of e)typeof n==`string`?t.push({text:n}):t.push(n);return ur(t)}function ur(e){let t={role:`user`,parts:[]},n={role:`function`,parts:[]},r=!1,i=!1;for(let a of e)`functionResponse`in a?(n.parts.push(a),i=!0):(t.parts.push(a),r=!0);if(r&&i)throw new z(U.INVALID_CONTENT,`Within a single message, FunctionResponse cannot be mixed with other type of Part in the request for sending chat message.`);if(!r&&!i)throw new z(U.INVALID_CONTENT,`No Content is provided for sending chat message.`);return r?t:n}function $(e){let t;return t=e.contents?e:{contents:[Q(e)]},e.systemInstruction&&(t.systemInstruction=lr(e.systemInstruction)),t}
/**
* @license
* Copyright 2026 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const dr=`SILENT_ERROR`;var fr=class{constructor(e,t,n){this.params=t,this.requestOptions=n,this._history=[],this._sendPromise=Promise.resolve(),this._apiSettings=e}async getHistory(){return await this._sendPromise,this._history}async _sendMessage(e,t){let n={};await this._sendPromise;let r=[];return this._sendPromise=this._sendPromise.then(async()=>{let i,a=0,o=this.requestOptions?.maxSequentialFunctionCalls??10;do{let o;i?(a++,o=Q(await this._callFunctionsAsNeeded(i))):o=Q(e);let s=this._formatRequest(o,[...r]);r.push(o);let c=await this._callGenerateContent(s,t);if(c)if(n=c,i=this._getCallableFunctionCalls(c.response),c.response.candidates&&c.response.candidates.length>0){let e={parts:c.response.candidates?.[0].content.parts||[],role:c.response.candidates?.[0].content.role||`model`};r.push(e)}else{let e=Z(c.response);e&&q.warn(`sendMessage() was unsuccessful. ${e}. Inspect response object for details.`)}else i=void 0}while(i&&a<o);i&&a>=o&&q.warn(`Automatic function calling exceeded the limit of ${o} function calls. Returning last model response.`)}),await this._sendPromise,this._history=this._history.concat(r),n}async _sendMessageStream(e,t){await this._sendPromise;let n=[],r=(async()=>{let r,i=0,a=this.requestOptions?.maxSequentialFunctionCalls??10,o;do{let a;r?(i++,a=Q(await this._callFunctionsAsNeeded(r))):a=Q(e);let s=this._formatRequest(a,[...n]);if(n.push(a),o=await this._callGenerateContentStream(s,t),r=this._getCallableFunctionCalls(o.firstValue),r&&o.firstValue&&o.firstValue.candidates&&o.firstValue.candidates.length>0){let e={...o.firstValue.candidates[0].content};e.role||=`model`,n.push(e)}}while(r&&i<a);return r&&i>=a&&q.warn(`Automatic function calling exceeded the limit of ${a} function calls. Returning last model response.`),{stream:o.stream,response:o.response}})();return this._sendPromise=this._sendPromise.then(async()=>r).catch(e=>{throw Error(dr)}).then(e=>e.response).then(e=>{if(e.candidates&&e.candidates.length>0){this._history=this._history.concat(n);let t={...e.candidates[0].content};t.role||=`model`,this._history.push(t)}else{let t=Z(e);t&&q.warn(`sendMessageStream() was unsuccessful. ${t}. Inspect response object for details.`)}}).catch(e=>{e.message!==dr&&e.name!==`AbortError`&&q.error(e)}),r}_getCallableFunctionCalls(e){let t=this.params?.tools?.find(e=>e.functionDeclarations);if(!t?.functionDeclarations)return;let n=Bn(e);if(n){for(let e of n)if(!t.functionDeclarations?.some(t=>t.name===e.name&&typeof t.functionReference==`function`))return;return n}}async _callFunctionsAsNeeded(e){let t=[],n=[],r=this.params?.tools?.find(e=>e.functionDeclarations);if(r&&r.functionDeclarations){for(let i of e){let e=r.functionDeclarations.find(e=>e.name===i.name);if(e?.functionReference){let r=Promise.resolve(e.functionReference(i.args)).catch(t=>{let n=new z(U.ERROR,`Error in user-defined function "${e.name}": ${t.message}`);throw n.stack=t.stack,n});t.push({name:i.name,id:i.id,results:r}),n.push(r)}}await Promise.all(n);let i=[];for(let{name:e,id:n,results:r}of t){let t={name:e,response:await r};n&&(t.id=n),i.push({functionResponse:t})}return i}else throw new z(U.REQUEST_ERROR,`No function declarations were provided in "tools".`)}};
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
const pr=[`text`,`inlineData`,`functionCall`,`functionResponse`,`thought`,`thoughtSignature`],mr={user:[`text`,`inlineData`],function:[`functionResponse`],model:[`text`,`functionCall`,`thought`,`thoughtSignature`],system:[`text`]},hr={user:[`model`],function:[`model`],model:[`user`,`function`],system:[]};function gr(e){let t=null;for(let n of e){let{role:e,parts:r}=n;if(!t&&e!==`user`)throw new z(U.INVALID_CONTENT,`First Content should be with role 'user', got ${e}`);if(!vn.includes(e))throw new z(U.INVALID_CONTENT,`Each item should include role field. Got ${e} but valid roles are: ${JSON.stringify(vn)}`);if(!Array.isArray(r))throw new z(U.INVALID_CONTENT,`Content should have 'parts' property with an array of Parts`);if(r.length===0)throw new z(U.INVALID_CONTENT,`Each Content should have at least one part`);let i={text:0,inlineData:0,functionCall:0,functionResponse:0,thought:0,thoughtSignature:0,executableCode:0,codeExecutionResult:0};for(let e of r)for(let t of pr)t in e&&(i[t]+=1);let a=mr[e];for(let t of pr)if(!a.includes(t)&&i[t]>0)throw new z(U.INVALID_CONTENT,`Content with role '${e}' can't contain '${t}' part`);if(t&&!hr[e].includes(t.role))throw new z(U.INVALID_CONTENT,`Content with role '${e}' can't follow '${t.role}'. Valid previous roles: ${JSON.stringify(hr)}`);t=n}}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var _r=class extends fr{constructor(e,t,n,r,i){super(e,r,i),this.model=t,this.chromeAdapter=n,this.params=r,this.requestOptions=i,r?.history&&(gr(r.history),this._history=r.history),this.params?.systemInstruction!=null&&(this.params={...this.params,systemInstruction:lr(this.params.systemInstruction)})}_formatRequest(e,t){return{safetySettings:this.params?.safetySettings,generationConfig:this.params?.generationConfig,tools:this.params?.tools,toolConfig:this.params?.toolConfig,systemInstruction:this.params?.systemInstruction,contents:[...this._history,...t,e]}}_callGenerateContent(e,t){return sr(this._apiSettings,this.model,e,this.chromeAdapter,{...this.requestOptions,...t})}_callGenerateContentStream(e,t){return ar(this._apiSettings,this.model,e,this.chromeAdapter,{...this.requestOptions,...t})}async sendMessage(e,t){return this._sendMessage(e,t)}async sendMessageStream(e,t){return this._sendMessageStream(e,t)}};
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
async function vr(e,t,n,r){let i=``;if(e.backend.backendType===W.GOOGLE_AI){let e=Kn(n,t);i=JSON.stringify(e)}else i=JSON.stringify(n);return(await Ln({model:t,task:`countTokens`,apiSettings:e,stream:!1,singleRequestOptions:r},i)).json()}async function yr(e,t,n,r,i){if(r?.mode===V.ONLY_ON_DEVICE)throw new z(U.UNSUPPORTED,`countTokens() is not supported for on-device models.`);return vr(e,t,n,i)}
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
var br=class extends Mn{constructor(e,t,n,r){super(e,t.model),this.chromeAdapter=r,this.generationConfig=t.generationConfig||{},xr(this.generationConfig),this.safetySettings=t.safetySettings||[],this.tools=t.tools,this.toolConfig=t.toolConfig,this.systemInstruction=lr(t.systemInstruction),this.requestOptions=n||{}}async initializeDeviceModel(e){if(!(!this.chromeAdapter||this.chromeAdapter.mode===V.ONLY_IN_CLOUD)){if(await this.chromeAdapter.downloadIfAvailable(e)===J.UNAVAILABLE){let e=new z(U.API_NOT_ENABLED,`Local LanguageModel API not available in this environment.`);if(this.chromeAdapter.mode===V.ONLY_ON_DEVICE)throw e;q.debug(e.message)}await this.chromeAdapter.downloadPromise}}async generateContent(e,t){let n=$(e);return sr(this._apiSettings,this.model,{generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,...n},this.chromeAdapter,{...this.requestOptions,...t})}async generateContentStream(e,t){let n=$(e),{stream:r,response:i}=await ar(this._apiSettings,this.model,{generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,...n},this.chromeAdapter,{...this.requestOptions,...t});return{stream:r,response:i}}startChat(e){return new _r(this._apiSettings,this.model,this.chromeAdapter,{tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,generationConfig:this.generationConfig,safetySettings:this.safetySettings,...e},this.requestOptions)}async countTokens(e,t){let n=$(e);return yr(this._apiSettings,this.model,n,this.chromeAdapter,{...this.requestOptions,...t})}};function xr(e){if(e.thinkingConfig?.thinkingBudget!=null&&e.thinkingConfig?.thinkingLevel)throw new z(U.UNSUPPORTED,`Cannot set both thinkingBudget and thinkingLevel in a config.`);if(e.responseSchema!=null&&e.responseJsonSchema!=null)throw new z(U.UNSUPPORTED,`Cannot set both responseSchema and responseJsonSchema in a config.`);if((e.responseSchema!=null||e.responseJsonSchema!=null)&&e.responseMimeType!==`application/json`)throw new z(U.UNSUPPORTED,`responseMimeType must be set to "application/json" if responseSchema or responseJsonSchema are set.`)}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2026 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
/**
* @license
* Copyright 2024 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function Sr(e=nt(),t){e=fe(e);let n=Qe(e,`AI`),r=t?.backend??new G,i={useLimitedUseAppCheckTokens:t?.useLimitedUseAppCheckTokens??!1},a=Sn(r),o=n.getImmediate({identifier:a});return o.options=i,o}const Cr=[`mode`,`onDeviceParams`,`inCloudParams`];function wr(e,t,n){let r=t,i;if(r.mode){for(let e of Object.keys(t))Cr.includes(e)||q.warn(`When a hybrid inference mode is specified (mode is currently set to ${r.mode}), "${e}" cannot be configured at the top level. Configuration for in-cloud and on-device must be done separately in inCloudParams and onDeviceParams. Configuration values set outside of inCloudParams and onDeviceParams will be ignored.`);i=r.inCloudParams||{model:`gemini-2.5-flash-lite`}}else i=t;if(!i.model)throw new z(U.NO_MODEL,`Must provide a model name. Example: getGenerativeModel({ model: 'my-model-name' })`);let a=e.chromeAdapterFactory?.(r.mode,typeof window>`u`?void 0:window,r.onDeviceParams),o=new br(e,i,n,a);return o._apiSettings.inferenceMode=r.mode,o}
/**
* @license
* Copyright 2025 Google LLC
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
function Tr(){w(new g(`AI`,An,`PUBLIC`).setMultipleInstances(!0)),E(hn,gn),E(hn,gn,`esm2020`)}Tr();var Er=class extends r{#e;#t;constructor(e){let{geminiApiProvider:t,modelName:r,useAppCheck:i,reCaptchaSiteKey:a,useLimitedUseAppCheckTokens:o,...s}=e;super(r||n.firebase.modelName);let c=tt(s);i&&a&&dn(c,{provider:new cn(a),isTokenAutoRefreshEnabled:!0});let l=t===`vertex`?new K:new G;this.#t=Sr(c,{backend:l,useLimitedUseAppCheckTokens:o||!0})}createSession(e,t){return this.#e=wr(this.#t,{mode:V.ONLY_IN_CLOUD,inCloudParams:t}),this.#e}async generateContent(e){let t=await this.#e.generateContent({contents:e}),n=t.response.usageMetadata?.promptTokenCount||0;return{text:t.response.text(),usage:n}}async generateContentStream(e){return(await this.#e.generateContentStream({contents:e})).stream}async countTokens(e){let{totalTokens:t}=await this.#e.countTokens({contents:e});return t}};export{Er as default};