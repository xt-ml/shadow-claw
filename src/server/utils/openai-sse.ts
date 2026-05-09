/**
 * OpenAI-compatible SSE chunk writing helpers.
 *
 * Used by Transformers.js, Llamafile, Gemini, and Vertex AI routes to emit
 * streaming responses in the OpenAI chat completion chunk format.
 */

import type { Response as ExpressResponse } from "express";

export function writeOpenAiDeltaChunk(
  res: ExpressResponse,
  model: string,
  content: string,
) {
  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  };

  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

export function writeOpenAiToolCallChunk(
  res: ExpressResponse,
  model: string,
  toolCall: { name: string; input: Record<string, any> },
) {
  const chunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: `call_${Date.now()}_${Math.random()}`,
              type: "function",
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.input || {}),
              },
            },
          ],
        },
        finish_reason: null,
      },
    ],
  };

  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

export function writeOpenAiDoneChunk(
  res: ExpressResponse,
  model: string,
  finishReason: "stop" | "tool_calls" = "stop",
) {
  const finalChunk = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finishReason,
      },
    ],
  };

  res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  res.write("data: [DONE]\n\n");
}

export function sendStreamingProxyError(
  res: Pick<
    ExpressResponse,
    "headersSent" | "writableEnded" | "write" | "end" | "status" | "json"
  >,
  opts: {
    status: number;
    publicMessage: string;
    streamMessage: string;
  },
): void {
  if (!res.headersSent) {
    res.status(opts.status).json({ error: opts.publicMessage });

    return;
  }

  if (res.writableEnded) {
    return;
  }

  res.write(
    `data: ${JSON.stringify({ type: "error", error: { type: "server_error", message: opts.streamMessage } })}\n\n`,
  );
  res.end();
}
