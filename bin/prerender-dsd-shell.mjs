#!/usr/bin/env node

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { DEFAULT_MAIN_GROUP_README_CONTENT } from "../src/storage/defaultReadmeContent.mjs";

const SHADOW_CLAW_TEMPLATE_START =
  '<template shadowrootmode="open" data-shadow-claw-dsd="true">';

const PAGE_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".html",
  ".htm",
  ".xhtml",
]);

function buildDefaultPageSource() {
  return {
    absolutePath: null,
    displayPath: "MEMORY.md",
    inlineContent: DEFAULT_MAIN_GROUP_README_CONTENT,
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

function isPageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  return PAGE_EXTENSIONS.has(ext);
}

function sortPagePaths(paths) {
  return [...paths].sort((left, right) => {
    const leftIsMemory = /^memory\.(md|markdown)$/iu.test(path.basename(left));
    const rightIsMemory = /^memory\.(md|markdown)$/iu.test(
      path.basename(right),
    );

    if (leftIsMemory && !rightIsMemory) {
      return -1;
    }

    if (!leftIsMemory && rightIsMemory) {
      return 1;
    }

    const leftIsReadme = /^readme\.(md|markdown)$/iu.test(path.basename(left));
    const rightIsReadme = /^readme\.(md|markdown)$/iu.test(
      path.basename(right),
    );

    if (leftIsReadme && !rightIsReadme) {
      return -1;
    }

    if (!leftIsReadme && rightIsReadme) {
      return 1;
    }

    return left.localeCompare(right, undefined, { sensitivity: "base" });
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

async function renderPageHtml(pageContent, pagePath) {
  const ext = path.extname(pagePath).toLowerCase();
  const isHtml = ext === ".html" || ext === ".htm" || ext === ".xhtml";

  if (isHtml) {
    return sanitizeRenderedHtml(pageContent);
  }

  try {
    return sanitizeRenderedHtml(await marked.parse(pageContent));
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
    `<div class="pages__status" data-pages-status>${escapeHtml(statusText)}</div>`,
  );
  next = next.replace(
    /<div\s+class="pages__list"\s+data-pages-list\s+role="list"><\/div>/iu,
    `<div class="pages__list" data-pages-list role="list">\n${listMarkup}\n</div>`,
  );
  next = next.replace(
    /<div\s+class="pages__empty"\s+data-pages-empty>/iu,
    '<div class="pages__empty" data-pages-empty hidden>',
  );
  next = next.replace(
    /<div\s+class="pages__rendered"\s+data-pages-rendered\s+hidden><\/div>/iu,
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
    pagesDsdHost,
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
    const [indexHtml, shadowClawTemplateSource] = await Promise.all([
      readFile(indexPath, "utf8"),
      readFile(shadowClawTemplatePath, "utf8"),
    ]);

    const shadowClawTemplateContent = extractTemplateContent(
      shadowClawTemplateSource,
    );
    const shadowClawDsdTemplate = buildShadowClawDsdTemplateWithoutPages(
      shadowClawTemplateContent,
    );
    const markedHtml = markNoSeedPrerenderHost(indexHtml);
    const nextHtml = injectShadowClawTemplate(
      markedHtml,
      shadowClawDsdTemplate,
    );

    await writeFile(indexPath, nextHtml, "utf8");
    console.log(`Injected DSD shell into ${indexPath} (pages disabled).`);

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

  const [selectedPage] = pageSources;
  const selectedContent =
    typeof selectedPage.inlineContent === "string"
      ? selectedPage.inlineContent
      : await readFile(selectedPage.absolutePath, "utf8");
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
    pageSources,
    rendered,
  );
  const shadowClawDsdTemplate = buildShadowClawDsdTemplate(
    shadowClawTemplateContent,
    pagesDsdHost,
  );
  const nextHtml = injectShadowClawTemplate(indexHtml, shadowClawDsdTemplate);

  await writeFile(indexPath, nextHtml, "utf8");
  console.log(
    `Injected DSD shell into ${indexPath} from ${sourcePath} (${pageSources.length} page${pageSources.length === 1 ? "" : "s"}).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
