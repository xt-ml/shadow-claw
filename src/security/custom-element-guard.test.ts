import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  DEFAULT_ALLOWED_CUSTOM_ELEMENTS,
  DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS,
  getAllowedCustomElements,
  installCustomElementDomGuard,
  installCustomElementsRegistryGuard,
  isAllowedCustomElement,
  setAllowedCustomElements,
  setAllowedCustomElementHostPatterns,
  uninstallCustomElementsRegistryGuard,
} from "./custom-element-guard.js";

describe("custom-element-guard", () => {
  beforeEach(() => {
    setAllowedCustomElements(DEFAULT_ALLOWED_CUSTOM_ELEMENTS);
    setAllowedCustomElementHostPatterns(
      DEFAULT_ALLOWED_CUSTOM_ELEMENT_HOST_PATTERNS,
    );
    uninstallCustomElementsRegistryGuard();
  });

  afterEach(() => {
    uninstallCustomElementsRegistryGuard();
  });

  it("rejects unapproved custom elements by default", () => {
    expect(isAllowedCustomElement("unapproved-element")).toBe(false);
  });

  it("permits shadow-claw built-in elements", () => {
    expect(isAllowedCustomElement("shadow-claw")).toBe(true);
    expect(isAllowedCustomElement("shadow-claw-pages")).toBe(true);
  });

  it("permits approved custom elements after configuration", () => {
    setAllowedCustomElements(["my-widget", "x-postpress-feed"]);
    expect(isAllowedCustomElement("my-widget")).toBe(true);
    expect(isAllowedCustomElement("x-postpress-feed")).toBe(true);
    expect(isAllowedCustomElement("other-widget")).toBe(false);
  });

  it("blocks registration of unapproved elements when registry guard is installed", () => {
    installCustomElementsRegistryGuard();
    expect(() => {
      customElements.define("blocked-element", class extends HTMLElement {});
    }).toThrow(/Registration blocked/);
  });

  it("returns current allowed custom elements via getAllowedCustomElements", () => {
    setAllowedCustomElements(["custom-a", "custom-b"]);
    expect(getAllowedCustomElements()).toContain("custom-a");
    expect(getAllowedCustomElements()).toContain("custom-b");
  });

  it("installs DOM guard on elements without throwing", () => {
    const div = document.createElement("div");
    expect(() => installCustomElementDomGuard(div)).not.toThrow();
  });
});
