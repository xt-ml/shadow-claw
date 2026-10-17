import { describe, expect, it } from "@jest/globals";
import {
  formatSeoTitle,
  extractMarkdownDescription,
  resolveCanonicalUrl,
  patchHtmlHeadMetadata,
} from "./seo.js";

describe("formatSeoTitle", () => {
  it("formats standard page title and site title with default separator", () => {
    const title = formatSeoTitle({
      pageTitle: "Agent Skills & Skill Creator",
      siteTitle: "ShadowClaw",
    });
    expect(title).toBe("Agent Skills & Skill Creator - ShadowClaw");
  });

  it("supports custom separator", () => {
    const title = formatSeoTitle({
      pageTitle: "Publishing to GitHub Pages",
      siteTitle: "ShadowClaw",
      separator: "|",
    });
    expect(title).toBe("Publishing to GitHub Pages | ShadowClaw");
  });

  it("supports Yoast-style template variables", () => {
    const title = formatSeoTitle({
      pageTitle: "About Us",
      siteTitle: "ShadowClaw Template",
      titleTemplate: "%%title%% %%sep%% %%sitename%%",
      separator: "•",
    });
    expect(title).toBe("About Us • ShadowClaw Template");
  });

  it("supports %title% and %site% syntax in template", () => {
    const title = formatSeoTitle({
      pageTitle: "About Us",
      siteTitle: "ShadowClaw Template",
      titleTemplate: "%title% — %site%",
    });
    expect(title).toBe("About Us — ShadowClaw Template");
  });

  it("deduplicates when pageTitle already contains siteTitle suffix", () => {
    const title = formatSeoTitle({
      pageTitle: "Agent Skills - ShadowClaw",
      siteTitle: "ShadowClaw",
    });
    expect(title).toBe("Agent Skills - ShadowClaw");
  });

  it("returns siteTitle when pageTitle equals siteTitle", () => {
    const title = formatSeoTitle({
      pageTitle: "ShadowClaw",
      siteTitle: "ShadowClaw",
    });
    expect(title).toBe("ShadowClaw");
  });

  it("returns siteTitle when isHome is true", () => {
    const title = formatSeoTitle({
      pageTitle: "Home",
      siteTitle: "ShadowClaw",
      isHome: true,
    });
    expect(title).toBe("ShadowClaw");
  });

  it("returns siteTitle when pageTitle is empty", () => {
    const title = formatSeoTitle({
      pageTitle: "",
      siteTitle: "ShadowClaw",
    });
    expect(title).toBe("ShadowClaw");
  });

  it("strips HTML tags and normalizes whitespace in page title", () => {
    const title = formatSeoTitle({
      pageTitle: "<h1>On <b>Developing</b> Loops</h1>  \n",
      siteTitle: "ShadowClaw",
    });
    expect(title).toBe("On Developing Loops - ShadowClaw");
  });
});

describe("extractMarkdownDescription", () => {
  it("extracts plain text from the first paragraph", () => {
    const md = `---
title: "Agent Skills"
---

# Agent Skills

Welcome to the ShadowClaw Agent Skills guide! Skills are workspace-local instruction packages.

Second paragraph here.
`;
    const desc = extractMarkdownDescription(md);
    expect(desc).toBe(
      "Welcome to the ShadowClaw Agent Skills guide! Skills are workspace-local instruction packages.",
    );
  });

  it("strips markdown links, formatting, and images", () => {
    const md = `
# Title

Here is a [link to docs](https://example.com) with **bold text**, *italic*, and \`inline code\`. ![alt text](img.png)
`;
    const desc = extractMarkdownDescription(md);
    expect(desc).toBe(
      "Here is a link to docs with bold text, italic, and inline code.",
    );
  });

  it("truncates long paragraphs cleanly with an ellipsis", () => {
    const longText =
      "This is a very long descriptive paragraph that goes on and on with lots of details about automated static site publishing, declarative shadow DOM shells, search engine optimization, Yoast patterns, and various architectural enhancements for web assistants.";
    const desc = extractMarkdownDescription(longText, { maxLength: 80 });
    expect(desc.length).toBeLessThanOrEqual(83);
    expect(desc.endsWith("...")).toBe(true);
  });

  it("returns fallback if markdown has no paragraph content", () => {
    const md = `# Only Heading
`;
    const desc = extractMarkdownDescription(md, {
      fallback: "Default site description",
    });
    expect(desc).toBe("Default site description");
  });
});

describe("resolveCanonicalUrl", () => {
  it("resolves origin, basePath, and prettyPath correctly", () => {
    const url = resolveCanonicalUrl({
      origin: "https://xt-ml.github.io",
      basePath: "/shadow-claw/",
      prettyPath: "/docs/skill-creator/",
    });
    expect(url).toBe("https://xt-ml.github.io/shadow-claw/docs/skill-creator/");
  });

  it("handles origin with trailing slash and basePath without leading slash", () => {
    const url = resolveCanonicalUrl({
      origin: "https://xt-ml.github.io/shadow-claw/",
      prettyPath: "docs/publishing/",
    });
    expect(url).toBe("https://xt-ml.github.io/shadow-claw/docs/publishing/");
  });

  it("does not duplicate basePath if origin already includes it", () => {
    const url = resolveCanonicalUrl({
      origin: "https://xt-ml.github.io/shadow-claw/",
      basePath: "/shadow-claw/",
      prettyPath: "/docs/skill-creator/",
    });
    expect(url).toBe("https://xt-ml.github.io/shadow-claw/docs/skill-creator/");
  });

  it("handles relative path when origin is not provided", () => {
    const url = resolveCanonicalUrl({
      basePath: "/shadow-claw/",
      prettyPath: "/main/about/",
    });
    expect(url).toBe("/shadow-claw/main/about/");
  });
});

describe("patchHtmlHeadMetadata", () => {
  const baseHtml = `<!doctype html>
<html>
<head>
  <title>ShadowClaw</title>
  <meta name="description" content="Default description" />
  <link rel="canonical" href="https://xt-ml.github.io/shadow-claw/" />
  <meta property="og:title" content="ShadowClaw" />
  <meta property="og:description" content="Default description" />
  <meta property="og:url" content="https://xt-ml.github.io/shadow-claw/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:title" content="ShadowClaw" />
  <meta name="twitter:description" content="Default description" />
</head>
<body>
  <div id="app"></div>
</body>
</html>`;

  it("patches title, description, canonical link, and social tags", () => {
    const patched = patchHtmlHeadMetadata(baseHtml, {
      title: "Agent Skills & Skill Creator - ShadowClaw",
      description: "Learn how to build agent skills.",
      canonicalUrl: "https://xt-ml.github.io/shadow-claw/docs/skill-creator/",
      type: "article",
    });

    expect(patched).toContain(
      "<title>Agent Skills &amp; Skill Creator - ShadowClaw</title>",
    );
    expect(patched).toContain(
      '<meta name="description" content="Learn how to build agent skills." />',
    );
    expect(patched).toContain(
      '<link rel="canonical" href="https://xt-ml.github.io/shadow-claw/docs/skill-creator/" />',
    );
    expect(patched).toContain(
      '<meta property="og:title" content="Agent Skills &amp; Skill Creator - ShadowClaw" />',
    );
    expect(patched).toContain(
      '<meta property="og:description" content="Learn how to build agent skills." />',
    );
    expect(patched).toContain(
      '<meta property="og:url" content="https://xt-ml.github.io/shadow-claw/docs/skill-creator/" />',
    );
    expect(patched).toContain('<meta property="og:type" content="article" />');
    expect(patched).toContain(
      '<meta name="twitter:title" content="Agent Skills &amp; Skill Creator - ShadowClaw" />',
    );
    expect(patched).toContain(
      '<meta name="twitter:description" content="Learn how to build agent skills." />',
    );
  });

  it("inserts missing tags when they do not exist in the input html", () => {
    const minimalHtml = `<!doctype html><html><head><title>Old</title></head><body></body></html>`;
    const patched = patchHtmlHeadMetadata(minimalHtml, {
      title: "New Title",
      description: "New description",
      canonicalUrl: "https://example.com/page/",
      siteTitle: "MySite",
    });

    expect(patched).toContain("<title>New Title</title>");
    expect(patched).toContain(
      '<meta name="description" content="New description" />',
    );
    expect(patched).toContain(
      '<link rel="canonical" href="https://example.com/page/" />',
    );
    expect(patched).toContain(
      '<meta property="og:title" content="New Title" />',
    );
    expect(patched).toContain(
      '<meta property="og:site_name" content="MySite" />',
    );
  });
});
