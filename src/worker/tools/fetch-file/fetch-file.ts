import { hasPathTraversal } from "../workspace/utils/hasPathTraversal.js";
import { normalizeWorkspacePath } from "../workspace/utils/normalizeWorkspacePath.js";

import { HttpError } from "./utils/HttpError.js";
import { isBinaryContentType } from "./utils/isBinaryContentType.js";
import { parseAuthMode } from "./utils/parseAuthMode.js";

import type { ShadowClawDatabase } from "../../../db/types.js";
import type { AccountAuthMode } from "../../../subsystems/accounts/service-accounts.js";
import type { GitAuthMode, ResolvedGitCredentials } from "../../../subsystems/git/types.js";

interface FetchFileResult {
  response: Response;
  contentType: string;
}

export interface FetchFileDeps {
  fetchImpl: typeof fetch;
  resolveGitCredentials: (
    db: ShadowClawDatabase,
    url: string,
    options?: {
      accountId?: string;
      authMode?: GitAuthMode;
      forceRefresh?: boolean;
    },
  ) => Promise<ResolvedGitCredentials>;
  buildAuthHeaders: (credentials: {
    token?: string;
    username?: string;
    password?: string;
    hostPattern?: string;
    provider?: ResolvedGitCredentials["provider"];
    authMode?: ResolvedGitCredentials["authMode"];
    reauthRequired?: boolean;
  }) => Record<string, string>;
  resolveServiceCredentials: (
    db: ShadowClawDatabase,
    url: string,
    options?: {
      accountId?: string;
      authMode?: AccountAuthMode;
      forceRefresh?: boolean;
    },
  ) => Promise<
    | {
        accountId: string;
        authMode: "token" | "oauth" | "basic";
        headerName: string;
        headerValue: string;
        service: string;
        hostPattern: string;
        token: string;
        reauthRequired?: boolean;
      }
    | undefined
  >;
  withRetry: <T>(
    fn: () => Promise<T>,
    options: {
      maxRetries: number;
      baseDelayMs: number;
      jitterFactor: number;
      shouldRetry: (error: unknown) => boolean;
      onRetry: (
        attempt: number,
        maxRetries: number,
        delayMs: number,
        error: unknown,
      ) => void;
    },
  ) => Promise<T>;
  isRetryableFetchError: (error: unknown) => boolean;
  retryableStatusCodes: Set<number>;
  post: (message: {
    type: "show-toast";
    payload: {
      message: string;
      type: "warning";
      duration: number;
    };
  }) => void;
  writeGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
    content: string,
  ) => Promise<void>;
  uploadGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
    content: Blob,
  ) => Promise<void>;
}

export interface HttpErrorLike extends Error {
  status: number;
  statusText: string;
  body: string;
}

export async function executeFetchFileTool(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
  deps: FetchFileDeps,
): Promise<string> {
  try {
    // ── Validate destination path ─────────────────────────────────────────────
    if (!input.path || typeof input.path !== "string") {
      return "Error: fetch_file requires a destination 'path' string.";
    }

    const destPath = normalizeWorkspacePath(input.path);
    if (!destPath) {
      return "Error: fetch_file received an empty destination path.";
    }

    if (hasPathTraversal(destPath)) {
      return "Error: fetch_file destination path cannot contain '..' segments.";
    }

    // ── Build request headers (auth) ──────────────────────────────────────────
    const fetchHeaders: Record<string, string> = {
      ...(input.headers || {}),
    };

    const authMode = parseAuthMode(input.auth_mode);
    const serviceAccountId =
      typeof input.account_id === "string" ? input.account_id : undefined;

    let resolvedGitCredentials:
      | {
          accountId?: string;
          authMode?: "token" | "oauth" | "basic" | "basic";
          hostPattern?: string;
          provider?: string;
          reauthRequired?: boolean;
        }
      | undefined;
    let resolvedServiceCredentials:
      | {
          accountId: string;
          authMode: "token" | "oauth" | "basic";
          headerName: string;
          headerValue: string;
          service: string;
          hostPattern: string;
          token: string;
        }
      | undefined;

    if (input.use_git_auth) {
      const creds = await deps.resolveGitCredentials(db, input.url, {
        accountId:
          typeof input.git_account_id === "string"
            ? input.git_account_id
            : undefined,
        authMode,
      });
      resolvedGitCredentials = creds;
      if (creds.reauthRequired) {
        return (
          `OAuth Git account reconnect required for ${creds.hostPattern || creds.provider || "this remote"}.\n` +
          "Open Settings \u2192 Git, edit this account, and click Connect OAuth to re-authorize."
        );
      }

      const authHeaders = deps.buildAuthHeaders(creds);
      Object.assign(fetchHeaders, authHeaders);
    }

    if (input.use_account_auth) {
      const creds = await deps.resolveServiceCredentials(db, input.url, {
        accountId: serviceAccountId,
        authMode,
      });
      resolvedServiceCredentials = creds;
      if (creds?.reauthRequired) {
        return (
          `OAuth account reconnect required for ${creds.service} (${creds.hostPattern}).\n` +
          "Open Settings \u2192 Accounts, edit this account, and click Connect OAuth to re-authorize."
        );
      }

      if (creds?.headerValue) {
        fetchHeaders[creds.headerName] = creds.headerValue;
      }
    }

    // ── Perform the fetch with retry ──────────────────────────────────────────
    const fetchImpl = deps.fetchImpl.bind(globalThis);

    const runFetchWithRetry = async (): Promise<FetchFileResult> =>
      deps.withRetry(
        async () => {
          const res = await fetchImpl(input.url, {
            method: input.method || "GET",
            headers: fetchHeaders,
            body: input.body,
          });

          const contentType = res.headers.get("content-type") || "";

          // Throw on retryable HTTP error codes so withRetry can back off and
          // re-attempt — mirrors the fetch-url pattern.
          if (!res.ok && deps.retryableStatusCodes.has(res.status)) {
            const preview = await res.text().catch(() => "");

            throw new HttpError(res.status, res.statusText, preview);
          }

          return { response: res, contentType };
        },
        {
          maxRetries: 3,
          baseDelayMs: 1000,
          jitterFactor: 0.5,
          shouldRetry: (error) => deps.isRetryableFetchError(error),
          onRetry: (_attempt, _maxRetries, _delayMs, _error) => {
            const errMsg =
              _error instanceof Error ? _error.message : String(_error);

            deps.post({
              type: "show-toast",
              payload: {
                message: `fetch_file: Retrying (${_attempt}/${_maxRetries})… ${errMsg}`,
                type: "warning",
                duration: 4000,
              },
            });
          },
        },
      );

    let { response: res, contentType } = await runFetchWithRetry();

    // ── OAuth token refresh on 401/403 ────────────────────────────────────────
    if (
      (res.status === 401 || res.status === 403) &&
      input.use_account_auth &&
      resolvedServiceCredentials?.authMode === "oauth"
    ) {
      const refreshed = await deps.resolveServiceCredentials(db, input.url, {
        accountId: resolvedServiceCredentials.accountId || serviceAccountId,
        authMode,
        forceRefresh: true,
      });

      if (
        refreshed?.headerValue &&
        refreshed.headerValue !== fetchHeaders[refreshed.headerName]
      ) {
        fetchHeaders[refreshed.headerName] = refreshed.headerValue;
        ({ response: res, contentType } = await runFetchWithRetry());
      }
    }

    if (
      (res.status === 401 || res.status === 403) &&
      input.use_git_auth &&
      resolvedGitCredentials?.authMode === "oauth"
    ) {
      const refreshed = await deps.resolveGitCredentials(db, input.url, {
        accountId:
          resolvedGitCredentials.accountId ||
          (typeof input.git_account_id === "string"
            ? input.git_account_id
            : undefined),
        authMode,
        forceRefresh: true,
      });

      if (refreshed.reauthRequired) {
        return (
          `OAuth Git account reconnect required for ${refreshed.hostPattern || refreshed.provider || "this remote"}.\n` +
          "Open Settings \u2192 Git, edit this account, and click Connect OAuth to re-authorize."
        );
      }

      const refreshedHeaders = deps.buildAuthHeaders(refreshed);
      const headersChanged = Object.entries(refreshedHeaders).some(
        ([key, value]) => fetchHeaders[key] !== value,
      );

      if (headersChanged) {
        Object.assign(fetchHeaders, refreshedHeaders);
        ({ response: res, contentType } = await runFetchWithRetry());
      }
    }

    if (!res.ok) {
      const preview = await res.text().catch(() => "");

      return `[HTTP ${res.status} ${res.statusText}]\nError fetching URL. Content preview:\n${preview.slice(0, 1000)}`;
    }

    // ── Save to workspace ─────────────────────────────────────────────────────
    if (isBinaryContentType(contentType)) {
      const blob = await res.blob();
      await deps.uploadGroupFile(db, groupId, destPath, blob);

      const markdownSnippet = contentType.includes("image/")
        ? `![${destPath}](${destPath})`
        : `[${destPath}](${destPath})`;

      return (
        `Saved ${blob.size} bytes to workspace path: ${destPath}\n\n` +
        `To display this file to the user, output this Markdown in your response:\n${markdownSnippet}`
      );
    }

    const text = await res.text();
    await deps.writeGroupFile(db, groupId, destPath, text);

    return `Saved ${text.length} bytes to workspace path: ${destPath}`;
  } catch (fetchErr) {
    if (fetchErr instanceof HttpError) {
      return `[HTTP ${fetchErr.status} ${fetchErr.statusText}]\nError fetching URL after retries. Content preview:\n${fetchErr.body.slice(0, 1000)}`;
    }

    const errMsg =
      fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

    return `Network Error: Failed to fetch ${input.url} (after retries).\nReason: ${errMsg}\nCheck if the URL is correct and the server is reachable.`;
  }
}
