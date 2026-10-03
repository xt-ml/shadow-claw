declare const __PRERENDER_MAIN_MEMORY__: boolean | undefined;

export const PRERENDER_SKELETON_META_NAME =
  "shadow-claw-override-prerender-skeleton";

/**
 * Default for "override pre-rendered content with skeleton" when the user has
 * not chosen a value. A site-config meta tag (written at build time from
 * `settings.overridePrerenderSkeleton`) wins over the build-time constant.
 */
export function getPrerenderSkeletonDefault(): boolean {
  try {
    const content = document
      .querySelector(`meta[name="${PRERENDER_SKELETON_META_NAME}"]`)
      ?.getAttribute("content");

    if (content === "true") {
      return true;
    }

    if (content === "false") {
      return false;
    }
  } catch {
    // No DOM available; use the build-time default.
  }

  return typeof __PRERENDER_MAIN_MEMORY__ !== "undefined"
    ? __PRERENDER_MAIN_MEMORY__
    : true;
}
