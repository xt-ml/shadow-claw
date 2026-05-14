import { jest } from "@jest/globals";

import { executeFetchUrlTool } from "./fetch-url.js";

function createResponse({
  status,
  statusText,
  contentType,
  body,
}: {
  status: number;
  statusText: string;
  contentType: string;
  body: string;
}) {
  const headers = new Map<string, string>([["content-type", contentType]]);

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers,
    text: jest.fn(async () => body),
    blob: jest.fn(async () => new Blob([body], { type: contentType })),
  } as any;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    fetchImpl: jest.fn(async () =>
      createResponse({
        status: 200,
        statusText: "OK",
        contentType: "text/plain",
        body: "ok",
      }),
    ),
    resolveGitCredentials: jest.fn(async () => ({ token: undefined })),
    buildAuthHeaders: jest.fn(() => ({})),
    resolveServiceCredentials: jest.fn(async () => undefined),
    withRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
    isRetryableFetchError: jest.fn(() => false),
    retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
    stripHtml: jest.fn((html: string) => html.replace(/<[^>]*>/g, "")),
    uploadGroupFile: jest.fn(async () => undefined),
    post: jest.fn(),
    fetchMaxResponse: 1000,
    ...overrides,
  } as any;
}

describe("worker/tools/fetch-url", () => {
  it("invokes fetchImpl with global context to avoid illegal invocation", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async function (this: unknown) {
        if (this !== globalThis) {
          throw new TypeError("Illegal invocation");
        }

        return createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/plain",
          body: "ok",
        });
      }),
    });

    const result = await executeFetchUrlTool(
      {} as any,
      { url: "https://x.test" },
      "group-1",
      deps,
    );

    expect(result).toContain("[HTTP 200 OK]");
  });

  it("handles GET html responses and strips markup", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/html",
          body: "<html><body>hello</body></html>",
        }),
      ),
    });

    const result = await executeFetchUrlTool(
      {} as any,
      { url: "https://x.test" },
      "group-1",
      deps,
    );

    expect(result).toContain("[HTTP 200 OK]");
    expect(result).toContain("hello");
    expect(deps.stripHtml).toHaveBeenCalled();
  });

  it("includes request and response headers when include_headers is true", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () => ({
        ...createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/plain",
          body: "payload",
        }),
        headers: new Map([
          ["content-type", "text/plain"],
          ["x-demo", "1"],
        ]),
      })),
    });

    const result = await executeFetchUrlTool(
      {} as any,
      {
        url: "https://x.test",
        include_headers: true,
        headers: { "X-Req": "v" },
      },
      "group-1",
      deps,
    );

    expect(result).toContain("--- Request Headers ---");
    expect(result).toContain("X-Req: v");
    expect(result).toContain("--- Response Headers ---");
    expect(result).toContain("x-demo: 1");
  });

  it("returns oauth reconnect guidance when service credentials need reauth", async () => {
    const deps = makeDeps({
      resolveServiceCredentials: jest.fn(async () => ({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "",
        reauthRequired: true,
      })),
    });

    const result = await executeFetchUrlTool(
      {} as any,
      { url: "https://api.github.com/user", use_account_auth: true },
      "group-1",
      deps,
    );

    expect(result).toContain("OAuth account reconnect required");
    expect((deps.fetchImpl as jest.Mock).mock.calls).toHaveLength(0);
  });

  it("refreshes oauth service token once on 401 and retries", async () => {
    const deps = makeDeps();
    const resolveServiceCredentialsMock = jest.fn() as any;
    resolveServiceCredentialsMock
      .mockResolvedValueOnce({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "Bearer stale",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "stale",
      })
      .mockResolvedValueOnce({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "Bearer fresh",
        service: "GitHub",
        hostPattern: "api.github.com",
        token: "fresh",
      });
    deps.resolveServiceCredentials = resolveServiceCredentialsMock;

    const fetchImplMock = jest.fn() as any;
    fetchImplMock
      .mockResolvedValueOnce(
        createResponse({
          status: 401,
          statusText: "Unauthorized",
          contentType: "application/json",
          body: "bad",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "application/json",
          body: '{"ok":true}',
        }),
      );
    deps.fetchImpl = fetchImplMock;

    const result = await executeFetchUrlTool(
      {} as any,
      {
        url: "https://api.github.com/user",
        use_account_auth: true,
        account_id: "svc-1",
        auth_mode: "oauth",
      },
      "group-1",
      deps,
    );

    expect(result).toContain('"ok":true');
    expect(deps.fetchImpl).toHaveBeenCalledTimes(2);
    expect(deps.resolveServiceCredentials).toHaveBeenNthCalledWith(
      2,
      {} as any,
      "https://api.github.com/user",
      {
        accountId: "svc-1",
        authMode: "oauth",
        forceRefresh: true,
      },
    );
  });

  it("detects login page responses on git hosts when auth is missing", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/html",
          body: "<html><body>Sign in Username Password</body></html>",
        }),
      ),
    });

    const result = await executeFetchUrlTool(
      {} as any,
      { url: "https://github.com/org/repo" },
      "group-1",
      deps,
    );

    expect(result).toContain("authentication page");
    expect(result).toContain("use_git_auth: true");
  });
});
