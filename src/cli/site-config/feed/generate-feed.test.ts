import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectFeedItems,
  generateAllFeeds,
  generateAtomXml,
  generateFeedHtmlRedirect,
  generateRdfXml,
  generateRss2Xml,
  patchFeed,
  type FeedChannel,
} from "./generate-feed.js";

describe("generateRss2Xml", () => {
  const channel: FeedChannel = {
    title: "Test Site",
    link: "https://example.com/",
    feedUrl: "https://example.com/feed/",
    description: "A test feed for ShadowClaw",
    lang: "en-US",
    author: "Karl Herrick",
    lastBuildDate: new Date("2026-10-18T12:00:00Z"),
    items: [
      {
        title: "Second Post",
        link: "https://example.com/posts/second/",
        guid: "https://example.com/posts/second/",
        pubDate: new Date("2026-10-15T00:00:00Z"),
        description: "Summary of second post",
        content: "<p>Full content of second post</p>",
        author: "Karl Herrick",
        categories: ["Tech", "AI"],
      },
      {
        title: "First Post & More",
        link: "https://example.com/posts/first/",
        guid: "https://example.com/posts/first/",
        pubDate: new Date("2026-09-01T00:00:00Z"),
        description: "Summary with <special> & characters",
        author: "Karl Herrick",
      },
    ],
  };

  it("emits valid RSS 2.0 structure with required namespaces", () => {
    const xml = generateRss2Xml(channel);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(
      'xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    );
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("<title>Test Site</title>");
    expect(xml).toContain("<link>https://example.com/</link>");
    expect(xml).toContain(
      "<description>A test feed for ShadowClaw</description>",
    );
    expect(xml).toContain(
      '<atom:link href="https://example.com/feed/" rel="self" type="application/rss+xml" />',
    );
    expect(xml).toContain("<language>en-US</language>");
    expect(xml).toContain("<generator>ShadowClaw</generator>");
  });

  it("formats pubDate in RFC 822 format", () => {
    const xml = generateRss2Xml(channel);

    expect(xml).toContain("<pubDate>Thu, 15 Oct 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<pubDate>Tue, 01 Sep 2026 00:00:00 GMT</pubDate>");
  });

  it("emits items with permalinks, guid, dc:creator, description, and content:encoded", () => {
    const xml = generateRss2Xml(channel);

    expect(xml).toContain("<title>Second Post</title>");
    expect(xml).toContain("<link>https://example.com/posts/second/</link>");
    expect(xml).toContain(
      '<guid isPermaLink="true">https://example.com/posts/second/</guid>',
    );
    expect(xml).toContain("<dc:creator><![CDATA[Karl Herrick]]></dc:creator>");
    expect(xml).toContain(
      "<description><![CDATA[Summary of second post]]></description>",
    );
    expect(xml).toContain(
      "<content:encoded><![CDATA[<p>Full content of second post</p>]]></content:encoded>",
    );
    expect(xml).toContain("<category><![CDATA[Tech]]></category>");
    expect(xml).toContain("<category><![CDATA[AI]]></category>");
  });

  it("escapes XML special characters in titles and links", () => {
    const xml = generateRss2Xml(channel);

    expect(xml).toContain("<title>First Post &amp; More</title>");
  });

  it("handles empty items array gracefully", () => {
    const emptyChannel: FeedChannel = {
      title: "Empty Feed",
      link: "https://example.com/",
      feedUrl: "https://example.com/feed/",
      items: [],
    };
    const xml = generateRss2Xml(emptyChannel);

    expect(xml).toContain("<title>Empty Feed</title>");
    expect(xml).not.toContain("<item>");
  });
});

describe("generateAtomXml", () => {
  const channel: FeedChannel = {
    title: "Test Site",
    link: "https://example.com/",
    feedUrl: "https://example.com/feed/atom/",
    description: "An Atom test feed for ShadowClaw",
    lang: "en-US",
    author: "Karl Herrick",
    lastBuildDate: new Date("2026-10-18T12:00:00Z"),
    items: [
      {
        title: "Second Post",
        link: "https://example.com/posts/second/",
        guid: "https://example.com/posts/second/",
        pubDate: new Date("2026-10-15T00:00:00Z"),
        updated: new Date("2026-10-16T10:00:00Z"),
        description: "Summary of second post",
        content: "<p>Full content of second post</p>",
        author: "Karl Herrick",
        categories: ["Tech"],
      },
    ],
  };

  it("emits valid Atom 1.0 structure (RFC 4287)", () => {
    const xml = generateAtomXml(channel);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain(
      '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-US">',
    );
    expect(xml).toContain('<title type="text">Test Site</title>');
    expect(xml).toContain(
      '<subtitle type="text">An Atom test feed for ShadowClaw</subtitle>',
    );
    expect(xml).toContain("<updated>2026-10-18T12:00:00.000Z</updated>");
    expect(xml).toContain(
      '<link rel="alternate" type="text/html" href="https://example.com/" />',
    );
    expect(xml).toContain("<id>https://example.com/feed/atom/</id>");
    expect(xml).toContain(
      '<link rel="self" type="application/atom+xml" href="https://example.com/feed/atom/" />',
    );
    expect(xml).toContain(
      '<generator uri="https://github.com/xt-ml/shadow-claw">ShadowClaw</generator>',
    );
  });

  it("emits entries with RFC 3339 timestamps and CDATA blocks", () => {
    const xml = generateAtomXml(channel);

    expect(xml).toContain("<entry>");
    expect(xml).toContain('<title type="html"><![CDATA[Second Post]]></title>');
    expect(xml).toContain(
      '<link rel="alternate" type="text/html" href="https://example.com/posts/second/" />',
    );
    expect(xml).toContain("<id>https://example.com/posts/second/</id>");
    expect(xml).toContain("<published>2026-10-15T00:00:00.000Z</published>");
    expect(xml).toContain("<updated>2026-10-16T10:00:00.000Z</updated>");
    expect(xml).toContain("<author><name>Karl Herrick</name></author>");
    expect(xml).toContain(
      '<summary type="html"><![CDATA[Summary of second post]]></summary>',
    );
    expect(xml).toContain(
      '<content type="html" xml:base="https://example.com/posts/second/"><![CDATA[<p>Full content of second post</p>]]></content>',
    );
    expect(xml).toContain('<category term="Tech" />');
    expect(xml).toContain("</entry>");
  });
});

describe("generateRdfXml", () => {
  const channel: FeedChannel = {
    title: "Test Site",
    link: "https://example.com/",
    feedUrl: "https://example.com/feed/rdf/",
    description: "An RDF test feed for ShadowClaw",
    lang: "en-US",
    author: "Karl Herrick",
    lastBuildDate: new Date("2026-10-18T12:00:00Z"),
    items: [
      {
        title: "Second Post",
        link: "https://example.com/posts/second/",
        guid: "https://example.com/posts/second/",
        pubDate: new Date("2026-10-15T00:00:00Z"),
        description: "Summary of second post",
        content: "<p>Full content</p>",
        author: "Karl Herrick",
      },
    ],
  };

  it("emits valid RDF / RSS 1.0 structure with Seq inside channel and items outside", () => {
    const xml = generateRdfXml(channel);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<rdf:RDF");
    expect(xml).toContain(
      'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
    );
    expect(xml).toContain('xmlns="http://purl.org/rss/1.0/"');
    expect(xml).toContain('xmlns:dc="http://purl.org/dc/elements/1.1/"');
    expect(xml).toContain(
      '<channel rdf:about="https://example.com/feed/rdf/">',
    );
    expect(xml).toContain("<title>Test Site</title>");
    expect(xml).toContain("<link>https://example.com/</link>");
    expect(xml).toContain("<items>");
    expect(xml).toContain("<rdf:Seq>");
    expect(xml).toContain(
      '<rdf:li rdf:resource="https://example.com/posts/second/" />',
    );
    expect(xml).toContain("</rdf:Seq>");
    expect(xml).toContain("</items>");
    expect(xml).toContain("</channel>");
    // Item is a direct child of rdf:RDF, after channel
    expect(xml).toContain(
      '<item rdf:about="https://example.com/posts/second/">',
    );
    expect(xml).toContain("<title>Second Post</title>");
    expect(xml).toContain("<link>https://example.com/posts/second/</link>");
    expect(xml).toContain("<dc:date>2026-10-15T00:00:00.000Z</dc:date>");
    expect(xml).toContain("<dc:creator>Karl Herrick</dc:creator>");
    expect(xml).toContain(
      "<description><![CDATA[Summary of second post]]></description>",
    );
    expect(xml).toContain(
      "<content:encoded><![CDATA[<p>Full content</p>]]></content:encoded>",
    );
    expect(xml).toContain("</item>");
    expect(xml).toContain("</rdf:RDF>");
  });
});

describe("generateFeedHtmlRedirect", () => {
  it("emits a lightweight HTML redirect with meta refresh and alternate link", () => {
    const html = generateFeedHtmlRedirect(
      "rss.xml",
      "RSS Feed",
      "application/rss+xml",
    );

    expect(html).toContain(
      '<meta http-equiv="refresh" content="0; url=rss.xml" />',
    );
    expect(html).toContain(
      '<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="rss.xml" />',
    );
    expect(html).toContain("<title>RSS Feed</title>");
    expect(html).toContain('href="rss.xml"');
  });
});

describe("collectFeedItems", () => {
  it("extracts and sorts feed items from routes and page files", async () => {
    const routesJson = {
      routes: {
        "/pages/main/index.html": {
          prettyPath: "/",
        },
        "/pages/main/posts/older.md": {
          prettyPath: "/posts/older/",
          title: "Older Post",
          date: "2024-01-01T00:00:00Z",
          description: "Older post summary",
        },
        "/pages/main/posts/newer.md": {
          prettyPath: "/posts/newer/",
          title: "Newer Post",
          date: "2025-06-01T00:00:00Z",
          description: "Newer post summary",
        },
        "/pages/main/feed/rss.xml": {
          prettyPath: "/feed/",
        },
      },
    };

    const items = await collectFeedItems(routesJson, {
      origin: "https://example.com",
    });

    expect(items).toHaveLength(2);
    // Home route "/" and feed route "/feed/" are excluded
    expect(items[0].title).toBe("Newer Post");
    expect(items[0].link).toBe("https://example.com/posts/newer/");
    expect(items[1].title).toBe("Older Post");
    expect(items[1].link).toBe("https://example.com/posts/older/");
  });

  it("respects denyList and excludes purge-pages", async () => {
    const routesJson = {
      routes: {
        "/pages/main/allowed.md": {
          prettyPath: "/allowed/",
          title: "Allowed",
          date: "2025-01-01",
        },
        "/pages/main/denied.md": {
          prettyPath: "/denied/",
          title: "Denied",
          date: "2025-01-02",
        },
      },
    };

    const items = await collectFeedItems(routesJson, {
      origin: "https://example.com",
      denyList: ["/pages/main/denied.md"],
    });

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Allowed");
  });

  it("excludes pages with frontmatter feed: false, syndication: false, or rss: false", async () => {
    const tmpDir = path.join(
      os.tmpdir(),
      `shadow-claw-feed-frontmatter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tmpDir, { recursive: true });

    try {
      await writeFile(
        path.join(tmpDir, "about.md"),
        `---
title: "About Me"
date: "2026-01-01"
feed: false
---
About content
`,
        "utf8",
      );

      await writeFile(
        path.join(tmpDir, "portfolio.html"),
        `---
title: "Portfolio"
date: "2026-01-01"
syndication: false
---
Portfolio content
`,
        "utf8",
      );

      await writeFile(
        path.join(tmpDir, "post.md"),
        `---
title: "Real Blog Post"
date: "2026-01-02"
---
Blog post content
`,
        "utf8",
      );

      const routesJson = {
        routes: {
          "/pages/main/about.md": {
            prettyPath: "/about",
          },
          "/pages/main/portfolio.html": {
            prettyPath: "/portfolio",
          },
          "/pages/main/post.md": {
            prettyPath: "/posts/first/",
          },
        },
      };

      const items = await collectFeedItems(routesJson, {
        origin: "https://example.com",
        pagesDir: tmpDir,
      });

      expect(items).toHaveLength(1);
      expect(items[0].title).toBe("Real Blog Post");
      expect(items[0].link).toBe("https://example.com/posts/first/");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("supports prettyPath variants and path prefixes in denyList", async () => {
    const routesJson = {
      routes: {
        "/pages/main/about.md": {
          prettyPath: "/about",
          title: "About",
          date: "2026-01-01",
        },
        "/pages/main/portfolio.html": {
          prettyPath: "/portfolio",
          title: "Portfolio",
          date: "2026-01-01",
        },
        "/pages/main/portfolio/project-1.md": {
          prettyPath: "/portfolio/project-1/",
          title: "Project 1",
          date: "2026-01-02",
        },
        "/pages/main/posts/hello.md": {
          prettyPath: "/2026/01/hello/",
          title: "Hello Post",
          date: "2026-01-03",
        },
      },
    };

    // Exact deny of /about and /portfolio shouldn't deny /portfolio/project-1/
    const items = await collectFeedItems(routesJson, {
      origin: "https://example.com",
      denyList: ["/about", "/portfolio"],
    });

    const titles = items.map((i) => i.title);
    expect(titles).not.toContain("About");
    expect(titles).not.toContain("Portfolio");
    expect(titles).toContain("Project 1");
    expect(titles).toContain("Hello Post");

    // Denying /portfolio/* should deny child items
    const itemsWithWildcard = await collectFeedItems(routesJson, {
      origin: "https://example.com",
      denyList: ["/about", "/portfolio", "/portfolio/*"],
    });

    const titlesWithWildcard = itemsWithWildcard.map((i) => i.title);
    expect(titlesWithWildcard).not.toContain("About");
    expect(titlesWithWildcard).not.toContain("Portfolio");
    expect(titlesWithWildcard).not.toContain("Project 1");
    expect(titlesWithWildcard).toEqual(["Hello Post"]);
  });
});

describe("patchFeed", () => {
  it("rewrites origin in feed content", () => {
    const rawRss = `<?xml version="1.0"?>
<rss><channel>
  <link>http://localhost:8888/shadow-claw/</link>
  <atom:link href="http://localhost:8888/shadow-claw/feed/" rel="self" />
  <item><link>http://localhost:8888/shadow-claw/post-1/</link></item>
</channel></rss>`;

    const patched = patchFeed(rawRss, "https://xt-ml.github.io/shadow-claw/");

    expect(patched).toContain(
      "<link>https://xt-ml.github.io/shadow-claw/</link>",
    );
    expect(patched).toContain(
      '<atom:link href="https://xt-ml.github.io/shadow-claw/feed/" rel="self" />',
    );
    expect(patched).toContain(
      "<link>https://xt-ml.github.io/shadow-claw/post-1/</link>",
    );
    expect(patched).not.toContain("localhost:8888");
  });
});

describe("generateAllFeeds", () => {
  it("generates RSS 2.0, Atom, RDF XML feeds, and HTML redirect files", async () => {
    const routesJson = {
      routes: {
        "/pages/main/index.html": { prettyPath: "/" },
        "/pages/main/article.md": {
          prettyPath: "/article/",
          title: "My Article",
          date: "2026-05-01T00:00:00Z",
          description: "Article excerpt",
        },
      },
    };

    const siteConfig = {
      site: {
        title: "Test Blog",
        description: "Blog description",
        lang: "en-US",
      },
      branding: {
        siteUrl: "https://example.com",
      },
    };

    const result = await generateAllFeeds({
      routesJson,
      siteConfig,
      origin: "https://example.com",
    });

    expect(result.rss2).toContain("<title>Test Blog</title>");
    expect(result.rss2).toContain("<title>My Article</title>");
    expect(result.atom).toContain('<title type="text">Test Blog</title>');
    expect(result.atom).toContain(
      '<title type="html"><![CDATA[My Article]]></title>',
    );
    expect(result.rdf).toContain("<title>Test Blog</title>");
    expect(result.rdf).toContain("<title>My Article</title>");

    expect(result.files["feed/rss.xml"]).toBeDefined();
    expect(result.files["feed/index.xml"]).toBeDefined();
    expect(result.files["feed/index.html"]).toBeDefined();
    expect(result.files["feed/atom/atom.xml"]).toBeDefined();
    expect(result.files["feed/atom/index.xml"]).toBeDefined();
    expect(result.files["feed/atom/index.html"]).toBeDefined();
    expect(result.files["feed/rdf/index.xml"]).toBeDefined();
    expect(result.files["feed/rdf/index.html"]).toBeDefined();
  });

  it("respects siteConfig.feed.denyList to exclude items from feeds", async () => {
    const routesJson = {
      routes: {
        "/pages/main/about.md": {
          prettyPath: "/about",
          title: "About",
          date: "2026-01-01T00:00:00Z",
        },
        "/pages/main/portfolio.html": {
          prettyPath: "/portfolio",
          title: "Portfolio",
          date: "2026-01-01T00:00:00Z",
        },
        "/pages/main/posts/hello.md": {
          prettyPath: "/posts/hello/",
          title: "Hello Post",
          date: "2026-01-02T00:00:00Z",
        },
      },
    };

    const siteConfig = {
      site: {
        title: "Test Blog",
      },
      feed: {
        enabled: true,
        denyList: ["/about", "/portfolio"],
      },
    };

    const result = await generateAllFeeds({
      routesJson,
      siteConfig,
      origin: "https://example.com",
    });

    expect(result.rss2).toContain("<title>Hello Post</title>");
    expect(result.rss2).not.toContain("<title>About</title>");
    expect(result.rss2).not.toContain("<title>Portfolio</title>");
    expect(result.atom).toContain("Hello Post");
    expect(result.atom).not.toContain("About");
    expect(result.atom).not.toContain("Portfolio");
    expect(result.rdf).toContain("<title>Hello Post</title>");
    expect(result.rdf).not.toContain("<title>About</title>");
    expect(result.rdf).not.toContain("<title>Portfolio</title>");
  });

  it("respects siteConfig.feed.allowList to include only matching items in feeds", async () => {
    const routesJson = {
      routes: {
        "/pages/main/about.md": {
          prettyPath: "/about",
          title: "About",
          date: "2026-01-01T00:00:00Z",
        },
        "/pages/main/posts/hello.md": {
          prettyPath: "/posts/hello/",
          title: "Hello Post",
          date: "2026-01-02T00:00:00Z",
        },
      },
    };

    const siteConfig = {
      site: {
        title: "Test Blog",
      },
      feed: {
        enabled: true,
        allowList: ["/posts/*"],
      },
    };

    const result = await generateAllFeeds({
      routesJson,
      siteConfig,
      origin: "https://example.com",
    });

    expect(result.rss2).toContain("<title>Hello Post</title>");
    expect(result.rss2).not.toContain("<title>About</title>");
  });
});
