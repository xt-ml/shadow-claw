const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Pretty paths from a routes.json document, in order, without duplicates. */
export function getRoutePrettyPaths(routesJson: unknown): string[] {
  const routes = (routesJson as { routes?: unknown } | null)?.routes;

  if (!routes || typeof routes !== "object") {
    return [];
  }

  const seen = new Set<string>();

  for (const entry of Object.values(routes as Record<string, any>)) {
    const prettyPath = entry?.prettyPath;

    if (typeof prettyPath === "string" && prettyPath) {
      seen.add(prettyPath);
    }
  }

  return [...seen];
}

/** Builds a sitemap.xml from routes.json; the site root is always included. */
export function generateSitemapXml(
  routesJson: unknown,
  origin: string,
): string {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  const urls = new Set<string>([base]);

  for (const prettyPath of getRoutePrettyPaths(routesJson)) {
    urls.add(base + prettyPath.replace(/^\/+/, ""));
  }

  const entries = [...urls]
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
