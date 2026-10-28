import { describe, expect, it, beforeEach, afterEach } from "@jest/globals";
import { getSiteConfig, resetSiteConfigCache } from "./site-config.js";

describe("site-config", () => {
  beforeEach(() => {
    resetSiteConfigCache();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    resetSiteConfigCache();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("returns null when no site config script is in DOM", () => {
    expect(getSiteConfig()).toBeNull();
  });

  it("parses valid JSON from shadow-claw-site-config", () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-site-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      site: { title: "Custom Title" },
      sidebar: { pagesHidden: true },
    });
    document.head.appendChild(script);

    const config = getSiteConfig();
    expect(config).toBeDefined();
    expect(config?.site?.title).toBe("Custom Title");
    expect(config?.sidebar?.pagesHidden).toBe(true);
  });

  it("preserves settings and agent sections independently", () => {
    const script = document.createElement("script");
    script.id = "shadow-claw-site-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      settings: {
        defaultProvider: "gemini",
        defaultModel: "gemini-1.5-pro",
      },
      agent: {
        defaultProvider: "transformers_js_local",
        defaultModel: "onnx-community/gemma-4-E2B-it-ONNX",
      },
    });
    document.head.appendChild(script);

    const config = getSiteConfig();
    expect(config?.settings?.defaultProvider).toBe("gemini");
    expect(config?.settings?.defaultModel).toBe("gemini-1.5-pro");
    expect(config?.agent?.defaultProvider).toBe("transformers_js_local");
    expect(config?.agent?.defaultModel).toBe(
      "onnx-community/gemma-4-E2B-it-ONNX",
    );
  });

  it("supports custom script element ID via config attribute on host element", () => {
    const script = document.createElement("script");
    script.id = "my-special-config";
    script.type = "application/json";
    script.textContent = JSON.stringify({
      site: { title: "Scoped Instance" },
    });
    document.head.appendChild(script);

    const host = document.createElement("shadow-claw");
    host.setAttribute("config", "#my-special-config");
    document.body.appendChild(host);

    const config = getSiteConfig(host);
    expect(config?.site?.title).toBe("Scoped Instance");
  });
});
