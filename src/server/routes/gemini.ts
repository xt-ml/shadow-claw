/**
 * Gemini API proxy routes.
 *
 * Handles:
 *   - POST /gemini-proxy/chat/completions
 *   - GET  /gemini-proxy/models
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

export function registerGeminiRoutes(
  app: Express,
  _options: { verbose?: boolean } = {},
): void {
  app.post("/gemini-proxy/chat/completions", async (req, res) => {
    try {
      const apiKey =
        getFirstHeaderValue(req.headers["x-goog-api-key"]) ||
        env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(401).json({
          error:
            "Gemini API key is missing. Set GEMINI_API_KEY or provide it in the UI.",
        });
      }

      const body = req.body;
      const modelId = body.model || "gemini-2.0-flash";
      const wantsStreaming = body.stream === true;

      const ai = new GoogleGenAI({ apiKey });

      // Translate OpenAI messages to Gemini SDK contents
      const contents = (body.messages || [])
        .filter((msg: any) => msg.role !== "system")
        .map((msg: any) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : msg.role === "tool"
                ? "function"
                : "user",
          parts: Array.isArray(msg.content)
            ? msg.content.map((block: any) => {
                if (block.type === "text") {
                  return { text: block.text };
                }

                if (block.type === "image_url") {
                  const match = block.image_url.url.match(
                    /^data:([^;]+);base64,(.+)$/,
                  );
                  if (match) {
                    return {
                      inlineData: { mimeType: match[1], data: match[2] },
                    };
                  }
                }

                if (block.type === "tool_use") {
                  return {
                    functionCall: { name: block.name, args: block.input },
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
          temperature: body.temperature,
          topP: body.top_p,
        },
      };

      if (wantsStreaming) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const result = await ai.models.generateContentStream(generateOptions);

        for await (const chunk of result) {
          const text = chunk.text;
          if (text) {
            writeOpenAiDeltaChunk(res, modelId, text);
          }

          // Handle tool calls in stream (Gemini typically sends them in the first or last chunk)
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
      console.error("Gemini proxy error:", message);

      let status = 502;
      let publicMessage = `Gemini invocation failed: ${message}`;

      // Try to extract status code from Google SDK error message (which is often JSON)
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

  app.get("/gemini-proxy/models", async (req, res) => {
    try {
      const apiKey =
        getFirstHeaderValue(req.headers["x-goog-api-key"]) ||
        env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(401).json({ error: "Missing Gemini API key" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.list();
      const modelsList: any[] = [];

      try {
        for await (const m of response) {
          if (
            (m as any).supportedGenerationMethods?.includes("generateContent")
          ) {
            const modelName = m.name || "";
            modelsList.push({
              id: modelName.replace("models/", ""),
              name: m.displayName || modelName.replace("models/", ""),
              context_length: m.inputTokenLimit || 128000,
              max_completion_tokens: m.outputTokenLimit || 8192,
              supports_tools: true,
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch dynamic Gemini models:", err);
        // Continue to fallback if loop fails (e.g. rate limit on list)
      }

      // If we failed to get models or got an empty list, provide standard fallbacks
      if (modelsList.length === 0) {
        const fallbacks = [
          { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", ctx: 1048576 },
          { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", ctx: 1048576 },
          { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", ctx: 2097152 },
          {
            id: "gemini-2.0-flash-thinking-preview",
            name: "Gemini 2.0 Flash Thinking",
            ctx: 1048576,
          },
        ];

        for (const f of fallbacks) {
          modelsList.push({
            id: f.id,
            name: f.name,
            context_length: f.ctx,
            max_completion_tokens: 65536,
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
        .json({ error: `Failed to list Gemini models: ${message}` });
    }
  });
}
