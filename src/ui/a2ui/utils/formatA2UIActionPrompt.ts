import type { A2UIAction } from "../types.js";

/**
 * Build the `[A2UI ACTION]` prompt delivered to the surface owner's agent when
 * a user interacts with a surface (clicks a Button, submits a TextField, …).
 *
 * The prompt is intentionally prefixed with `[A2UI ACTION]` so the orchestrator
 * can force-trigger the agent regardless of channel. It is the single source of
 * truth shared by the local chat UI and the multi-party room manager.
 *
 * @param action  The action fired on the surface.
 * @param actorAlias  Optional human-readable name of the peer that fired the
 *   action (used in shared room surfaces to give the owner context).
 */
export function formatA2UIActionPrompt(
  action: A2UIAction,
  actorAlias?: string,
): string {
  const dataModelJson = JSON.stringify(action.dataModel ?? {}, null, 2);
  const actor = actorAlias ? `${actorAlias}` : "The user";

  return (
    `[A2UI ACTION]\n` +
    `surfaceId: "${action.surfaceId}"\n` +
    `actionId: "${action.actionId}"\n` +
    (actorAlias ? `firedBy: "${actorAlias}"\n` : "") +
    `dataModel:\n${dataModelJson}\n\n` +
    `Instructions: ${actor} triggered the "${action.actionId}" action on ` +
    `surface "${action.surfaceId}". ` +
    `The dataModel above contains the current form values. ` +
    `Use the appropriate tool(s) to fulfill the action based on the actionId ` +
    `and dataModel values. ` +
    `After you have a result, call render_component with action ` +
    `"updateDataModel" on surfaceId "${action.surfaceId}" to update the ` +
    `surface (e.g. set path "/result" to the output value). ` +
    `Do NOT respond with plain text only — always update the surface via ` +
    `render_component.`
  );
}
