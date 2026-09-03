import type { Express, Request, Response } from "express";
import { openApiSpec } from "../openapi/openapi-spec.js";

/**
 * Registers OpenAPI specification and Scalar interactive API documentation routes.
 */
export function registerDocsRoutes(app: Express): void {
  // Machine-readable OpenAPI 3.1 JSON specification
  app.get("/api/openapi.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.json(openApiSpec);
  });

  // Human-readable interactive Scalar API Reference UI
  app.get("/api/docs", (_req: Request, res: Response) => {
    // Custom CSP headers to allow loading Scalar assets from CDN
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https:;",
    );
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ShadowClaw API Reference</title>
    <link rel="icon" type="image/x-icon" href="/assets/icons/favicon.ico" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0d1117;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference("#app", {
        url: "/api/openapi.json",
        darkMode: true,
        theme: "kepler",
        metaData: {
          title: "ShadowClaw API Reference",
          description: "RESTful and streaming endpoints for ShadowClaw personal AI assistant",
        },
      });
    </script>
  </body>
</html>`);
  });

  // Convenience redirect from /docs to /api/docs
  app.get("/docs", (_req: Request, res: Response) => {
    res.redirect("/api/docs");
  });
}
