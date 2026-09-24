import fs from "node:fs";
import path from "node:path";

import { getTrustedTypesPolicyName } from "./trusted-types.js";

export interface CspOptions {
  includeTrustedTypes?: boolean;
  scriptSources?: string[];
  workerSources?: string[];
  connectSources?: string[];
  styleSources?: string[];
  rootPath?: string;
  config?: any;
}

export interface ExtractedCspConfig {
  scriptHosts: string[];
  workerSources: string[];
  connectSources: string[];
}

const CONFIG_CANDIDATES = [
  "shadow-claw.config.json",
  "shadow-claw-config.json",
  "shadowclaw.config.json",
  "site-config.json",
  "pages/site-config.json",
];

function tryReadConfigFile(filePath: string): any {
  try {
    if (
      typeof fs !== "undefined" &&
      typeof fs.readFileSync === "function" &&
      fs.existsSync(filePath)
    ) {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    }
  } catch {}
  return null;
}

export function loadWorkspaceConfigSync(rootPath?: string): any {
  const dirs: string[] = [];
  if (rootPath) {
    const resolved = path.resolve(rootPath);
    dirs.push(resolved);
    dirs.push(path.resolve(resolved, ".."));
    dirs.push(path.resolve(resolved, "../.."));
  }
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    const cwd = path.resolve(process.cwd());
    if (!dirs.includes(cwd)) {
      dirs.push(cwd);
    }
  }

  for (const dir of dirs) {
    for (const candidate of CONFIG_CANDIDATES) {
      const p = path.resolve(dir, candidate);
      const parsed = tryReadConfigFile(p);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  }
  return null;
}

export function extractCspConfigOrigins(config: any): ExtractedCspConfig {
  const scriptHosts = new Set<string>();
  const workerSources = new Set<string>();
  const connectSources = new Set<string>();

  if (!config || typeof config !== "object") {
    return {
      scriptHosts: [],
      workerSources: [],
      connectSources: [],
    };
  }

  // 1. Allowed domains (from customElements.allowedDomains or allowedCustomElementDomains)
  const allowedDomains =
    config.allowedCustomElementDomains ||
    (typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.allowedDomains
      : undefined);

  if (Array.isArray(allowedDomains)) {
    for (const domain of allowedDomains) {
      if (typeof domain === "string" && domain.trim()) {
        const d = domain.trim();
        scriptHosts.add(`https://${d}`);
        scriptHosts.add(`http://${d}`);
        connectSources.add(`https://${d}`);
        connectSources.add(`http://${d}`);
      }
    }
  }

  // 2. Custom element scripts (from customElements.scripts or scripts)
  const scripts =
    typeof config.customElements === "object" &&
    !Array.isArray(config.customElements)
      ? config.customElements?.scripts
      : undefined;

  if (Array.isArray(scripts)) {
    for (const script of scripts) {
      const src = typeof script === "string" ? script : script?.src;
      if (
        typeof src === "string" &&
        (src.startsWith("http://") ||
          src.startsWith("https://") ||
          src.startsWith("//"))
      ) {
        try {
          const origin = new URL(src.startsWith("//") ? `https:${src}` : src)
            .origin;
          scriptHosts.add(origin);
          connectSources.add(origin);
        } catch {}
      }
    }
  }

  // 3. Security overrides (from config.security)
  if (config.security && typeof config.security === "object") {
    if (Array.isArray(config.security.scriptSrc)) {
      for (const s of config.security.scriptSrc) {
        if (typeof s === "string" && s.trim()) scriptHosts.add(s.trim());
      }
    }
    if (Array.isArray(config.security.workerSrc)) {
      for (const w of config.security.workerSrc) {
        if (typeof w === "string" && w.trim()) workerSources.add(w.trim());
      }
    }
    if (Array.isArray(config.security.connectSrc)) {
      for (const c of config.security.connectSrc) {
        if (typeof c === "string" && c.trim()) connectSources.add(c.trim());
      }
    }
  }

  return {
    scriptHosts: Array.from(scriptHosts),
    workerSources: Array.from(workerSources),
    connectSources: Array.from(connectSources),
  };
}

export function buildCspReportOnlyValue(options: CspOptions = {}): string {
  const includeTrustedTypes = options.includeTrustedTypes ?? true;

  let config = options.config;
  if (config === undefined && options.rootPath) {
    config = loadWorkspaceConfigSync(options.rootPath);
  } else if (
    config === undefined &&
    typeof process !== "undefined" &&
    typeof process.cwd === "function"
  ) {
    config = loadWorkspaceConfigSync(process.cwd());
  }
  const extracted = extractCspConfigOrigins(config);

  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    ...extracted.scriptHosts,
    ...(options.scriptSources ?? []),
  ];

  const workerSources = [
    "'self'",
    "blob:",
    "data:",
    ...extracted.workerSources,
    ...(options.workerSources ?? []),
  ];

  const connectSources = [
    "'self'",
    "https:",
    "wss:",
    "ws:",
    "data:",
    ...extracted.connectSources,
    ...(options.connectSources ?? []),
  ];

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://www.youtube.com",
    "object-src 'none'",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' data: blob: https: http:",
    "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    `script-src ${Array.from(new Set(scriptSources)).join(" ")}`,
    `worker-src ${Array.from(new Set(workerSources)).join(" ")}`,
    `connect-src ${Array.from(new Set(connectSources)).join(" ")}`,
    "report-uri /__cspreport",
  ];

  if (includeTrustedTypes) {
    directives.push(
      `trusted-types ${getTrustedTypesPolicyName()} shadowclaw-sandbox dompurify default`,
      "require-trusted-types-for 'script'",
    );
  }

  return directives.join("; ");
}

export function applyCspReportOnlyHeader(
  res: {
    setHeader: (name: string, value: string) => unknown;
  },
  options: CspOptions = {},
): void {
  res.setHeader(
    "Content-Security-Policy-Report-Only",
    buildCspReportOnlyValue(options),
  );
  res.setHeader("Origin-Agent-Cluster", "?1");
}
