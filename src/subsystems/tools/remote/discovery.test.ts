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
  });

  describe("resolveManifestRelativeUrl", () => {
    const manifestUrl =
      "https://kherrick.github.io/pwgen-knowledge-hub/.well-known/agent-skills/index.json";

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

    it("resolves all tool, script, and skill URLs in manifest", () => {
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
            ],
            scripts: [
              { name: "pwgen", url: "../../.agents/scripts/main/pwgen.js" },
            ],
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
