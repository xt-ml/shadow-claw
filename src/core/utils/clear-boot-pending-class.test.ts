import { describe, expect, it } from "@jest/globals";
import { clearBootPendingClass } from "./clear-boot-pending-class.js";
import {
  BOOT_PENDING_ATTR,
  BOOT_PENDING_CLASS,
  HYDRATION_PENDING_ATTR,
} from "../constants.js";

describe("clearBootPendingClass", () => {
  it("returns early if doc is undefined", () => {
    expect(() => clearBootPendingClass(undefined as any)).not.toThrow();
  });

  it("removes boot pending and prerender override classes from documentElement", () => {
    document.documentElement.classList.add(
      BOOT_PENDING_CLASS,
      "sc-prerender-override",
    );

    clearBootPendingClass(document);

    expect(
      document.documentElement.classList.contains(BOOT_PENDING_CLASS),
    ).toBe(false);
    expect(
      document.documentElement.classList.contains("sc-prerender-override"),
    ).toBe(false);
  });

  it("removes attributes from shadow-claw element if present", () => {
    const host = document.createElement("shadow-claw");
    host.setAttribute(BOOT_PENDING_ATTR, "true");
    host.setAttribute(HYDRATION_PENDING_ATTR, "true");
    document.body.appendChild(host);

    try {
      clearBootPendingClass(document);
      expect(host.hasAttribute(BOOT_PENDING_ATTR)).toBe(false);
      expect(host.hasAttribute(HYDRATION_PENDING_ATTR)).toBe(false);
    } finally {
      host.remove();
    }
  });
});
