import { describe, expect, it, jest } from "@jest/globals";
import vm from "node:vm";

import { patchServiceWorkerTrustedTypes } from "./patch-service-worker-trusted-types.js";

const SERVICE_WORKER_SOURCE =
  'if(!self.define){importScripts("one.js","two.js")}';

function runPatchedServiceWorker({ trustedTypes } = {}) {
  const importScripts = jest.fn();
  const context = { importScripts, self: null, trustedTypes };
  context.self = context;

  vm.runInNewContext(
    patchServiceWorkerTrustedTypes(SERVICE_WORKER_SOURCE),
    context,
  );

  return importScripts;
}

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

  it("does not patch a service worker more than once", () => {
    const patched = patchServiceWorkerTrustedTypes(SERVICE_WORKER_SOURCE);

    expect(patchServiceWorkerTrustedTypes(patched)).toBe(patched);
  });

  it("uses the default Trusted Types policy when one already exists", () => {
    const createScriptURL = jest.fn((url) => `trusted:${url}`);
    const getPolicy = jest.fn(() => ({ createScriptURL }));
    const importScripts = runPatchedServiceWorker({
      trustedTypes: {
        createPolicy: jest.fn(),
        getPolicy,
      },
    });

    expect(getPolicy).toHaveBeenCalledWith("default");
    expect(createScriptURL).toHaveBeenCalledWith("one.js");
    expect(createScriptURL).toHaveBeenCalledWith("two.js");
    expect(importScripts).toHaveBeenCalledWith(
      "trusted:one.js",
      "trusted:two.js",
    );
  });

  it("creates a default Trusted Types policy when none exists", () => {
    const createScriptURL = jest.fn((url) => `trusted:${url}`);
    const createPolicy = jest.fn(() => ({ createScriptURL }));
    const importScripts = runPatchedServiceWorker({
      trustedTypes: {
        createPolicy,
        getPolicy: jest.fn(() => null),
      },
    });

    expect(createPolicy).toHaveBeenCalledWith("default", expect.any(Object));
    expect(createScriptURL).toHaveBeenCalledWith("one.js");
    expect(importScripts).toHaveBeenCalledWith(
      "trusted:one.js",
      "trusted:two.js",
    );
  });

  it("falls back to raw URLs when Trusted Types setup fails", () => {
    const importScripts = runPatchedServiceWorker({
      trustedTypes: {
        createPolicy: jest.fn(() => {
          throw new Error("policy already exists");
        }),
      },
    });

    expect(importScripts).toHaveBeenCalledWith("one.js", "two.js");
  });
});
