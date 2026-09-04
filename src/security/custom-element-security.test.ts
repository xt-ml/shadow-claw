import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

import {
  configureCustomElementSecurity,
  DEFAULT_ALLOWED_CUSTOM_ELEMENTS,
  DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS,
  DEFAULT_IFRAME_SANDBOX_POLICY,
  getAllowedCustomElementHostPatterns,
  getAllowedCustomElements,
  getApprovedCustomElementScriptDescriptors,
  getApprovedCustomElementScripts,
  getCustomElementPurifyConfig,
  getIframeCsp,
  getIframeSandboxPolicy,
  installCustomElementDomGuard,
  installCustomElementsRegistryGuard,
  isAllowedCustomElement,
  isSafeCustomElementSource,
  loadApprovedCustomElementScript,
  loadCustomElementSecurityFromDb,
  setAllowedCustomElementHostPatterns,
  setAllowedCustomElements,
  setIframeSandboxPolicy,
  uninstallCustomElementsRegistryGuard,
} from "./custom-element-security.js";
import { sanitizeHtml } from "../utils/utils.js";
import { CONFIG_KEYS } from "../config/config.js";

describe("custom-element-security", () => {
  beforeEach(() => {
    // Reset to defaults
    setAllowedCustomElements(DEFAULT_ALLOWED_CUSTOM_ELEMENTS);
    setAllowedCustomElementHostPatterns(
      DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS,
    );
    uninstallCustomElementsRegistryGuard();
  });

  afterEach(() => {
    uninstallCustomElementsRegistryGuard();
  });

  describe("isAllowedCustomElement", () => {
    it("rejects custom elements by default", () => {
      expect(isAllowedCustomElement("block-garden")).toBe(false);
      expect(isAllowedCustomElement("sprite-garden")).toBe(false);
      expect(isAllowedCustomElement("x-pwgen")).toBe(false);
      expect(isAllowedCustomElement("malicious-tag")).toBe(false);
    });

    it("always permits built-in shadow-claw elements", () => {
      expect(isAllowedCustomElement("shadow-claw")).toBe(true);
      expect(isAllowedCustomElement("shadow-claw-pages")).toBe(true);
      expect(isAllowedCustomElement("shadow-claw-chat")).toBe(true);
      expect(isAllowedCustomElement("shadow-claw-dialog")).toBe(true);
    });

    it("permits standard non-custom HTML tags", () => {
      expect(isAllowedCustomElement("div")).toBe(true);
      expect(isAllowedCustomElement("p")).toBe(true);
      expect(isAllowedCustomElement("span")).toBe(true);
      expect(isAllowedCustomElement("article")).toBe(true);
    });

    it("allows configured custom elements", () => {
      setAllowedCustomElements(["block-garden", "sprite-garden", "x-pwgen"]);

      expect(isAllowedCustomElement("block-garden")).toBe(true);
      expect(isAllowedCustomElement("sprite-garden")).toBe(true);
      expect(isAllowedCustomElement("x-pwgen")).toBe(true);
      expect(isAllowedCustomElement("BLOCK-GARDEN")).toBe(true);
      expect(isAllowedCustomElement("unapproved-element")).toBe(false);
    });
  });

  describe("isSafeCustomElementSource", () => {
    it("rejects external domains by default", () => {
      expect(
        isSafeCustomElementSource(
          "https://kherrick.github.io/block-garden/index.mjs",
        ),
      ).toBe(false);
      expect(
        isSafeCustomElementSource("https://evil.com/block-garden/index.mjs"),
      ).toBe(false);
    });

    it("allows blob URLs and same-origin relative URLs", () => {
      expect(isSafeCustomElementSource("blob:http://localhost/1234")).toBe(
        true,
      );
      expect(isSafeCustomElementSource("/assets/script.js")).toBe(true);
      expect(isSafeCustomElementSource("./local-component.mjs")).toBe(true);
    });

    it("rejects javascript: and data: URIs", () => {
      expect(isSafeCustomElementSource("javascript:alert(1)")).toBe(false);
      expect(isSafeCustomElementSource("data:text/javascript,alert(1)")).toBe(
        false,
      );
    });

    it("allows URLs matching approved domain patterns", () => {
      setAllowedCustomElementHostPatterns([
        "kherrick.github.io",
        "xt-ml.github.io",
      ]);

      expect(
        isSafeCustomElementSource(
          "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
        ),
      ).toBe(true);
      expect(
        isSafeCustomElementSource(
          "https://xt-ml.github.io/components/engine.mjs",
        ),
      ).toBe(true);
      expect(
        isSafeCustomElementSource("https://attacker.github.io/malicious.js"),
      ).toBe(false);
      expect(isSafeCustomElementSource("https://evil.com/bundle.js")).toBe(
        false,
      );
    });
  });

  describe("configureCustomElementSecurity", () => {
    it("configures security from structured site-config object", () => {
      configureCustomElementSecurity({
        customElements: {
          allowedElements: ["block-garden", "sprite-garden"],
          allowedDomains: ["kherrick.github.io", "xt-ml.github.io"],
        },
      });

      expect(getAllowedCustomElements()).toEqual([
        "block-garden",
        "sprite-garden",
      ]);
      expect(getAllowedCustomElementHostPatterns()).toEqual([
        "kherrick.github.io",
        "xt-ml.github.io",
      ]);
      expect(isAllowedCustomElement("block-garden")).toBe(true);
      expect(
        isSafeCustomElementSource(
          "https://kherrick.github.io/block-garden/index.mjs",
        ),
      ).toBe(true);
    });
  });

  describe("installCustomElementsRegistryGuard", () => {
    it("blocks registration of unapproved custom elements by throwing", () => {
      setAllowedCustomElements(["block-garden"]);
      installCustomElementsRegistryGuard();

      class BlockGardenEl extends HTMLElement {}
      class UnapprovedEl extends HTMLElement {}

      expect(() => {
        customElements.define("block-garden", BlockGardenEl);
      }).not.toThrow();

      expect(() => {
        customElements.define("unapproved-el", UnapprovedEl);
      }).toThrow(/Registration blocked: <unapproved-el>/);
    });
  });

  describe("DOMPurify integration via sanitizeHtml", () => {
    it("strips unapproved custom elements during sanitization", () => {
      setAllowedCustomElements([]);

      const dirty = `
        <article>
          <h1>Test</h1>
          <block-garden id="game"></block-garden>
          <unapproved-tag>Secret</unapproved-tag>
        </article>
      `;

      const clean = sanitizeHtml(dirty);

      expect(clean).toContain("<h1>Test</h1>");
      expect(clean).not.toContain("<block-garden");
      expect(clean).not.toContain("<unapproved-tag");
    });

    it("preserves approved custom elements during sanitization", () => {
      setAllowedCustomElements(["block-garden", "sprite-garden"]);

      const dirty = `
        <article>
          <h1>Meadow</h1>
          <block-garden class="garden-view"></block-garden>
          <sprite-garden></sprite-garden>
          <evil-widget></evil-widget>
        </article>
      `;

      const clean = sanitizeHtml(dirty);

      expect(clean).toContain("<h1>Meadow</h1>");
      expect(clean).toContain(
        '<block-garden class="garden-view"></block-garden>',
      );
      expect(clean).toContain("<sprite-garden></sprite-garden>");
      expect(clean).not.toContain("<evil-widget");
    });
  });

  describe("installCustomElementDomGuard", () => {
    it("removes unapproved custom element nodes added to the DOM", async () => {
      setAllowedCustomElements(["block-garden"]);

      const container = document.createElement("div");
      document.body.appendChild(container);

      const observer = installCustomElementDomGuard(container);

      const approved = document.createElement("block-garden");
      const unapproved = document.createElement("unapproved-tag");

      container.appendChild(approved);
      container.appendChild(unapproved);

      // Wait for MutationObserver callback microtask
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(container.contains(approved)).toBe(true);
      expect(container.contains(unapproved)).toBe(false);

      observer?.disconnect();
      container.remove();
    });
  });

  describe("getCustomElementPurifyConfig", () => {
    it("returns purify config matching current allowlist", () => {
      setAllowedCustomElements(["block-garden"]);
      const config = getCustomElementPurifyConfig();

      expect(config.CUSTOM_ELEMENT_HANDLING?.tagNameCheck).toBeDefined();
      if (typeof config.CUSTOM_ELEMENT_HANDLING?.tagNameCheck === "function") {
        expect(
          config.CUSTOM_ELEMENT_HANDLING.tagNameCheck("block-garden"),
        ).toBe(true);
        expect(
          config.CUSTOM_ELEMENT_HANDLING.tagNameCheck("unapproved-el"),
        ).toBe(false);
      }
    });
  });

  describe("loadCustomElementSecurityFromDb", () => {
    it("loads config from database", async () => {
      const storeData: Record<string, string> = {
        [CONFIG_KEYS.ALLOWED_CUSTOM_ELEMENTS]: JSON.stringify([
          "block-garden",
          "x-pwgen",
        ]),
        [CONFIG_KEYS.ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS]: JSON.stringify([
          "kherrick.github.io",
        ]),
      };

      const mockDb: any = {
        transaction: () => ({
          objectStore: () => ({
            get: (key: string) => {
              const req: any = {
                result: storeData[key]
                  ? { key, value: storeData[key] }
                  : undefined,
              };
              setTimeout(() => req.onsuccess?.(), 0);

              return req;
            },
          }),
        }),
      };

      await loadCustomElementSecurityFromDb(mockDb);

      expect(isAllowedCustomElement("block-garden")).toBe(true);
      expect(isAllowedCustomElement("x-pwgen")).toBe(true);
      expect(isAllowedCustomElement("unapproved-tag")).toBe(false);
      expect(
        isSafeCustomElementSource(
          "https://kherrick.github.io/pwgen/dist/lib/esm/component/XPwgen.js",
        ),
      ).toBe(true);
    });
  });

  describe("loadApprovedCustomElementScript", () => {
    it("rejects loading scripts from unapproved domains", async () => {
      setAllowedCustomElementHostPatterns(["kherrick.github.io"]);

      await expect(
        loadApprovedCustomElementScript("https://evil.com/malicious.js"),
      ).rejects.toThrow(/Refused to load script from unapproved host/);
    });

    it("appends script for approved domains", async () => {
      setAllowedCustomElementHostPatterns(["kherrick.github.io"]);

      const scriptPromise = loadApprovedCustomElementScript(
        "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
      );

      const injected = document.querySelector(
        'script[src="https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs"]',
      ) as HTMLScriptElement;

      expect(injected).not.toBeNull();
      expect(injected.type).toBe("module");

      // Trigger onload to complete promise
      injected.onload?.(new Event("load"));

      const scriptEl = await scriptPromise;
      expect(scriptEl).toBe(injected);
    });
  });

  describe("embedded site-config initialization", () => {
    it("synchronously seeds allowed custom elements and host patterns from DOM script tag during installCustomElementsRegistryGuard", () => {
      const siteConfigScript = document.createElement("script");
      siteConfigScript.id = "shadow-claw-site-config";
      siteConfigScript.type = "application/json";
      siteConfigScript.textContent = JSON.stringify({
        customElements: {
          allowedElements: [
            "block-garden",
            "block-garden-select",
            "block-garden-option",
          ],
          allowedDomains: ["kherrick.github.io"],
        },
      });
      document.head.appendChild(siteConfigScript);

      try {
        installCustomElementsRegistryGuard();

        expect(isAllowedCustomElement("block-garden")).toBe(true);
        expect(isAllowedCustomElement("block-garden-select")).toBe(true);
        expect(isAllowedCustomElement("block-garden-option")).toBe(true);
        expect(isAllowedCustomElement("unapproved-element")).toBe(false);

        class MockBlockGardenSelect extends HTMLElement {}
        class MockBlockGardenOption extends HTMLElement {}

        expect(() => {
          customElements.define("block-garden-select", MockBlockGardenSelect);
        }).not.toThrow();

        expect(() => {
          customElements.define("block-garden-option", MockBlockGardenOption);
        }).not.toThrow();
      } finally {
        siteConfigScript.remove();
      }
    });

    it("configures iframe sandbox policy and extracts approved scripts from embedded config", () => {
      const siteConfigScript = document.createElement("script");
      siteConfigScript.id = "shadow-claw-site-config";
      siteConfigScript.type = "application/json";
      siteConfigScript.textContent = JSON.stringify({
        customElements: {
          allowedElements: ["block-garden"],
          allowedDomains: ["kherrick.github.io"],
          scripts: [
            "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
            "https://unapproved.example.com/evil.js",
          ],
        },
        security: {
          iframeSandbox: [
            "allow-modals",
            "allow-scripts",
            "allow-popups",
            "allow-popups-to-escape-sandbox",
            "allow-same-origin",
          ],
        },
      });
      document.head.appendChild(siteConfigScript);

      try {
        installCustomElementsRegistryGuard();

        expect(getIframeSandboxPolicy()).toContain("allow-same-origin");
        expect(getApprovedCustomElementScripts()).toEqual([
          "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
        ]);
        expect(getApprovedCustomElementScriptDescriptors()).toEqual([
          {
            src: "https://kherrick.github.io/block-garden/block-garden-bundle-min.mjs",
            hasInit: false,
          },
        ]);

        const csp = getIframeCsp("test-nonce");
        expect(csp).toContain("script-src 'nonce-test-nonce'");
        expect(csp).toContain("https://kherrick.github.io");
        expect(csp).toContain("worker-src 'self' blob: data:");
        expect(csp).toContain("connect-src 'self' blob: data:");
      } finally {
        siteConfigScript.remove();
        setIframeSandboxPolicy(DEFAULT_IFRAME_SANDBOX_POLICY);
      }
    });

    it("parses object script descriptors with src and hasInit", () => {
      const siteConfigScript = document.createElement("script");
      siteConfigScript.id = "shadow-claw-site-config";
      siteConfigScript.type = "application/json";
      siteConfigScript.textContent = JSON.stringify({
        customElements: {
          allowedDomains: ["kherrick.github.io"],
          scripts: [
            { src: ".agents/scripts/main/pwgen-adapter.js", hasInit: true },
            { src: "https://kherrick.github.io/x-pwgen.js", hasInit: false },
            "local-element.js",
          ],
        },
      });
      document.head.appendChild(siteConfigScript);

      try {
        installCustomElementsRegistryGuard();

        expect(getApprovedCustomElementScripts()).toEqual([
          ".agents/scripts/main/pwgen-adapter.js",
          "https://kherrick.github.io/x-pwgen.js",
          "local-element.js",
        ]);
        expect(getApprovedCustomElementScriptDescriptors()).toEqual([
          {
            src: ".agents/scripts/main/pwgen-adapter.js",
            hasInit: true,
          },
          {
            src: "https://kherrick.github.io/x-pwgen.js",
            hasInit: false,
          },
          {
            src: "local-element.js",
            hasInit: false,
          },
        ]);
      } finally {
        uninstallCustomElementsRegistryGuard();
        siteConfigScript.remove();
      }
    });
  });
});
