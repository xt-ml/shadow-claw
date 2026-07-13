import { applyWeight } from "./shared.js";
import { resolveDynamicString } from "../../../ui/a2ui.js";

import type { VideoSpec } from "../../../ui/a2ui.js";
import type { SurfaceState, RenderContext } from "../../types.js";

export function renderVideo(
  spec: VideoSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "resolveMediaUrl">,
): HTMLElement {
  const video = document.createElement("video");
  video.controls = true;
  video.className = "a2ui__video";

  let videoUrl =
    spec.url ??
    (spec as any).src ??
    (spec as any).source ??
    (spec as any).videoUrl ??
    "";
  videoUrl = resolveDynamicString(videoUrl, surface.dataModel);

  const resolvedUrl = ctx.resolveMediaUrl(videoUrl);
  if (resolvedUrl.startsWith("/files/")) {
    video.setAttribute("data-a2ui-workspace-src", resolvedUrl);
  } else if (resolvedUrl) {
    video.src = resolvedUrl;
  }

  if (spec.posterUrl) {
    const posterUrl = ctx.resolveMediaUrl(
      resolveDynamicString(spec.posterUrl, surface.dataModel),
    );
    if (posterUrl.startsWith("/files/")) {
      video.setAttribute("data-a2ui-workspace-poster", posterUrl);
    } else if (posterUrl) {
      video.poster = posterUrl;
    }
  }

  applyWeight(video, spec.weight);

  return video;
}
