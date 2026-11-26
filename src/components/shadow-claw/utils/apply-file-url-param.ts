import { getAppBasePath } from "../../../core/app-routes.js";
import {
  getSiteConfigDefaultViewerComponents,
  getUrlParam,
  readFileParamFromUrl,
  resolveDefaultViewerComponent,
  setPendingFileParam,
  type PendingFileParamPayload,
} from "../../../utils/url-file-param.js";

import type { FileViewerStore } from "../../../stores/file-viewer.js";

let lastHandledRawFileParam: string | null = null;

function findTargetViewerElement(
  shadow: ShadowRoot | null,
  tagName: string,
): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const fromShadow = shadow?.querySelector(tagName) as HTMLElement | null;
  if (fromShadow) return fromShadow;

  const pagesInShadow = shadow?.querySelector("shadow-claw-pages") as
    (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
  const fromPagesShadow = pagesInShadow?.shadowRoot?.querySelector(
    tagName,
  ) as HTMLElement | null;
  if (fromPagesShadow) return fromPagesShadow;

  const fromDoc = document.querySelector(tagName) as HTMLElement | null;
  if (fromDoc) return fromDoc;

  const pagesInDoc = document.querySelector("shadow-claw-pages") as
    (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
  const fromPagesDoc = pagesInDoc?.shadowRoot?.querySelector(
    tagName,
  ) as HTMLElement | null;
  if (fromPagesDoc) return fromPagesDoc;

  return null;
}

export function resetLastHandledFileParam(): void {
  lastHandledRawFileParam = null;
}

/**
 * Checks `url` for a compressed `#file=` / `?file=` parameter and routes it
 * either to the configured `settings.defaultViewerComponents` custom element
 * or to the default `shadow-claw-file-viewer` via `fileViewerStore`.
 */
export async function applyFileUrlParam(
  shadow: ShadowRoot | null,
  fStore: FileViewerStore,
  url: URL,
): Promise<boolean> {
  const rawParam = getUrlParam("file", url);
  if (!rawParam) {
    lastHandledRawFileParam = null;
    return false;
  }

  if (rawParam === lastHandledRawFileParam) {
    return false;
  }

  const decoded = await readFileParamFromUrl(url);
  if (!decoded) {
    return false;
  }

  lastHandledRawFileParam = rawParam;

  const targetComponent = resolveDefaultViewerComponent(
    url.pathname,
    getSiteConfigDefaultViewerComponents(),
    getAppBasePath(),
  );

  if (targetComponent) {
    const payload: PendingFileParamPayload = {
      ...decoded,
      targetComponent,
      url: url.href,
    };

    setPendingFileParam(payload);

    const targetEl = findTargetViewerElement(shadow, targetComponent) as
      | (HTMLElement & {
          openFileFromUrl?: (
            payload: PendingFileParamPayload,
          ) => void | Promise<void>;
        })
      | null;

    if (targetEl) {
      if (typeof targetEl.openFileFromUrl === "function") {
        await targetEl.openFileFromUrl(payload);
      }
      targetEl.dispatchEvent(
        new CustomEvent("shadow-claw-file-param", {
          detail: payload,
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("shadow-claw-file-param", {
          detail: payload,
          bubbles: true,
          composed: true,
        }),
      );
    }

    return true;
  }

  fStore.openInMemoryFile({
    name: decoded.name,
    content: decoded.content,
  });

  return true;
}
