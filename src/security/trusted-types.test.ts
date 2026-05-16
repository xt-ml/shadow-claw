import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const originalTrustedTypes = globalThis.trustedTypes;

describe("trusted-types helpers", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalTrustedTypes === undefined) {
      delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
        .trustedTypes;
    } else {
      Object.defineProperty(globalThis, "trustedTypes", {
        configurable: true,
        value: originalTrustedTypes,
      });
    }
  });

  it("falls back to sanitized strings when Trusted Types are unavailable", async () => {
    delete (globalThis as typeof globalThis & { trustedTypes?: unknown })
      .trustedTypes;

    const { sanitizeToTrustedHtml } = await import("./trusted-types.js");

    const html = sanitizeToTrustedHtml("<p>ok</p><script>alert(1)</script>");

    expect(typeof html).toBe("string");
    expect(String(html)).toContain("<p>ok</p>");
    expect(String(html)).not.toContain("<script>");
  });

  it("creates a named policy when Trusted Types are supported", async () => {
    const createPolicy = jest.fn(
      (_: string, rules: { createHTML?: (input: string) => string }) => ({
        createHTML: (input: string) => ({
          __trustedHtml: rules.createHTML?.(input) ?? input,
        }),
      }),
    );

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    const { getTrustedTypesPolicyName, sanitizeToTrustedHtml } =
      await import("./trusted-types.js");

    const html = sanitizeToTrustedHtml("<p>safe</p>") as {
      __trustedHtml: string;
    };

    expect(createPolicy).toHaveBeenCalledWith(
      getTrustedTypesPolicyName(),
      expect.objectContaining({
        createHTML: expect.any(Function),
      }),
    );
    expect(html.__trustedHtml).toContain("<p>safe</p>");
  });

  it("sets sanitized HTML through the wrapper helper", async () => {
    const { setSanitizedHtml } = await import("./trusted-types.js");
    const element = document.createElement("div");

    setSanitizedHtml(element, "<p>ok</p><script>alert(1)</script>");

    expect(element.innerHTML).toContain("<p>ok</p>");
    expect(element.innerHTML).not.toContain("<script>");
  });
});
