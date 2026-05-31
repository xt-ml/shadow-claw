import { describe, expect, it } from "@jest/globals";

import { patchServiceWorkerTrustedTypes } from "./patch-service-worker-trusted-types.js";

describe("patchServiceWorkerTrustedTypes", () => {
  it("wraps generated service worker importScripts calls with Trusted Types helper", () => {
    const source =
      'if(!self.define){let s,e={};const a=(a,c)=>(a=new URL(a+".js",c).href,e[a]||new Promise(e=>{if("document"in self){const s=document.createElement("script");s.src=a,s.onload=e,document.head.appendChild(s)}else s=a,importScripts(a),e()}).then(()=>{let s=e[a];if(!s)throw new Error(`Module ${a} didn\'t register its module`);return s}));self.define=(c,o)=>{const n=s||("document"in self?document.currentScript.src:"")||location.href;if(e[n])return;let i={};const d=s=>a(s,n),t={module:{uri:n},exports:i,require:d};e[n]=Promise.all(c.map(s=>t[s]||d(s))).then(s=>(o(...s),i))}}define(["./workbox-5262048c"],function(s){"use strict";importScripts("service-worker/fetch-proxy.js","service-worker/push-handler.js","service-worker/share-target.js"),self.addEventListener("message",s=>{s.data&&"SKIP_WAITING"===s.data.type&&self.skipWaiting()})';

    const patched = patchServiceWorkerTrustedTypes(source);

    expect(patched).toContain("shadowClawImportScripts");
    expect(patched).toContain("shadowClawServiceWorkerTrustedTypesPolicy");
    expect(patched).not.toContain(
      'importScripts("service-worker/fetch-proxy.js","service-worker/push-handler.js","service-worker/share-target.js")',
    );
  });

  it("leaves unrelated content unchanged", () => {
    const source = "console.log('ok');";

    expect(patchServiceWorkerTrustedTypes(source)).toBe(source);
  });
});
