import { resolveDynamicString } from "../../../ui/a2ui.js";
import { applyWeight } from "./shared.js";

import type { AudioPlayerSpec } from "../../../ui/a2ui.js";
import type { RenderContext, SurfaceState } from "../../types.js";

export function renderAudioPlayer(
  spec: AudioPlayerSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "resolveMediaUrl">,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "a2ui__audio";

  const audio = document.createElement("audio");
  audio.controls = true;

  let audioUrl =
    spec.url ??
    (spec as any).src ??
    (spec as any).source ??
    (spec as any).audioUrl ??
    "";
  audioUrl = resolveDynamicString(audioUrl, surface.dataModel);

  const resolvedUrl = ctx.resolveMediaUrl(audioUrl);
  if (resolvedUrl.startsWith("/files/")) {
    audio.setAttribute("data-a2ui-workspace-src", resolvedUrl);
  } else if (resolvedUrl) {
    audio.src = resolvedUrl;
  }

  applyWeight(wrapper, spec.weight);
  wrapper.appendChild(audio);

  if (spec.description) {
    const desc = document.createElement("div");
    desc.className = "a2ui__audio-description";
    desc.textContent = resolveDynamicString(
      spec.description,
      surface.dataModel,
    );
    wrapper.appendChild(desc);
  }

  return wrapper;
}
