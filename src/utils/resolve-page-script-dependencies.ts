export interface PageScriptDependencySource {
  src: string;
  id?: string;
  name?: string;
  global?: boolean;
  autoload?: boolean;
  type?: string;
  async?: boolean;
  defer?: boolean;
  hasInit?: boolean;
}

function stripScriptPrefix(s: string): string {
  return s
    .replace(/^\.?\//, "")
    .replace(/^pages\/main\//, "")
    .toLowerCase()
    .trim();
}

function getFilename(filepath: string): string {
  const parts = filepath.split("/");
  return (parts.pop() || "").toLowerCase().trim();
}

function getFilenameStem(filepath: string): string {
  const filename = getFilename(filepath);
  return filename
    .replace(/\.(js|mjs|cjs|ts)$/i, "")
    .toLowerCase()
    .trim();
}

/**
 * Resolves script dependencies for a page given a list of approved script descriptors
 * and frontmatter/dependency declarations.
 *
 * Always includes scripts marked as `global` or `autoload`.
 * Gracefully ignores any unknown dependency IDs or missing scripts without throwing.
 */
export function resolvePageScriptDependencies(
  descriptors: Array<string | PageScriptDependencySource> = [],
  frontmatterOrDependencies?: Record<string, any> | string[] | string | null,
  content?: string | null,
): PageScriptDependencySource[] {
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    return [];
  }

  // Normalize all descriptors to objects with at least a `src`
  const normalizedDescriptors: PageScriptDependencySource[] = descriptors
    .map((item) => {
      if (typeof item === "string") {
        return { src: item };
      }
      if (item && typeof item === "object" && typeof item.src === "string") {
        return item;
      }
      return null;
    })
    .filter((entry): entry is PageScriptDependencySource => entry !== null);

  const resolved: PageScriptDependencySource[] = [];
  const addedSrcs = new Set<string>();

  // 1. Automatically include all global / autoload scripts
  for (const desc of normalizedDescriptors) {
    if (desc.global === true || desc.autoload === true) {
      if (!addedSrcs.has(desc.src)) {
        addedSrcs.add(desc.src);
        resolved.push(desc);
      }
    }
  }

  if (!frontmatterOrDependencies && !content) {
    return resolved;
  }

  // 2. Extract requested dependency names / IDs / paths
  const rawItems: any[] = [];
  if (Array.isArray(frontmatterOrDependencies)) {
    rawItems.push(...frontmatterOrDependencies);
  } else if (typeof frontmatterOrDependencies === "string") {
    rawItems.push(...frontmatterOrDependencies.split(/[,;\s]+/));
  } else if (
    typeof frontmatterOrDependencies === "object" &&
    frontmatterOrDependencies !== null
  ) {
    const data = frontmatterOrDependencies;
    if (Array.isArray(data.dependencies)) {
      rawItems.push(...data.dependencies);
    } else if (typeof data.dependencies === "string") {
      rawItems.push(...data.dependencies.split(/[,;\s]+/));
    }

    if (Array.isArray(data.scripts)) {
      rawItems.push(...data.scripts);
    } else if (typeof data.scripts === "string") {
      rawItems.push(...data.scripts.split(/[,;\s]+/));
    }
  }

  // 2b. Auto-detect inline scripts and custom element tags from markdown content
  if (typeof content === "string" && content) {
    const inlineScriptMatches = content.matchAll(
      /<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi,
    );
    for (const match of inlineScriptMatches) {
      if (match[1]) {
        rawItems.push(match[1]);
      }
    }

    for (const desc of normalizedDescriptors) {
      const candidates = [
        desc.id,
        desc.name,
        getFilenameStem(desc.src),
        getFilename(desc.src),
      ].filter(Boolean) as string[];

      for (const tag of candidates) {
        if (tag.includes("-")) {
          const tagRegex = new RegExp(`<${tag}[\\s>/]`, "i");
          if (tagRegex.test(content)) {
            rawItems.push(tag);
            break;
          }
        }
      }
    }
  }

  // Flatten and normalize tokens
  const requestedKeys: string[] = [];
  for (const item of rawItems) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) {
        requestedKeys.push(trimmed);
      }
    } else if (item && typeof item === "object") {
      const key = item.id || item.name || item.src;
      if (typeof key === "string" && key.trim()) {
        requestedKeys.push(key.trim());
      }
    }
  }

  // 3. Resolve requested keys against approved descriptors
  for (const key of requestedKeys) {
    const keyLower = key.toLowerCase();
    const keyNorm = stripScriptPrefix(key);
    const keyFilename = getFilename(key);
    const keyStem = getFilenameStem(key);

    const match = normalizedDescriptors.find((desc) => {
      if (desc.id && desc.id.toLowerCase() === keyLower) {
        return true;
      }
      if (desc.name && desc.name.toLowerCase() === keyLower) {
        return true;
      }
      if (desc.src === key || desc.src.toLowerCase() === keyLower) {
        return true;
      }
      if (stripScriptPrefix(desc.src) === keyNorm) {
        return true;
      }
      const descFilename = getFilename(desc.src);
      if (
        descFilename &&
        (descFilename === keyFilename || descFilename === keyLower)
      ) {
        return true;
      }
      const descStem = getFilenameStem(desc.src);
      if (descStem && (descStem === keyStem || descStem === keyLower)) {
        return true;
      }
      return false;
    });

    if (match) {
      if (!addedSrcs.has(match.src)) {
        addedSrcs.add(match.src);
        resolved.push(match);
      }
    } else {
      console.warn(
        `[ShadowClaw] Script dependency "${key}" declared in page frontmatter was not found in approved customElements.scripts config.`,
      );
    }
  }

  return resolved;
}
