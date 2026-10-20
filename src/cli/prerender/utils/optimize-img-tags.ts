import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getImageFileDimensions } from "../../../utils/image-dimensions.js";

export interface OptimizeImgTagsOptions {
  pagePath?: string;
  baseDir?: string;
  assetDirs?: string[];
}

/**
 * Resolves an image src string to a local filesystem file path.
 */
function resolveLocalImagePath(
  src: string,
  pagePath?: string,
  baseDir: string = process.cwd(),
  assetDirs: string[] = [],
): string | null {
  if (/^(?:https?:|\/\/|data:|blob:)/iu.test(src)) {
    return null;
  }

  const cleanSrc = src.split("?")[0].split("#")[0];
  const strippedLeading = cleanSrc.replace(/^\/+/, "");

  const candidates: string[] = [];

  if (existsSync(cleanSrc)) {
    candidates.push(cleanSrc);
  }

  if (pagePath && !cleanSrc.startsWith("/")) {
    candidates.push(resolve(baseDir, dirname(pagePath), strippedLeading));
  }

  candidates.push(resolve(baseDir, strippedLeading));

  for (const assetDir of assetDirs) {
    candidates.push(resolve(baseDir, assetDir, strippedLeading));
  }

  // Common conventions in ShadowClaw workspaces
  candidates.push(
    resolve(
      baseDir,
      "pages/main/assets",
      strippedLeading.replace(/^pages\/main\/assets\/?/, ""),
    ),
    resolve(
      baseDir,
      "pages/main",
      strippedLeading.replace(/^pages\/main\/?/, ""),
    ),
    resolve(baseDir, "pages", strippedLeading.replace(/^pages\/?/, "")),
    resolve(baseDir, "assets", strippedLeading.replace(/^assets\/?/, "")),
    resolve(baseDir, "dist/public", strippedLeading),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Optimizes <img> tags in rendered HTML by injecting width/height attributes from image headers,
 * adding fetchpriority="high" to the first image, and loading="lazy" decoding="async" to subsequent images.
 */
export async function optimizeImgTags(
  html: string,
  options: OptimizeImgTagsOptions = {},
): Promise<string> {
  const imgTagRegex = /<img\b([^>]*?)>/giu;
  const baseDir = options.baseDir || process.cwd();

  const matches: { fullMatch: string; attributes: string; index: number }[] =
    [];
  let m: RegExpExecArray | null;

  while ((m = imgTagRegex.exec(html)) !== null) {
    matches.push({
      fullMatch: m[0],
      attributes: m[1],
      index: m.index,
    });
  }

  if (matches.length === 0) {
    return html;
  }

  let resultHtml = html;
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const item = matches[i];
    let attrs = item.attributes;

    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/iu);
    const src = srcMatch ? srcMatch[1] : null;

    const hasWidth = /\bwidth=["']?\d+/iu.test(attrs);
    const hasHeight = /\bheight=["']?\d+/iu.test(attrs);
    const hasLoading = /\bloading=["']/iu.test(attrs);
    const hasDecoding = /\bdecoding=["']/iu.test(attrs);
    const hasFetchPriority = /\bfetchpriority=["']/iu.test(attrs);

    const isSelfClosing = /\/\s*$/u.test(attrs);
    if (isSelfClosing) {
      attrs = attrs.replace(/\/\s*$/u, "").trimEnd();
    }

    // 1. Inject width and height if missing
    if ((!hasWidth || !hasHeight) && src) {
      const localFile = resolveLocalImagePath(
        src,
        options.pagePath,
        baseDir,
        options.assetDirs,
      );
      if (localFile) {
        const dims = await getImageFileDimensions(localFile);
        if (dims) {
          if (!hasWidth) {
            attrs += ` width="${dims.width}"`;
          }
          if (!hasHeight) {
            attrs += ` height="${dims.height}"`;
          }
        }
      }
    }

    // 2. Loading hints
    if (i === 0) {
      // First image: prioritize for LCP
      if (!hasLoading) {
        attrs += ` loading="eager"`;
      }
      if (!hasFetchPriority) {
        attrs += ` fetchpriority="high"`;
      }
    } else {
      // Subsequent images: lazy load
      if (!hasLoading) {
        attrs += ` loading="lazy"`;
      }
    }

    if (!hasDecoding) {
      attrs += ` decoding="async"`;
    }

    const newTag = `<img${attrs}${isSelfClosing ? " />" : ">"}`;
    const startPos = item.index + offset;
    const endPos = startPos + item.fullMatch.length;

    resultHtml =
      resultHtml.slice(0, startPos) + newTag + resultHtml.slice(endPos);
    offset += newTag.length - item.fullMatch.length;
  }

  return resultHtml;
}
