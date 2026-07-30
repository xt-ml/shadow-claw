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

import { DEFAULT_MAIN_GROUP_MEMORY_CONTENT } from "../src/storage/defaultMemoryContent.mjs";

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

function buildDefaultPageSource() {
  return {
    absolutePath: null,
    displayPath: "MEMORY.md",
    inlineContent: DEFAULT_MAIN_GROUP_MEMORY_CONTENT,
  };
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

function splitFrontmatterWithGrayMatter(src) {
  const parsed = matter(src);
  const data =
    parsed.data && typeof parsed.data === "object" ? parsed.data : {};

  return {
    data,
    content: parsed.content || "",
  };
}

function extractTemplateContent(html) {
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

function isPageFile(filePath) {
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

async function collectPageSources(sourcePath) {
  let sourceStats;
  try {
    sourceStats = await stat(sourcePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [buildDefaultPageSource()];
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
    return [buildDefaultPageSource()];
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
    return sanitizeRenderedHtml(pageContent);
  }

  try {
    const parsed = splitFrontmatterWithGrayMatter(pageContent);
    const markdownHtml = await marked.parse(parsed.content);
    const rendered = sanitizeRenderedHtml(markdownHtml);

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
  return pageSources
    .map((page, index) => {
      const isActive = index === 0;
      const activeClass = isActive ? " active" : "";

      return [
        `<div class="pages__list-item${activeClass}">`,
        `  <span class="pages__list-path">${escapeHtml(page.displayPath)}</span>`,
        "</div>",
      ].join("\n");
    })
    .join("\n");
}

function applyStaticPagesContent(templateContent, pageSources, renderedHtml) {
  const statusText =
    pageSources.length === 1
      ? "1 saved page"
      : `${pageSources.length} saved pages`;
  const listMarkup = buildStaticPagesListMarkup(pageSources);

  let next = templateContent;
  next = next.replace(
    /<div\s+class="pages__status"\s+data-pages-status><\/div>/iu,
    () =>
      `<div class="pages__status" data-pages-status>${escapeHtml(statusText)}</div>`,
  );
  next = next.replace(
    /<div\s+class="pages__list"\s+data-pages-list\s+role="list"><\/div>/iu,
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

  return next;
}

function buildPagesDsdHost(pagesTemplateContent, pageSources, renderedHtml) {
  const pagesShadowContent = applyStaticPagesContent(
    pagesTemplateContent,
    pageSources,
    renderedHtml,
  );

  return [
    "<shadow-claw-pages>",
    '<template shadowrootmode="open" data-shadow-claw-pages-dsd="true">',
    '<link rel="stylesheet" href="components/shadow-claw-pages/shadow-claw-pages.css" />',
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

function buildPagesDsdHostEmpty(pagesTemplateContent) {
  const pagesShadowContent = applyNoSeedPagesContent(pagesTemplateContent);

  return [
    "<shadow-claw-pages>",
    '<template shadowrootmode="open" data-shadow-claw-pages-dsd="true">',
    '<link rel="stylesheet" href="components/shadow-claw-pages/shadow-claw-pages.css" />',
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

function buildShadowClawDsdTemplate(shadowClawTemplateContent, pagesDsdHost) {
  const withPages = shadowClawTemplateContent.replace(
    /<shadow-claw-pages><\/shadow-claw-pages>/iu,
    () => pagesDsdHost,
  );
  const content = wrapShadowClawDialogContentInTemplate(withPages);

  return [
    '<template shadowrootmode="open" data-shadow-claw-dsd="true">',
    '<link rel="stylesheet" href="components/shadow-claw/shadow-claw.css" />',
    content,
    "</template>",
  ].join("\n");
}

function buildShadowClawDsdTemplateWithoutPages(shadowClawTemplateContent) {
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
    '<link rel="stylesheet" href="components/shadow-claw/shadow-claw.css" />',
    content,
    "</template>",
  ].join("\n");
}

function injectShadowClawTemplate(indexHtml, dsdTemplate) {
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

function markNoSeedPrerenderHost(indexHtml) {
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
  const scriptTag = `<script id="shadow-claw-static-manifest" type="application/json">${safeManifestJson}</script>`;
  if (/id="shadow-claw-static-manifest"/iu.test(html)) {
    return html.replace(
      /<script\s+id="shadow-claw-static-manifest"[\s\S]*?<\/script>/iu,
      () => scriptTag,
    );
  }

  if (html.includes("</head>")) {
    return html.replace("</head>", () => `  ${scriptTag}\n</head>`);
  }

  return `${scriptTag}\n${html}`;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = new Set(
    process.argv.slice(2).filter((a) => a.startsWith("--")),
  );
  const noSeed = flags.has("--no-seed");

  const [indexPath = "dist/public/index.html", sourcePath = "main"] = args;

  const publicDir = path.dirname(indexPath);
  const shadowClawTemplatePath = path.join(
    publicDir,
    "components/shadow-claw/shadow-claw.html",
  );
  const pagesTemplatePath = path.join(
    publicDir,
    "components/shadow-claw-pages/shadow-claw-pages.html",
  );

  if (noSeed) {
    const [indexHtml, shadowClawTemplateSource, pageSources] =
      await Promise.all([
        readFile(indexPath, "utf8"),
        readFile(shadowClawTemplatePath, "utf8"),
        collectPageSources(sourcePath),
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

    const purgeTokens = {};
    const filteredPages = pageSourcesWithContent.filter((page) => {
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
      }
      return true;
    });

    const manifestPages = filteredPages.map((page) => ({
      displayPath: page.displayPath,
      content: page.content,
    }));

    const manifest = { pages: manifestPages };
    if (Object.keys(purgeTokens).length > 0) {
      manifest.preRenderedStaticPages = purgeTokens;
    }
    const manifestJson = JSON.stringify(manifest);

    const staticManifestPath = path.join(
      publicDir,
      "static-main-manifest.json",
    );
    await writeFile(
      staticManifestPath,
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    try {
      const sourceStats = await stat(sourcePath);
      if (sourceStats.isDirectory()) {
        const targetDir = path.join(publicDir, "static-main");
        await mkdir(targetDir, { recursive: true });
        await cp(sourcePath, targetDir, { recursive: true });
      }
    } catch {}

    const shadowClawTemplateContent = extractTemplateContent(
      shadowClawTemplateSource,
    );
    const shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
      shadowClawTemplateContent,
    );
    const markedHtml = markNoSeedPrerenderHost(indexHtml);
    const htmlWithDsd = injectShadowClawTemplate(
      markedHtml,
      shadowClawDsdTemplate,
    );
    const nextHtml = injectStaticManifestScript(htmlWithDsd, manifestJson);

    await writeFile(indexPath, nextHtml, "utf8");
    console.log(`Injected DSD shell into ${indexPath} (pages DSD disabled).`);

    return;
  }

  const [
    indexHtml,
    shadowClawTemplateSource,
    pagesTemplateSource,
    pageSources,
  ] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(shadowClawTemplatePath, "utf8"),
    readFile(pagesTemplatePath, "utf8"),
    collectPageSources(sourcePath),
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
    }
    return true;
  });

  const manifestPages = filteredPageSources.map((page) => ({
    displayPath: page.displayPath,
    content: page.content,
  }));

  const manifest = { pages: manifestPages };
  if (Object.keys(purgeTokens).length > 0) {
    manifest.preRenderedStaticPages = purgeTokens;
  }
  const manifestJson = JSON.stringify(manifest);

  const staticManifestPath = path.join(publicDir, "static-main-manifest.json");
  await writeFile(
    staticManifestPath,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  try {
    const sourceStats = await stat(sourcePath);
    if (sourceStats.isDirectory()) {
      const targetDir = path.join(publicDir, "static-main");
      await mkdir(targetDir, { recursive: true });
      await cp(sourcePath, targetDir, { recursive: true });
    }
  } catch {}

  const [selectedPage] = filteredPageSources;
  const selectedContent = selectedPage.content;
  const rendered = await renderPageHtml(
    selectedContent,
    selectedPage.absolutePath || selectedPage.displayPath,
  );

  const shadowClawTemplateContent = extractTemplateContent(
    shadowClawTemplateSource,
  );
  const pagesTemplateContent = extractTemplateContent(pagesTemplateSource);
  const pagesDsdHost = buildPagesDsdHost(
    pagesTemplateContent,
    filteredPageSources,
    rendered,
  );
  const shadowClawDsdTemplate = buildShadowClawDsdTemplate(
    shadowClawTemplateContent,
    pagesDsdHost,
  );
  const htmlWithDsd = injectShadowClawTemplate(
    indexHtml,
    shadowClawDsdTemplate,
  );
  const nextHtml = injectStaticManifestScript(htmlWithDsd, manifestJson);

  await writeFile(indexPath, nextHtml, "utf8");
  console.log(
    `Injected DSD shell into ${indexPath} from ${sourcePath} (${pageSources.length} page${pageSources.length === 1 ? "" : "s"}).`,
  );
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
