import { Page, Route } from "@playwright/test";

export interface MockToolCall {
  id?: string;
  name: string;
  arguments: Record<string, any>;
}

export type MockTurn =
  | {
      type?: "text";
      text: string;
      streaming?: boolean;
    }
  | {
      type: "tool_call";
      toolCalls: MockToolCall[];
    }
  | {
      type: "error";
      status: number;
      message: string;
    };

export interface MockLlmOptions {
  providerUrl?: string;
  providerId?: string;
  model?: string;
  apiKey?: string;
  streaming?: boolean;
}

/**
 * Configure the browser E2E bridge with a mock provider and intercept all
 * outbound provider requests to return deterministic responses.
 */
export async function setupMockLlm(
  page: Page,
  turns: MockTurn[],
  options: MockLlmOptions = {},
) {
  const providerUrl =
    options.providerUrl || "https://openrouter.ai/api/v1/chat/completions";
  const providerId = options.providerId || "openrouter";
  const model = options.model || "test/mock-model";
  const apiKey = options.apiKey || "mock-e2e-api-key";
  const streaming = options.streaming ?? false;

  let turnIndex = 0;
  const recordedRequests: any[] = [];

  await page.route(providerUrl, async (route: Route) => {
    const postData = route.request().postDataJSON();
    recordedRequests.push(postData);

    const currentTurn = turns[turnIndex++] || {
      type: "text",
      text: "Default mock response.",
    };

    if (currentTurn.type === "error") {
      await route.fulfill({
        status: currentTurn.status,
        contentType: "application/json",
        body: JSON.stringify({
          error: { message: currentTurn.message, code: currentTurn.status },
        }),
      });
      return;
    }

    if (currentTurn.type === "tool_call") {
      const toolCalls = currentTurn.toolCalls.map((tc, idx) => ({
        id: tc.id || `call_${Date.now()}_${idx}`,
        type: "function",
        function: {
          name: tc.name,
          arguments:
            typeof tc.arguments === "string"
              ? tc.arguments
              : JSON.stringify(tc.arguments),
        },
      }));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `gen-mock-tc-${Date.now()}`,
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: toolCalls,
              },
              finish_reason: "tool_calls",
              index: 0,
            },
          ],
          model,
          usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
        }),
      });
      return;
    }

    // Text response (streaming or non-streaming)
    const isStreaming = currentTurn.streaming ?? streaming;
    if (isStreaming) {
      const chunks = [
        `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { role: "assistant", content: "" }, index: 0 }], model })}\n\n`,
        `data: ${JSON.stringify({ id: "gen-mock", choices: [{ delta: { content: currentTurn.text }, index: 0, finish_reason: "stop" }], model })}\n\n`,
        "data: [DONE]\n\n",
      ].join("");

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: chunks,
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: `gen-mock-${Date.now()}`,
          choices: [
            {
              message: {
                role: "assistant",
                content: currentTurn.text,
              },
              finish_reason: "stop",
              index: 0,
            },
          ],
          model,
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      });
    }
  });

  // Wait for the app to initialize and expose the e2e bridge
  await page.waitForFunction(
    () => (globalThis as any).__SHADOWCLAW_E2E__?.isReady(),
    { timeout: 15000 },
  );

  // Configure provider via bridge
  await page.evaluate(
    async ({ pId, pKey, pModel, pStream }) => {
      const bridge = (globalThis as any).__SHADOWCLAW_E2E__;
      if (!bridge) {
        throw new Error("E2E Bridge is not ready");
      }
      await bridge.configureProvider(pId, pKey, pModel, pStream);
    },
    { pId: providerId, pKey: apiKey, pModel: model, pStream: streaming },
  );

  return {
    getRecordedRequests: () => recordedRequests,
  };
}
