import { ShadowClawDatabase } from "../../../db/types";

import {
  invokeWithLiteRtLm,
  isLiteRtLmSupported,
} from "../../../subsystems/providers/litert-lm-provider";

import {
  invokeWithPromptApi,
  isPromptApiSupported,
} from "../../../subsystems/providers/prompt-api-provider";

import { invokeWithTransformersJs } from "../../../subsystems/providers/transformers-js-provider";

import { InvokePayload } from "../../../subsystems/worker/types";
import { handleInvoke } from "../../../worker/utils/handleInvoke";
import { post as workerPost } from "../../../worker/utils/post";

type SubagentPayload = InvokePayload & { isScheduledTask?: boolean };

const BROWSER_PROVIDER_IDS = new Set([
  "litert_lm_browser",
  "prompt_api",
  "transformer_js_browser",
]);

export function isBrowserProviderId(providerId: string | undefined): boolean {
  return !!providerId && BROWSER_PROVIDER_IDS.has(providerId);
}

export async function dispatchSubagentInvoke(
  db: ShadowClawDatabase,
  payload: SubagentPayload,
  abortSignal?: AbortSignal | undefined,
): Promise<void> {
  const providerId = payload.provider;

  const emit = async (msg: any) => {
    workerPost(msg);
  };

  if (providerId === "transformers_js_browser") {
    await invokeWithTransformersJs(
      db,
      payload.groupId,
      payload.systemPrompt,
      payload.messages,
      payload.maxTokens,
      emit,
      abortSignal,
      payload.enabledTools,
      payload.model,
    );

    return;
  }

  if (providerId === "prompt_api") {
    if (!isPromptApiSupported()) {
      throw new Error(
        "Prompt API provider is not supported in this environment.",
      );
    }

    await invokeWithPromptApi(
      db,
      payload.groupId,
      payload.systemPrompt,
      payload.messages,
      payload.maxTokens,
      emit,
      abortSignal,
      payload.enabledTools,
    );

    return;
  }

  if (providerId === "litert_lm_browser") {
    if (!isLiteRtLmSupported()) {
      throw new Error(
        "Litert LM Browser provider is not supported in this environment.",
      );
    }

    await invokeWithLiteRtLm(
      db,
      payload.groupId,
      payload.systemPrompt,
      payload.messages,
      payload.maxTokens,
      emit,
      abortSignal,
      payload.enabledTools,
    );

    return;
  }

  await handleInvoke(db, payload, abortSignal);
}
