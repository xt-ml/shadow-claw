import type { GroupMeta } from "../../../db/types.js";
import { resolveWorkspaceFileTarget } from "./resolveWorkspaceFileTarget.js";

export interface ResolveMarkdownImagesOptions {
  container: HTMLElement;
  groupId: string;
  filePath: string;
  groups: GroupMeta[];
  readImageAsDataUrlFn: (
    groupId: string,
    workspacePath: string,
  ) => Promise<string | null>;
}

/**
 * Scans container for relative images, resolves workspace targets, and replaces src attributes with Data URLs.
 */
export async function resolveMarkdownImages({
  container,
  groupId,
  filePath,
  groups,
  readImageAsDataUrlFn,
}: ResolveMarkdownImagesOptions): Promise<void> {
  const images = Array.from(container.querySelectorAll("img[src]"));
  if (images.length === 0) {
    return;
  }

  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src || /^(?:blob:|data:|#)/u.test(src)) {
        return;
      }

      const target = resolveWorkspaceFileTarget(src, filePath, groupId, groups);
      if (!target) {
        return;
      }

      const dataUrl = await readImageAsDataUrlFn(target.groupId, target.path);
      if (!dataUrl) {
        return;
      }

      img.setAttribute("src", dataUrl);
    }),
  );
}
