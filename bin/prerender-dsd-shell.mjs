#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import matter from "gray-matter";
import { marked } from "marked";

import {
  createFrontmatterDetailsElement,
  renderFrontmatterMarkup,
} from "../src/common/utils/frontmatter.mjs";

import { DEFAULT_MAIN_GROUP_INDEX_CONTENT } from "../src/storage/defaultIndexContent.mjs";
import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "../src/storage/defaultMemoryContent.mjs";

/**
 * @typedef {import("../src/storage/staticMainSite.js").StaticMainManifest} StaticMainManifest
 * @typedef {import("../src/storage/staticMainSite.js").StaticPageSource} StaticPageSource
 */

/**
 * @typedef {Object} PageSource
 *
 * @property {string|null} absolutePath
 * @property {string} displayPath
 * @property {string} [inlineContent]
 * @property {string} [content]
 */

const SHADOW_CLAW_TEMPLATE_START =
  '<template shadowrootmode="open" data-shadow-claw-dsd="true">';

const PAGE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".xhtml",
]);

const frontmatterDom = new DOMImplementation().createDocument(
  null,
  "html",
  null,
);
const frontmatterSerializer = new XMLSerializer();

/**
 * @returns {PageSource}
 */
function buildDefaultPageSource() {
  return [
    {
      absolutePath: null,
      displayPath: "index.html",
      inlineContent: DEFAULT_MAIN_GROUP_INDEX_CONTENT,
    },
    {
      absolutePath: null,
      displayPath: "MEMORY.md",
      inlineContent: DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
    },
  ];
}

function escapeHtml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeRenderedHtml(html) {
  // Build-time safety: strip script tags and inline event handlers.

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/giu, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/giu, "");
}

export function splitFrontmatterWithGrayMatter(src) {
  const parsed = matter(src);
  const data =
    parsed.data && typeof parsed.data === "object" ? parsed.data : {};

  return {
    data,
    content: parsed.content || "",
  };
}

export function extractTemplateContent(html) {
  const templateMatch = html.match(/<template[^>]*>([\s\S]*?)<\/template>/iu);

  if (!templateMatch) {
    throw new Error("Template wrapper not found while generating DSD.");
  }

  return templateMatch[1].trim();
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join("/");
}

function applyPurgePreRenderedStaticPages(
  purgeTokens,
  sourcePath,
  displayPath,
) {
  const group = `br-${path.basename(sourcePath)}`;
  if (!purgeTokens[group]) {
    purgeTokens[group] = {};
  }

  const parts = displayPath.split("/");
  let current = purgeTokens[group];

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part]) {
      current[part] = {};
    }
    current = current[part];
  }
  current.purgePreRenderedStaticPages = true;
}

export function isPageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  return PAGE_EXTENSIONS.has(ext);
}

export function sortPagePaths(paths) {
  return [...paths].sort((left, right) => {
    const leftIsMemory = /^memory\.(md|markdown)$/iu.test(path.basename(left));
    const rightIsMemory = /^memory\.(md|markdown)$/iu.test(
      path.basename(right),
    );

    if (leftIsMemory && !rightIsMemory) {
      return 1;
    }

    if (!leftIsMemory && rightIsMemory) {
      return -1;
    }

    return right.localeCompare(left, undefined, { sensitivity: "base" });
  });
}

export async function collectPageSources(sourcePath) {
  let sourceStats;
  try {
    sourceStats = await stat(sourcePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return buildDefaultPageSource();
    }

    throw error;
  }

  if (sourceStats.isFile()) {
    const displayPath = toPosixPath(path.basename(sourcePath));

    return [{ absolutePath: sourcePath, displayPath }];
  }

  const pages = [];

  async function visit(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);

        continue;
      }

      if (!entry.isFile() || !isPageFile(entry.name)) {
        continue;
      }

      const displayPath = toPosixPath(path.relative(sourcePath, absolutePath));
      pages.push({ absolutePath, displayPath });
    }
  }

  await visit(sourcePath);

  if (pages.length === 0) {
    return buildDefaultPageSource();
  }

  const pageByDisplayPath = new Map(
    pages.map((page) => [page.displayPath, page]),
  );

  return sortPagePaths(pages.map((page) => page.displayPath)).map(
    (displayPath) => pageByDisplayPath.get(displayPath),
  );
}

export async function renderPageHtml(pageContent, pagePath) {
  const ext = path.extname(pagePath).toLowerCase();
  const isHtml = ext === ".html" || ext === ".htm" || ext === ".xhtml";

  if (isHtml) {
    let rendered = sanitizeRenderedHtml(pageContent);
    if (pagePath) {
      const dir = path.posix.dirname(toPosixPath(pagePath));
      const prefix = `/files/main/${dir === "." ? "" : dir + "/"}`;
      rendered = rendered.replace(
        /<img\s+([^>]*?)src="([^"]+)"([^>]*)>/giu,
        (match, before, src, after) => {
          if (/^(?:[a-z]+:|#|\/)/iu.test(src)) {
            return match;
          }
          return `<img ${before}src="${prefix}${src}"${after}>`;
        },
      );
    }
    return rendered;
  }

  try {
    const parsed = splitFrontmatterWithGrayMatter(pageContent);
    const markdownHtml = await marked.parse(parsed.content);
    let rendered = sanitizeRenderedHtml(markdownHtml);

    if (pagePath) {
      const dir = path.posix.dirname(toPosixPath(pagePath));
      const prefix = `/files/main/${dir === "." ? "" : dir + "/"}`;
      rendered = rendered.replace(
        /<img\s+([^>]*?)src="([^"]+)"([^>]*)>/giu,
        (match, before, src, after) => {
          if (/^(?:[a-z]+:|#|\/)/iu.test(src)) {
            return match;
          }
          return `<img ${before}src="${prefix}${src}"${after}>`;
        },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return rendered;
    }

    return `${renderFrontmatterMarkup(
      parsed.data,
      createFrontmatterDetailsElement,
      {
        documentInstance: frontmatterDom,
        serializeNode: (node) => frontmatterSerializer.serializeToString(node),
      },
    )}${rendered}`;
  } catch {
    return `<p>${escapeHtml(pageContent)}</p>`;
  }
}

function findMatchingTemplateEnd(input, startIndex) {
  const templateTagPattern = /<\/?template\b[^>]*>/giu;
  templateTagPattern.lastIndex = startIndex;

  let depth = 0;
  let sawRoot = false;
  let match = templateTagPattern.exec(input);

  while (match) {
    const raw = match[0].toLowerCase();
    const isClose = raw.startsWith("</template");

    if (!isClose) {
      depth += 1;
      sawRoot = true;
    } else {
      depth -= 1;
    }

    if (sawRoot && depth === 0) {
      return templateTagPattern.lastIndex;
    }

    match = templateTagPattern.exec(input);
  }

  return -1;
}

function removeExistingShadowClawDsd(innerHtml) {
  const startIndex = innerHtml.indexOf(SHADOW_CLAW_TEMPLATE_START);
  if (startIndex === -1) {
    return innerHtml;
  }

  const endIndex = findMatchingTemplateEnd(innerHtml, startIndex);
  if (endIndex === -1) {
    return innerHtml;
  }

  return `${innerHtml.slice(0, startIndex)}${innerHtml.slice(endIndex)}`;
}

function removeLegacyBootShell(innerHtml) {
  return innerHtml.replace(
    /\s*<div\s+aria-hidden="true"\s+class="boot-shell">[\s\S]*?<\/div>\s*/iu,
    "\n",
  );
}

function buildStaticPagesListMarkup(pageSources) {
  const rows = pageSources
    .map((page, index) => {
      const isActive = index === 0;
      const activeClass = isActive ? " active" : "";
      const defaultClass = isActive ? " is-default" : "";
      const displayPath = escapeHtml(page.displayPath);

      return [
        `    <div class="pages__list-item${activeClass}">`,
        '      <span class="pages__drag-handle" draggable="true" title="Drag to reorder">⠿</span>',
        `      <span class="pages__default-btn${defaultClass}" title="Default page">⭐</span>`,
        `      <button type="button" class="pages__select" title="Open ${displayPath}">`,
        `        <span class="pages__list-path">${displayPath}</span>`,
        "      </button>",
        `      <button class="pages__edit" type="button" title="Edit in file editor" aria-label="Edit ${displayPath} in file editor">✏️</button>`,
        `      <button class="pages__remove" type="button" title="Remove from Pages" aria-label="Remove ${displayPath} from Pages in Main">✕</button>`,
        "    </div>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<details class="pages__group-details" open>',
    '  <summary class="pages__group-label">',
    '    <span>Main</span><span class="pages__group-icon">▼</span>',
    "  </summary>",
    '  <div class="pages__group-pages">',
    rows,
    "  </div>",
    "</details>",
  ].join("\n");
}

export function injectPageHeaderDsd(
  pagesContent,
  pageHeaderTemplateContent,
  frontmatterTitle = "",
  pageHeaderCss = "",
) {
  return pagesContent.replace(
    /(<shadow-claw-page-header\b[^>]*>)([\s\S]*?)(<\/shadow-claw-page-header>)/iu,
    (full, openTag, innerContent, closeTag) => {
      if (/^\s*<template\s+shadowrootmode=/iu.test(innerContent)) {
        return full;
      }

      const iconMatch = openTag.match(/\sicon="([^"]*)"/iu);
      const titleMatch = openTag.match(/\stitle="([^"]*)"/iu);
      const icon = iconMatch ? iconMatch[1] : "";
      let title = titleMatch ? titleMatch[1] : "";
      if (frontmatterTitle) {
        title = `${title} — ${frontmatterTitle}`;
      }
      const renderedTitle = [icon, title].filter(Boolean).join(" ");

      let headerShadowContent = pageHeaderTemplateContent;
      headerShadowContent = headerShadowContent.replace(
        /<h2\s+class="header__title"><\/h2>/iu,
        () => `<h2 class="header__title">${escapeHtml(renderedTitle)}</h2>`,
      );
      headerShadowContent = headerShadowContent.replace(
        /<details\s+class="header__actions-disclosure">/iu,
        '<details class="header__actions-disclosure" hidden>',
      );
      headerShadowContent = headerShadowContent.replace(
        /<div\s+class="header__actions"\s+id="header-actions-panel">/iu,
        '<div class="header__actions" id="header-actions-panel" hidden>',
      );

      return [
        openTag,
        '<template shadowrootmode="open" data-shadow-claw-page-header-dsd="true">',
        `<style data-dsd-style>${pageHeaderCss}</style>`,
        headerShadowContent,
        "</template>",
        innerContent.trim(),
        closeTag,
      ].join("\n");
    },
  );
}

export function applyStaticPagesContent(
  templateContent,
  pageSources,
  renderedHtml,
  pageHeaderTemplateContent,
  frontmatterTitle = "",
  pageHeaderCss = "",
) {
  const statusText =
    pageSources.length === 1
      ? "1 saved page"
      : `${pageSources.length} saved pages`;
  const listMarkup = buildStaticPagesListMarkup(pageSources);
  const selectedPath = pageSources[0]?.displayPath || "Select a page...";

  let next = templateContent;
  next = next.replace(
    /<div\b[^>]*\bdata-pages-status\b[^>]*><\/div>/iu,
    () =>
      `<div class="pages__status" data-pages-status>${escapeHtml(statusText)}</div>`,
  );
  next = next.replace(
    /<span\s+class="pages__dropdown-selected"\s+data-pages-dropdown-selected>[\s\S]*?<\/span>/iu,
    () =>
      `<span class="pages__dropdown-selected" data-pages-dropdown-selected>${escapeHtml(selectedPath)}</span>`,
  );
  next = next.replace(
    /<div\s+class="pages__list"\s+data-pages-list\s+role="list"><\/div>/giu,
    () =>
      `<div class="pages__list" data-pages-list role="list">\n${listMarkup}\n</div>`,
  );
  next = next.replace(
    /<div\s+class="pages__empty"\s+data-pages-empty>/iu,
    () => '<div class="pages__empty" data-pages-empty hidden>',
  );
  next = next.replace(
    /<div\s+class="pages__rendered"\s+data-pages-rendered\s+hidden><\/div>/iu,
    () =>
      `<div class="pages__rendered" data-pages-rendered>${renderedHtml}</div>`,
  );

  return injectPageHeaderDsd(
    next,
    pageHeaderTemplateContent,
    frontmatterTitle,
    pageHeaderCss,
  );
}

export function buildPagesDsdHost(
  pagesTemplateContent,
  pageSources,
  renderedHtml,
  pageHeaderTemplateContent,
  frontmatterTitle = "",
  pagesCss = "",
  pageHeaderCss = "",
) {
  const pagesShadowContent = applyStaticPagesContent(
    pagesTemplateContent,
    pageSources,
    renderedHtml,
    pageHeaderTemplateContent,
    frontmatterTitle,
    pageHeaderCss,
  );

  return [
    "<shadow-claw-pages>",
    '<template shadowrootmode="open" data-shadow-claw-pages-dsd="true">',
    `<style data-dsd-style>${pagesCss}</style>`,
    pagesShadowContent,
    "</template>",
    "</shadow-claw-pages>",
  ].join("\n");
}

function applyNoSeedPagesContent(templateContent) {
  // Keep the pages pane shell visible, but suppress seeded/placeholder content.
  let next = templateContent;
  next = next.replace(
    /<div\s+class="pages__empty"\s+data-pages-empty>[\s\S]*?<\/div>/iu,
    '<div class="pages__empty" data-pages-empty hidden></div>',
  );

  return next;
}

function buildPagesDsdHostEmpty(pagesTemplateContent, pagesCss = "") {
  const pagesShadowContent = applyNoSeedPagesContent(pagesTemplateContent);

  return [
    "<shadow-claw-pages>",
    '<template shadowrootmode="open" data-shadow-claw-pages-dsd="true">',
    `<style data-dsd-style>${pagesCss}</style>`,
    pagesShadowContent,
    "</template>",
    "</shadow-claw-pages>",
  ].join("\n");
}

function wrapShadowClawDialogContentInTemplate(html) {
  return html.replace(
    /(<shadow-claw-dialog\b[^>]*>)([\s\S]*?)(<\/shadow-claw-dialog>)/giu,
    (full, openTag, inner, closeTag) => {
      if (/^\s*<template\b/iu.test(inner)) {
        return full;
      }

      const trimmedInner = inner.trim();
      if (!trimmedInner) {
        return `${openTag}<template></template>${closeTag}`;
      }

      return [
        openTag,
        "<template>",
        trimmedInner,
        "</template>",
        closeTag,
      ].join("\n");
    },
  );
}

export function buildShadowClawDsdTemplate(
  shadowClawTemplateContent,
  pagesDsdHost,
  shadowClawCss = "",
) {
  const withPages = shadowClawTemplateContent.replace(
    /<shadow-claw-pages><\/shadow-claw-pages>/iu,
    () => pagesDsdHost,
  );
  const content = wrapShadowClawDialogContentInTemplate(withPages);

  return [
    '<template shadowrootmode="open" data-shadow-claw-dsd="true">',
    `<style data-dsd-style>${shadowClawCss}</style>`,
    content,
    "</template>",
  ].join("\n");
}

export function buildShadowClawDsdTemplateWithoutPages(
  shadowClawTemplateContent,
  shadowClawCss = "",
) {
  let next = shadowClawTemplateContent;

  // Remove "active" from the Pages page div and Pages nav item
  next = next.replace(
    /(<li\s+class="nav-item)\s+active(\s*"\s+data-page="pages">)/iu,
    "$1$2",
  );
  next = next.replace(
    /(<div\s+class="page)\s+active("\s+data-page-id="pages">)/iu,
    "$1$2",
  );

  // Hide the Pages nav item (keep it in DOM so JS can unhide it later)
  next = next.replace(
    /(<li\s+class="nav-item[^"]*"\s+data-page="pages")>/iu,
    "$1 hidden>",
  );

  // Make Chat nav item active
  next = next.replace(
    /(<li\s+class="nav-item)(\s*"\s+data-page="chat">)/iu,
    "$1 active$2",
  );

  // Make Chat page div active
  next = next.replace(
    /(<div\s+class="page\s+chat-page)("\s+data-page-id="chat">)/iu,
    "$1 active$2",
  );

  const content = wrapShadowClawDialogContentInTemplate(next);

  return [
    '<template shadowrootmode="open" data-shadow-claw-dsd="true">',
    `<style data-dsd-style>${shadowClawCss}</style>`,
    content,
    "</template>",
  ].join("\n");
}

export function injectShadowClawTemplate(indexHtml, dsdTemplate) {
  const openTagMatch = indexHtml.match(/<shadow-claw\b[^>]*>/iu);
  const closeTag = "</shadow-claw>";
  const openTag = openTagMatch ? openTagMatch[0] : null;
  const start = openTagMatch?.index ?? -1;

  if (start === -1) {
    throw new Error("Unable to find <shadow-claw> host in index.html.");
  }

  const end = indexHtml.indexOf(closeTag, start);
  if (end === -1) {
    throw new Error("Unable to find </shadow-claw> host in index.html.");
  }

  const innerStart = start + openTag.length;
  const inner = indexHtml.slice(innerStart, end);
  const cleaned = removeLegacyBootShell(
    removeExistingShadowClawDsd(inner),
  ).trim();
  const nextInner = cleaned
    ? `\n      ${dsdTemplate}\n${cleaned}\n    `
    : `\n      ${dsdTemplate}\n    `;

  return `${indexHtml.slice(0, innerStart)}${nextInner}${indexHtml.slice(end)}`;
}

export function markNoSeedPrerenderHost(indexHtml) {
  return indexHtml.replace(
    /<shadow-claw(\s[^>]*)?>/iu,
    (fullMatch, attrs = "") => {
      if (/\sdata-prerender-no-seed\s*=\s*/iu.test(attrs)) {
        return `<shadow-claw${attrs}>`;
      }

      return `<shadow-claw${attrs} data-prerender-no-seed="true">`;
    },
  );
}

export function escapeJsonForHtmlScript(jsonString) {
  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\//g, "\\u002f")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function injectStaticManifestScript(html, manifestJson) {
  const safeManifestJson = escapeJsonForHtmlScript(manifestJson);
  const manifestScriptTag = `<script id="shadow-claw-static-manifest" type="application/json">${safeManifestJson}</script>`;
  const routingScriptTag = `<script id="shadow-claw-static-routing" type="application/json">{"routes":{}}</script>`;

  let resultHtml = html;

  if (/id="shadow-claw-static-manifest"/iu.test(resultHtml)) {
    resultHtml = resultHtml.replace(
      /<script\s+id="shadow-claw-static-manifest"[\s\S]*?<\/script>/iu,
      () => manifestScriptTag,
    );
  } else if (resultHtml.includes("</head>")) {
    resultHtml = resultHtml.replace(
      "</head>",
      () => `  ${manifestScriptTag}\n</head>`,
    );
  } else {
    resultHtml = `${manifestScriptTag}\n${resultHtml}`;
  }

  if (!/id="shadow-claw-static-routing"/iu.test(resultHtml)) {
    if (resultHtml.includes("</head>")) {
      resultHtml = resultHtml.replace(
        "</head>",
        () => `  ${routingScriptTag}\n</head>`,
      );
    } else {
      resultHtml = `${routingScriptTag}\n${resultHtml}`;
    }
  }

  return resultHtml;
}

/**
 * Inlines critical CSS and JS for production builds.
 *
 * @param {string} html
 * @param {string} publicDir
 * @returns {Promise<string>}
 */
export async function inlineCriticalAssets(html, publicDir) {
  if (process.env.NODE_ENV !== "production") {
    return html;
  }

  let nextHtml = html;
  try {
    const cssPath = path.join(publicDir, "index.css");
    const cssContent = await readFile(cssPath, "utf8");
    nextHtml = nextHtml.replace(
      /<link\b[^>]*?href="(?:\/)?index\.css"[^>]*?>/iu,
      () => `<style>${cssContent}</style>`,
    );
  } catch (err) {
    console.warn("Failed to inline index.css", err.message);
  }

  try {
    const jsPath = path.join(publicDir, "theme-init.js");
    const jsContent = await readFile(jsPath, "utf8");
    nextHtml = nextHtml.replace(
      /<script\b[^>]*?src="(?:\/)?theme-init\.js"[^>]*?><\/script>/iu,
      () => `<script>${jsContent}</script>`,
    );
  } catch (err) {
    console.warn("Failed to inline theme-init.js", err.message);
  }

  try {
    const swInitPath = path.join(publicDir, "service-worker/init.js");
    const swInitContent = await readFile(swInitPath, "utf8");
    nextHtml = nextHtml.replace(
      /<script\b[^>]*?src="(?:\/)?service-worker\/init\.js"[^>]*?><\/script>/iu,
      () => `<script type="module">${swInitContent}</script>`,
    );
  } catch (err) {
    console.warn("Failed to inline service-worker/init.js", err.message);
  }

  return nextHtml;
}

/**
 * Minifies Declarative Shadow DOM (DSD) template contents and structural HTML.
 * Collapses whitespace, newlines, and inter-tag spaces inside `<template>` blocks
 * while safely preserving `<pre>` and `<textarea>` elements. Handles nested templates cleanly.
 *
 * @param {string} html
 * @returns {string}
 */
export function minifyDsdTemplateHtml(html) {
  if (!html || typeof html !== "string") {
    return html;
  }

  // Preserve <pre> and <textarea> blocks to protect formatted code / frontmatter
  const preserved = [];
  const withPlaceholders = html.replace(
    /<pre\b[^>]*>[\s\S]*?<\/pre>|<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi,
    (match) => {
      const idx = preserved.length;
      preserved.push(match);
      return `___PRESERVED_BLOCK_${idx}___`;
    },
  );

  const minifySegment = (content) =>
    content.replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();

  // Recursively process nested template tags so innermost and outermost templates are all minified
  function processTemplates(str) {
    const templateRegex = /<template\b[^>]*>/gi;
    let match;
    let pos = 0;
    let result = "";

    while ((match = templateRegex.exec(str)) !== null) {
      const openTag = match[0];
      const startIndex = match.index;

      const templateTagPattern = /<\/?template\b[^>]*>/gi;
      templateTagPattern.lastIndex = startIndex;
      let depth = 0;
      let sawRoot = false;
      let tagMatch = templateTagPattern.exec(str);
      let endMatchIndex = -1;
      let closeTagLen = 0;

      while (tagMatch) {
        const isClose = tagMatch[0].toLowerCase().startsWith("</template");
        if (!isClose) {
          depth += 1;
          sawRoot = true;
        } else {
          depth -= 1;
        }
        if (sawRoot && depth === 0) {
          endMatchIndex = tagMatch.index;
          closeTagLen = tagMatch[0].length;
          break;
        }
        tagMatch = templateTagPattern.exec(str);
      }

      if (endMatchIndex !== -1) {
        result += str.slice(pos, startIndex);
        const innerContent = str.slice(
          startIndex + openTag.length,
          endMatchIndex,
        );
        const processedInner = minifySegment(processTemplates(innerContent));
        result += `${openTag}${processedInner}</template>`;
        pos = endMatchIndex + closeTagLen;
        templateRegex.lastIndex = pos;
      }
    }
    result += str.slice(pos);
    return result;
  }

  let minified = processTemplates(withPlaceholders);

  // Direct regex replacement pass for template shadowrootmode blocks
  minified = minified.replace(
    /(<template\s+shadowrootmode="?[a-z]+"?[^>]*>)([\s\S]*?)(<\/template>)/gi,
    (match, startTag, innerContent, endTag) => {
      const minifiedContent = minifySegment(innerContent);
      return `${startTag}${minifiedContent}${endTag}`;
    },
  );

  // Restore preserved blocks
  for (let i = 0; i < preserved.length; i++) {
    minified = minified.replace(
      `___PRESERVED_BLOCK_${i}___`,
      () => preserved[i],
    );
  }

  return minified;
}

/**
 * Normalizes prerender-pages option to a number (0, 1, N) or "all".
 *
 * @param {string|number|boolean|undefined} val
 * @returns {number|"all"}
 */
export function normalizePrerenderPagesOption(val) {
  if (val === undefined || val === null || val === "" || val === true) {
    return 1;
  }
  const str = String(val).trim().toLowerCase();
  if (str === "all") {
    return "all";
  }
  if (str === "none" || str === "0" || str === "false") {
    return 0;
  }
  if (str === "1" || str === "current" || str === "single") {
    return 1;
  }
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0) {
    return num;
  }
  return 1;
}

/**
 * @typedef {Object} PrerenderDsdShellOptions
 * @property {string} [indexPath]
 * @property {string} [sourcePath]
 * @property {string} [publicDir]
 * @property {boolean} [noSeed]
 * @property {string|number} [prerenderPages]
 * @property {boolean} [silent]
 */

/**
 * Injects Declarative Shadow DOM (DSD) shell and static manifest into index.html.
 *
 * @param {PrerenderDsdShellOptions} [options]
 */
export async function prerenderDsdShell(options = {}) {
  const indexPath = path.resolve(options.indexPath || "dist/public/index.html");
  const sourcePath = path.resolve(options.sourcePath || "pages/main");
  const publicDir = path.resolve(options.publicDir || path.dirname(indexPath));

  const rawPagesOpt =
    options.prerenderPages !== undefined
      ? options.prerenderPages
      : options.noSeed
        ? 0
        : (process.env.PRERENDER_PAGES ?? 1);
  const prerenderPages = normalizePrerenderPagesOption(rawPagesOpt);

  const shadowClawTemplatePath = path.join(
    publicDir,
    "components/shadow-claw/shadow-claw.html",
  );
  const pagesTemplatePath = path.join(
    publicDir,
    "components/shadow-claw-pages/shadow-claw-pages.html",
  );
  const pageHeaderTemplatePath = path.join(
    publicDir,
    "components/shadow-claw-page-header/shadow-claw-page-header.html",
  );

  const shadowClawCssPath = path.join(
    publicDir,
    "components/shadow-claw/shadow-claw.css",
  );
  const pagesCssPath = path.join(
    publicDir,
    "components/shadow-claw-pages/shadow-claw-pages.css",
  );
  const pageHeaderCssPath = path.join(
    publicDir,
    "components/shadow-claw-page-header/shadow-claw-page-header.css",
  );

  const [
    indexHtml,
    shadowClawTemplateSource,
    pagesTemplateSource,
    pageHeaderTemplateSource,
    pageSources,
    shadowClawCssSource,
    pagesCssSource,
    pageHeaderCssSource,
  ] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(shadowClawTemplatePath, "utf8"),
    readFile(pagesTemplatePath, "utf8").catch(() => ""),
    readFile(pageHeaderTemplatePath, "utf8").catch(() => ""),
    collectPageSources(sourcePath),
    readFile(shadowClawCssPath, "utf8").catch(() => ""),
    readFile(pagesCssPath, "utf8").catch(() => ""),
    readFile(pageHeaderCssPath, "utf8").catch(() => ""),
  ]);

  const pageSourcesWithContent = await Promise.all(
    pageSources.map(async (page) => {
      const content =
        typeof page.inlineContent === "string"
          ? page.inlineContent
          : await readFile(page.absolutePath, "utf8");
      return { ...page, content };
    }),
  );

  let manifestPurgeId;
  const purgeTokens = {};
  const filteredPageSources = pageSourcesWithContent.filter((page) => {
    if (
      page.displayPath.endsWith(".md") &&
      /^---\r?\n[\s\S]*?slug:\s*"shadow-claw--purge-pages"[\s\S]*?---/mu.test(
        page.content,
      )
    ) {
      applyPurgePreRenderedStaticPages(
        purgeTokens,
        sourcePath,
        page.displayPath,
      );
      if (!manifestPurgeId) {
        const parsed = splitFrontmatterWithGrayMatter(page.content);
        const rawPurgeId = parsed.data["purge-id"];
        if (rawPurgeId !== undefined && rawPurgeId !== null) {
          manifestPurgeId = String(rawPurgeId);
        }
      }
      return false;
    }
    return true;
  });

  // Always write full manifest to static-main-manifest.json
  const fullManifestPages = filteredPageSources.map((page) => ({
    displayPath: page.displayPath,
    content: page.content,
  }));
  const fullManifest = { pages: fullManifestPages };
  if (Object.keys(purgeTokens).length > 0) {
    fullManifest.preRenderedStaticPages = purgeTokens;
  }
  if (manifestPurgeId) {
    fullManifest.purgeId = manifestPurgeId;
  }
  const staticManifestPath = path.join(publicDir, "static-main-manifest.json");
  await mkdir(publicDir, { recursive: true });
  await writeFile(
    staticManifestPath,
    JSON.stringify(fullManifest, null, 2),
    "utf8",
  );

  // Always copy static-main and files/main assets
  try {
    const sourceStats = await stat(sourcePath);
    if (sourceStats.isDirectory()) {
      const targetDir = path.join(publicDir, "static-main");
      await mkdir(targetDir, { recursive: true });
      await cp(sourcePath, targetDir, { recursive: true });

      const filesTargetDir = path.join(publicDir, "files/main");
      await mkdir(filesTargetDir, { recursive: true });
      await cp(sourcePath, filesTargetDir, { recursive: true });
    }
  } catch {}

  const shadowClawTemplateContent = extractTemplateContent(
    shadowClawTemplateSource,
  );

  if (prerenderPages === 0) {
    const shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
      shadowClawTemplateContent,
    );
    const markedHtml = markNoSeedPrerenderHost(indexHtml);
    const htmlWithDsd = injectShadowClawTemplate(
      markedHtml,
      shadowClawDsdTemplate,
    );
    const emptyManifestJson = JSON.stringify({ pages: [] });
    const nextHtml = injectStaticManifestScript(htmlWithDsd, emptyManifestJson);
    const minifiedHtml = minifyDsdTemplateHtml(nextHtml);
    const finalHtml = await inlineCriticalAssets(minifiedHtml, publicDir);
    await writeFile(indexPath, finalHtml, "utf8");
    const isSilent = options.silent ?? process.env.NODE_ENV === "test";
    if (!isSilent) {
      console.log(`Injected DSD shell into ${indexPath} (pages DSD disabled).`);
    }
    return;
  }

  // Determine pages to prerender into DSD and embedded manifest
  const selectedPage = filteredPageSources[0];
  let dsdPages = [];
  let embeddedManifestPages = [];

  if (prerenderPages === "all") {
    dsdPages = filteredPageSources;
    embeddedManifestPages = fullManifestPages;
  } else if (typeof prerenderPages === "number") {
    dsdPages = filteredPageSources.slice(0, prerenderPages);
    embeddedManifestPages = fullManifestPages.slice(0, prerenderPages);
  }

  const selectedContent = selectedPage ? selectedPage.content : "";
  const parsed = splitFrontmatterWithGrayMatter(selectedContent);
  const frontmatterTitle =
    parsed.data && parsed.data.title ? parsed.data.title : "";
  const rendered = selectedPage
    ? await renderPageHtml(selectedContent, selectedPage.displayPath)
    : "";

  const pagesTemplateContent = extractTemplateContent(pagesTemplateSource);
  const pageHeaderTemplateContent = extractTemplateContent(
    pageHeaderTemplateSource,
  );

  let shadowClawDsdTemplate;
  if (prerenderPages === 0) {
    shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
      shadowClawTemplateContent,
      shadowClawCssSource,
    );
  } else if (filteredPageSources.length === 0) {
    const pagesDsdHost = buildPagesDsdHostEmpty(
      pagesTemplateContent,
      pagesCssSource,
    );
    shadowClawDsdTemplate = buildShadowClawDsdTemplate(
      shadowClawTemplateContent,
      pagesDsdHost,
      shadowClawCssSource,
    );
  } else {
    const defaultPage = filteredPageSources[0];
    const parsed = splitFrontmatterWithGrayMatter(defaultPage.content);
    const frontmatterTitle =
      parsed.data && parsed.data.title ? parsed.data.title : "";

    const renderedHtml = await renderPageHtml(
      defaultPage.content,
      defaultPage.absolutePath || defaultPage.displayPath,
    );

    const pagesDsdHost = buildPagesDsdHost(
      pagesTemplateContent,
      dsdPages,
      renderedHtml,
      pageHeaderTemplateContent,
      frontmatterTitle,
      pagesCssSource,
      pageHeaderCssSource,
    );
    shadowClawDsdTemplate = buildShadowClawDsdTemplate(
      shadowClawTemplateContent,
      pagesDsdHost,
      shadowClawCssSource,
    );
  }

  const htmlWithDsd = injectShadowClawTemplate(
    indexHtml,
    shadowClawDsdTemplate,
  );
  const markedHtml = markNoSeedPrerenderHost(htmlWithDsd);

  const embeddedManifest = { pages: embeddedManifestPages };
  if (Object.keys(purgeTokens).length > 0) {
    embeddedManifest.preRenderedStaticPages = purgeTokens;
  }
  if (manifestPurgeId) {
    embeddedManifest.purgeId = manifestPurgeId;
  }
  const embeddedManifestJson = JSON.stringify(embeddedManifest);

  const nextHtml = injectStaticManifestScript(markedHtml, embeddedManifestJson);
  const minifiedHtml = minifyDsdTemplateHtml(nextHtml);
  const finalHtml = await inlineCriticalAssets(minifiedHtml, publicDir);
  await writeFile(indexPath, finalHtml, "utf8");
  const isSilent = options.silent ?? process.env.NODE_ENV === "test";
  if (!isSilent) {
    console.log(
      `Injected DSD shell into ${indexPath} from ${sourcePath} (${dsdPages.length} of ${pageSources.length} page${pageSources.length === 1 ? "" : "s"} prerendered).`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
  const noSeed = flags.includes("--no-seed");

  let prerenderPages;
  for (const flag of flags) {
    if (flag.startsWith("--prerender-pages=")) {
      prerenderPages = flag.slice("--prerender-pages=".length);
    } else if (flag.startsWith("--pages=")) {
      prerenderPages = flag.slice("--pages=".length);
    }
  }

  const [indexPath = "dist/public/index.html", sourcePath = "pages/main"] =
    args;

  await prerenderDsdShell({
    indexPath,
    sourcePath,
    noSeed,
    prerenderPages,
  });
}

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
