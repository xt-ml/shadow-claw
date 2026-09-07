export interface RemoteToolItem {
  name: string;
  description?: string;
  url: string;
  digest?: string;
  rawInputSchema?: unknown;
  executionType?: "javascript" | "bash" | "tool";
}

export interface RemoteScriptItem {
  name: string;
  description?: string;
  url: string;
  digest?: string;
}

export interface RemoteSkillItem {
  name: string;
  type?: string;
  description?: string;
  url: string;
  digest?: string;
  tools?: Array<{ name: string; url?: string; digest?: string }>;
  scripts?: Array<{ name: string; url?: string; digest?: string }>;
}

export interface RemoteManifest {
  $schema?: string;
  name: string;
  description?: string;
  tools?: RemoteToolItem[];
  scripts?: RemoteScriptItem[];
  skills?: RemoteSkillItem[];
  dependencies?: {
    tools?: string[];
    scripts?: string[];
  };
}

export interface ResolvedRemoteManifest {
  manifest: RemoteManifest;
  siteUrl: string;
  manifestUrl: string;
}

export interface ImportOptions {
  groupId?: string;
  siteSlug?: string;
  targetSubdir?: string;
  autoEnable?: boolean;
  overwrite?: boolean;
  fetchFn?: typeof fetch;
}

export interface ImportArtifactStatus {
  name: string;
  path: string;
  status: "imported" | "skipped" | "failed";
  error?: string;
}

export interface ImportResult {
  tools: ImportArtifactStatus[];
  skills: ImportArtifactStatus[];
  scripts: ImportArtifactStatus[];
  diagnostics: string[];
}
