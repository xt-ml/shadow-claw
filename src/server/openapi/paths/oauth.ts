import type { OpenApiPathItem } from "../types.js";

export const oauthPaths: Record<string, OpenApiPathItem> = {
  "/oauth/authorize": {
    post: {
      tags: ["OAuth"],
      summary: "Initiate OAuth Flow",
      description:
        "Generates an authorization URL and initializes an OAuth session state with optional PKCE support.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["providerId", "clientId", "redirectUri"],
              properties: {
                providerId: {
                  type: "string",
                  description:
                    "OAuth provider ID (e.g., github, google, custom_mcp)",
                },
                clientId: { type: "string" },
                clientSecret: { type: "string" },
                redirectUri: { type: "string" },
                scope: { type: "array", items: { type: "string" } },
                authorizeUrl: { type: "string" },
                tokenUrl: { type: "string" },
                usePkce: { type: "boolean" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "OAuth flow initiated",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  state: { type: "string" },
                  providerId: { type: "string" },
                  authorizeUrl: { type: "string" },
                  expiresAt: { type: "integer" },
                  pkceEnabled: { type: "boolean" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid parameters or unsupported provider" },
      },
    },
  },
  "/oauth/callback": {
    get: {
      tags: ["OAuth"],
      summary: "OAuth Callback Handler",
      description:
        "Receives redirect callbacks from OAuth authorization servers.",
      parameters: [
        {
          name: "state",
          in: "query",
          description: "OAuth state parameter",
          required: true,
          schema: { type: "string" },
        },
        {
          name: "code",
          in: "query",
          description: "OAuth authorization code",
          required: false,
          schema: { type: "string" },
        },
        {
          name: "error",
          in: "query",
          description: "Error code if authorization was denied",
          required: false,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Authorization callback rendered",
          content: { "text/html": { schema: { type: "string" } } },
        },
        "400": { description: "Missing state or authorization failed" },
      },
    },
  },
  "/oauth/session/{state}": {
    get: {
      tags: ["OAuth"],
      summary: "Check OAuth Session Status",
      description:
        "Polls current status of an OAuth flow session by state token.",
      parameters: [
        {
          name: "state",
          in: "path",
          description: "OAuth state token",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Session status details",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  providerId: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["pending", "authorized", "error"],
                  },
                  expiresAt: { type: "integer" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
        "404": { description: "OAuth session not found or expired" },
      },
    },
  },
  "/oauth/token": {
    post: {
      tags: ["OAuth"],
      summary: "Exchange Code for Tokens",
      description:
        "Exchanges an authorized code from a completed session for upstream provider access tokens.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["state"],
              properties: {
                state: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Token exchange successful",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                  tokenType: { type: "string" },
                },
              },
            },
          },
        },
        "400": { description: "Session not authorized or missing state" },
        "502": { description: "Upstream token exchange error" },
      },
    },
  },
  "/oauth/refresh": {
    post: {
      tags: ["OAuth"],
      summary: "Refresh Access Token",
      description:
        "Refreshes an expired OAuth access token using a stored refresh token.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["providerId", "clientId", "refreshToken"],
              properties: {
                providerId: { type: "string" },
                clientId: { type: "string" },
                clientSecret: { type: "string" },
                refreshToken: { type: "string" },
                tokenUrl: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Refreshed token response",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
            },
          },
        },
        "400": { description: "Invalid parameters or unsupported provider" },
        "502": { description: "Upstream token refresh error" },
      },
    },
  },
};
