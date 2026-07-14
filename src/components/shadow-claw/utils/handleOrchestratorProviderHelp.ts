import { requestDialog } from "./requestDialog.js";

import { buildLlamafileHelpDialogOptions } from "../../common/help/llamafile.js";
import { buildProviderHelpDialogOptions } from "../../common/help/providers.js";
import { buildTransformersJsHelpDialogOptions } from "../../common/help/transformers.js";

import type { ProviderHelpType } from "../../types.js";

export async function handleOrchestratorProviderHelp(
  doc: Document,
  shadow: ShadowRoot | null,
  payload: {
    providerId: string;
    reason?: string;
    helpType?: ProviderHelpType;
  },
) {
  if (payload?.providerId === "llamafile") {
    await requestDialog(
      doc,
      shadow,
      buildLlamafileHelpDialogOptions(payload.reason),
    );
  } else if (payload?.providerId === "transformers_js_local") {
    await requestDialog(
      doc,
      shadow,
      buildTransformersJsHelpDialogOptions(payload.reason),
    );
  } else if (payload?.providerId && payload.helpType) {
    await requestDialog(
      doc,
      shadow,
      buildProviderHelpDialogOptions(
        payload.providerId,
        payload.helpType,
        payload.reason,
      ),
    );
  }
}
