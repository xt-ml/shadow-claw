/**
 * Llamafile proxy routes.
 *
 * Handles:
 *   - GET  /llamafile-proxy/models
 *   - POST /llamafile-proxy/cancel
 *   - POST /llamafile-proxy/chat/completions
 */

import {
  LlamafileManagerService,
  invokeLlamafileServer,
} from "../services/llamafile-manager.js";

import type { Express } from "express";

export function registerLlamafileRoutes(
  app: Express,
  service: LlamafileManagerService,
  options: { verbose?: boolean } = {},
): void {
  const verbose = options.verbose ?? false;

  // ---- Llamafile: list local binaries ----
  app.get("/llamafile-proxy/models", async (_req, res) => {
    try {
      const binaries = await service.listBinaries();
      const models = binaries.map((entry) => ({
        id: entry.id,
        name: entry.id,
        file_name: entry.fileName,
        supports_tools: true,
      }));

      res.json({ data: models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Llamafile models discovery error:", message);
      res.status(502).json({
        error: `Failed to list llamafile binaries: ${message}`,
      });
    }
  });

  app.post("/llamafile-proxy/cancel", (req, res) => {
    const body =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, any>)
        : undefined;
    const requestId = service.getLlamafileRequestId(req, body);

    if (!requestId) {
      res.status(400).json({ error: "Missing llamafile request id" });

      return;
    }

    const cancelled = service.cancelRequest(requestId);
    if (!cancelled) {
      res.status(200).json({ ok: true, cancelled: false });

      return;
    }

    res.status(202).json({ ok: true, cancelled: true });
  });

  // ---- Llamafile: chat completions (CLI or SERVER mode) ----
  app.post("/llamafile-proxy/chat/completions", async (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      const runtime = service.getLlamafileRuntimeOptions(req);
      const model = typeof body.model === "string" ? body.model.trim() : "";

      if (verbose) {
        const headerMode = req.headers["x-llamafile-mode"];
        const bodyMode =
          body.llamafile && typeof body.llamafile === "object"
            ? String(body.llamafile.mode || "")
            : "";
        console.log(
          `[Proxy] Llamafile runtime: mode=${runtime.mode} model=${model || "<none>"} headerMode=${headerMode || "<none>"} bodyMode=${bodyMode || "<none>"}`,
        );
      }

      if (runtime.mode === "cli") {
        if (!model) {
          return res.status(400).json({
            error:
              "Missing or invalid 'model' parameter for CLI mode. Select a local *.llamafile model.",
          });
        }

        await service.invokeCli(
          req,
          res,
          body,
          {
            model,
            offline: runtime.offline,
          },
          verbose,
        );

        return;
      }

      await invokeLlamafileServer(
        req,
        res,
        body,
        {
          host: runtime.host,
          port: runtime.port,
        },
        verbose,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : "";
      console.error("Llamafile invocation error:", message, err);
      if (stack && verbose) {
        console.error("Stack trace:", stack);
      }

      if (!res.headersSent) {
        res.status(502).json({
          error: `Llamafile invocation failed: ${message}`,
        });

        return;
      }

      res.write(
        `data: ${JSON.stringify({ error: { type: "server_error", message } })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });
}
