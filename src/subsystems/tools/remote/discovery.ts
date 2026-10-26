import { computeSha256 } from "../../../utils/crypto.js";
import { parseSkill } from "../../skills/parse-skill.js";
import type {
  RemoteManifest,
  RemoteSkillItem,
  ResolvedRemoteManifest,
} from "./types.js";

const WELL_KNOWN_PATH = ".well-known/agent-skills/index.json";

export interface GitHubRepoSource {
  owner: string;
  repo: string;
  ref: string;
  skillFilter?: string;
  subpath?: string;
}

/**
 * Parses a GitHub shorthand (`owner/repo`, `owner/repo@skill`) or GitHub repository/tree URL.
 */
export function parseGitHubRepoSource(input: string): GitHubRepoSource | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // Match https://github.com/owner/repo(/tree/ref/subpath)?(@skill)?
  const ghUrlMatch = trimmed.match(
    /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?(?:@([a-zA-Z0-9_.-]+))?$/i,
  );
  if (ghUrlMatch) {
    return {
      owner: ghUrlMatch[1],
      repo: ghUrlMatch[2],
      ref: ghUrlMatch[3] || "HEAD",
      subpath: ghUrlMatch[4],
      skillFilter: ghUrlMatch[5],
    };
  }

  // Match shorthand owner/repo or owner/repo@skill (where owner has no dots or colons)
  if (!trimmed.includes("://")) {
    const shorthandMatch = trimmed.match(
      /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:@([a-zA-Z0-9_.-]+))?$/,
    );
    if (shorthandMatch && !shorthandMatch[1].includes(".")) {
      return {
        owner: shorthandMatch[1],
        repo: shorthandMatch[2],
        ref: "HEAD",
        skillFilter: shorthandMatch[3],
      };
    }
  }

  return null;
}

/**
 * Resolves an arbitrary site or discovery URL into a normalized base URL and manifest URL.
 */
export function resolveDiscoveryUrl(inputUrl: string): {
  baseUrl: string;
  siteUrl: string;
  manifestUrl: string;
} {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error("URL cannot be empty");
  }

  let urlString = trimmed;
  if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
    urlString = `https://${urlString}`;
  }

  // Remove trailing slashes
  urlString = urlString.replace(/\/+$/, "");

  // Normalize GitHub blob URLs pointing to SKILL.md into raw.githubusercontent.com URLs
  const ghBlobMatch = urlString.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+\/skill\.md)$/i,
  );
  if (ghBlobMatch) {
    urlString = `https://raw.githubusercontent.com/${ghBlobMatch[1]}/${ghBlobMatch[2]}/${ghBlobMatch[3]}/${ghBlobMatch[4]}`;
  }

  if (/\/skill\.md$/i.test(urlString)) {
    const baseUrl = urlString.replace(/\/skill\.md$/i, "");
    return {
      baseUrl,
      siteUrl: baseUrl,
      manifestUrl: urlString,
    };
  }

  if (urlString.endsWith(WELL_KNOWN_PATH)) {
    const baseUrl = urlString
      .slice(0, -WELL_KNOWN_PATH.length)
      .replace(/\/+$/, "");
    return {
      baseUrl,
      siteUrl: baseUrl,
      manifestUrl: urlString,
    };
  }

  return {
    baseUrl: urlString,
    siteUrl: urlString,
    manifestUrl: `${urlString}/${WELL_KNOWN_PATH}`,
  };
}

/**
 * Resolves an RFC 3986 relative URL found in an agent-skills manifest against the manifest URL.
 */
export function resolveManifestRelativeUrl(
  relativeUrl: string,
  manifestUrl: string,
): string {
  if (!relativeUrl) {
    return "";
  }
  try {
    return new URL(relativeUrl, manifestUrl).href;
  } catch {
    return relativeUrl;
  }
}

/**
 * Resolves all relative URLs in an agent-skills manifest into fully-qualified absolute URLs.
 */
export function resolveManifestUrls(
  manifest: RemoteManifest,
  manifestUrl: string,
): RemoteManifest {
  const cloned: RemoteManifest = JSON.parse(JSON.stringify(manifest));

  if (Array.isArray(cloned.tools)) {
    cloned.tools = cloned.tools.map((tool) => ({
      ...tool,
      url: resolveManifestRelativeUrl(tool.url, manifestUrl),
    }));
  }

  if (Array.isArray(cloned.scripts)) {
    cloned.scripts = cloned.scripts.map((script) => ({
      ...script,
      url: resolveManifestRelativeUrl(script.url, manifestUrl),
    }));
  }

  if (Array.isArray(cloned.skills)) {
    cloned.skills = cloned.skills.map((skill) => ({
      ...skill,
      url: resolveManifestRelativeUrl(skill.url, manifestUrl),
      tools: Array.isArray(skill.tools)
        ? skill.tools.map((st) => ({
            ...st,
            url: st.url
              ? resolveManifestRelativeUrl(st.url, manifestUrl)
              : undefined,
          }))
        : undefined,
      scripts: Array.isArray(skill.scripts)
        ? skill.scripts.map((ss) => ({
            ...ss,
            url: ss.url
              ? resolveManifestRelativeUrl(ss.url, manifestUrl)
              : undefined,
          }))
        : undefined,
    }));
  }

  return cloned;
}

/**
 * Verifies that the given content matches an expected SHA-256 digest (e.g. "sha256:...").
 */
export async function verifySha256Digest(
  content: string | Uint8Array,
  expectedDigest?: string,
): Promise<boolean> {
  if (!expectedDigest || !expectedDigest.startsWith("sha256:")) {
    return true;
  }

  const expectedHex = expectedDigest.slice(7).trim().toLowerCase();
  if (!expectedHex) {
    return true;
  }

  const rawBytes =
    typeof content === "string" ? new TextEncoder().encode(content) : content;
  const actualHex = (await computeSha256(rawBytes)).toLowerCase();
  return actualHex === expectedHex;
}

async function buildSingleSkillManifest(
  skillUrl: string,
  baseUrl: string,
  rawText: string,
  files?: string[],
): Promise<ResolvedRemoteManifest> {
  const parsed = parseSkill(skillUrl, rawText);
  const skillItem: RemoteSkillItem = {
    name: parsed.name,
    type: "skill-md",
    description: parsed.description,
    url: skillUrl,
    ...(files && files.length > 0 ? { files } : {}),
  };
  return {
    manifest: {
      name: parsed.name,
      description: parsed.description,
      skills: [skillItem],
    },
    siteUrl: baseUrl,
    manifestUrl: skillUrl,
  };
}

async function fetchGitHubDiscoveryManifest(
  gh: GitHubRepoSource,
  customFetch: typeof fetch,
): Promise<ResolvedRemoteManifest> {
  const rawBase = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${gh.ref}`;
  const siteUrl = `https://github.com/${gh.owner}/${gh.repo}`;

  // 1. Explicit tree subpath (e.g. https://github.com/owner/repo/tree/main/skills/my-skill)
  if (gh.subpath) {
    const cleanSubpath = gh.subpath
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/skill\.md$/i, "");
    const skillUrl = `${rawBase}/${cleanSubpath}/SKILL.md`;
    const res = await customFetch(skillUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch discovery manifest: HTTP ${res.status} ${res.statusText || ""}`.trim(),
      );
    }
    return buildSingleSkillManifest(
      skillUrl,
      `${rawBase}/${cleanSubpath}`,
      await res.text(),
    );
  }

  // 2. Explicit skill filter (e.g. owner/repo@skill-name)
  if (gh.skillFilter) {
    const candidates = [
      `skills/${gh.skillFilter}/SKILL.md`,
      `.agents/skills/${gh.skillFilter}/SKILL.md`,
      `.agents/skills/main/${gh.skillFilter}/SKILL.md`,
      `${gh.skillFilter}/SKILL.md`,
    ];
    for (const relPath of candidates) {
      const candidateUrl = `${rawBase}/${relPath}`;
      const res = await customFetch(candidateUrl);
      if (res.ok) {
        return buildSingleSkillManifest(
          candidateUrl,
          candidateUrl.replace(/\/skill\.md$/i, ""),
          await res.text(),
        );
      }
    }
    throw new Error(
      `Failed to fetch skill "${gh.skillFilter}" from ${gh.owner}/${gh.repo}`,
    );
  }

  // 3. Full repository: try .well-known/agent-skills/index.json first
  const wellKnownUrl = `${rawBase}/${WELL_KNOWN_PATH}`;
  try {
    const wkRes = await customFetch(wellKnownUrl, {
      headers: { Accept: "application/json" },
    });
    if (wkRes.ok) {
      const rawManifest = (await wkRes.json()) as RemoteManifest;
      if (rawManifest && typeof rawManifest === "object") {
        return {
          manifest: resolveManifestUrls(rawManifest, wellKnownUrl),
          siteUrl: rawBase,
          manifestUrl: wellKnownUrl,
        };
      }
    }
  } catch {
    // Fall through to GitHub Trees API / root SKILL.md
  }

  // 4. Try GitHub Git Trees API to discover all SKILL.md files and companion files
  const treeApiUrl = `https://api.github.com/repos/${gh.owner}/${gh.repo}/git/trees/${gh.ref}?recursive=1`;
  try {
    const treeRes = await customFetch(treeApiUrl, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (treeRes.ok) {
      const treeData = (await treeRes.json()) as {
        tree?: Array<{ path?: string; type?: string }>;
      };
      const blobs = (treeData?.tree || [])
        .filter(
          (item) => item?.type === "blob" && typeof item.path === "string",
        )
        .map((item) => item.path as string);
      const skillMdPaths = blobs.filter(
        (p) => p === "SKILL.md" || p.endsWith("/SKILL.md"),
      );

      if (skillMdPaths.length > 0) {
        const skills: RemoteSkillItem[] = [];
        for (const skillMdPath of skillMdPaths) {
          const skillDir =
            skillMdPath === "SKILL.md"
              ? ""
              : skillMdPath.slice(0, -"/SKILL.md".length);
          const prefix = skillDir ? `${skillDir}/` : "";
          const companionFiles = blobs
            .filter(
              (p) =>
                (skillDir ? p.startsWith(prefix) : !p.includes("/")) &&
                p !== skillMdPath,
            )
            .map((p) => (skillDir ? p.slice(prefix.length) : p));

          const skillUrl = `${rawBase}/${skillMdPath}`;
          const mdRes = await customFetch(skillUrl);
          if (!mdRes.ok) continue;
          const mdText = await mdRes.text();
          try {
            const parsed = parseSkill(skillMdPath, mdText);
            skills.push({
              name: parsed.name,
              type: "skill-md",
              description: parsed.description,
              url: skillUrl,
              ...(companionFiles.length > 0
                ? { files: ["SKILL.md", ...companionFiles] }
                : {}),
            });
          } catch {
            // Skip invalid SKILL.md
          }
        }
        if (skills.length > 0) {
          return {
            manifest: {
              name: `${gh.owner}/${gh.repo}`,
              description: `Agent skills from ${gh.owner}/${gh.repo}`,
              skills,
            },
            siteUrl,
            manifestUrl: treeApiUrl,
          };
        }
      }
    }
  } catch {
    // Fall through to root SKILL.md
  }

  // 5. Fallback: root SKILL.md
  const rootSkillUrl = `${rawBase}/SKILL.md`;
  const rootRes = await customFetch(rootSkillUrl);
  if (rootRes.ok) {
    return buildSingleSkillManifest(
      rootSkillUrl,
      rawBase,
      await rootRes.text(),
    );
  }

  throw new Error(
    `Failed to fetch discovery manifest from GitHub repository ${gh.owner}/${gh.repo}`,
  );
}

/**
 * Fetches and parses a remote site's Agent Skills discovery manifest,
 * direct SKILL.md URL, or GitHub repository/shorthand.
 */
export async function fetchDiscoveryManifest(
  siteUrl: string,
  customFetch: typeof fetch = globalThis.fetch,
): Promise<ResolvedRemoteManifest> {
  const ghSource = parseGitHubRepoSource(siteUrl);
  if (ghSource) {
    return fetchGitHubDiscoveryManifest(ghSource, customFetch);
  }

  const { baseUrl, manifestUrl } = resolveDiscoveryUrl(siteUrl);

  if (/\/skill\.md$/i.test(manifestUrl)) {
    const response = await customFetch(manifestUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch discovery manifest: HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }
    const rawText = await response.text();
    return buildSingleSkillManifest(manifestUrl, baseUrl, rawText);
  }

  const response = await customFetch(manifestUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch discovery manifest: HTTP ${response.status} ${response.statusText}`.trim(),
    );
  }

  const rawManifest = (await response.json()) as RemoteManifest;
  if (!rawManifest || typeof rawManifest !== "object") {
    throw new Error("Invalid discovery manifest: expected a JSON object");
  }

  const resolvedManifest = resolveManifestUrls(rawManifest, manifestUrl);

  return {
    manifest: resolvedManifest,
    siteUrl: baseUrl,
    manifestUrl,
  };
}
