import { jest } from "@jest/globals";

import {
  buildAuthorizeUrl,
  createPkceChallenge,
  registerOAuthRoutes,
} from "./oauth.js";

type Handler = (req: any, res: any) => any;

function createFakeApp() {
  const routes = {
    get: new Map<string, Handler>(),
    post: new Map<string, Handler>(),
  };

  return {
    routes,
    app: {
      get(path: string, handler: Handler) {
        routes.get.set(path, handler);
      },
      post(path: string, handler: Handler) {
        routes.post.set(path, handler);
      },
    },
  };
}

function createResponse() {
  const response: any = {
    statusCode: 200,
    body: undefined,
    contentType: undefined,
    status(code: number) {
      this.statusCode = code;

      return this;
    },
    json(payload: any) {
      this.body = payload;

      return this;
    },
    send(payload: any) {
      this.body = payload;

      return this;
    },
    type(value: string) {
      this.contentType = value;

      return this;
    },
  };

  return response;
}

describe("oauth-routes", () => {
  it("buildAuthorizeUrl should include required OAuth params", () => {
    const url = buildAuthorizeUrl(
      {
        providerId: "github",
        authorizeUrl: "https://example.com/oauth/authorize",
        tokenUrl: "https://example.com/oauth/token",
        clientId: "client-123",
        redirectUri: "http://localhost:8888/oauth/callback",
        scope: ["repo", "read:user"],
      },
      "state-123",
      "challenge-xyz",
    );

    const parsed = new URL(url);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe("client-123");
    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("scope")).toBe("repo read:user");
    expect(parsed.searchParams.get("code_challenge")).toBe("challenge-xyz");
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("createPkceChallenge should return deterministic hash for same verifier", () => {
    const verifier = "abc123";
    const one = createPkceChallenge(verifier);
    const two = createPkceChallenge(verifier);

    expect(one).toBe(two);
    expect(one.length).toBeGreaterThan(20);
  });

  it("should run authorize -> callback -> token flow with one-time state", async () => {
    const { app, routes } = createFakeApp();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "access-token-123",
          token_type: "Bearer",
          refresh_token: "refresh-token-123",
          expires_in: 3600,
          scope: "repo read:user",
        }),
    }));

    registerOAuthRoutes(app as any, {
      stateTtlMs: 60_000,
      now: () => 1000,
      fetchImpl: fetchMock as any,
    });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "github",
          clientId: "client-123",
          redirectUri: "http://localhost:8888/oauth/callback",
          scope: ["repo"],
        },
      },
      authorizeRes,
    );

    expect(authorizeRes.statusCode).toBe(200);
    expect(typeof authorizeRes.body.state).toBe("string");
    expect(authorizeRes.body.authorizeUrl).toContain("state=");

    const state = authorizeRes.body.state;

    const callbackRes = createResponse();
    await routes.get.get("/oauth/callback")!(
      {
        query: {
          state,
          code: "authorization-code-123",
        },
      },
      callbackRes,
    );

    expect(callbackRes.statusCode).toBe(200);
    expect(callbackRes.body).toContain("OAuth authorization complete");

    const tokenRes = createResponse();
    await routes.post.get("/oauth/token")!(
      {
        body: { state },
      },
      tokenRes,
    );

    expect(tokenRes.statusCode).toBe(200);
    expect(tokenRes.body.accessToken).toBe("access-token-123");
    expect(tokenRes.body.refreshToken).toBe("refresh-token-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // One-time use: replay should fail.
    const replayRes = createResponse();
    await routes.post.get("/oauth/token")!(
      {
        body: { state },
      },
      replayRes,
    );
    expect(replayRes.statusCode).toBe(400);
    expect(replayRes.body.error).toContain("Invalid or expired");
  });

  it("should reject callback with invalid state", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const callbackRes = createResponse();
    await routes.get.get("/oauth/callback")!(
      {
        query: {
          state: "nope",
          code: "abc",
        },
      },
      callbackRes,
    );

    expect(callbackRes.statusCode).toBe(400);
    expect(String(callbackRes.body)).toContain(
      "Invalid or expired OAuth state",
    );
  });

  it("should reject token exchange when callback has not completed", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "github",
          clientId: "client-123",
          redirectUri: "http://localhost:8888/oauth/callback",
        },
      },
      authorizeRes,
    );

    const tokenRes = createResponse();
    await routes.post.get("/oauth/token")!(
      {
        body: { state: authorizeRes.body.state },
      },
      tokenRes,
    );

    expect(tokenRes.statusCode).toBe(400);
    expect(tokenRes.body.error).toContain("callback not completed");
  });

  it("should reject unsupported provider IDs at authorize", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "unknown-provider",
          clientId: "client-123",
          redirectUri: "http://localhost:8888/oauth/callback",
        },
      },
      authorizeRes,
    );

    expect(authorizeRes.statusCode).toBe(400);
    expect(authorizeRes.body.error).toContain("Unsupported OAuth provider");
  });

  it("should reject scopes outside allowlisted provider scopes", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "github",
          clientId: "client-123",
          redirectUri: "http://localhost:8888/oauth/callback",
          scope: ["admin:org"],
        },
      },
      authorizeRes,
    );

    expect(authorizeRes.statusCode).toBe(400);
    expect(authorizeRes.body.error).toContain("not allowed");
  });

  it("should refresh access token via allowlisted provider endpoint", async () => {
    const { app, routes } = createFakeApp();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 1800,
          scope: "repo read:user",
          token_type: "Bearer",
        }),
    }));

    registerOAuthRoutes(app as any, {
      now: () => 1000,
      fetchImpl: fetchMock as any,
    });

    const refreshRes = createResponse();
    await routes.post.get("/oauth/refresh")!(
      {
        body: {
          providerId: "github",
          clientId: "client-123",
          refreshToken: "refresh-token-1",
          scope: ["repo"],
        },
      },
      refreshRes,
    );

    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.body.accessToken).toBe("new-access-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should reject refresh for unsupported provider IDs", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const refreshRes = createResponse();
    await routes.post.get("/oauth/refresh")!(
      {
        body: {
          providerId: "unknown-provider",
          clientId: "client-123",
          refreshToken: "refresh-token-1",
        },
      },
      refreshRes,
    );

    expect(refreshRes.statusCode).toBe(400);
    expect(refreshRes.body.error).toContain("Unsupported OAuth provider");
  });

  it("should not include scope parameter for Figma authorize when none requested", async () => {
    const { app, routes } = createFakeApp();
    registerOAuthRoutes(app as any, { now: () => 1000 });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "figma",
          clientId: "figma-client",
          redirectUri: "http://localhost:8888/oauth/callback",
        },
      },
      authorizeRes,
    );

    expect(authorizeRes.statusCode).toBe(200);
    const parsed = new URL(authorizeRes.body.authorizeUrl);
    expect(parsed.searchParams.has("scope")).toBe(false);
  });

  it("should use HTTP Basic auth for Figma token exchange", async () => {
    const { app, routes } = createFakeApp();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "figma-access",
          token_type: "bearer",
          refresh_token: "figma-refresh",
          expires_in: 3600,
        }),
    }));

    registerOAuthRoutes(app as any, {
      now: () => 1000,
      fetchImpl: fetchMock as any,
    });

    const authorizeRes = createResponse();
    await routes.post.get("/oauth/authorize")!(
      {
        body: {
          providerId: "figma",
          clientId: "figma-client",
          clientSecret: "figma-secret",
          redirectUri: "http://localhost:8888/oauth/callback",
        },
      },
      authorizeRes,
    );

    const state = authorizeRes.body.state;

    const callbackRes = createResponse();
    await routes.get.get("/oauth/callback")!(
      {
        query: {
          state,
          code: "figma-code",
        },
      },
      callbackRes,
    );

    const tokenRes = createResponse();
    await routes.post.get("/oauth/token")!(
      {
        body: { state },
      },
      tokenRes,
    );

    expect(tokenRes.statusCode).toBe(200);
    const fetchCall = fetchMock.mock.calls[0] as any[] | undefined;
    const fetchOptions = (fetchCall?.[1] || {}) as {
      headers?: Record<string, string>;
      body?: string;
    };
    expect(fetchOptions.headers?.authorization).toContain("Basic ");
    expect(String(fetchOptions.body)).not.toContain("client_secret=");
  });

  it("should use HTTP Basic auth for Figma refresh", async () => {
    const { app, routes } = createFakeApp();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          access_token: "figma-access-new",
          token_type: "bearer",
          expires_in: 1800,
        }),
    }));

    registerOAuthRoutes(app as any, {
      now: () => 1000,
      fetchImpl: fetchMock as any,
    });

    const refreshRes = createResponse();
    await routes.post.get("/oauth/refresh")!(
      {
        body: {
          providerId: "figma",
          clientId: "figma-client",
          clientSecret: "figma-secret",
          refreshToken: "refresh-token-1",
        },
      },
      refreshRes,
    );

    expect(refreshRes.statusCode).toBe(200);
    const fetchCall = fetchMock.mock.calls[0] as any[] | undefined;
    const fetchOptions = (fetchCall?.[1] || {}) as {
      headers?: Record<string, string>;
      body?: string;
    };
    expect(fetchOptions.headers?.authorization).toContain("Basic ");
    expect(String(fetchOptions.body)).not.toContain("client_secret=");
  });
});
