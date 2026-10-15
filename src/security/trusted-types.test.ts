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

  it("reuses an existing named policy when createPolicy throws", async () => {
    const existingPolicy = {
      createHTML: (input: string) => ({ __trustedHtml: input }),
      createScriptURL: (input: string) => ({ __trustedScriptUrl: input }),
    };

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy: jest.fn(() => {
          throw new Error("Policy already exists");
        }),
        getPolicy: jest.fn((name: string) =>
          name === "shadowclaw" ? existingPolicy : null,
        ),
      },
    });

    const { sanitizeToTrustedHtml } = await import("./trusted-types.js");

    const html = sanitizeToTrustedHtml("<p>safe</p>") as {
      __trustedHtml: string;
    };

    expect(html.__trustedHtml).toContain("<p>safe</p>");
  });

  it("sets sanitized HTML through the wrapper helper", async () => {
    const { setSanitizedHtml } = await import("./trusted-types.js");
    const element = document.createElement("div");

    setSanitizedHtml(element, "<p>ok</p><script>alert(1)</script>");

    expect(element.innerHTML).toContain("<p>ok</p>");
    expect(element.innerHTML).not.toContain("<script>");
  });

  it("sets sanitized iframe srcdoc through the wrapper helper", async () => {
    const { setSanitizedSrcdoc } = await import("./trusted-types.js");
    const iframe = document.createElement("iframe");

    setSanitizedSrcdoc(iframe, "<p>ok</p><script>alert(1)</script>");

    expect(iframe.srcdoc).toContain("<p>ok</p>");
    expect(iframe.srcdoc).not.toContain("<script>");
  });

  it("creates a trusted script URL when Trusted Types are supported", async () => {
    const createPolicy = jest.fn(
      (_: string, rules: { createScriptURL?: (input: string) => string }) => ({
        createScriptURL: (input: string) => ({
          __trustedScriptUrl: rules.createScriptURL?.(input) ?? input,
        }),
      }),
    );

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy,
      },
    });

    const { getTrustedTypesPolicyName, toTrustedScriptUrl } =
      await import("./trusted-types.js");

    const url = toTrustedScriptUrl("blob:test") as {
      __trustedScriptUrl: string;
    };

    expect(createPolicy).toHaveBeenCalledWith(
      getTrustedTypesPolicyName(),
      expect.objectContaining({
        createScriptURL: expect.any(Function),
      }),
    );
    expect(url.__trustedScriptUrl).toBe("blob:test");
  });

  it("handles setEscapedHtml, escapeToTrustedHtml, and sanitizeSrcdocHtml", async () => {
    const { escapeToTrustedHtml, sanitizeSrcdocHtml, setEscapedHtml } =
      await import("./trusted-types.js");

    const escaped = escapeToTrustedHtml("<script>&'\"");
    expect(escaped).not.toContain("<script>");

    const srcdoc = sanitizeSrcdocHtml("<b>bold</b>");
    expect(srcdoc).toContain("<b>bold</b>");

    const element = document.createElement("div");
    const result = setEscapedHtml(element, "Hello <World>");
    expect(element.innerHTML).toContain("Hello &lt;World&gt;");
    expect(result).toBeDefined();
  });

  it("handles setTrustedSrcdoc and toTrustedHtmlPresanitized", async () => {
    const { setTrustedSrcdoc, toTrustedHtmlPresanitized } =
      await import("./trusted-types.js");

    const presanitized = toTrustedHtmlPresanitized("<p>pre</p>");
    expect(String(presanitized)).toContain("<p>pre</p>");

    const iframe = document.createElement("iframe");
    const res = setTrustedSrcdoc(iframe, "<p>iframe doc</p>");
    expect(iframe.srcdoc).toContain("<p>iframe doc</p>");
    expect(res).toBeDefined();
  });

  it("reuses existing policy when factory.getPolicy is available on first check", async () => {
    const existingPolicy = {
      createHTML: (input: string) => `existing:${input}`,
      createScriptURL: (url: string) => `existing:${url}`,
    };
    const getPolicy = jest.fn(() => existingPolicy);
    const createPolicy = jest.fn();

    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: { getPolicy, createPolicy },
    });

    const { sanitizeToTrustedHtml, toTrustedScriptUrl } =
      await import("./trusted-types.js");
    expect(sanitizeToTrustedHtml("<p>test</p>")).toContain("existing:");
    expect(toTrustedScriptUrl("https://foo.com")).toBe(
      "existing:https://foo.com",
    );
    expect(createPolicy).not.toHaveBeenCalled();
  });

  it("handles toTrustedScriptUrl fallback when policy lacks createScriptURL", async () => {
    const policyWithoutScript = {
      createHTML: (input: string) => input,
    };
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        getPolicy: () => policyWithoutScript,
        createPolicy: () => policyWithoutScript,
      },
    });

    const { toTrustedScriptUrl } = await import("./trusted-types.js");
    expect(toTrustedScriptUrl("https://example.com/script.js")).toBe(
      "https://example.com/script.js",
    );
  });

  it("handles createPolicy throwing when getPolicy is not a function", async () => {
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy: () => {
          throw new Error("Creation error");
        },
      },
    });

    const { sanitizeToTrustedHtml } = await import("./trusted-types.js");
    const res = sanitizeToTrustedHtml("<p>hello</p>");
    expect(String(res)).toContain("<p>hello</p>");
  });

  it("calls policy.createHTML in toTrustedHtmlPresanitized when policy exists", async () => {
    const customPolicy = {
      createHTML: jest.fn((input: string) => `policy:${input}`),
    };
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy: jest.fn(),
        getPolicy: () => customPolicy,
      },
    });

    const { toTrustedHtmlPresanitized } = await import("./trusted-types.js");
    expect(toTrustedHtmlPresanitized("<div>wrapped</div>")).toBe(
      "policy:<div>wrapped</div>",
    );
  });

  it("handles getPolicy returning null in catch block when createPolicy throws", async () => {
    Object.defineProperty(globalThis, "trustedTypes", {
      configurable: true,
      value: {
        createPolicy: () => {
          throw new Error("createPolicy failed");
        },
        getPolicy: () => null,
      },
    });

    const { sanitizeToTrustedHtml } = await import("./trusted-types.js");
    const res = sanitizeToTrustedHtml("<p>fallback</p>");
    expect(String(res)).toContain("<p>fallback</p>");
  });
});
