import { describe, expect, it, jest } from "@jest/globals";
import {
  PageScriptDependencySource,
  resolvePageScriptDependencies,
} from "./resolve-page-script-dependencies.js";

describe("resolvePageScriptDependencies", () => {
  const sampleDescriptors: PageScriptDependencySource[] = [
    {
      id: "feed-scroller",
      src: "/pages/main/assets/feed-scroller.js",
      global: true,
      hasInit: true,
    },
    {
      id: "x-hook-component",
      src: "/pages/main/assets/x-hook-component.js",
      hasInit: true,
    },
    {
      name: "x-postpress-code",
      src: "/pages/main/assets/x-postpress-code.js",
      hasInit: true,
    },
    {
      src: "/pages/main/assets/utility-logger.js",
    },
  ];

  it("returns empty array when descriptors are empty and no frontmatter provided", () => {
    expect(resolvePageScriptDependencies([], null)).toEqual([]);
    expect(resolvePageScriptDependencies(undefined as any, undefined)).toEqual(
      [],
    );
  });

  it("always includes global or autoload scripts even if frontmatter is empty or null", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, null);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("feed-scroller");
  });

  it("resolves dependencies specified by id in frontmatter.dependencies", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["x-hook-component"],
    });
    expect(result.map((r) => r.src)).toEqual([
      "/pages/main/assets/feed-scroller.js",
      "/pages/main/assets/x-hook-component.js",
    ]);
  });

  it("resolves dependencies case-insensitively", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["X-Hook-Component"],
    });
    expect(result.some((r) => r.id === "x-hook-component")).toBe(true);
  });

  it("resolves dependencies specified by name", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["x-postpress-code"],
    });
    expect(result.some((r) => r.name === "x-postpress-code")).toBe(true);
  });

  it("resolves dependencies specified by src path", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["/pages/main/assets/utility-logger.js"],
    });
    expect(
      result.some((r) => r.src === "/pages/main/assets/utility-logger.js"),
    ).toBe(true);
  });

  it("resolves dependencies with normalized relative paths", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["pages/main/assets/utility-logger.js"],
    });
    expect(
      result.some((r) => r.src === "/pages/main/assets/utility-logger.js"),
    ).toBe(true);
  });

  it("resolves dependencies from frontmatter.scripts array", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      scripts: ["x-hook-component", "x-postpress-code"],
    });
    expect(result.map((r) => r.src)).toEqual([
      "/pages/main/assets/feed-scroller.js",
      "/pages/main/assets/x-hook-component.js",
      "/pages/main/assets/x-postpress-code.js",
    ]);
  });

  it("resolves dependencies when provided as a comma-separated string", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: "x-hook-component, x-postpress-code",
    });
    expect(result.map((r) => r.src)).toEqual([
      "/pages/main/assets/feed-scroller.js",
      "/pages/main/assets/x-hook-component.js",
      "/pages/main/assets/x-postpress-code.js",
    ]);
  });

  it("handles string descriptors seamlessly", () => {
    const stringDescriptors = [
      "/pages/main/assets/global-one.js",
      { id: "widget", src: "/pages/main/assets/widget.js" },
    ];
    const result = resolvePageScriptDependencies(stringDescriptors as any, {
      dependencies: ["widget"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].src).toBe("/pages/main/assets/widget.js");
  });

  it("deduplicates results if a global script is also explicitly requested", () => {
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["feed-scroller", "x-hook-component"],
    });
    expect(result).toHaveLength(2);
    expect(
      result.filter((r) => r.src === "/pages/main/assets/feed-scroller.js"),
    ).toHaveLength(1);
  });

  it("gracefully ignores missing or unknown ids without throwing an error", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolvePageScriptDependencies(sampleDescriptors, {
      dependencies: ["non-existent-script-id", "x-hook-component"],
    });

    expect(result.map((r) => r.src)).toEqual([
      "/pages/main/assets/feed-scroller.js",
      "/pages/main/assets/x-hook-component.js",
    ]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("gracefully handles completely invalid or unresolvable dependencies", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolvePageScriptDependencies(
      [{ id: "known", src: "/known.js" }],
      { dependencies: ["unknown-a", "unknown-b"] },
    );

    expect(result).toEqual([]);
    warnSpy.mockRestore();
  });

  describe("graceful fallback for existing configs without id", () => {
    const legacyDescriptors = [
      { src: "/pages/main/assets/feed-scroller.js", global: true },
      { src: "/pages/main/assets/x-hook-component.js" },
      { src: "/pages/main/assets/x-postpress-code.js" },
    ];

    it("matches dependency by stem when existing config has no id", () => {
      const result = resolvePageScriptDependencies(legacyDescriptors, {
        dependencies: ["x-hook-component"],
      });
      expect(result.map((r) => r.src)).toEqual([
        "/pages/main/assets/feed-scroller.js",
        "/pages/main/assets/x-hook-component.js",
      ]);
    });

    it("matches dependency by filename with extension when existing config has no id", () => {
      const result = resolvePageScriptDependencies(legacyDescriptors, {
        dependencies: ["x-postpress-code.js"],
      });
      expect(result.map((r) => r.src)).toEqual([
        "/pages/main/assets/feed-scroller.js",
        "/pages/main/assets/x-postpress-code.js",
      ]);
    });

    it("fails gracefully and renders best-effort if an id is missing from existing config", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      // Frontmatter requests an unknown id AND a valid legacy script
      const result = resolvePageScriptDependencies(legacyDescriptors, {
        dependencies: ["non-existent-widget", "x-hook-component"],
      });

      // Best effort: successfully resolves the known script and global script, ignores missing
      expect(result.map((r) => r.src)).toEqual([
        "/pages/main/assets/feed-scroller.js",
        "/pages/main/assets/x-hook-component.js",
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Script dependency "non-existent-widget"'),
      );
      warnSpy.mockRestore();
    });

    it("supports string array config without ids matching by stem", () => {
      const stringArrayConfig = [
        "/pages/main/assets/feed-scroller.js",
        "/pages/main/assets/x-hook-component.js",
      ];
      const result = resolvePageScriptDependencies(stringArrayConfig, {
        dependencies: ["x-hook-component"],
      });
      expect(result.map((r) => r.src)).toEqual([
        "/pages/main/assets/x-hook-component.js",
      ]);
    });
  });

  describe("content-based auto-detection", () => {
    it("automatically detects inline script tags in markdown content", () => {
      const rawContent = `
# Title
Some text
<script type="module" src="/pages/main/assets/x-postpress-code.js"></script>
      `;
      const result = resolvePageScriptDependencies(
        sampleDescriptors,
        null,
        rawContent,
      );
      expect(result.map((r) => r.src)).toContain(
        "/pages/main/assets/x-postpress-code.js",
      );
    });

    it("automatically detects custom element tags matching descriptors in markdown content", () => {
      const rawContent = `
# Post
<x-postpress-code type="html"><pre>code</pre></x-postpress-code>
      `;
      const result = resolvePageScriptDependencies(
        sampleDescriptors,
        null,
        rawContent,
      );
      expect(result.map((r) => r.src)).toContain(
        "/pages/main/assets/x-postpress-code.js",
      );
    });
  });
});
