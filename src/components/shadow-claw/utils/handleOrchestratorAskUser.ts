import { answerUserPrompt } from "../../../core/orchestrator/utils/operations/vm.js";
import { requestUserPrompt } from "./requestUserPrompt.js";

interface AskUserContext {
  orchestrator: any;
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

  answerUserPrompt(shadowClaw.orchestrator, payload.id, response);
}
