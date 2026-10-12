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

  const prefixes = ["/llamafile-proxy", "/agentfile-proxy"];

  for (const prefix of prefixes) {
    const isAgentfilePrefix = prefix.includes("agentfile");
    const nameLabel = isAgentfilePrefix ? "agentfile" : "llamafile";
    const displayName = isAgentfilePrefix ? "Agentfile" : "Llamafile";

    // ---- List local binaries ----
    app.get(`${prefix}/models`, async (_req, res) => {
      try {
        const binaries = await service.listBinaries(
          isAgentfilePrefix ? "agentfile" : undefined,
        );
        const models = binaries.map((entry) => ({
          id: entry.id,
          name: entry.id,
          file_name: entry.fileName,
          supports_tools: true,
        }));

        res.json({ data: models });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${nameLabel} models discovery error:`, message);
        res.status(502).json({
          error: `Failed to list ${nameLabel} binaries: ${message}`,
        });
      }
    });

    // ---- Cancel request ----
    app.post(`${prefix}/cancel`, (req, res) => {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, any>)
          : undefined;
      const requestId = service.getLlamafileRequestId(req, body);

      if (!requestId) {
        res.status(400).json({ error: `Missing ${nameLabel} request id` });

        return;
      }

      const cancelled = service.cancelRequest(requestId);
      if (!cancelled) {
        res.status(200).json({ ok: true, cancelled: false });

        return;
      }

      res.status(202).json({ ok: true, cancelled: true });
    });

    // ---- List available tools ----
    app.get(`${prefix}/tools`, async (req, res) => {
      try {
        const runtime = service.getLlamafileRuntimeOptions(req);
        const tools = await service.listTools(runtime);
        res.json({ tools });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${nameLabel} tools discovery error:`, message);
        res.status(502).json({
          error: `Failed to list ${nameLabel} tools: ${message}`,
        });
      }
    });

    // ---- Execute native tool ----
    app.post(`${prefix}/tools`, async (req, res) => {
      try {
        const body = req.body;
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        if (!name) {
          return res.status(400).json({
            error: "Missing required 'name' parameter for tool execution",
          });
        }

        const runtime = service.getLlamafileRuntimeOptions(req);
        const args =
          body.arguments && typeof body.arguments === "object"
            ? body.arguments
            : body.input && typeof body.input === "object"
              ? body.input
              : {};

        const result = await service.executeTool(name, args, runtime);
        res.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${nameLabel} tool execution error:`, message);
        res.status(502).json({
          error: `${nameLabel} tool execution failed: ${message}`,
        });
      }
    });

    // ---- Chat completions (CLI or SERVER mode) ----
    app.post(`${prefix}/chat/completions`, async (req, res) => {
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
            `[Proxy] ${nameLabel} runtime: mode=${runtime.mode} model=${model || "<none>"} headerMode=${headerMode || "<none>"} bodyMode=${bodyMode || "<none>"}`,
          );
        }

        // If mode is CLI or this is agentfile prefix / agentfile model, invoke CLI
        if (
          runtime.mode === "cli" ||
          isAgentfilePrefix ||
          model.endsWith(".agentfile")
        ) {
          if (!model) {
            return res.status(400).json({
              error: `Missing or invalid 'model' parameter for CLI mode. Select a local *.${isAgentfilePrefix ? "agentfile" : "llamafile"} model.`,
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
        console.error(`${nameLabel} invocation error:`, message, err);
        if (stack && verbose) {
          console.error("Stack trace:", stack);
        }

        if (!res.headersSent) {
          res.status(502).json({
            error: `${displayName} invocation failed: ${message}`,
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
}
