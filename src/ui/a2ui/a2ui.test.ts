/**
 * Tests for a2ui.ts core constants and types.
 *
 * Covers:
 * - Catalog identifiers (A2UI_BASIC_CATALOG_ID)
 * - New envelope types (callFunction, actionResponse)
 * - A2UIClientCapabilities type
 *
 * Note: Utility functions (resolveDynamicString, formatA2UIActionPrompt, etc.)
 * are tested in their respective files under utils/*.
 */

import { A2UI_AVAILABLE_CATALOGS, A2UI_BASIC_CATALOG_ID } from "./types.js";

import type {
  A2UIActionResponse,
  A2UICallFunction,
  A2UIClientCapabilities,
} from "./types.js";

// ---------------------------------------------------------------------------
// Catalog identifiers
// ---------------------------------------------------------------------------

describe("A2UI catalog constants", () => {
  it("exports only the Basic catalog ID — Minimal was invented and removed", () => {
    expect(A2UI_AVAILABLE_CATALOGS).toHaveLength(1);
    expect(A2UI_AVAILABLE_CATALOGS[0]).toBe(A2UI_BASIC_CATALOG_ID);
  });

  it("Basic catalog ID matches the official v1.0 URL", () => {
    expect(A2UI_BASIC_CATALOG_ID).toBe(
      "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
    );
  });

  it("does not export A2UI_MINIMAL_CATALOG_ID", async () => {
    // Import the module and confirm the symbol is absent.
    const mod = await import("./types.js");
    expect((mod as any).A2UI_MINIMAL_CATALOG_ID).toBeUndefined();
  });
});

describe("A2UICallFunction envelope type", () => {
  it("constructs a valid callFunction envelope", () => {
    const env: A2UICallFunction = {
      type: "callFunction",
      surfaceId: "s1",
      callId: "call-1",
      call: { call: "formatString", args: { value: "Hi ${/name}" } },
    };
    expect(env.type).toBe("callFunction");
    expect(env.callId).toBe("call-1");
  });
});

describe("A2UIActionResponse envelope type", () => {
  it("constructs a valid actionResponse envelope", () => {
    const env: A2UIActionResponse = {
      type: "actionResponse",
      surfaceId: "s1",
      actionId: "submit",
      value: "done",
      responsePath: "/result",
    };
    expect(env.type).toBe("actionResponse");
    expect(env.responsePath).toBe("/result");
  });
});

describe("A2UIClientCapabilities type", () => {
  it("can describe full renderer capabilities", () => {
    const caps: A2UIClientCapabilities = {
      versions: ["v1.0"],
      catalogs: [A2UI_BASIC_CATALOG_ID],
      supportsCallFunction: true,
      supportsChecks: true,
      supportsIndexBuiltin: true,
      supportsActionResponse: true,
      supportsSendDataModel: true,
    };
    expect(caps.versions).toContain("v1.0");
    expect(caps.catalogs[0]).toBe(A2UI_BASIC_CATALOG_ID);
    expect(caps.supportsCallFunction).toBe(true);
  });
});
