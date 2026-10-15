import { jest } from "@jest/globals";
import {
  resolveDiscoveryUrl,
  resolveManifestRelativeUrl,
  resolveManifestUrls,
  verifySha256Digest,
  fetchDiscoveryManifest,
} from "./discovery.js";
import type { RemoteManifest } from "./types.js";

describe("discovery", () => {
  describe("resolveDiscoveryUrl", () => {
    it("resolves base site URL to .well-known/agent-skills/index.json", () => {
      const res = resolveDiscoveryUrl(
        "https://kherrick.github.io/pwgen-knowledge-hub",
      );
      expect(res.siteUrl).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub",
      );
      expect(res.manifestUrl).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json",
      );
    });

    it("handles trailing slashes on base site URL", () => {
      const res = resolveDiscoveryUrl(
        "https://kherrick.github.io/block-garden-knowledge-hub/",
      );
      expect(res.siteUrl).toBe(
        "https://kherrick.github.io/block-garden-knowledge-hub",
      );
      expect(res.manifestUrl).toBe(
        "https://kherrick.github.io/block-garden-knowledge-hub/.well-known/agent-skills/index.json",
      );
    });

    it("preserves explicit manifest URL and computes siteUrl", () => {
      const res = resolveDiscoveryUrl(
        "https://example.com/demo/.well-known/agent-skills/index.json",
      );
      expect(res.siteUrl).toBe("https://example.com/demo");
      expect(res.manifestUrl).toBe(
        "https://example.com/demo/.well-known/agent-skills/index.json",
      );
    });

    it("throws when URL is empty or whitespace", () => {
      expect(() => resolveDiscoveryUrl("")).toThrow("URL cannot be empty");
      expect(() => resolveDiscoveryUrl("   ")).toThrow("URL cannot be empty");
    });

    it("prepends https:// when protocol is missing and supports http://", () => {
      const res1 = resolveDiscoveryUrl("example.com/skills");
      expect(res1.siteUrl).toBe("https://example.com/skills");
      expect(res1.manifestUrl).toBe(
        "https://example.com/skills/.well-known/agent-skills/index.json",
      );

      const res2 = resolveDiscoveryUrl("http://localhost:8080");
      expect(res2.siteUrl).toBe("http://localhost:8080");
      expect(res2.manifestUrl).toBe(
        "http://localhost:8080/.well-known/agent-skills/index.json",
      );
    });
  });

  describe("resolveManifestRelativeUrl", () => {
    const manifestUrl =
      "https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json";

    it("returns empty string if relativeUrl is falsy", () => {
      expect(resolveManifestRelativeUrl("", manifestUrl)).toBe("");
      expect(resolveManifestRelativeUrl(undefined as any, manifestUrl)).toBe(
        "",
      );
    });

    it("falls back to relativeUrl if URL resolution fails", () => {
      // Invalid URL base or relative URL that throws
      const invalidBase = "http://[invalid:host";
      expect(resolveManifestRelativeUrl("test/path", invalidBase)).toBe(
        "test/path",
      );
    });

    it("resolves RFC 3986 relative tool path against manifest directory", () => {
      const resolved = resolveManifestRelativeUrl(
        "../../.agents/tools/main/pwgen.json",
        manifestUrl,
      );
      expect(resolved).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/tools/main/pwgen.json",
      );
    });

    it("resolves relative script path against manifest directory", () => {
      const resolved = resolveManifestRelativeUrl(
        "../../.agents/scripts/main/pwgen.js",
        manifestUrl,
      );
      expect(resolved).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/scripts/main/pwgen.js",
      );
    });

    it("returns absolute URLs unchanged", () => {
      const absoluteUrl = "https://cdn.example.com/tools/echo.json";
      expect(resolveManifestRelativeUrl(absoluteUrl, manifestUrl)).toBe(
        absoluteUrl,
      );
    });
  });

  describe("resolveManifestUrls", () => {
    const manifestUrl =
      "https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json";

    it("handles manifest without tools, scripts, or skills arrays", () => {
      const rawManifest: RemoteManifest = {
        name: "Empty Hub",
      };
      const resolved = resolveManifestUrls(rawManifest, manifestUrl);
      expect(resolved.name).toBe("Empty Hub");
      expect(resolved.tools).toBeUndefined();
      expect(resolved.scripts).toBeUndefined();
      expect(resolved.skills).toBeUndefined();
    });

    it("resolves all tool, script, and skill URLs in manifest including optional URLs in nested items", () => {
      const rawManifest: RemoteManifest = {
        name: "pwgen Knowledge Hub",
        tools: [
          {
            name: "pwgen",
            url: "../../.agents/tools/main/pwgen.json",
            digest: "sha256:1234",
          },
        ],
        scripts: [
          {
            name: "pwgen",
            url: "../../.agents/scripts/main/pwgen.js",
          },
        ],
        skills: [
          {
            name: "pwgen-entropy",
            url: "../../.agents/skills/main/pwgen-entropy/SKILL.md",
            tools: [
              {
                name: "pwgen_entropy",
                url: "../../.agents/tools/main/pwgen_entropy.json",
              },
              {
                name: "tool_without_url",
                url: "",
              },
            ],
            scripts: [
              { name: "pwgen", url: "../../.agents/scripts/main/pwgen.js" },
              { name: "script_without_url", url: "" },
            ],
          },
          {
            name: "skill-without-arrays",
            url: "https://example.com/skill.md",
          },
        ],
      };

      const resolved = resolveManifestUrls(rawManifest, manifestUrl);
      expect(resolved.tools?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/tools/main/pwgen.json",
      );
      expect(resolved.scripts?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/scripts/main/pwgen.js",
      );
      expect(resolved.skills?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/skills/main/pwgen-entropy/SKILL.md",
      );
      expect(resolved.skills?.[0].tools?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/tools/main/pwgen_entropy.json",
      );
      expect(resolved.skills?.[0].tools?.[1].url).toBeUndefined();
      expect(resolved.skills?.[0].scripts?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/scripts/main/pwgen.js",
      );
      expect(resolved.skills?.[0].scripts?.[1].url).toBeUndefined();
      expect(resolved.skills?.[1].tools).toBeUndefined();
      expect(resolved.skills?.[1].scripts).toBeUndefined();
    });
  });

  describe("verifySha256Digest", () => {
    it("validates matching sha256 digest string", async () => {
      const text = "hello world";
      // echo -n "hello world" | sha256sum -> b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
      const expectedDigest =
        "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
      const valid = await verifySha256Digest(text, expectedDigest);
      expect(valid).toBe(true);
    });

    it("supports Uint8Array content", async () => {
      const bytes = new TextEncoder().encode("hello world");
      const expectedDigest =
        "sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
      expect(await verifySha256Digest(bytes, expectedDigest)).toBe(true);
    });

    it("rejects non-matching sha256 digest string", async () => {
      const text = "hello world";
      const wrongDigest =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      const valid = await verifySha256Digest(text, wrongDigest);
      expect(valid).toBe(false);
    });

    it("returns true if expected digest is empty or not sha256 prefixed", async () => {
      expect(await verifySha256Digest("test", "")).toBe(true);
      expect(await verifySha256Digest("test", undefined as any)).toBe(true);
      expect(await verifySha256Digest("test", "md5:12345")).toBe(true);
      expect(await verifySha256Digest("test", "sha256:")).toBe(true);
      expect(await verifySha256Digest("test", "sha256:   ")).toBe(true);
    });
  });

  describe("fetchDiscoveryManifest", () => {
    it("fetches manifest from resolved URL and returns resolved URLs", async () => {
      const mockManifest: RemoteManifest = {
        name: "Test Site",
        description: "A test site",
        tools: [
          {
            name: "test_tool",
            url: "../../.agents/tools/main/test_tool.json",
          },
        ],
      };

      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockManifest,
      } as any) as unknown as typeof fetch;

      const result = await fetchDiscoveryManifest(
        "https://kherrick.github.io/pwgen-knowledge-hub",
        mockFetch,
      );

      expect(result.siteUrl).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub",
      );
      expect(result.manifestUrl).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json",
      );
      expect(result.manifest.name).toBe("Test Site");
      expect(result.manifest.tools?.[0].url).toBe(
        "https://kherrick.github.io/pwgen-knowledge-hub/.agents/tools/main/test_tool.json",
      );
    });

    it("throws when response JSON is not an object or is null", async () => {
      const mockFetchNull = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
      } as any) as unknown as typeof fetch;

      await expect(
        fetchDiscoveryManifest("https://example.com/null-site", mockFetchNull),
      ).rejects.toThrow("Invalid discovery manifest: expected a JSON object");

      const mockFetchString = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => "not-json-object",
      } as any) as unknown as typeof fetch;

      await expect(
        fetchDiscoveryManifest(
          "https://example.com/string-site",
          mockFetchString,
        ),
      ).rejects.toThrow("Invalid discovery manifest: expected a JSON object");
    });

    it("throws a clear error on HTTP failure", async () => {
      const mockFetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any) as unknown as typeof fetch;

      await expect(
        fetchDiscoveryManifest("https://example.com/missing-site", mockFetch),
      ).rejects.toThrow(
        "Failed to fetch discovery manifest: HTTP 404 Not Found",
      );
    });
  });
});
