import type { ToolDefinition } from "./types.js";

export const fetch_url: ToolDefinition = {
  name: "fetch_url",
  description:
    "Fetch a URL via HTTP and return the response body. " +
    "Subject to browser CORS restrictions — works with most public APIs. " +
    "Response is truncated to 100KB. " +
    "Set use_git_auth to true to automatically inject the saved Git PAT " +
    "as an Authorization header (supports GitHub, Azure DevOps, GitLab, and other providers — " +
    "auth format is auto-detected from the URL's host). " +
    "If include_headers is true, the response will include both request and response headers.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      method: {
        type: "string",
        description: "HTTP method (default: GET)",
      },
      headers: {
        type: "object",
        properties: {},
        description: "Request headers as key-value pairs",
      },
      body: {
        type: "string",
        description: "Request body (for POST/PUT/PATCH)",
      },
      use_git_auth: {
        type: "boolean",
        description:
          "If true, inject the saved Git credentials as an Authorization header. " +
          "Auth format is auto-detected from the URL host: GitHub (token), " +
          "Azure DevOps (Basic), GitLab (Bearer), or generic Bearer.",
      },
      git_account_id: {
        type: "string",
        description:
          "Optional explicit Git account ID to use when use_git_auth is true. " +
          "If omitted, account resolution uses hostPattern/default matching.",
      },
      use_account_auth: {
        type: "boolean",
        description:
          "If true, inject a saved service account PAT as a Bearer Authorization header. " +
          "The account is matched by hostPattern against the URL (longest match wins), " +
          "then falls back to the default service account. " +
          "Use this for non-Git services like Figma, Notion, or any other service " +
          "whose PAT is stored under Settings → Accounts.",
      },
      account_id: {
        type: "string",
        description:
          "Optional explicit service account ID to use when use_account_auth is true. " +
          "If omitted, account resolution uses hostPattern/default matching.",
      },
      auth_mode: {
        type: "string",
        enum: ["pat", "oauth"],
        description:
          "Optional preferred credential mode when multiple accounts match. " +
          "Valid values: pat or oauth.",
      },
      include_headers: {
        type: "boolean",
        description:
          "If true, include request and response headers in the output.",
      },
    },
    required: ["url"],
  },
};

export const fetch_file: ToolDefinition = {
  name: "fetch_file",
  description:
    "Fetch a URL and save the response body directly to the workspace in one step. " +
    "Equivalent to fetch_url + write_file but atomic. " +
    "Text responses are saved as UTF-8; binary responses (images, PDFs, audio, video, zip, " +
    "application/octet-stream) are saved as raw bytes. " +
    "The destination path within the workspace is required. " +
    "Supports the same authentication options as fetch_url (use_git_auth, use_account_auth, etc.). " +
    "Returns the workspace path the file was saved to and the number of bytes written.",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to fetch",
      },
      path: {
        type: "string",
        description:
          "Destination path within the workspace (e.g. 'data/response.json'). " +
          "Parent directories are created automatically. " +
          "Must not contain '..' segments.",
      },
      method: {
        type: "string",
        description: "HTTP method (default: GET)",
      },
      headers: {
        type: "object",
        properties: {},
        description: "Request headers as key-value pairs",
      },
      body: {
        type: "string",
        description: "Request body (for POST/PUT/PATCH)",
      },
      use_git_auth: {
        type: "boolean",
        description:
          "If true, inject the saved Git credentials as an Authorization header. " +
          "Auth format is auto-detected from the URL host: GitHub (token), " +
          "Azure DevOps (Basic), GitLab (Bearer), or generic Bearer.",
      },
      git_account_id: {
        type: "string",
        description:
          "Optional explicit Git account ID to use when use_git_auth is true. " +
          "If omitted, account resolution uses hostPattern/default matching.",
      },
      use_account_auth: {
        type: "boolean",
        description:
          "If true, inject a saved service account PAT as a Bearer Authorization header. " +
          "The account is matched by hostPattern against the URL (longest match wins), " +
          "then falls back to the default service account.",
      },
      account_id: {
        type: "string",
        description:
          "Optional explicit service account ID to use when use_account_auth is true. " +
          "If omitted, account resolution uses hostPattern/default matching.",
      },
      auth_mode: {
        type: "string",
        enum: ["pat", "oauth"],
        description:
          "Optional preferred credential mode when multiple accounts match. " +
          "Valid values: pat or oauth.",
      },
    },
    required: ["url", "path"],
  },
};

export const web_search: ToolDefinition = {
  name: "web_search",
  description:
    "Perform a web search using a search engine to discover information. " +
    "Returns a plain-text summary of the top search results including titles, URLs, and snippets. " +
    "Use this when you need to find information but don't know the exact URL to fetch.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to look up.",
      },
    },
    required: ["query"],
  },
};
