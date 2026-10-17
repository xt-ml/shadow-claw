/**
 * Isomorphic SEO utilities for title templating, metadata extraction,
 * canonical URL generation, and HTML head patching (inspired by Yoast SEO).
 *
 * @module seo
 */

import { escapeHtml, stripHtml } from "./html.js";

export interface FormatSeoTitleOptions {
  pageTitle?: string | null;
  siteTitle?: string | null;
  siteDescription?: string | null;
  separator?: string | null;
  titleTemplate?: string | null;
  isHome?: boolean;
}

export interface ExtractMarkdownDescriptionOptions {
  maxLength?: number;
  fallback?: string;
}

export interface ResolveCanonicalUrlOptions {
  origin?: string | null;
  basePath?: string | null;
  prettyPath: string;
}

export interface PageHeadMetadata {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  siteTitle?: string;
  type?: "website" | "article";
  image?: string;
}

/**
 * Format a page title following Yoast SEO title patterns.
 * Supports template variables: %title% (or %%title%%), %site% (or %%sitename%%),
 * %sep% (or %%sep%%), and %description% (or %%sitedesc%%).
 */
export function formatSeoTitle(options: FormatSeoTitleOptions): string {
  const siteTitle = (options.siteTitle || "").trim();
  const rawPageTitle = options.pageTitle
    ? stripHtml(options.pageTitle).trim()
    : "";
  const isHome = Boolean(options.isHome);

  if (isHome || !rawPageTitle) {
    return siteTitle;
  }

  if (!siteTitle) {
    return rawPageTitle;
  }

  if (rawPageTitle.toLowerCase() === siteTitle.toLowerCase()) {
    return siteTitle;
  }

  let sep = options.separator != null ? options.separator : " - ";
  if (sep && !sep.startsWith(" ") && !sep.endsWith(" ")) {
    sep = ` ${sep} `;
  }

  // Deduplicate if pageTitle already ends with siteTitle (e.g. "About - ShadowClaw")
  const trimmedSep = sep.trim();
  const pattern = new RegExp(
    `(?:\\s*[-|—•·]\\s*|\\s+${escapeRegex(trimmedSep)}\\s+)${escapeRegex(siteTitle)}$`,
    "i",
  );
  if (pattern.test(rawPageTitle)) {
    return rawPageTitle;
  }

  if (options.titleTemplate) {
    let templated = options.titleTemplate
      .replace(/%%title%%|%title%/g, rawPageTitle)
      .replace(/%%sitename%%|%%site%%|%sitename%|%site%/g, siteTitle)
      .replace(/%%sep%%|%sep%/g, trimmedSep)
      .replace(
        /%%sitedesc%%|%%description%%|%sitedesc%|%description%/g,
        (options.siteDescription || "").trim(),
      );
    return templated.replace(/\s+/g, " ").trim();
  }

  return `${rawPageTitle}${sep}${siteTitle}`;
}

/**
 * Extract a concise, plain-text description from Markdown content.
 * Strips frontmatter, code blocks, headings, images, links, and formatting.
 */
export function extractMarkdownDescription(
  markdown: string,
  options?: ExtractMarkdownDescriptionOptions,
): string {
  if (!markdown) {
    return options?.fallback || "";
  }

  const maxLength = options?.maxLength ?? 160;

  // 1. Remove YAML frontmatter
  let clean = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/mu, "");

  // 2. Remove code fences and tildes
  clean = clean.replace(/```[\s\S]*?```/gu, "");
  clean = clean.replace(/~~~[\s\S]*?~~~/gu, "");

  // 3. Remove headings
  clean = clean.replace(/^#{1,6}\s+.*$/gmu, "");

  // 4. Remove images
  clean = clean.replace(/!\[.*?\]\(.*?\)/gu, "");

  // 5. Replace links with their text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1");

  // 6. Strip blockquotes
  clean = clean.replace(/^>\s*/gmu, "");

  // 7. Strip bold, italic, inline code
  clean = clean.replace(/\*\*([^*]+)\*\*/gu, "$1");
  clean = clean.replace(/\*([^*]+)\*/gu, "$1");
  clean = clean.replace(/__([^_]+)__/gu, "$1");
  clean = clean.replace(/_([^_]+)_/gu, "$1");
  clean = clean.replace(/`([^`]+)`/gu, "$1");

  // 8. Split into paragraphs and pick the first non-empty paragraph
  const paragraphs = clean
    .split(/\r?\n\s*\r?\n/)
    .map((p) => stripHtml(p).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return options?.fallback || "";
  }

  const firstPara = paragraphs[0];
  if (firstPara.length <= maxLength) {
    return firstPara;
  }

  // Truncate at word boundary
  let truncated = firstPara.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }

  // Remove trailing commas, periods, colons
  truncated = truncated.replace(/[,;.:\-—]+$/u, "").trim();
  return `${truncated}...`;
}

/**
 * Resolve an absolute or base-normalized canonical URL.
 */
export function resolveCanonicalUrl(
  options: ResolveCanonicalUrlOptions,
): string {
  const origin = (options.origin || "").trim().replace(/\/+$/, "");
  const basePath = (options.basePath || "").trim();
  const prettyPath = options.prettyPath.trim();

  let combinedPath = prettyPath;
  if (!combinedPath.startsWith("/")) {
    combinedPath = `/${combinedPath}`;
  }

  if (basePath && basePath !== "/") {
    const cleanBase = `/${basePath.replace(/^\/+|\/+$/g, "")}`;
    if (!combinedPath.startsWith(cleanBase)) {
      if (!origin.endsWith(cleanBase)) {
        combinedPath = `${cleanBase}${combinedPath}`;
      }
    }
  }

  if (origin) {
    return `${origin}${combinedPath}`;
  }

  return combinedPath;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findClosingHeadIndex(html: string): number {
  const tokenRegex =
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<template\b[\s\S]*?<\/template>|<\/head>/gi;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(html)) !== null) {
    if (match[0].toLowerCase().startsWith("</head")) {
      return match.index;
    }
  }
  return -1;
}

function insertBeforeHeadClose(html: string, tag: string): string {
  const idx = findClosingHeadIndex(html);
  if (idx !== -1) {
    return `${html.slice(0, idx)}  ${tag}\n${html.slice(idx)}`;
  }
  return `${tag}\n${html}`;
}

/**
 * Patch or insert metadata tags (<title>, <meta name="description">,
 * <link rel="canonical">, Open Graph, and Twitter) inside an HTML document.
 */
export function patchHtmlHeadMetadata(
  html: string,
  metadata: PageHeadMetadata,
): string {
  let next = html;

  // Title
  if (metadata.title) {
    const escaped = escapeHtml(metadata.title);
    if (/<title>[^<]*<\/title>/iu.test(next)) {
      next = next.replace(
        /<title>[^<]*<\/title>/iu,
        `<title>${escaped}</title>`,
      );
    } else {
      next = insertBeforeHeadClose(next, `<title>${escaped}</title>`);
    }
  }

  // Meta description
  if (metadata.description) {
    const escaped = escapeHtml(metadata.description);
    const tag = `<meta name="description" content="${escaped}" />`;
    if (/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Canonical link
  if (metadata.canonicalUrl) {
    const escaped = escapeHtml(metadata.canonicalUrl);
    const tag = `<link rel="canonical" href="${escaped}" />`;
    if (/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Open Graph: title
  if (metadata.title) {
    const escaped = escapeHtml(metadata.title);
    const tag = `<meta property="og:title" content="${escaped}" />`;
    if (/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Open Graph: description
  if (metadata.description) {
    const escaped = escapeHtml(metadata.description);
    const tag = `<meta property="og:description" content="${escaped}" />`;
    if (
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/iu.test(next)
    ) {
      next = next.replace(
        /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Open Graph: url
  if (metadata.canonicalUrl) {
    const escaped = escapeHtml(metadata.canonicalUrl);
    const tag = `<meta property="og:url" content="${escaped}" />`;
    if (/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Open Graph: site_name
  if (metadata.siteTitle) {
    const escaped = escapeHtml(metadata.siteTitle);
    const tag = `<meta property="og:site_name" content="${escaped}" />`;
    if (
      /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/iu.test(next)
    ) {
      next = next.replace(
        /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Open Graph: type
  if (metadata.type) {
    const escaped = escapeHtml(metadata.type);
    const tag = `<meta property="og:type" content="${escaped}" />`;
    if (/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Twitter: title
  if (metadata.title) {
    const escaped = escapeHtml(metadata.title);
    const tag = `<meta name="twitter:title" content="${escaped}" />`;
    if (/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Twitter: description
  if (metadata.description) {
    const escaped = escapeHtml(metadata.description);
    const tag = `<meta name="twitter:description" content="${escaped}" />`;
    if (
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/iu.test(next)
    ) {
      next = next.replace(
        /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/iu,
        tag,
      );
    } else {
      next = insertBeforeHeadClose(next, tag);
    }
  }

  // Image
  if (metadata.image) {
    const escaped = escapeHtml(metadata.image);
    const ogTag = `<meta property="og:image" content="${escaped}" />`;
    if (/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/iu,
        ogTag,
      );
    } else {
      next = insertBeforeHeadClose(next, ogTag);
    }

    const twTag = `<meta name="twitter:image" content="${escaped}" />`;
    if (/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/iu.test(next)) {
      next = next.replace(
        /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/iu,
        twTag,
      );
    } else {
      next = insertBeforeHeadClose(next, twTag);
    }
  }

  return next;
}
