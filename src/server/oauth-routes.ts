import { createHash, randomBytes } from "node:crypto";

import { getOAuthProviderDefinition } from "../config.js";

import type { Express, Request, Response } from "express";

export interface OAuthAuthorizeRequest {
  providerId: string;
  clientId: string;
  redirectUri: string;
  scope?: string | string[];
  audience?: string;
  clientSecret?: string;
  extraAuthorizeParams?: Record<string, string>;
  /** Custom authorize URL override (only accepted for custom_mcp provider). */
  authorizeUrl?: string;
  /** Custom token URL override (only accepted for custom_mcp provider). */
  tokenUrl?: string;
  /** Custom PKCE override (only accepted for custom_mcp provider). */
  usePkce?: boolean;
}

export interface OAuthRefreshRequest {
  providerId: string;
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  scope?: string | string[];
  /** Custom token URL override (only accepted for custom_mcp provider). */
  tokenUrl?: string;
}

interface OAuthAuthorizeUrlInput extends OAuthAuthorizeRequest {
  authorizeUrl: string;
  tokenUrl: string;
  usePkce?: boolean;
  scopeSeparator?: "space" | "comma";
}

interface PendingOAuthSession {
  providerId: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  codeVerifier?: string;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "authorized" | "error";
  authorizationCode?: string;
  authorizationError?: string;
  authorizationErrorDescription?: string;
}

interface RegisterOAuthRoutesOptions {
  stateTtlMs?: number;
  now?: () => number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

export function createRandomToken(size = 32): string {
  return randomBytes(size).toString("base64url");
}

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function isSafeAbsoluteUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function asScopeString(
  scope?: string | string[],
  separator: "space" | "comma" = "space",
): string {
  const joiner = separator === "comma" ? "," : " ";

  if (Array.isArray(scope)) {
    return scope.filter(Boolean).join(joiner).trim();
  }

  return typeof scope === "string" ? scope.trim() : "";
}

function parseScopeList(scope?: string | string[]): string[] {
  if (Array.isArray(scope)) {
    return scope
      .flatMap((item) => item.split(/[\s,]+/))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof scope === "string") {
    return scope
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function areScopesAllowed(allowed: string[], requested: string[]): boolean {
  if (!allowed.length || !requested.length) {
    return true;
  }

  const allowedSet = new Set(allowed);

  return requested.every((scope) => allowedSet.has(scope));
}

function buildClientAuthHeaders(
  clientAuthMethod: "request_body" | "basic_header" | undefined,
  clientId: string,
  clientSecret?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };

  if (clientAuthMethod === "basic_header" && clientSecret) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.authorization = `Basic ${basic}`;
  }

  return headers;
}

export function buildAuthorizeUrl(
  request: OAuthAuthorizeUrlInput,
  state: string,
  codeChallenge?: string,
): string {
  const url = new URL(request.authorizeUrl);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", request.clientId);
  url.searchParams.set("redirect_uri", request.redirectUri);
  url.searchParams.set("state", state);

  const scope = asScopeString(request.scope, request.scopeSeparator);
  if (scope) {
    url.searchParams.set("scope", scope);
  }

  if (request.audience) {
    url.searchParams.set("audience", request.audience);
  }

  if (codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (request.extraAuthorizeParams) {
    for (const [key, value] of Object.entries(request.extraAuthorizeParams)) {
      if (!value) {
        continue;
      }

      if (
        !["response_type", "client_id", "redirect_uri", "state"].includes(key)
      ) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

export function registerOAuthRoutes(
  app: Pick<Express, "post" | "get">,
  options: RegisterOAuthRoutesOptions = {},
): void {
  const now = options.now || (() => Date.now());
  const fetchImpl = options.fetchImpl || fetch;
  const stateTtlMs = options.stateTtlMs || DEFAULT_STATE_TTL_MS;
  const sessions = new Map<string, PendingOAuthSession>();

  function cleanupExpiredSessions(): void {
    const currentTime = now();
    for (const [state, session] of sessions.entries()) {
      if (session.expiresAt <= currentTime) {
        sessions.delete(state);
      }
    }
  }

  function getActiveSession(state: string): PendingOAuthSession | undefined {
    cleanupExpiredSessions();
    const session = sessions.get(state);

    if (!session) {
      return undefined;
    }

    if (session.expiresAt <= now()) {
      sessions.delete(state);

      return undefined;
    }

    return session;
  }

  app.post("/oauth/authorize", (req: Request, res: Response) => {
    cleanupExpiredSessions();
    const body = (req.body || {}) as OAuthAuthorizeRequest;

    if (!body.providerId || typeof body.providerId !== "string") {
      res.status(400).json({ error: "Missing required providerId" });

      return;
    }

    const provider = getOAuthProviderDefinition(body.providerId);
    if (!provider) {
      res.status(400).json({
        error: "Unsupported OAuth provider",
        providerId: body.providerId,
      });

      return;
    }

    // For custom_mcp, allow caller-supplied OAuth URLs (validated below).
    const isCustomMcp = body.providerId === "custom_mcp";
    const effectiveAuthorizeUrl =
      isCustomMcp && isSafeAbsoluteUrl(body.authorizeUrl)
        ? body.authorizeUrl
        : provider.authorizeUrl;
    const effectiveTokenUrl =
      isCustomMcp && isSafeAbsoluteUrl(body.tokenUrl)
        ? body.tokenUrl
        : provider.tokenUrl;
    const effectiveUsePkce =
      isCustomMcp && typeof body.usePkce === "boolean"
        ? body.usePkce
        : provider.usePkce;

    if (!isSafeAbsoluteUrl(effectiveAuthorizeUrl)) {
      res.status(isCustomMcp ? 400 : 500).json({
        error: isCustomMcp
          ? "Custom MCP requires a valid authorizeUrl"
          : "Invalid provider authorizeUrl configuration",
      });

      return;
    }

    if (!isSafeAbsoluteUrl(effectiveTokenUrl)) {
      res.status(isCustomMcp ? 400 : 500).json({
        error: isCustomMcp
          ? "Custom MCP requires a valid tokenUrl"
          : "Invalid provider tokenUrl configuration",
      });

      return;
    }

    if (!isSafeAbsoluteUrl(body.redirectUri)) {
      res.status(400).json({ error: "Invalid redirectUri" });

      return;
    }

    if (!body.clientId || typeof body.clientId !== "string") {
      res.status(400).json({ error: "Missing required clientId" });

      return;
    }

    const requestedScopes = parseScopeList(body.scope);
    if (!areScopesAllowed(provider.defaultScopes, requestedScopes)) {
      res.status(400).json({
        error: "Requested scopes are not allowed for this provider",
      });

      return;
    }

    const effectiveScopes = requestedScopes.length
      ? requestedScopes
      : provider.defaultScopes;

    const state = createRandomToken();
    const shouldUsePkce = effectiveUsePkce;
    const codeVerifier = shouldUsePkce ? createRandomToken(48) : undefined;
    const codeChallenge = codeVerifier
      ? createPkceChallenge(codeVerifier)
      : undefined;

    const createdAt = now();
    const expiresAt = createdAt + stateTtlMs;

    sessions.set(state, {
      providerId: body.providerId,
      tokenUrl: effectiveTokenUrl,
      clientId: body.clientId,
      clientSecret: body.clientSecret,
      redirectUri: body.redirectUri,
      codeVerifier,
      createdAt,
      expiresAt,
      status: "pending",
    });

    const authorizeUrl = buildAuthorizeUrl(
      {
        ...body,
        authorizeUrl: effectiveAuthorizeUrl,
        tokenUrl: effectiveTokenUrl,
        scope: effectiveScopes,
        usePkce: effectiveUsePkce,
        scopeSeparator: provider.scopeSeparator,
      },
      state,
      codeChallenge,
    );

    res.json({
      state,
      providerId: body.providerId,
      authorizeUrl,
      expiresAt,
      pkceEnabled: shouldUsePkce,
      codeChallengeMethod: shouldUsePkce ? "S256" : undefined,
    });
  });

  app.get("/oauth/callback", (req: Request, res: Response) => {
    cleanupExpiredSessions();
    const state =
      typeof req.query.state === "string" ? req.query.state.trim() : "";

    if (!state) {
      res.status(400).send("Missing state");

      return;
    }

    const session = getActiveSession(state);
    if (!session) {
      res.status(400).send("Invalid or expired OAuth state");

      return;
    }

    const error =
      typeof req.query.error === "string" ? req.query.error : undefined;
    const errorDescription =
      typeof req.query.error_description === "string"
        ? req.query.error_description
        : undefined;

    if (error) {
      session.status = "error";
      session.authorizationError = error;
      session.authorizationErrorDescription = errorDescription;

      res.status(400).send(`OAuth authorization failed: ${error}`);

      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      res.status(400).send("Missing authorization code");

      return;
    }

    session.status = "authorized";
    session.authorizationCode = code;

    res.type("html").send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>OAuth Complete</title></head>
  <body>
    <p>OAuth authorization complete. You can close this window.</p>
  </body>
</html>`);
  });

  app.get("/oauth/session/:state", (req: Request, res: Response) => {
    const state =
      typeof req.params.state === "string" ? req.params.state.trim() : "";
    if (!state) {
      res.status(400).json({ error: "Missing state" });

      return;
    }

    const session = getActiveSession(state);

    if (!session) {
      res.status(404).json({ error: "OAuth session not found" });

      return;
    }

    res.json({
      providerId: session.providerId,
      status: session.status,
      expiresAt: session.expiresAt,
      error: session.authorizationError,
      errorDescription: session.authorizationErrorDescription,
    });
  });

  app.post("/oauth/token", async (req: Request, res: Response) => {
    cleanupExpiredSessions();
    const state =
      typeof req.body?.state === "string" ? req.body.state.trim() : "";

    if (!state) {
      res.status(400).json({ error: "Missing required state" });

      return;
    }

    const session = getActiveSession(state);
    if (!session) {
      res.status(400).json({ error: "Invalid or expired OAuth state" });

      return;
    }

    if (session.status !== "authorized" || !session.authorizationCode) {
      res.status(400).json({
        error: "OAuth callback not completed for this state",
      });

      return;
    }

    const provider = getOAuthProviderDefinition(session.providerId);
    if (!provider) {
      sessions.delete(state);
      res.status(400).json({ error: "Unsupported OAuth provider" });

      return;
    }

    const params = new URLSearchParams();
    params.set("grant_type", "authorization_code");
    params.set("code", session.authorizationCode);
    params.set("client_id", session.clientId);
    params.set("redirect_uri", session.redirectUri);

    if (
      session.clientSecret &&
      (provider.clientAuthMethod || "request_body") !== "basic_header"
    ) {
      params.set("client_secret", session.clientSecret);
    }

    if (session.codeVerifier) {
      params.set("code_verifier", session.codeVerifier);
    }

    try {
      const response = await fetchImpl(session.tokenUrl, {
        method: "POST",
        headers: buildClientAuthHeaders(
          provider.clientAuthMethod,
          session.clientId,
          session.clientSecret,
        ),
        body: params.toString(),
      });

      const rawBody = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawBody
          ? (JSON.parse(rawBody) as Record<string, unknown>)
          : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        sessions.delete(state);
        res.status(502).json({
          error: "OAuth token exchange failed",
          status: response.status,
          upstreamError:
            payload.error || payload.error_description || "unknown_error",
        });

        return;
      }

      const accessToken =
        typeof payload.access_token === "string" ? payload.access_token : "";

      if (!accessToken) {
        sessions.delete(state);
        res
          .status(502)
          .json({ error: "OAuth token exchange returned no access_token" });

        return;
      }

      sessions.delete(state);

      res.json({
        providerId: session.providerId,
        accessToken,
        tokenType:
          typeof payload.token_type === "string"
            ? payload.token_type
            : "Bearer",
        refreshToken:
          typeof payload.refresh_token === "string"
            ? payload.refresh_token
            : undefined,
        expiresIn:
          typeof payload.expires_in === "number"
            ? payload.expires_in
            : undefined,
        scope: typeof payload.scope === "string" ? payload.scope : undefined,
      });
    } catch {
      sessions.delete(state);
      res.status(502).json({ error: "OAuth token exchange network error" });
    }
  });

  app.post("/oauth/refresh", async (req: Request, res: Response) => {
    const body = (req.body || {}) as OAuthRefreshRequest;

    if (!body.providerId || typeof body.providerId !== "string") {
      res.status(400).json({ error: "Missing required providerId" });

      return;
    }

    const provider = getOAuthProviderDefinition(body.providerId);
    if (!provider) {
      res.status(400).json({
        error: "Unsupported OAuth provider",
        providerId: body.providerId,
      });

      return;
    }

    // For custom_mcp, allow caller-supplied token URL.
    const isCustomMcp = body.providerId === "custom_mcp";
    const effectiveTokenUrl =
      isCustomMcp && isSafeAbsoluteUrl(body.tokenUrl)
        ? body.tokenUrl
        : provider.tokenUrl;

    if (!body.clientId || typeof body.clientId !== "string") {
      res.status(400).json({ error: "Missing required clientId" });

      return;
    }

    if (!body.refreshToken || typeof body.refreshToken !== "string") {
      res.status(400).json({ error: "Missing required refreshToken" });

      return;
    }

    const requestedScopes = parseScopeList(body.scope);
    if (!areScopesAllowed(provider.defaultScopes, requestedScopes)) {
      res.status(400).json({
        error: "Requested scopes are not allowed for this provider",
      });

      return;
    }

    const params = new URLSearchParams();
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", body.refreshToken);
    params.set("client_id", body.clientId);

    if (
      body.clientSecret &&
      (provider.clientAuthMethod || "request_body") !== "basic_header"
    ) {
      params.set("client_secret", body.clientSecret);
    }

    if (requestedScopes.length > 0) {
      const separator = provider.scopeSeparator === "comma" ? "," : " ";
      params.set("scope", requestedScopes.join(separator));
    }

    try {
      const response = await fetchImpl(effectiveTokenUrl, {
        method: "POST",
        headers: buildClientAuthHeaders(
          provider.clientAuthMethod,
          body.clientId,
          body.clientSecret,
        ),
        body: params.toString(),
      });

      const rawBody = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawBody
          ? (JSON.parse(rawBody) as Record<string, unknown>)
          : {};
      } catch {
        payload = {};
      }

      if (!response.ok) {
        res.status(502).json({
          error: "OAuth refresh failed",
          status: response.status,
          upstreamError:
            payload.error || payload.error_description || "unknown_error",
        });

        return;
      }

      const accessToken =
        typeof payload.access_token === "string" ? payload.access_token : "";

      if (!accessToken) {
        res
          .status(502)
          .json({ error: "OAuth refresh returned no access_token" });

        return;
      }

      res.json({
        providerId: provider.id,
        accessToken,
        tokenType:
          typeof payload.token_type === "string"
            ? payload.token_type
            : "Bearer",
        refreshToken:
          typeof payload.refresh_token === "string"
            ? payload.refresh_token
            : undefined,
        expiresIn:
          typeof payload.expires_in === "number"
            ? payload.expires_in
            : undefined,
        scope: typeof payload.scope === "string" ? payload.scope : undefined,
      });
    } catch {
      res.status(502).json({ error: "OAuth refresh network error" });
    }
  });
}
