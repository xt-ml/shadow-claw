import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function wrapCdata(value: string): string {
  const safe = value.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

export function formatRfc822(d: string | Date | undefined): string {
  if (!d) return new Date().toUTCString();
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

export function formatRfc3339(d: string | Date | undefined): string {
  if (!d) return new Date().toISOString();
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function extractDateFromPath(str: string): string | undefined {
  const match = str.match(
    /\b(19\d\d|20\d\d)[-_/](0[1-9]|1[0-2])[-_/](0[1-9]|[12]\d|3[01])\b/,
  );
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T00:00:00Z`;
  }
  return undefined;
}

function extractFirstMarkdownHeading(content: string): string {
  const clean = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/mu, "");
  const match = clean.match(/^#+\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function extractFirstParagraph(content: string): string {
  const clean = content
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/mu, "")
    .replace(/^#+.*$/gm, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  const paragraphs = clean.split(/\n\s*\n/);
  return paragraphs[0] ? paragraphs[0].trim().slice(0, 300) : "";
}

export interface FeedItem {
  title: string;
  link: string;
  guid?: string;
  pubDate?: string | Date;
  updated?: string | Date;
  description?: string;
  content?: string;
  author?: string;
  categories?: string[];
}

export interface FeedChannel {
  title: string;
  link: string;
  feedUrl?: string;
  description?: string;
  lang?: string;
  author?: string;
  lastBuildDate?: string | Date;
  items: FeedItem[];
}

export interface CollectFeedItemsOptions {
  origin: string;
  pagesDir?: string;
  allowList?: string[];
  denyList?: string[];
  sortOrder?: "asc" | "desc";
  author?: string;
}

function buildFeedPathCandidates(
  routeKey: string,
  prettyPath: string,
): string[] {
  const set = new Set<string>();
  if (prettyPath) {
    set.add(prettyPath);
    const clean = prettyPath.replace(/^\/+|\/+$/g, "");
    if (clean) set.add(clean);
  }
  if (routeKey) {
    set.add(routeKey);
    const cleanRoute = routeKey.replace(/^\/+|\/+$/g, "");
    if (cleanRoute) set.add(cleanRoute);
    const withoutPages = cleanRoute
      .replace(/^pages\/main\//, "")
      .replace(/^pages\//, "")
      .replace(/^main\//, "");
    if (withoutPages) set.add(withoutPages);
    const base = path.basename(routeKey);
    if (base) set.add(base);
  }
  return Array.from(set);
}

function matchesFeedPattern(pattern: string, candidates: string[]): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;

  // Wildcard matching e.g. /portfolio/* or /portfolio/**
  if (trimmed.includes("*")) {
    const normPattern = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
    const escaped = normPattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    const regex = new RegExp(`^${escaped}$`, "i");
    return candidates.some((c) => regex.test(c));
  }

  // Trailing slash prefix matching e.g. /portfolio/
  if (trimmed.endsWith("/")) {
    const prefix = trimmed
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .toLowerCase();
    return candidates.some((c) => {
      const normCand = c.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
      return normCand === prefix || normCand.startsWith(`${prefix}/`);
    });
  }

  // Exact matching (normalized without leading/trailing slashes)
  const normPattern = trimmed
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

  for (const c of candidates) {
    const normCand = c.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
    if (normCand === normPattern) {
      return true;
    }
    // Also match when stripping extensions (.md, .html)
    const strippedCand = normCand.replace(
      /\.(md|markdown|html|xhtml|txt)$/i,
      "",
    );
    const strippedPat = normPattern.replace(
      /\.(md|markdown|html|xhtml|txt)$/i,
      "",
    );
    if (strippedCand === strippedPat) {
      return true;
    }
  }

  return false;
}

/**
 * Collects and normalizes feed items from routes.json and Markdown page frontmatter.
 */
export async function collectFeedItems(
  routesJson: unknown,
  options: CollectFeedItemsOptions,
): Promise<FeedItem[]> {
  const routes = (routesJson as { routes?: Record<string, any> } | null)
    ?.routes;
  if (!routes || typeof routes !== "object") {
    return [];
  }

  const base = options.origin.endsWith("/")
    ? options.origin
    : `${options.origin}/`;
  const items: FeedItem[] = [];

  for (const [routeKey, routeDef] of Object.entries(routes)) {
    const prettyPath: string | undefined = routeDef?.prettyPath;
    if (!prettyPath || typeof prettyPath !== "string") {
      continue;
    }

    const cleanPretty = prettyPath.replace(/^\/+|\/+$/g, "");
    // Exclude home page, index.html, feed routes from being items
    if (
      cleanPretty === "" ||
      cleanPretty === "index.html" ||
      cleanPretty === "main" ||
      cleanPretty === "feed" ||
      cleanPretty.startsWith("feed/") ||
      routeKey.endsWith(".xml")
    ) {
      continue;
    }

    const candidates = buildFeedPathCandidates(routeKey, prettyPath);

    if (options.denyList && options.denyList.length > 0) {
      if (options.denyList.some((pat) => matchesFeedPattern(pat, candidates))) {
        continue;
      }
    }

    if (options.allowList && options.allowList.length > 0) {
      if (
        !options.allowList.some((pat) => matchesFeedPattern(pat, candidates))
      ) {
        continue;
      }
    }

    let fileContent = "";
    if (options.pagesDir) {
      const candidates = [
        path.join(
          options.pagesDir,
          routeKey
            .replace(/^\/pages\/main\//, "")
            .replace(/^\/main\//, "")
            .replace(/^\//, ""),
        ),
        path.join(options.pagesDir, path.basename(routeKey)),
      ];
      for (const candidate of candidates) {
        try {
          fileContent = await readFile(candidate, "utf8");
          break;
        } catch {}
      }
    }

    let frontmatter: Record<string, any> = {};
    let markdownContent = fileContent;

    if (fileContent) {
      try {
        const parsed = matter(fileContent);
        frontmatter = parsed.data || {};
        markdownContent = parsed.content || "";
      } catch {}
    }

    if (
      frontmatter.slug === "shadow-claw--purge-pages" ||
      frontmatter.draft === true ||
      frontmatter.published === false ||
      frontmatter.feed === false ||
      frontmatter.feed?.enabled === false ||
      frontmatter.feed?.exclude === true ||
      frontmatter.syndication === false ||
      frontmatter.syndicate === false ||
      frontmatter.rss === false
    ) {
      continue;
    }

    const title =
      routeDef.title ||
      frontmatter.title ||
      extractFirstMarkdownHeading(fileContent) ||
      path.basename(routeKey, path.extname(routeKey)).replace(/[-_]/g, " ");

    const rawDate =
      frontmatter.date ||
      frontmatter.pubDate ||
      frontmatter.created ||
      frontmatter.updated ||
      routeDef.date ||
      extractDateFromPath(routeKey);

    const pubDate = rawDate ? new Date(rawDate) : undefined;
    const rawUpdated = frontmatter.updated || frontmatter.created || rawDate;
    const updated = rawUpdated ? new Date(rawUpdated) : pubDate;

    const description =
      routeDef.description ||
      frontmatter.description ||
      frontmatter.excerpt ||
      frontmatter.summary ||
      extractFirstParagraph(markdownContent);

    const fullLink = `${base}${prettyPath.replace(/^\/+/, "")}`;
    const author = frontmatter.author || routeDef.author || options.author;
    const categories = Array.isArray(frontmatter.categories)
      ? frontmatter.categories
      : Array.isArray(frontmatter.tags)
        ? frontmatter.tags
        : typeof frontmatter.section === "string"
          ? [frontmatter.section]
          : [];

    items.push({
      title,
      link: fullLink,
      guid: fullLink,
      pubDate,
      updated,
      description,
      content: markdownContent ? markdownContent.trim() : undefined,
      author,
      categories,
    });
  }

  const sortDesc = options.sortOrder !== "asc";
  items.sort((a, b) => {
    const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (timeA === timeB) {
      return a.title.localeCompare(b.title);
    }
    return sortDesc ? timeB - timeA : timeA - timeB;
  });

  return items;
}

/**
 * Emits an RSS 2.0 XML string conforming to Harvard RSS 2.0.11.
 */
export function generateRss2Xml(channel: FeedChannel): string {
  const lang = channel.lang || "en-US";
  const lastBuildDate = formatRfc822(channel.lastBuildDate);
  const base = channel.link.endsWith("/") ? channel.link : `${channel.link}/`;
  const feedUrl = channel.feedUrl || `${base}feed/`;

  const itemsXml = channel.items
    .map((item) => {
      const pubDate = formatRfc822(item.pubDate);
      const guid = item.guid || item.link;
      const creator = item.author || channel.author || channel.title;
      const categoriesXml = (item.categories || [])
        .map((cat) => `      <category>${wrapCdata(cat)}</category>`)
        .join("\n");
      const contentXml = item.content
        ? `      <content:encoded>${wrapCdata(item.content)}</content:encoded>\n`
        : "";

      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${wrapCdata(creator)}</dc:creator>
      <guid isPermaLink="true">${escapeXml(guid)}</guid>
      <description>${wrapCdata(item.description || "")}</description>
${contentXml}${categoriesXml ? categoriesXml + "\n" : ""}    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
  xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
>
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description || "")}</description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <language>${escapeXml(lang)}</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <generator>ShadowClaw</generator>
${itemsXml ? itemsXml + "\n" : ""}  </channel>
</rss>
`;
}

/**
 * Emits an Atom 1.0 XML string conforming to RFC 4287.
 */
export function generateAtomXml(channel: FeedChannel): string {
  const lang = channel.lang || "en-US";
  const updated = formatRfc3339(channel.lastBuildDate);
  const base = channel.link.endsWith("/") ? channel.link : `${channel.link}/`;
  const feedUrl = channel.feedUrl || `${base}feed/atom/`;

  const entriesXml = channel.items
    .map((item) => {
      const pubDate = formatRfc3339(item.pubDate);
      const updateDate = formatRfc3339(item.updated || item.pubDate);
      const id = item.guid || item.link;
      const author = item.author || channel.author || channel.title;
      const summaryXml = item.description
        ? `    <summary type="html">${wrapCdata(item.description)}</summary>\n`
        : "";
      const contentXml = item.content
        ? `    <content type="html" xml:base="${escapeXml(item.link)}">${wrapCdata(item.content)}</content>\n`
        : "";
      const categoriesXml = (item.categories || [])
        .map((cat) => `    <category term="${escapeXml(cat)}" />`)
        .join("\n");

      return `  <entry>
    <author><name>${escapeXml(author)}</name></author>
    <title type="html">${wrapCdata(item.title)}</title>
    <link rel="alternate" type="text/html" href="${escapeXml(item.link)}" />
    <id>${escapeXml(id)}</id>
    <updated>${updateDate}</updated>
    <published>${pubDate}</published>
${summaryXml}${contentXml}${categoriesXml ? categoriesXml + "\n" : ""}  </entry>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(lang)}">
  <title type="text">${escapeXml(channel.title)}</title>
  <subtitle type="text">${escapeXml(channel.description || "")}</subtitle>
  <updated>${updated}</updated>
  <link rel="alternate" type="text/html" href="${escapeXml(channel.link)}" />
  <id>${escapeXml(feedUrl)}</id>
  <link rel="self" type="application/atom+xml" href="${escapeXml(feedUrl)}" />
  <generator uri="https://github.com/xt-ml/shadow-claw">ShadowClaw</generator>
${entriesXml ? entriesXml + "\n" : ""}
</feed>
`;
}

/**
 * Emits an RDF / RSS 1.0 XML string conforming to the RSS 1.0 specification.
 */
export function generateRdfXml(channel: FeedChannel): string {
  const lang = channel.lang || "en-US";
  const date = formatRfc3339(channel.lastBuildDate);
  const base = channel.link.endsWith("/") ? channel.link : `${channel.link}/`;
  const feedUrl = channel.feedUrl || `${base}feed/rdf/`;

  const seqItems = channel.items
    .map((item) => `        <rdf:li rdf:resource="${escapeXml(item.link)}" />`)
    .join("\n");

  const itemsXml = channel.items
    .map((item) => {
      const pubDate = formatRfc3339(item.pubDate);
      const creator = item.author || channel.author || channel.title;
      const contentXml = item.content
        ? `  <content:encoded>${wrapCdata(item.content)}</content:encoded>\n`
        : "";

      return `<item rdf:about="${escapeXml(item.link)}">
  <title>${escapeXml(item.title)}</title>
  <link>${escapeXml(item.link)}</link>
  <dc:date>${pubDate}</dc:date>
  <dc:creator>${escapeXml(creator)}</dc:creator>
  <description>${wrapCdata(item.description || "")}</description>
${contentXml}</item>`;
    })
    .join("\n\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns="http://purl.org/rss/1.0/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:taxo="http://purl.org/rss/1.0/modules/taxonomy/"
  xmlns:syn="http://purl.org/rss/1.0/modules/syndication/"
  xmlns:admin="http://webns.net/mvcb/"
>
  <channel rdf:about="${escapeXml(feedUrl)}">
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description || "")}</description>
    <dc:date>${date}</dc:date>
    <dc:language>${escapeXml(lang)}</dc:language>
    <syn:updatePeriod>hourly</syn:updatePeriod>
    <syn:updateFrequency>1</syn:updateFrequency>
    <syn:updateBase>1970-01-01T00:00+00:00</syn:updateBase>
    <items>
      <rdf:Seq>
${seqItems ? seqItems + "\n" : ""}      </rdf:Seq>
    </items>
  </channel>

${itemsXml}
</rdf:RDF>
`;
}

/**
 * Generates an HTML document that redirects to a feed and announces it via link alternate tags.
 */
export function generateFeedHtmlRedirect(
  targetFeedFile: string,
  feedTitle: string,
  feedType: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=${escapeXml(targetFeedFile)}" />
  <link rel="alternate" type="${escapeXml(feedType)}" title="${escapeXml(feedTitle)}" href="${escapeXml(targetFeedFile)}" />
  <title>${escapeXml(feedTitle)}</title>
</head>
<body>
  <p><a href="${escapeXml(targetFeedFile)}">Click here to view ${escapeXml(feedTitle)}</a></p>
</body>
</html>
`;
}

/**
 * Rewrites origins in an existing XML feed string.
 */
export function patchFeed(content: string, pagesOrigin?: string): string {
  if (!pagesOrigin) return content;
  const normalizedOrigin = pagesOrigin.endsWith("/")
    ? pagesOrigin
    : `${pagesOrigin}/`;
  const originUrl = new URL(normalizedOrigin);
  const basePath = originUrl.pathname.replace(/\/$/, "");

  return content.replace(
    /(<(?:link|guid|id)[^>]*>|rdf:about="|rdf:resource="|href="|xml:base=")(https?:\/\/[^"<>\s]+)/giu,
    (fullMatch, prefix, urlStr) => {
      try {
        const u = new URL(urlStr);
        let pagePath = u.pathname;
        if (basePath && pagePath.startsWith(basePath + "/")) {
          pagePath = pagePath.slice(basePath.length);
        } else if (basePath && pagePath === basePath) {
          pagePath = "/";
        }
        const cleanPagePath = pagePath.startsWith("/")
          ? pagePath
          : `/${pagePath}`;
        const newUrl = `${originUrl.origin}${basePath}${cleanPagePath}${u.search}${u.hash}`;
        return `${prefix}${escapeXml(newUrl)}`;
      } catch {
        return fullMatch;
      }
    },
  );
}

export interface GenerateAllFeedsOptions {
  routesJson: unknown;
  siteConfig: Record<string, any>;
  origin: string;
  pagesDir?: string;
  lastBuildDate?: Date;
}

export interface GenerateAllFeedsResult {
  rss2: string;
  atom: string;
  rdf: string;
  files: Record<string, string>;
}

/**
 * Generates RSS 2.0, Atom, RDF XML feeds and accompanying directory index redirects.
 */
export async function generateAllFeeds(
  options: GenerateAllFeedsOptions,
): Promise<GenerateAllFeedsResult> {
  const origin = options.origin || "";
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  const site = options.siteConfig?.site || {};
  const branding = options.siteConfig?.branding || {};
  const siteTitle = branding.titleText || site.title || "ShadowClaw";
  const siteDescription = site.description || "";
  const lang = site.lang || "en-US";
  const author = branding.repoLabel || site.author || siteTitle;
  const lastBuildDate = options.lastBuildDate || new Date();

  const feedConfig =
    typeof options.siteConfig?.feed === "object" ? options.siteConfig.feed : {};
  const allowList = [
    ...(feedConfig?.allowList || feedConfig?.allowlist || []),
    ...(options.siteConfig?.pages?.allowList ||
      options.siteConfig?.allowList ||
      []),
  ];
  const denyList = [
    ...(feedConfig?.denyList || feedConfig?.denylist || []),
    ...(options.siteConfig?.pages?.denyList ||
      options.siteConfig?.denyList ||
      []),
  ];

  const items = await collectFeedItems(options.routesJson, {
    origin: base,
    pagesDir: options.pagesDir,
    allowList: allowList.length > 0 ? allowList : undefined,
    denyList: denyList.length > 0 ? denyList : undefined,
    sortOrder: options.siteConfig?.pages?.sortOrder,
    author,
  });

  const rssChannel: FeedChannel = {
    title: siteTitle,
    link: base,
    feedUrl: `${base}feed/`,
    description: siteDescription,
    lang,
    author,
    lastBuildDate,
    items,
  };

  const atomChannel: FeedChannel = {
    ...rssChannel,
    feedUrl: `${base}feed/atom/`,
  };

  const rdfChannel: FeedChannel = {
    ...rssChannel,
    feedUrl: `${base}feed/rdf/`,
  };

  const rss2 = generateRss2Xml(rssChannel);
  const atom = generateAtomXml(atomChannel);
  const rdf = generateRdfXml(rdfChannel);

  const rss2Html = generateFeedHtmlRedirect(
    "rss.xml",
    `${siteTitle} Feed`,
    "application/rss+xml",
  );
  const atomHtml = generateFeedHtmlRedirect(
    "atom.xml",
    `${siteTitle} Atom Feed`,
    "application/atom+xml",
  );
  const rdfHtml = generateFeedHtmlRedirect(
    "index.xml",
    `${siteTitle} RDF Feed`,
    "application/rdf+xml",
  );

  return {
    rss2,
    atom,
    rdf,
    files: {
      "feed/rss.xml": rss2,
      "feed/index.xml": rss2,
      "feed/index.html": rss2Html,
      "feed/atom/atom.xml": atom,
      "feed/atom/index.xml": atom,
      "feed/atom/index.html": atomHtml,
      "feed/rdf/index.xml": rdf,
      "feed/rdf/index.html": rdfHtml,
    },
  };
}
