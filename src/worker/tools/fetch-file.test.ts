import { jest } from "@jest/globals";

import { executeFetchFileTool } from "./fetch-file.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  const bodyStr = typeof body === "string" ? body : "";

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers,
    text: jest.fn(async () => bodyStr),
    blob: jest.fn(
      async () =>
        new Blob([body], { type: contentType }) as unknown as Blob & {
          size: number;
        },
    ),
  } as any;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    fetchImpl: jest.fn(async () =>
      createResponse({
        status: 200,
        statusText: "OK",
        contentType: "text/plain",
        body: "hello world",
      }),
    ),
    resolveGitCredentials: jest.fn(async () => ({ token: undefined })),
    buildAuthHeaders: jest.fn(() => ({})),
    resolveServiceCredentials: jest.fn(async () => undefined),
    withRetry: jest.fn(async (fn: () => Promise<any>) => fn()),
    isRetryableFetchError: jest.fn(() => false),
    retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
    post: jest.fn(),
    writeGroupFile: jest.fn(async () => undefined),
    uploadGroupFile: jest.fn(async () => undefined),
    ...overrides,
  } as any;
}

// ── Path validation ───────────────────────────────────────────────────────────

describe("worker/tools/fetch-file — path validation", () => {
  it("returns an error when path is missing", async () => {
    const deps = makeDeps();
    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test" },
      "group-1",
      deps,
    );
    expect(result).toContain("Error: fetch_file requires a destination");
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("returns an error when path is empty after normalisation", async () => {
    const deps = makeDeps();
    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test", path: "   " },
      "group-1",
      deps,
    );
    expect(result).toContain("Error: fetch_file received an empty");
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("returns an error when path contains '..' traversal", async () => {
    const deps = makeDeps();
    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test", path: "../../etc/passwd" },
      "group-1",
      deps,
    );
    expect(result).toContain("cannot contain '..'");
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("strips leading slashes from path", async () => {
    const deps = makeDeps();
    await executeFetchFileTool(
      {} as any,
      { url: "https://x.test", path: "/data/file.txt" },
      "group-1",
      deps,
    );
    expect(deps.writeGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group-1",
      "data/file.txt",
      expect.any(String),
    );
  });
});

// ── Plain text responses ──────────────────────────────────────────────────────

describe("worker/tools/fetch-file — plain text", () => {
  it("writes text body to the workspace and returns byte count", async () => {
    const body = "hello world";
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/plain",
          body,
        }),
      ),
    });

    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test/file.txt", path: "data/file.txt" },
      "group-1",
      deps,
    );

    expect(deps.writeGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group-1",
      "data/file.txt",
      body,
    );
    expect(deps.uploadGroupFile).not.toHaveBeenCalled();
    expect(result).toContain(`Saved ${body.length} bytes`);
    expect(result).toContain("data/file.txt");
  });

  it("writes JSON responses as text", async () => {
    const body = '{"key":"value"}';
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "application/json",
          body,
        }),
      ),
    });

    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://api.test/data.json", path: "out/data.json" },
      "group-1",
      deps,
    );

    expect(deps.writeGroupFile).toHaveBeenCalledWith(
      {} as any,
      "group-1",
      "out/data.json",
      body,
    );
    expect(result).toContain("Saved");
  });
});

// ── Binary responses ──────────────────────────────────────────────────────────

describe("worker/tools/fetch-file — binary", () => {
  const binaryTypes = [
    { contentType: "image/png", expectMarkdown: "!" },
    { contentType: "image/jpeg", expectMarkdown: "!" },
    { contentType: "image/webp", expectMarkdown: "!" },
    { contentType: "application/pdf", expectMarkdown: null },
    { contentType: "application/zip", expectMarkdown: null },
    { contentType: "application/octet-stream", expectMarkdown: null },
    { contentType: "audio/mpeg", expectMarkdown: null },
    { contentType: "video/mp4", expectMarkdown: null },
  ];

  for (const { contentType, expectMarkdown } of binaryTypes) {
    it(`saves ${contentType} via uploadGroupFile`, async () => {
      const deps = makeDeps({
        fetchImpl: jest.fn(async () =>
          createResponse({
            status: 200,
            statusText: "OK",
            contentType,
            body: "binary-data",
          }),
        ),
      });

      const result = await executeFetchFileTool(
        {} as any,
        { url: "https://x.test/asset", path: "assets/asset.bin" },
        "group-1",
        deps,
      );

      expect(deps.uploadGroupFile).toHaveBeenCalledWith(
        {} as any,
        "group-1",
        "assets/asset.bin",
        expect.any(Blob),
      );
      expect(deps.writeGroupFile).not.toHaveBeenCalled();
      expect(result).toContain("Saved");
      expect(result).toContain("assets/asset.bin");

      if (expectMarkdown === "!") {
        expect(result).toContain("![assets/asset.bin]");
      } else {
        expect(result).toContain("[assets/asset.bin]");
        expect(result).not.toMatch(/!\[assets\/asset\.bin\]/);
      }
    });
  }
});

// ── HTTP errors ───────────────────────────────────────────────────────────────

describe("worker/tools/fetch-file — HTTP errors", () => {
  it("returns error message on non-ok response", async () => {
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 404,
          statusText: "Not Found",
          contentType: "text/plain",
          body: "not found",
        }),
      ),
    });

    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test/missing", path: "out/file.txt" },
      "group-1",
      deps,
    );

    expect(result).toContain("[HTTP 404 Not Found]");
    expect(deps.writeGroupFile).not.toHaveBeenCalled();
    expect(deps.uploadGroupFile).not.toHaveBeenCalled();
  });

  it("throws HttpError for retryable status codes so withRetry can back off", async () => {
    // Use a real-ish withRetry that records whether the inner fn threw
    let thrownError: unknown;
    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 503,
          statusText: "Service Unavailable",
          contentType: "text/plain",
          body: "down",
        }),
      ),
      withRetry: jest.fn(async (fn: () => Promise<any>, _opts: any) => {
        try {
          return await fn();
        } catch (err) {
          thrownError = err;
          // Simulate exhausted retries — re-throw so executeFetchFileTool gets it

          throw err;
        }
      }),
      isRetryableFetchError: jest.fn(() => true),
    });

    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test/flaky", path: "out/file.txt" },
      "group-1",
      deps,
    );

    // The inner fn should have thrown because 503 is in retryableStatusCodes
    expect(thrownError).toBeDefined();
    expect((thrownError as any).status).toBe(503);
    // After withRetry exhausts, the caught HttpError surfaces as an error result
    expect(result).toContain("503");
  });

  it("sends a toast notification on each retry", async () => {
    const postMock = jest.fn();
    let callCount = 0;

    const deps = makeDeps({
      fetchImpl: jest.fn(async () =>
        createResponse({
          status: 500,
          statusText: "Internal Server Error",
          contentType: "text/plain",
          body: "err",
        }),
      ),
      // A withRetry that invokes onRetry once before giving up
      withRetry: jest.fn(
        async (fn: () => Promise<any>, opts: any): Promise<any> => {
          try {
            return await fn();
          } catch (err) {
            callCount++;
            opts.onRetry(1, 3, 1000, err);

            throw err;
          }
        },
      ),
      post: postMock,
    });

    await executeFetchFileTool(
      {} as any,
      { url: "https://x.test/flaky", path: "out/file.txt" },
      "group-1",
      deps,
    ).catch(() => {});

    expect(postMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "show-toast",
        payload: expect.objectContaining({
          type: "warning",
          message: expect.stringContaining("fetch_file: Retrying"),
        }),
      }),
    );
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

describe("worker/tools/fetch-file — auth", () => {
  it("returns git reauth guidance when reauthRequired is true", async () => {
    const deps = makeDeps({
      resolveGitCredentials: jest.fn(async () => ({
        reauthRequired: true,
        hostPattern: "github.com",
        provider: "github",
      })),
    });

    const result = await executeFetchFileTool(
      {} as any,
      {
        url: "https://github.com/org/repo",
        path: "out/file.txt",
        use_git_auth: true,
      },
      "group-1",
      deps,
    );

    expect(result).toContain("OAuth Git account reconnect required");
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("returns service account reauth guidance when reauthRequired is true", async () => {
    const deps = makeDeps({
      resolveServiceCredentials: jest.fn(async () => ({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "",
        service: "MyService",
        hostPattern: "api.myservice.com",
        token: "",
        reauthRequired: true,
      })),
    });

    const result = await executeFetchFileTool(
      {} as any,
      {
        url: "https://api.myservice.com/data",
        path: "out/data.json",
        use_account_auth: true,
      },
      "group-1",
      deps,
    );

    expect(result).toContain("OAuth account reconnect required");
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it("refreshes oauth service token on 401 and retries", async () => {
    const resolveServiceCredentialsMock = jest.fn() as any;
    resolveServiceCredentialsMock
      .mockResolvedValueOnce({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "Bearer stale",
        service: "MyService",
        hostPattern: "api.myservice.com",
        token: "stale",
      })
      .mockResolvedValueOnce({
        accountId: "svc-1",
        authMode: "oauth",
        headerName: "Authorization",
        headerValue: "Bearer fresh",
        service: "MyService",
        hostPattern: "api.myservice.com",
        token: "fresh",
      });

    const fetchImplMock = jest.fn() as any;
    fetchImplMock
      .mockResolvedValueOnce(
        createResponse({
          status: 401,
          statusText: "Unauthorized",
          contentType: "application/json",
          body: "bad token",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          status: 200,
          statusText: "OK",
          contentType: "text/plain",
          body: "secret data",
        }),
      );

    const deps = makeDeps({
      fetchImpl: fetchImplMock,
      resolveServiceCredentials: resolveServiceCredentialsMock,
    });

    const result = await executeFetchFileTool(
      {} as any,
      {
        url: "https://api.myservice.com/data",
        path: "out/data.txt",
        use_account_auth: true,
        account_id: "svc-1",
        auth_mode: "oauth",
      },
      "group-1",
      deps,
    );

    expect(deps.fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toContain("Saved");
  });
});

// ── Bind safety ───────────────────────────────────────────────────────────────

describe("worker/tools/fetch-file — bind safety", () => {
  it("calls fetchImpl bound to globalThis", async () => {
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

    const result = await executeFetchFileTool(
      {} as any,
      { url: "https://x.test", path: "out/ok.txt" },
      "group-1",
      deps,
    );

    expect(result).toContain("Saved");
  });
});
