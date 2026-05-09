/**
 * Vertex AI Model Garden proxy routes.
 *
 * Handles:
 *   - POST /vertex-ai-proxy/chat/completions
 *   - GET  /vertex-ai-proxy/models
 */

import { env } from "node:process";

import { GoogleGenAI } from "@google/genai";

import { getFirstHeaderValue } from "../utils/proxy-helpers.js";
import {
  writeOpenAiDeltaChunk,
  writeOpenAiToolCallChunk,
  writeOpenAiDoneChunk,
  sendStreamingProxyError,
} from "../utils/openai-sse.js";

import type { Express } from "express";

export function registerVertexAiRoutes(
  app: Express,
  _options: { verbose?: boolean } = {},
): void {
  app.post("/vertex-ai-proxy/chat/completions", async (req, res) => {
    try {
      const project =
        getFirstHeaderValue(req.headers["x-vertex-project"]) ||
        env.VERTEX_AI_PROJECT;
      const location =
        getFirstHeaderValue(req.headers["x-vertex-location"]) ||
        env.VERTEX_AI_LOCATION ||
        "us-central1";

      if (!project) {
        return res.status(401).json({
          error:
            "GCP project ID is missing. Set VERTEX_AI_PROJECT or provide it via x-vertex-project header.",
        });
      }

      const body = req.body;
      const modelId = body.model || "gemini-2.5-flash";
      const wantsStreaming = body.stream === true;

      const ai = new GoogleGenAI({ vertexai: true, project, location });

      // Translate OpenAI messages to Gemini SDK contents
      const contents = (body.messages || [])
        .filter((msg: any) => msg.role !== "system")
        .map((msg: any) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: Array.isArray(msg.content)
            ? msg.content.map((block: any) => {
                if (block.type === "text") {
                  return { text: block.text };
                }

                if (block.type === "tool_use") {
                  return {
                    functionCall: {
                      name: block.name,
                      args: block.input || {},
                    },
                  };
                }

                if (block.type === "tool_result") {
                  return {
                    functionResponse: {
                      name: block.name || "unknown",
                      response: { result: block.content },
                    },
                  };
                }

                return { text: "" };
              })
            : [{ text: String(msg.content || "") }],
        }));

      // Find system prompt
      const systemMessage = (body.messages || []).find(
        (m: any) => m.role === "system",
      );
      const systemPrompt = systemMessage
        ? String(systemMessage.content)
        : undefined;

      // Map tools
      const googleTools = (body.tools || []).map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));

      const generateOptions: any = {
        model: modelId,
        contents,
        ...(systemPrompt && {
          systemInstruction: { parts: [{ text: systemPrompt }] },
        }),
        ...(googleTools.length > 0 && {
          tools: [{ functionDeclarations: googleTools }],
        }),
        generationConfig: {
          maxOutputTokens: body.max_tokens,
        },
      };

      if (wantsStreaming) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const stream = await ai.models.generateContentStream(generateOptions);

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            writeOpenAiDeltaChunk(res, modelId, text);
          }

          // Handle tool calls in stream
          const parts = chunk.candidates?.[0]?.content?.parts || [];
          for (const part of parts) {
            if (part.functionCall) {
              writeOpenAiToolCallChunk(res, modelId, {
                name: part.functionCall.name || "",
                input: part.functionCall.args || {},
              });
            }
          }
        }

        writeOpenAiDoneChunk(res, modelId);
        res.end();
      } else {
        const result = await ai.models.generateContent(generateOptions);
        const text = result.text;
        const parts = result.candidates?.[0]?.content?.parts || [];
        const toolCalls = parts
          .filter((p) => !!p.functionCall)
          .map((p) => ({
            id: `call_${Date.now()}_${Math.random()}`,
            type: "function",
            function: {
              name: p.functionCall!.name,
              arguments: JSON.stringify(p.functionCall!.args || {}),
            },
          }));

        res.json({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: text || null,
                ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
              },
              finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
            },
          ],
          usage: {
            prompt_tokens: result.usageMetadata?.promptTokenCount || 0,
            completion_tokens: result.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: result.usageMetadata?.totalTokenCount || 0,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Vertex AI proxy error:", message);

      let status = 502;
      let publicMessage = `Vertex AI invocation failed: ${message}`;

      try {
        const parsed = JSON.parse(message);
        if (parsed.error?.code) {
          status = parsed.error.code;
          publicMessage = parsed.error.message || publicMessage;
        } else if (parsed.code) {
          status = parsed.code;
          publicMessage = parsed.message || publicMessage;
        }
      } catch {
        // Not JSON, use defaults
      }

      sendStreamingProxyError(res, {
        status,
        publicMessage,
        streamMessage: publicMessage,
      });
    }
  });

  app.get("/vertex-ai-proxy/models", async (req, res) => {
    try {
      const project =
        getFirstHeaderValue(req.headers["x-vertex-project"]) ||
        env.VERTEX_AI_PROJECT;
      const location =
        getFirstHeaderValue(req.headers["x-vertex-location"]) ||
        env.VERTEX_AI_LOCATION ||
        "us-central1";

      if (!project) {
        return res.status(401).json({ error: "Missing GCP project ID" });
      }

      const ai = new GoogleGenAI({ vertexai: true, project, location });
      const modelsList: any[] = [];

      try {
        const response = await ai.models.list();
        for await (const m of response) {
          if (
            (m as any).supportedGenerationMethods?.includes("generateContent")
          ) {
            const modelName = m.name || "";
            modelsList.push({
              id: modelName.replace("models/", ""),
              name: m.displayName || modelName.replace("models/", ""),
              context_length: m.inputTokenLimit || 1048576,
              max_completion_tokens: m.outputTokenLimit || 65536,
              supports_tools: true,
            });
          }
        }
      } catch (listErr) {
        console.error("Failed to fetch Vertex AI models dynamically:", listErr);
      }

      // Fallback to known Vertex AI Gemini models if dynamic listing fails
      if (modelsList.length === 0) {
        const fallbacks = [
          {
            id: "gemini-2.5-flash",
            name: "Gemini 2.5 Flash",
            ctx: 1048576,
            out: 65536,
          },
          {
            id: "gemini-2.5-pro",
            name: "Gemini 2.5 Pro",
            ctx: 1048576,
            out: 65536,
          },
          {
            id: "gemini-2.0-flash",
            name: "Gemini 2.0 Flash",
            ctx: 1048576,
            out: 65536,
          },
          {
            id: "gemini-1.5-flash",
            name: "Gemini 1.5 Flash",
            ctx: 1048576,
            out: 65536,
          },
          {
            id: "gemini-1.5-pro",
            name: "Gemini 1.5 Pro",
            ctx: 2097152,
            out: 65536,
          },
        ];

        for (const f of fallbacks) {
          modelsList.push({
            id: f.id,
            name: f.name,
            context_length: f.ctx,
            max_completion_tokens: f.out,
            supports_tools: true,
          });
        }
      }

      res.json({
        data: modelsList,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res
        .status(502)
        .json({ error: `Failed to list Vertex AI models: ${message}` });
    }
  });
}
