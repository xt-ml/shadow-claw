import type { AccountAuthMode } from "../../accounts/service-accounts.js";
import type {
  GitAuthMode,
  ResolvedGitCredentials,
} from "../../git/credentials.js";
import type { ShadowClawDatabase } from "../../types.js";

interface FetchResult {
  status: string;
  body: string;
  headers: string;
  ok: boolean;
  fetchStatus: number;
}

interface HttpErrorLike extends Error {
  status: number;
  statusText: string;
  body: string;
  headers: string;
}

export interface FetchUrlDeps {
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
        authMode: "pat" | "oauth";
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
  stripHtml: (html: string) => string;
  uploadGroupFile: (
    db: ShadowClawDatabase,
    groupId: string,
    path: string,
    content: Blob,
  ) => Promise<void>;
  post: (message: {
    type: "show-toast";
    payload: {
      message: string;
      type: "warning";
      duration: number;
    };
  }) => void;
  fetchMaxResponse: number;
}

class HttpError extends Error implements HttpErrorLike {
  public status: number;
  public statusText: string;
  public body: string;
  public headers: string;

  constructor(status: number, statusText: string, body: string, headers = "") {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.headers = headers;
  }
}

function parseAuthMode(
  value: unknown,
): AccountAuthMode | GitAuthMode | undefined {
  if (value === "pat" || value === "oauth") {
    return value;
  }

  return undefined;
}

export async function executeFetchUrlTool(
  db: ShadowClawDatabase,
  input: Record<string, any>,
  groupId: string,
  deps: FetchUrlDeps,
): Promise<string> {
  try {
    const fetchHeaders: Record<string, string> = {
      ...(input.headers || {}),
    };
    const authMode = parseAuthMode(input.auth_mode);
    const serviceAccountId =
      typeof input.account_id === "string" ? input.account_id : undefined;
    let resolvedGitCredentials:
      | {
          accountId?: string;
          authMode?: "pat" | "oauth";
          hostPattern?: string;
          provider?: string;
          reauthRequired?: boolean;
        }
      | undefined;
    let resolvedServiceCredentials:
      | {
          accountId: string;
          authMode: "pat" | "oauth";
          headerName: string;
          headerValue: string;
          service: string;
          hostPattern: string;
          token: string;
        }
      | undefined;
    const fetchImpl = deps.fetchImpl.bind(globalThis);

    const runFetchWithRetry = async () =>
      deps.withRetry(
        async () => {
          const fetchRes = await fetchImpl(input.url, {
            method: input.method || "GET",
            headers: fetchHeaders,
            body: input.body,
          });

          const contentType = fetchRes.headers.get("content-type") || "";
          const statusLine = `[HTTP ${fetchRes.status} ${fetchRes.statusText}]\n`;

          const isBinary =
            contentType.includes("image/") ||
            contentType.includes("video/") ||
            contentType.includes("audio/") ||
            contentType.includes("application/pdf") ||
            contentType.includes("application/octet-stream") ||
            contentType.includes("application/zip");

          if (isBinary && fetchRes.ok) {
            const blob = await fetchRes.blob();
            const urlObj = new URL(input.url);
            const filenameMatch = urlObj.pathname.split("/").pop();
            const baseName = filenameMatch || `file_${Date.now()}`;

            let ext = "";
            if (!baseName.includes(".")) {
              if (contentType.includes("image/jpeg")) {
                ext = ".jpg";
              } else if (contentType.includes("image/png")) {
                ext = ".png";
              } else if (contentType.includes("image/gif")) {
                ext = ".gif";
              } else if (contentType.includes("image/webp")) {
                ext = ".webp";
              } else if (contentType.includes("application/pdf")) {
                ext = ".pdf";
              }
            }

            const filename = `${baseName}${ext}`;
            const savePath = `downloads/${filename}`;

            await deps.uploadGroupFile(db, groupId, savePath, blob);

            let headerInfo = "";
            if (input.include_headers) {
              headerInfo += "--- Request Headers ---\n";
              for (const [key, value] of Object.entries(fetchHeaders)) {
                headerInfo += `${key}: ${value}\n`;
              }

              headerInfo += "\n--- Response Headers ---\n";
              fetchRes.headers.forEach((v, k) => {
                headerInfo += `${k}: ${v}\n`;
              });
              headerInfo += "\n";
            }

            const markdownSnippet = contentType.includes("image/")
              ? `![Attachment](${savePath})`
              : `[Attachment](${savePath})`;
            const successMsg = `Successfully downloaded binary file (${blob.size} bytes) to workspace path: ${savePath}\n\nTo display this file to the user, output this Markdown in your response:\n${markdownSnippet}`;

            return {
              status: statusLine,
              body: successMsg,
              headers: headerInfo,
              ok: true,
              fetchStatus: fetchRes.status,
            } satisfies FetchResult;
          }

          const rawText = await fetchRes.text();
          let headerInfo = "";
          if (input.include_headers) {
            headerInfo += "--- Request Headers ---\n";
            for (const [key, value] of Object.entries(fetchHeaders)) {
              headerInfo += `${key}: ${value}\n`;
            }

            headerInfo += "\n--- Response Headers ---\n";
            fetchRes.headers.forEach((v, k) => {
              headerInfo += `${k}: ${v}\n`;
            });
            headerInfo += "\n";
          }

          let processedBody = rawText;
          if (
            contentType.includes("html") ||
            rawText.trimStart().startsWith("<")
          ) {
            processedBody = deps.stripHtml(rawText);
          }

          if (!fetchRes.ok && deps.retryableStatusCodes.has(fetchRes.status)) {
            throw new HttpError(
              fetchRes.status,
              fetchRes.statusText,
              processedBody,
              headerInfo,
            );
          }

          return {
            status: statusLine,
            body: processedBody,
            headers: headerInfo,
            ok: fetchRes.ok,
            fetchStatus: fetchRes.status,
          } satisfies FetchResult;
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
                message: `fetch_url: Retrying (${_attempt}/${_maxRetries})… ${errMsg}`,
                type: "warning",
                duration: 4000,
              },
            });
          },
        },
      );

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
          "Open Settings -> Git, edit this account, and click Connect OAuth to re-authorize."
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
          "Open Settings -> Accounts, edit this account, and click Connect OAuth to re-authorize."
        );
      }

      if (creds?.headerValue) {
        fetchHeaders[creds.headerName] = creds.headerValue;
      }
    }

    let fetchResult = await runFetchWithRetry();

    if (
      (fetchResult.fetchStatus === 401 || fetchResult.fetchStatus === 403) &&
      input.use_account_auth &&
      resolvedServiceCredentials?.authMode === "oauth"
    ) {
      const refreshedCredentials = await deps.resolveServiceCredentials(
        db,
        input.url,
        {
          accountId: resolvedServiceCredentials.accountId || serviceAccountId,
          authMode,
          forceRefresh: true,
        },
      );

      if (
        refreshedCredentials?.headerValue &&
        refreshedCredentials.headerValue !==
          fetchHeaders[refreshedCredentials.headerName]
      ) {
        fetchHeaders[refreshedCredentials.headerName] =
          refreshedCredentials.headerValue;
        fetchResult = await runFetchWithRetry();
      }
    }

    if (
      (fetchResult.fetchStatus === 401 || fetchResult.fetchStatus === 403) &&
      input.use_git_auth &&
      resolvedGitCredentials?.authMode === "oauth"
    ) {
      const refreshedCredentials = await deps.resolveGitCredentials(
        db,
        input.url,
        {
          accountId:
            resolvedGitCredentials.accountId ||
            (typeof input.git_account_id === "string"
              ? input.git_account_id
              : undefined),
          authMode,
          forceRefresh: true,
        },
      );

      if (refreshedCredentials.reauthRequired) {
        return (
          `OAuth Git account reconnect required for ${refreshedCredentials.hostPattern || refreshedCredentials.provider || "this remote"}.\n` +
          "Open Settings -> Git, edit this account, and click Connect OAuth to re-authorize."
        );
      }

      const refreshedHeaders = deps.buildAuthHeaders(refreshedCredentials);
      const headersChanged = Object.entries(refreshedHeaders).some(
        ([key, value]) => fetchHeaders[key] !== value,
      );

      if (headersChanged) {
        Object.assign(fetchHeaders, refreshedHeaders);
        fetchResult = await runFetchWithRetry();
      }
    }

    const { status, body, headers } = fetchResult;

    if (!body && status.includes("Error")) {
      return status;
    }

    const statusCodeMatch = status.match(/HTTP (\d+)/);
    const statusCode = statusCodeMatch ? Number(statusCodeMatch[1]) : 200;

    if (statusCode >= 400) {
      let hint = "";
      if (
        statusCode === 401 &&
        !input.use_git_auth &&
        /github|git\.|ghe\.|dev\.azure\.com|visualstudio\.com|gitlab/i.test(
          input.url,
        )
      ) {
        hint =
          "\n\nHint: This looks like a Git host and you received a 401. " +
          "Retry with use_git_auth: true to inject the saved Git credentials " +
          "(auth format is auto-detected per provider).";
      } else if (statusCode === 401 && !input.use_account_auth) {
        const svcCreds = await deps.resolveServiceCredentials(db, input.url);
        if (svcCreds) {
          hint =
            `\n\nHint: A saved account for "${svcCreds.service}" (${svcCreds.hostPattern}) ` +
            "was found. Retry with use_account_auth: true to inject that PAT.";
        }
      }

      return `${status}${headers}Error fetching URL. Content preview:\n${body.slice(0, 1000)}${hint}`;
    }

    const gitHostRe =
      /github|git\.|ghe\.|dev\.azure\.com|visualstudio\.com|gitlab/i;
    if (
      statusCode === 200 &&
      !input.use_git_auth &&
      gitHostRe.test(input.url) &&
      /sign.in|log.?in|username.*password/i.test(body)
    ) {
      return (
        `${status}${headers}` +
        "⚠️ The server returned a login/authentication page instead of API data. " +
        "This usually means the request requires authentication.\n\n" +
        "Hint: Retry with use_git_auth: true to inject the saved Git credentials.\n\n" +
        `Page preview:\n${body.slice(0, 500)}`
      );
    }

    const truncated = body.length > deps.fetchMaxResponse;
    const content = truncated
      ? body.slice(0, deps.fetchMaxResponse) +
        `\n\n--- Response truncated (showed ${deps.fetchMaxResponse.toLocaleString()} of ${body.length.toLocaleString()} chars) ---`
      : body;

    return status + headers + content;
  } catch (fetchErr) {
    if (fetchErr instanceof HttpError) {
      return `[HTTP ${fetchErr.status} ${fetchErr.statusText}]\n${fetchErr.headers}Error fetching URL after retries. Content preview:\n${fetchErr.body.slice(0, 1000)}`;
    }

    const errMsg =
      fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

    return `Network Error: Failed to fetch ${input.url} (after retries).\nReason: ${errMsg}\nCheck if the URL is correct and the server is reachable. If this is a CORS issue, it may be blocked by the browser.`;
  }
}
