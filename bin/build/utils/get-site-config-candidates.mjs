import path from "node:path";

export function getSiteConfigCandidates(contentRoot) {
  if (contentRoot) {
    return [
      path.join(contentRoot, "site-config.json"),
      path.join(contentRoot, "pages/site-config.json"),
    ];
  }
  return ["site-config.json"];
}
