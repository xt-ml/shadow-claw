import type {
  StoredCredentialAuthMode,
  StoredCredentialBase,
  StoredCredentialOAuthFields,
} from "../accounts/stored-credentials.js";
import type { ShadowClawDatabase } from "../../db/types.js";

export type GitAuthMode = StoredCredentialAuthMode;

export type GitProvider = "github" | "azure-devops" | "gitlab" | "generic";

export interface GitAccount
  extends StoredCredentialBase, StoredCredentialOAuthFields {
  authorEmail: string; // Commit author email (empty string to use global default)
  authorName: string; // Commit author name (empty string to use global default)
  password: string; // Encrypted password (empty string if not set)
  provider?: GitProvider; // Explicit provider type (auto-detected from hostPattern if omitted)
  username: string; // Plaintext username (empty string if not set)
}

export interface GitToolDeps {
  configKeys: {
    GIT_AUTHOR_EMAIL: string;
    GIT_AUTHOR_NAME: string;
    GIT_CORS_PROXY: string;
    GIT_PROXY_URL: string;
  };
  getConfig: (db: ShadowClawDatabase, key: string) => Promise<any>;
  getGroupDir: (
    db: ShadowClawDatabase,
    groupId: string,
  ) => Promise<FileSystemDirectoryHandle>;
  getProxyUrl: (
    pref: "local" | "public" | "custom",
    customUrl?: string,
  ) => string;
  getRemoteUrl: (input: {
    groupRoot?: FileSystemDirectoryHandle;
    remote?: string;
    repo: string;
  }) => Promise<any>;
  gitAdd: (input: any) => Promise<string>;
  gitBranch: (input: any) => Promise<string>;
  gitCheckout: (input: any) => Promise<string>;
  gitClone: (input: any) => Promise<string>;
  gitCommit: (input: any) => Promise<string>;
  gitConfig: (input: any) => Promise<string>;
  gitDeleteBranch: (input: any) => Promise<string>;
  gitDeleteRepo: (input: any) => Promise<string>;
  gitDiff: (input: any) => Promise<string>;
  gitFetch: (input: any) => Promise<string>;
  gitInit: (input: any) => Promise<string>;
  gitListBranches: (input: any) => Promise<string>;
  gitListRepos: (input: {
    groupRoot?: FileSystemDirectoryHandle;
  }) => Promise<string>;
  gitListTags: (input: any) => Promise<string>;
  gitLog: (input: any) => Promise<string>;
  gitMerge: (input: any) => Promise<string>;
  gitPull: (input: any) => Promise<string>;
  gitPush: (input: any) => Promise<string>;
  gitReadFileAtRef: (input: any) => Promise<string>;
  gitRemote: (input: any) => Promise<string>;
  gitReset: (input: any) => Promise<string>;
  gitShow: (input: any) => Promise<string>;
  gitStatus: (input: any) => Promise<string>;
  gitTag: (input: any) => Promise<string>;
  gitUnstage: (input: any) => Promise<string>;
  readGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
  ) => Promise<string>;
  resolveGitCredentials: (
    db: ShadowClawDatabase,
    url: any,
  ) => Promise<{
    authorEmail?: string;
    authorName?: string;
    password?: string;
    token?: string;
    username?: string;
  }>;
}

export interface ResolvedGitCredentials {
  accountId?: string;
  authMode?: GitAuthMode;
  authorEmail?: string;
  authorName?: string;
  hostPattern?: string; // Host pattern from the matched account
  password?: string;
  provider?: GitProvider; // Detected or explicit provider type
  reauthRequired?: boolean;
  token?: string;
  username?: string;
}

export interface ResolveGitCredentialsOptions {
  accountId?: string;
  authMode?: GitAuthMode;
  forceRefresh?: boolean;
}
