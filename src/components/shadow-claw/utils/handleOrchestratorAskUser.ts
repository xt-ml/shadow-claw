import { requestUserPrompt } from "./requestUserPrompt.js";

import type { ShadowClaw } from "../shadow-claw.js";

export async function handleOrchestratorAskUser(
  doc: Document,
  shadow: ShadowRoot | null,
  shadowClaw: ShadowClaw,
  payload: {
    id: string;
    groupId: string;
    question: string;
    options?: string[];
  },
) {
  const response = await requestUserPrompt(doc, shadow, payload);

  shadowClaw.orchestrator.answerUserPrompt(payload.id, response);
}
