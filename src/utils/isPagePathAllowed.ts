import { normalizeStringList } from "./normalizeStringList.js";

export interface PageFilterOptions {
  allowList?: readonly string[] | string[] | null;
  denyList?: readonly string[] | string[] | null;
  allowlist?: readonly string[] | string[] | null;
  denylist?: readonly string[] | string[] | null;
  groupId?: string | null;
  basePathPrefix?: string | null;
}

function normalizePattern(pattern: string): string {
  return pattern
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

const PAGE_EXTENSION_REGEX = /\.(md|markdown|html|xhtml|txt)$/i;

function stripPageExtension(filePath: string): string {
  return filePath.replace(PAGE_EXTENSION_REGEX, "");
}

function cleanPagePath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeGroupId(groupId?: string | null): string {
  if (!groupId) {
    return "main";
  }
  return groupId.replace(/^br:/i, "").replace(/^br-/i, "").trim();
}

function addCandidateVariants(candidates: Set<string>, rawPath: string): void {
  const norm = rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (!norm) return;

  candidates.add(norm);

  const stripped = stripPageExtension(norm);
  if (stripped && stripped !== norm) {
    candidates.add(stripped);
  }
}

/**
 * Builds candidate path variants for a page to match against allow/deny patterns.
 */
function buildPathCandidates(
  cleanPath: string,
  groupId?: string | null,
  basePathPrefix?: string | null,
): Set<string> {
  const candidates = new Set<string>();
  if (!cleanPath) {
    return candidates;
  }

  const normGroup = normalizeGroupId(groupId);

  addCandidateVariants(candidates, cleanPath);

  if (basePathPrefix) {
    const cleanPrefix = normalizePattern(basePathPrefix);
    if (cleanPrefix) {
      addCandidateVariants(candidates, `${cleanPrefix}/${cleanPath}`);
    }
  }

  if (cleanPath.startsWith("pages/")) {
    const withoutPages = cleanPath.slice("pages/".length);
    addCandidateVariants(candidates, withoutPages);

    if (withoutPages.startsWith(`${normGroup}/`)) {
      addCandidateVariants(
        candidates,
        withoutPages.slice(`${normGroup}/`.length),
      );
    } else {
      // Also add without any leading groupId segment (e.g. main/)
      const strippedGroup = withoutPages.replace(/^[^/]+\//, "");
      addCandidateVariants(candidates, strippedGroup);
    }
  } else {
    addCandidateVariants(candidates, `pages/${cleanPath}`);
    addCandidateVariants(candidates, `pages/${normGroup}/${cleanPath}`);
    addCandidateVariants(candidates, `${normGroup}/${cleanPath}`);
  }

  return candidates;
}

/**
 * Checks if any of the candidate path variations match the given normalized pattern.
 * Performs case-insensitive matching and handles extensionless patterns.
 */
function candidateMatchesPattern(
  candidates: Set<string>,
  pattern: string,
): boolean {
  const rawPat = pattern.toLowerCase();
  const strippedPat = stripPageExtension(pattern).toLowerCase();
  const patternsToMatch =
    rawPat === strippedPat ? [rawPat] : [rawPat, strippedPat];

  for (const rawCand of candidates) {
    const candLower = rawCand.toLowerCase();
    const candStripped = stripPageExtension(candLower);

    for (const pat of patternsToMatch) {
      if (!pat) continue;

      if (candLower === pat || candStripped === pat) {
        return true;
      }
      if (
        candLower.startsWith(`${pat}/`) ||
        candStripped.startsWith(`${pat}/`)
      ) {
        return true;
      }
      if (candLower.endsWith(`/${pat}`) || candStripped.endsWith(`/${pat}`)) {
        return true;
      }
      if (candLower.includes(`/${pat}/`) || candStripped.includes(`/${pat}/`)) {
        return true;
      }
    }
  }
  return false;
}

function isListMatch(
  candidates: Set<string>,
  patterns: readonly string[],
): boolean {
  for (const raw of patterns) {
    const pat = normalizePattern(raw);
    if (pat && candidateMatchesPattern(candidates, pat)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a page or directory path is allowed to participate in the pages viewer.
 *
 * Precedence:
 * 1. If matching any pattern in `denyList`, returns `false`.
 * 2. If `allowList` contains one or more patterns:
 *    - returns `true` only if matching at least one `allowList` pattern.
 *    - returns `false` otherwise.
 * 3. If `allowList` is empty and not denied, returns `true`.
 */
export function isPagePathAllowed(
  pagePath: string,
  allowListOrOptions?: PageFilterOptions | readonly string[] | string[] | null,
  denyListArg?: readonly string[] | string[] | null,
  extraOptions?: { groupId?: string | null; basePathPrefix?: string | null },
): boolean {
  if (!pagePath || typeof pagePath !== "string") {
    return false;
  }

  const clean = cleanPagePath(pagePath);
  if (!clean) {
    return false;
  }

  let allowList: string[] = [];
  let denyList: string[] = [];
  let groupId: string | null | undefined;
  let basePathPrefix: string | null | undefined;

  if (
    allowListOrOptions &&
    typeof allowListOrOptions === "object" &&
    !Array.isArray(allowListOrOptions)
  ) {
    const opts = allowListOrOptions as PageFilterOptions;
    const rawAllow = opts.allowList ?? opts.allowlist ?? [];
    const rawDeny = opts.denyList ?? opts.denylist ?? [];
    allowList = normalizeStringList(Array.from(rawAllow || []));
    denyList = normalizeStringList(Array.from(rawDeny || []));
    groupId = opts.groupId;
    basePathPrefix = opts.basePathPrefix;
  } else {
    allowList = normalizeStringList(
      Array.from((allowListOrOptions as readonly string[]) || []),
    );
    denyList = normalizeStringList(Array.from(denyListArg || []));
    groupId = extraOptions?.groupId;
    basePathPrefix = extraOptions?.basePathPrefix;
  }

  const candidates = buildPathCandidates(clean, groupId, basePathPrefix);

  if (denyList.length > 0 && isListMatch(candidates, denyList)) {
    return false;
  }

  if (allowList.length > 0) {
    return isListMatch(candidates, allowList);
  }

  return true;
}
