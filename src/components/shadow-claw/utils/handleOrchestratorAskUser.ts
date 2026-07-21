import { requestUserPrompt } from "./requestUserPrompt.js";

interface AskUserContext {
  orchestrator: {
    answerUserPrompt: (id: string, response: string | null) => void;
  };
}

export async function handleOrchestratorAskUser(
  doc: Document,
  shadow: ShadowRoot | null,
  shadowClaw: AskUserContext,
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
