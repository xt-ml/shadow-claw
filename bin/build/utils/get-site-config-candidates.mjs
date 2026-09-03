import path from "node:path";

export function getSiteConfigCandidates(contentRoot) {
  if (contentRoot) {
    return [
      path.join(contentRoot, "shadow-claw-config.json"),
      path.join(contentRoot, "shadow-claw.config.json"),
      path.join(contentRoot, "shadowclaw.config.json"),
      path.join(contentRoot, "pages/shadow-claw-config.json"),
      path.join(contentRoot, "pages/shadow-claw.config.json"),
      path.join(contentRoot, "site-config.json"),
      path.join(contentRoot, "pages/site-config.json"),
    ];
  }
  return [
    "shadow-claw-config.json",
    "shadow-claw.config.json",
    "shadowclaw.config.json",
    "site-config.json",
  ];
}
