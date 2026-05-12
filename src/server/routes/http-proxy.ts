/**
 * Generic proxy, Telegram, and git-proxy routes.
 *
 * Handles:
 *   - /proxy/* (CORS-anywhere style)
 *   - /telegram/* (Telegram Bot API proxy)
 *   - /git-proxy/* (isomorphic-git smart-HTTP proxy)
 */

import { handleProxyRequest } from "../utils/proxy-helpers.js";

import type { Express } from "express";

export function registerHttpProxyRoutes(
  app: Express,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  // ---- generic /proxy endpoint (supports https://cors-anywhere.com/) ----
  // Supports:
  //   - /proxy?url=<target> (query param)
  //   - /proxy with body { url: "<target>" } (body param)
  //   - /proxy/<target> (path-based, new fallback)
  app.all(/^\/proxy(\/(.*))?$/, async (req: any, res: any): Promise<any> => {
    const urlFromQuery =
      typeof req.query.url === "string" ? req.query.url : undefined;
    const urlFromBody =
      req.body && typeof req.body.url === "string" ? req.body.url : undefined;
    let target = urlFromBody || urlFromQuery;

    // If no target from query/body params, try to extract from path
    if (!target) {
      // Capture group from regex: the part after /proxy/
      const pathTarget = req.params[1];
      if (pathTarget) {
        target = pathTarget;
        // Append any additional query params (excluding 'url' which was already checked)
        const extraQuery = { ...req.query };
        delete extraQuery.url;
        if (Object.keys(extraQuery).length > 0) {
          const separator = target.includes("?") ? "&" : "?";
          target +=
            separator + new URLSearchParams(extraQuery as any).toString();
        }
      }
    }

    if (!target) {
      return res.status(400).json({ error: "Missing 'url' parameter" });
    }

    const method =
      (req.body && typeof req.body.method === "string" && req.body.method) ||
      req.method;
    const normalizedMethod = method.toUpperCase();

    const headersFromBody = !!(
      req.body &&
      req.body.headers &&
      typeof req.body.headers === "object"
    );

    const incomingHeaders =
      (headersFromBody ? req.body.headers : req.headers) || {};

    let body;
    if (req.body && typeof req.body.body === "string") {
      body = req.body.body;
    }

    // When headers come from the request body (e.g. service worker proxy),
    // the caller explicitly set them — preserve Authorization.
    const hasExplicitAuth =
      headersFromBody &&
      !!(incomingHeaders["Authorization"] || incomingHeaders["authorization"]);

    await handleProxyRequest(req, res, {
      targetUrl: target,
      method: normalizedMethod,
      headers: incomingHeaders,
      body,
      verbose,
      forwardAuth: hasExplicitAuth,
    });
  });

  app.all(
    /^\/telegram\/((?:bot.*)|(?:file\/bot.*))$/,
    async (req: any, res: any): Promise<any> => {
      // Telegram polling endpoints (getUpdates) must never be cached.
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const telegramPath = req.params[0];
      const queryString =
        Object.keys(req.query).length > 0
          ? "?" + new URLSearchParams(req.query as any).toString()
          : "";

      const targetUrl = `https://api.telegram.org/${telegramPath}${queryString}`;

      const method = req.method.toUpperCase();
      const incomingHeaders = req.headers || {};

      let body: Buffer | string | undefined;
      const contentType = incomingHeaders["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }

        body = Buffer.concat(chunks);
      } else if (req.body && typeof req.body.body === "string") {
        body = req.body.body;
      } else if (
        req.body &&
        typeof req.body === "object" &&
        Object.keys(req.body).length > 0 &&
        !("url" in req.body) &&
        !("method" in req.body) &&
        !("headers" in req.body)
      ) {
        body = JSON.stringify(req.body);
      }

      await handleProxyRequest(req, res, {
        targetUrl,
        method,
        headers: incomingHeaders,
        body,
        verbose,
      });
    },
  );

  // ---- isomorphic-git proxy (stream-based) ----
  app.all(/^\/git-proxy\/(.*)/, async (req, res) => {
    const pathParams = req.params[0];
    const queryString =
      Object.keys(req.query).length > 0
        ? "?" + new URLSearchParams(req.query as any).toString()
        : "";

    const targetUrlString = "https://" + pathParams + queryString;

    const bodyBuffers: Buffer[] = [];
    for await (const chunk of req) {
      bodyBuffers.push(chunk);
    }

    const rawBody = Buffer.concat(bodyBuffers);

    await handleProxyRequest(req, res, {
      targetUrl: targetUrlString,
      method: req.method,
      headers: req.headers,
      body: rawBody.length > 0 ? rawBody : undefined,
      verbose,
      // Git smart-HTTP needs the client's Authorization header to reach the
      // upstream host (e.g. Azure DevOps, GitHub). Without this the upstream
      // returns an anonymous sign-in page and isomorphic-git hangs.
      forwardAuth: true,
    });
  });
}
