/**
 * AWS Bedrock proxy routes.
 *
 * Handles:
 *   - GET  /bedrock-proxy/models   (list foundation models + inference profiles)
 *   - POST /bedrock-proxy/invoke   (invoke model, streaming or non-streaming)
 */

import { env } from "node:process";

import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { fromNodeProviderChain, fromSSO } from "@aws-sdk/credential-providers";

import { getFirstHeaderValue } from "../utils/proxy-helpers.js";

import type { Express } from "express";

// ---- Bedrock helpers ----

const BEDROCK_REGION = env.BEDROCK_REGION || "";
const BEDROCK_PROFILE = env.BEDROCK_PROFILE || "";

function getBedrockRuntimeOptions(req: any): {
  region: string;
  profile: string;
  authMode: string;
} {
  const region =
    BEDROCK_REGION ||
    getFirstHeaderValue(req.headers["x-bedrock-region"])?.trim() ||
    "";
  const profile =
    BEDROCK_PROFILE ||
    getFirstHeaderValue(req.headers["x-bedrock-profile"])?.trim() ||
    "";
  const authMode =
    getFirstHeaderValue(req.headers["x-bedrock-auth-mode"])?.trim() ||
    "provider_chain";

  return { region, profile, authMode };
}

function createBedrockCredentials(profile: string, authMode: string) {
  if (authMode === "sso") {
    return fromSSO({ profile });
  }

  return fromNodeProviderChain({ profile });
}

function toInferenceProfileId(modelId: string, region: string): string {
  if (/^[a-z]{2}\.anthropic\./.test(modelId)) {
    return modelId;
  }

  const regionPrefix = region.split("-")[0];

  if (!regionPrefix) {
    throw new Error(
      "Bedrock region is not configured. Set BEDROCK_REGION or provide x-bedrock-region header.",
    );
  }

  return `${regionPrefix}.${modelId}`;
}

/**
 * Convert a Bedrock ResponseStream event into one or more SSE `data:` lines
 * in Anthropic Messages API streaming format.
 */
function bedrockEventToSSE(event: any): string | null {
  if (event.chunk?.bytes) {
    const json = new TextDecoder().decode(event.chunk.bytes);

    return `data: ${json}\n\n`;
  }

  return null;
}

export function registerBedrockRoutes(
  app: Express,
  _options: { verbose?: boolean } = {},
): void {
  // ---- Bedrock: list models ----
  app.get("/bedrock-proxy/models", async (req, res) => {
    try {
      const runtime = getBedrockRuntimeOptions(req);
      if (!runtime.region || !runtime.profile) {
        return res.status(400).json({
          error:
            "Bedrock is not configured. Set BEDROCK_REGION and BEDROCK_PROFILE environment variables or provide Bedrock fallback settings in the UI.",
        });
      }

      const client = new BedrockClient({
        region: runtime.region,
        credentials: createBedrockCredentials(
          runtime.profile,
          runtime.authMode,
        ),
      });

      // Fetch Foundation Models
      const fmResponse = await client.send(
        new ListFoundationModelsCommand({ byProvider: "Anthropic" }),
      );

      const models = (fmResponse.modelSummaries || [])
        .filter((m) => m.modelLifecycle?.status === "ACTIVE")
        .map((m) => ({ id: m.modelId, name: m.modelName }));

      // Fetch Inference Profiles (to support Cross-Region inference)
      try {
        const ipResponse = await client.send(
          new ListInferenceProfilesCommand({}),
        );
        const profiles = (ipResponse.inferenceProfileSummaries || [])
          .filter((p) => p.status === "ACTIVE")
          // Only show Anthropic-compatible profiles since our proxy format is 'anthropic'
          .filter(
            (p) =>
              p.inferenceProfileId?.includes("anthropic") ||
              p.inferenceProfileName?.toLowerCase().includes("anthropic"),
          )
          .map((p) => ({
            id: p.inferenceProfileId || "",
            name: `${p.inferenceProfileName || "Unnamed Profile"} (Profile)`,
          }));

        models.push(...profiles);
      } catch (ipErr: unknown) {
        // AccessDeniedException is expected when the credential chain lacks
        // bedrock:ListInferenceProfiles — silently skip in that case.
        const errName =
          ipErr && typeof ipErr === "object" && "name" in ipErr
            ? (ipErr as { name: string }).name
            : "";
        if (errName !== "AccessDeniedException") {
          console.warn(
            "Failed to list Bedrock inference profiles:",
            ipErr instanceof Error ? ipErr.message : String(ipErr),
          );
        }

        // Non-fatal, proceed with just foundation models
      }

      res.json({ models });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Bedrock models discovery error:", message);
      res
        .status(502)
        .json({ error: `Failed to list Bedrock models: ${message}` });
    }
  });

  // ---- Bedrock: invoke model ----
  app.post("/bedrock-proxy/invoke", async (req, res) => {
    try {
      const runtime = getBedrockRuntimeOptions(req);
      if (!runtime.region || !runtime.profile) {
        return res.status(400).json({
          error:
            "Bedrock is not configured. Set BEDROCK_REGION and BEDROCK_PROFILE environment variables or provide Bedrock fallback settings in the UI.",
        });
      }

      const body = req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Missing request body" });
      }

      const rawModelId = body.model;
      if (
        typeof rawModelId !== "string" ||
        (!rawModelId.startsWith("anthropic.") &&
          !/^[a-z]{2}\.anthropic\./.test(rawModelId))
      ) {
        return res.status(400).json({
          error: `Invalid model ID: '${String(rawModelId || "")}'. Must be an Anthropic Bedrock model ID.`,
        });
      }

      const modelId = toInferenceProfileId(rawModelId, runtime.region);
      const wantsStreaming = body.stream === true;

      // Strip fields not accepted by Bedrock (model, stream)
      const { model: _model, stream: _stream, ...anthropicBody } = body;
      if (!anthropicBody.anthropic_version) {
        anthropicBody.anthropic_version = "bedrock-2023-05-31";
      }

      const client = new BedrockRuntimeClient({
        region: runtime.region,
        credentials: createBedrockCredentials(
          runtime.profile,
          runtime.authMode,
        ),
      });

      if (wantsStreaming) {
        // ---- Streaming path: InvokeModelWithResponseStream ----
        const command = new InvokeModelWithResponseStreamCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(anthropicBody),
        });

        const response = await client.send(command);

        // Set SSE headers
        res.status(200);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.flushHeaders();

        if (response.body) {
          for await (const event of response.body) {
            const sse = bedrockEventToSSE(event);
            if (sse) {
              res.write(sse);
            }
          }
        }

        res.end();
      } else {
        // ---- Non-streaming path: InvokeModel (original behavior) ----
        const command = new InvokeModelCommand({
          modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(anthropicBody),
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(
          new TextDecoder().decode(response.body),
        );

        res.json(responseBody);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Bedrock invoke error:", message);

      const status =
        message.includes("expired") || message.includes("credentials")
          ? 401
          : 502;

      if (!res.headersSent) {
        res
          .status(status)
          .json({ error: `Bedrock invocation failed: ${message}` });
      } else {
        // If we were already streaming, write an SSE error event and close
        res.write(
          `data: ${JSON.stringify({ type: "error", error: { type: "server_error", message } })}\n\n`,
        );
        res.end();
      }
    }
  });
}
