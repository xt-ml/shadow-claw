import path from "node:path";

export function getPublishCopyPlan({
  contentRoot = "",
  toolchainRoot = "",
  distPublicDir = "dist/public",
} = {}) {
  const basePlan = [
    {
      sources: [
        "pages/resources/README.md",
        "pages/deps/README.md",
        "resources/README.md",
        "deps/README.md",
        "pages/README.md",
        "README.md",
      ],
      dest: "dist/public/README.md",
    },
    {
      sources: [
        "pages/resources/docs",
        "pages/deps/docs",
        "resources/docs",
        "deps/docs",
        "pages/docs",
        "docs",
      ],
      dest: "dist/public/docs",
      opts: { recursive: true },
    },
    {
      sources: [
        "pages/resources/AGENTS.md",
        "pages/deps/AGENTS.md",
        "resources/AGENTS.md",
        "deps/AGENTS.md",
        "pages/AGENTS.md",
        "AGENTS.md",
      ],
      dest: "dist/public/AGENTS.md",
    },
    {
      sources: [
        "pages/resources/llms.txt",
        "pages/deps/llms.txt",
        "resources/llms.txt",
        "deps/llms.txt",
        "pages/llms.txt",
        "llms.txt",
      ],
      dest: "dist/public/llms.txt",
    },
    {
      sources: [
        "pages/resources/robots.txt",
        "pages/deps/robots.txt",
        "resources/robots.txt",
        "deps/robots.txt",
        "pages/robots.txt",
        "robots.txt",
      ],
      dest: "dist/public/robots.txt",
    },
    {
      sources: [
        "pages/resources/sitemap.xml",
        "pages/deps/sitemap.xml",
        "resources/sitemap.xml",
        "deps/sitemap.xml",
        "pages/sitemap.xml",
        "pages/main/sitemap.xml",
        "sitemap.xml",
      ],
      dest: "dist/public/sitemap.xml",
    },
    {
      sources: [
        "pages/resources/sitemap.txt",
        "pages/deps/sitemap.txt",
        "resources/sitemap.txt",
        "deps/sitemap.txt",
        "pages/sitemap.txt",
        "pages/main/sitemap.txt",
        "sitemap.txt",
      ],
      dest: "dist/public/sitemap.txt",
    },
    {
      sources: [
        "pages/resources/404.html",
        "pages/deps/404.html",
        "resources/404.html",
        "deps/404.html",
        "pages/404.html",
        "pages/main/404.html",
        "404.html",
      ],
      dest: "dist/public/404.html",
    },
    {
      sources: [
        "pages/resources/manifest.json",
        "pages/deps/manifest.json",
        "resources/manifest.json",
        "deps/manifest.json",
        "pages/manifest.json",
        "pages/main/manifest.json",
        "manifest.json",
      ],
      dest: "dist/public/manifest.json",
    },
    {
      sources: [
        "pages/resources/assets/icons/favicon.svg",
        "pages/deps/assets/icons/favicon.svg",
        "resources/assets/icons/favicon.svg",
        "deps/assets/icons/favicon.svg",
        "pages/resources/assets/favicon.svg",
        "pages/resources/favicon.svg",
        "pages/deps/favicon.svg",
        "resources/favicon.svg",
        "deps/favicon.svg",
        "pages/favicon.svg",
        "pages/main/favicon.svg",
        "assets/icons/favicon.svg",
      ],
      dest: "dist/public/favicon.svg",
    },
    {
      sources: [
        "pages/resources/assets/icons/favicon.ico",
        "pages/deps/assets/icons/favicon.ico",
        "resources/assets/icons/favicon.ico",
        "deps/assets/icons/favicon.ico",
        "pages/resources/assets/favicon.ico",
        "pages/resources/favicon.ico",
        "pages/deps/favicon.ico",
        "resources/favicon.ico",
        "deps/favicon.ico",
        "pages/favicon.ico",
        "pages/main/favicon.ico",
        "assets/icons/favicon.ico",
      ],
      dest: "dist/public/favicon.ico",
    },
  ];

  if (!contentRoot && !toolchainRoot && distPublicDir === "dist/public") {
    return basePlan;
  }

  return basePlan.map((entry) => {
    const dest = distPublicDir
      ? entry.dest.replace(/^dist\/public/, distPublicDir)
      : entry.dest;

    const sources = [];
    if (contentRoot) {
      for (const src of entry.sources) {
        sources.push(path.join(contentRoot, src));
      }
    }
    if (toolchainRoot && toolchainRoot !== contentRoot) {
      for (const src of entry.sources) {
        sources.push(path.join(toolchainRoot, src));
      }
    }
    if (!contentRoot && !toolchainRoot) {
      sources.push(...entry.sources);
    }

    return {
      sources,
      dest,
      ...(entry.opts ? { opts: entry.opts } : {}),
    };
  });
}
