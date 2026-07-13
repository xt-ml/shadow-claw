import type { ImageSpec } from "../../../ui/a2ui.js";
import { resolveDynamicString } from "../../../ui/a2ui.js";
import type { SurfaceState, RenderContext } from "../../types.js";
import { applyWeight } from "./shared.js";

export function renderImage(
  spec: ImageSpec,
  surface: SurfaceState,
  ctx: Pick<RenderContext, "resolveMediaUrl">,
): HTMLElement {
  const img = document.createElement("img");
  img.className = `a2ui__image a2ui__image--${spec.variant ?? "mediumFeature"}`;

  let imageUrl =
    spec.url ??
    (spec as any).src ??
    (spec as any).source ??
    (spec as any).imageUrl ??
    "";
  imageUrl = resolveDynamicString(imageUrl, surface.dataModel);

  const resolvedUrl = ctx.resolveMediaUrl(imageUrl);
  if (resolvedUrl.startsWith("/files/")) {
    img.setAttribute("data-a2ui-workspace-src", resolvedUrl);
  } else if (resolvedUrl) {
    img.src = resolvedUrl;
  }

  img.alt = spec.description
    ? resolveDynamicString(spec.description, surface.dataModel)
    : "";
  img.style.objectFit = spec.fit ?? "fill";
  applyWeight(img, spec.weight);

  return img;
}
