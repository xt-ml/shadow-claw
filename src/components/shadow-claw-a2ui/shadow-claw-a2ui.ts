/**
 * <shadow-claw-a2ui>
 *
 * A2UI v1.0 Basic catalog renderer — renders interactive UI surfaces
 * delivered from an agent.
 *
 * Components accept `{ "path": "/key" }` data binding syntax, though
 * `{ "$dataModel": "/key" }` is still supported for backward compatibility.
 */
import { getDb } from "../../db/db.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { chatUiStore } from "../../stores/chat-ui.js";
import { globalComponentRegistry } from "../../ui/a2ui/registries/ComponentRegistry.js";
import { globalFunctionRegistry } from "../../ui/a2ui/registries/FunctionRegistry.js";
import { registerBasicFunctions } from "../../ui/a2ui/registries/basicFunctions.js";
import { applyDataModelUpdate } from "../../ui/a2ui/utils/applyDataModelUpdate.js";
import { buildItemDataScope } from "../../ui/a2ui/utils/buildItemDataScope.js";
import { normaliseComponentsToMap } from "../../ui/a2ui/utils/normaliseComponentsToMap.js";

import { renderAudioPlayer } from "./catalog/basic/audio-player.js";
import { renderButton } from "./catalog/basic/button.js";
import { renderCard } from "./catalog/basic/card.js";
import { renderCheckBox } from "./catalog/basic/checkbox.js";
import { renderChoicePicker } from "./catalog/basic/choice-picker.js";
import { renderColumn } from "./catalog/basic/column.js";
import { renderDateTimeInput } from "./catalog/basic/date-time-input.js";
import { renderDivider } from "./catalog/basic/divider.js";
import { renderIcon } from "./catalog/basic/icon.js";
import { renderImage } from "./catalog/basic/image.js";
import { renderList } from "./catalog/basic/list.js";
import { renderModal } from "./catalog/basic/modal.js";
import { renderRow } from "./catalog/basic/row.js";
import { renderSlider } from "./catalog/basic/slider.js";
import { renderTabs } from "./catalog/basic/tabs.js";
import { renderTextField } from "./catalog/basic/text-field.js";
import { renderText } from "./catalog/basic/text.js";
import { renderVideo } from "./catalog/basic/video.js";

import type { A2UIAction, A2UIEnvelope } from "../../ui/a2ui/types.js";
import type { ScopeContext, SurfaceState } from "../types.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawA2uiStyles from "./shadow-claw-a2ui.css" with { type: "css" };
import shadowClawA2uiTemplate from "./shadow-claw-a2ui.html" with { type: "html" };

const elementName = "shadow-claw-a2ui";

export class ShadowClawA2UI extends ShadowClawElement {
  static styles = shadowClawA2uiStyles;
  static template = shadowClawA2uiTemplate;

  /** groupId of the conversation this surface belongs to */
  groupId: string = "";

  /**
   * Whether the current surface requested full data model on every action
   * (spec §sendDataModel).
   */
  #sendDataModel: boolean = false;

  /** Current surface state — set externally by the chat component */
  #surface: SurfaceState | null = null;

  /**
   * Apply an A2UI envelope. Handles all four envelope types.
   * Call this whenever the orchestrator emits "a2ui-surface".
   */
  applyEnvelope(envelope: A2UIEnvelope): void {
    switch (envelope.type) {
      case "createSurface": {
        // Spec §createSurface: components arrive as a flat array; normalise
        // to a keyed map for O(1) lookup during render. Root is always "root".
        this.#surface = {
          surfaceId: envelope.surfaceId,
          components: normaliseComponentsToMap(envelope.components),
          dataModel: { ...(envelope.dataModel ?? {}) },
          rootComponentId: "root",
        };
        this.#sendDataModel = envelope.sendDataModel ?? false;
        this.#renderSurface();

        break;
      }

      case "updateComponents": {
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }

        // Spec §updateComponents: components arrive as an array; merge into map.
        this.#surface = {
          ...this.#surface,
          components: {
            ...this.#surface.components,
            ...normaliseComponentsToMap(envelope.components),
          },
        };
        this.#renderSurface();

        break;
      }

      case "updateDataModel": {
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }

        // Spec §updateDataModel: single path + value update.
        this.#surface = {
          ...this.#surface,
          dataModel: applyDataModelUpdate(
            this.#surface.dataModel,
            envelope.path,
            envelope.value,
            "value" in envelope,
          ),
        };
        this.#renderSurface();

        break;
      }

      case "deleteSurface": {
        if (this.#surface?.surfaceId === envelope.surfaceId) {
          this.#surface = null;
          this.#sendDataModel = false;
          this.#clearRoot();
        }

        break;
      }

      case "actionResponse": {
        // Spec §actionResponse: store the response value at responsePath.
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }
        if (envelope.responsePath) {
          this.#surface = {
            ...this.#surface,
            dataModel: applyDataModelUpdate(
              this.#surface.dataModel,
              envelope.responsePath,
              envelope.value,
            ),
          };
          this.#renderSurface();
        }
        break;
      }

      case "callFunction": {
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }

        let value: unknown = null;
        let error: string | undefined;

        try {
          // Spec §callFunction: evaluate function requested by agent
          value = globalFunctionRegistry.execute(
            (envelope as any).call.call,
            (envelope as any).call.args ?? {},
            { dataModel: this.#surface.dataModel },
          );
        } catch (e: any) {
          error =
            e.message && e.message.includes("INVALID_FUNCTION_CALL")
              ? e.message
              : `INVALID_FUNCTION_CALL: ${e.message}`;
        }

        const response: any = {
          version: "v1.0",
          type: "functionResponse",
          surfaceId: envelope.surfaceId,
          callId: (envelope as any).callId,
          value,
          ...(error ? { error } : {}),
        };

        this.dispatchEvent(
          new CustomEvent("shadow-claw-a2ui-function-response", {
            bubbles: true,
            composed: true,
            detail: { groupId: this.groupId, response },
          }),
        );
        break;
      }
    }
  }

  getSurfaceId(): string | null {
    return this.#surface?.surfaceId ?? null;
  }

  override async render(): Promise<void> {
    if (this.#surface) {
      this.#renderSurface();
    }
  }

  #attachModalOverlay(overlay: HTMLElement): void {
    const surface = this.shadowRoot?.querySelector(".a2ui__surface");
    if (surface) {
      surface.appendChild(overlay);
    }
  }

  #clearRoot(): void {
    const root = this.shadowRoot?.querySelector(".a2ui__root");
    if (root) {
      root.replaceChildren();
    }
  }

  #dispatchAction(actionId: string, surface: SurfaceState): void {
    // Intercept media playback actions to control local audio/video elements
    if (actionId === "playTrack" || actionId === "play") {
      const mediaElements = this.shadowRoot?.querySelectorAll(
        "audio, video",
      ) as NodeListOf<HTMLMediaElement> | undefined;
      mediaElements?.forEach((media) => media.play().catch(console.error));

      return; // Handled locally
    }

    if (actionId === "pauseTrack" || actionId === "pause") {
      const mediaElements = this.shadowRoot?.querySelectorAll(
        "audio, video",
      ) as NodeListOf<HTMLMediaElement> | undefined;
      mediaElements?.forEach((media) => media.pause());

      return; // Handled locally
    }

    // Intercept modal close actions to close open modals locally
    if (actionId === "closeModal" || actionId === "close") {
      const overlays = this.shadowRoot?.querySelectorAll(
        ".a2ui__modal-overlay",
      ) as NodeListOf<HTMLElement> | undefined;
      let handled = false;
      overlays?.forEach((overlay) => {
        if (overlay.style.display !== "none") {
          overlay.style.display = "none";
          const content = overlay.querySelector(".a2ui__modal-content");
          if (content) {
            content.replaceChildren();
          }

          handled = true;
        }
      });
      if (handled) {
        return; // Handled locally;
      }
    }

    // Use this.#surface (current state) not surface param (may be stale)
    // to ensure form data updates are captured
    const currentSurface = this.#surface ?? surface;
    const action: A2UIAction = {
      type: "a2ui-action",
      surfaceId: currentSurface.surfaceId,
      actionId,
      dataModel: this.#sendDataModel
        ? { ...currentSurface.dataModel }
        : { ...currentSurface.dataModel },
    };

    // Bubble up to shadow-claw-chat
    this.dispatchEvent(
      new CustomEvent("shadow-claw-a2ui-action", {
        bubbles: true,
        composed: true,
        detail: { groupId: this.groupId, action },
      }),
    );
  }

  #renderComponent(
    id: string,
    surface: SurfaceState,
    scopeContext?: ScopeContext,
  ): HTMLElement | null {
    const rawSpec = surface.components[id];
    if (!rawSpec) {
      console.warn(`[shadow-claw-a2ui] Unknown component id: "${id}"`);

      return null;
    }

    // Stamp the map key as spec.id — agents typically omit this field.
    const spec = rawSpec.id ? rawSpec : { ...rawSpec, id };

    let activeSurface = surface;
    if (scopeContext) {
      activeSurface = {
        ...surface,
        dataModel: buildItemDataScope(
          surface.dataModel,
          scopeContext.itemValue,
          scopeContext.index,
        ),
      };
    }

    const renderer = globalComponentRegistry.get(spec.component);
    if (renderer) {
      return renderer(spec, activeSurface, {
        renderComponent: (childId: string, childScope?: ScopeContext) =>
          this.#renderComponent(childId, surface, childScope ?? scopeContext),
        dispatchAction: (actionId: string) =>
          this.#dispatchAction(actionId, activeSurface),
        updateDataModelKey: (s: any, newValue: any) => {
          let ptr = "";
          if (typeof s.value === "object" && "path" in s.value) {
            ptr = s.value.path;
          } else if (typeof s.value === "object" && "$dataModel" in s.value) {
            ptr = s.value.$dataModel;
          }
          if (ptr) {
            if (scopeContext && ptr.startsWith("/@item")) {
              ptr = `${scopeContext.arrayPath}/${scopeContext.index}${ptr.slice(6)}`;
            }
            this.#updateDataModelPointer(ptr, newValue);
          }
        },
        resolveMediaUrl: (input: string) => this.#resolveMediaUrl(input),
        attachModalOverlay: (overlay: HTMLElement) =>
          this.#attachModalOverlay(overlay),
        updateDataModelPointer: (pointer: string, value: unknown) => {
          if (scopeContext && pointer.startsWith("/@item")) {
            const translated = `${scopeContext.arrayPath}/${scopeContext.index}${pointer.slice(6)}`;
            this.#updateDataModelPointer(translated, value);
          } else {
            this.#updateDataModelPointer(pointer, value);
          }
        },
      });
    }

    console.warn(
      `[shadow-claw-a2ui] Unknown component type: "${(spec as any).component}"`,
    );
    return null;
  }

  /**
   * Resolve a potential workspace filename to a file URL.
   * If input looks like a remote URL (http/https), return as-is.
   * If input looks like a workspace filename, resolve it to `/files/{groupId}/{path}`.
   * This URL will be intercepted by the Service Worker and served from OPFS.
   */
  #resolveMediaUrl(input: string): string {
    if (!input) {
      return "";
    }

    // Already a URL with protocol
    if (/^https?:\/\//.test(input)) {
      return input;
    }

    // Already a file:// or data: URL
    if (/^(file|data):/.test(input)) {
      return input;
    }

    // Already a workspace route path -- preserve it verbatim.
    if (/^\/files\/[a-zA-Z0-9_-]+\/.*$/.test(input)) {
      return input;
    }

    // Workspace filename or relative path
    // groupId is set by shadow-claw-chat and should be in canonical form (with colons)
    // or already in URL-safe form (with dashes for peer IDs)
    if (!this.groupId) {
      console.warn(
        "[shadow-claw-a2ui] groupId not set, cannot resolve workspace files",
      );

      return "";
    }

    // Normalize: if groupId contains colons, replace with dashes for URL safety
    // If it already has dashes (peer-XXXX format), use as-is
    const normalizedGroupId = this.groupId.replace(/:/g, "-");
    const cleanPath = input.replace(/^\.\/?/, "");
    const encodedPath = cleanPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const resolvedUrl = `/files/${normalizedGroupId}/${encodedPath}`;

    return resolvedUrl;
  }

  #updateDataModelPointer(pointer: string, value: unknown): void {
    if (!this.#surface) {
      return;
    }

    this.#surface = {
      ...this.#surface,
      dataModel: applyDataModelUpdate(this.#surface.dataModel, pointer, value),
    };
  }

  async #renderSurface(): Promise<void> {
    const surface = this.#surface;
    if (!surface) {
      return;
    }

    const root = this.shadowRoot?.querySelector(".a2ui__root");
    if (!(root instanceof HTMLElement)) {
      return;
    }

    root.replaceChildren();

    const rootEl = this.#renderComponent(surface.rootComponentId, surface);
    if (rootEl) {
      root.appendChild(rootEl);
    }

    // Resolve deferred workspace images to blob URLs (videos/audio use Service Worker streaming)
    await this.#resolveWorkspaceImages();
  }

  /**
   * Convert a single media element's deferred workspace path to a blob URL.
   */
  async #resolveSingleMediaToBlobUrl(el: Element, db: any): Promise<void> {
    if (
      !(el instanceof HTMLImageElement) &&
      !(el instanceof HTMLVideoElement) &&
      !(el instanceof HTMLAudioElement)
    ) {
      return;
    }

    const workspacePath = el.getAttribute("data-a2ui-workspace-src");
    if (!workspacePath) {
      return;
    }

    const elementType =
      el instanceof HTMLImageElement
        ? "image"
        : el instanceof HTMLVideoElement
          ? "video"
          : "audio";

    try {
      // Parse workspace path to extract groupId and file path
      const match = workspacePath.match(/^\/files\/([a-zA-Z0-9_-]+)\/(.+)$/);
      if (!match) {
        console.warn(
          `[shadow-claw-a2ui] Invalid workspace path: ${workspacePath}`,
        );

        return;
      }

      const [, groupId, encodedFilePath] = match;
      const filePath = decodeURIComponent(encodedFilePath);
      const canonicalGroupId = groupId.replace(/-/g, ":");

      // Read media bytes from storage
      const bytes = await readGroupFileBytes(db, canonicalGroupId, filePath);
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);

      // Determine MIME type from file extension
      const lowerPath = filePath.toLowerCase();
      let mimeType = "application/octet-stream";
      if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) {
        mimeType = "image/jpeg";
      } else if (lowerPath.endsWith(".png")) {
        mimeType = "image/png";
      } else if (lowerPath.endsWith(".gif")) {
        mimeType = "image/gif";
      } else if (lowerPath.endsWith(".webp")) {
        mimeType = "image/webp";
      } else if (lowerPath.endsWith(".svg")) {
        mimeType = "image/svg+xml";
      } else if (lowerPath.endsWith(".mp4") || lowerPath.endsWith(".m4v")) {
        mimeType = "video/mp4";
      } else if (lowerPath.endsWith(".webm")) {
        mimeType = "video/webm";
      } else if (lowerPath.endsWith(".mkv")) {
        mimeType = "video/x-matroska";
      } else if (lowerPath.endsWith(".mov")) {
        mimeType = "video/mp4";
      } else if (lowerPath.endsWith(".mp3")) {
        mimeType = "audio/mpeg";
      } else if (lowerPath.endsWith(".wav")) {
        mimeType = "audio/wav";
      } else if (lowerPath.endsWith(".flac")) {
        mimeType = "audio/flac";
      } else if (lowerPath.endsWith(".aac")) {
        mimeType = "audio/aac";
      } else if (lowerPath.endsWith(".m4a")) {
        mimeType = "audio/mp4";
      }

      // Create blob URL
      const blob = new Blob([blobBytes], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      chatUiStore.registerAttachmentObjectUrl(objectUrl);

      // Set the blob URL as the src
      el.removeAttribute("data-a2ui-workspace-src");
      if (el instanceof HTMLImageElement) {
        el.src = objectUrl;
      } else if (
        el instanceof HTMLVideoElement ||
        el instanceof HTMLAudioElement
      ) {
        el.src = objectUrl;
      }
    } catch (e) {
      console.error(
        `[shadow-claw-a2ui] Failed to load workspace ${elementType}: ${workspacePath}`,
        e,
      );
    }
  }

  /**
   * Resolve a video's poster URL to a blob URL.
   */
  async #resolveVideoPosterToBlobUrl(
    video: HTMLVideoElement,
    db: any,
  ): Promise<void> {
    const posterPath = video.getAttribute("data-a2ui-workspace-poster");
    if (!posterPath) {
      return;
    }

    try {
      // Parse workspace path to extract groupId and file path
      const match = posterPath.match(/^\/files\/([a-zA-Z0-9_-]+)\/(.+)$/);
      if (!match) {
        return;
      }

      const [, groupId, filePath] = match;
      const canonicalGroupId = groupId.replace(/-/g, ":");

      // Read poster bytes from storage
      const bytes = await readGroupFileBytes(db, canonicalGroupId, filePath);
      const blobBytes = new Uint8Array(bytes.byteLength);
      blobBytes.set(bytes);

      // Determine MIME type
      const lowerPath = filePath.toLowerCase();
      let mimeType = "image/jpeg";
      if (lowerPath.endsWith(".png")) {
        mimeType = "image/png";
      } else if (lowerPath.endsWith(".gif")) {
        mimeType = "image/gif";
      } else if (lowerPath.endsWith(".webp")) {
        mimeType = "image/webp";
      }

      // Create blob URL
      const blob = new Blob([blobBytes], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      chatUiStore.registerAttachmentObjectUrl(objectUrl);

      video.removeAttribute("data-a2ui-workspace-poster");
      video.poster = objectUrl;
    } catch (e) {
      console.warn(
        `[shadow-claw-a2ui] Failed to load workspace poster: ${posterPath}`,
        e,
      );
    }
  }

  /**
   * Resolve deferred workspace images, videos, and audio to blob URLs loaded from storage.
   * Runs asynchronously after rendering to avoid blocking the UI.
   * Uses Promise.all to parallelize all media loading.
   */
  async #resolveWorkspaceImages(): Promise<void> {
    const root = this.shadowRoot?.querySelector(".a2ui__root");
    if (!(root instanceof HTMLElement)) {
      return;
    }

    // Collect all deferred media elements
    const mediaElements = [
      ...Array.from(root.querySelectorAll("img[data-a2ui-workspace-src]")),
      ...Array.from(root.querySelectorAll("video[data-a2ui-workspace-src]")),
      ...Array.from(root.querySelectorAll("audio[data-a2ui-workspace-src]")),
    ];

    // Also resolve poster URLs for videos
    const videosWithPoster = Array.from(
      root.querySelectorAll("video[data-a2ui-workspace-poster]"),
    );

    if (mediaElements.length === 0 && videosWithPoster.length === 0) {
      return;
    }

    const db = await getDb();

    // Parallelize all media blob URL conversions using Promise.all
    await Promise.all(
      mediaElements.map((el) => this.#resolveSingleMediaToBlobUrl(el, db)),
    );

    await Promise.all(
      videosWithPoster.map((el) =>
        this.#resolveVideoPosterToBlobUrl(el as HTMLVideoElement, db),
      ),
    );
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ShadowClawA2UI);
}

// Register basic catalog components
globalComponentRegistry.register("Text", (spec, surface) =>
  renderText(spec, surface),
);
globalComponentRegistry.register("Row", (spec, surface, ctx) =>
  renderRow(spec, surface, { renderComponent: ctx.renderComponent }),
);
globalComponentRegistry.register("Column", (spec, surface, ctx) =>
  renderColumn(spec, surface, { renderComponent: ctx.renderComponent }),
);
globalComponentRegistry.register("Button", (spec, surface, ctx) =>
  renderButton(spec, surface, {
    renderComponent: ctx.renderComponent,
    dispatchAction: ctx.dispatchAction,
  }),
);
globalComponentRegistry.register("TextField", (spec, surface, ctx) =>
  renderTextField(spec, surface, {
    updateDataModelKey: ctx.updateDataModelKey,
  }),
);
globalComponentRegistry.register("Image", (spec, surface, ctx) =>
  renderImage(spec, surface, { resolveMediaUrl: ctx.resolveMediaUrl }),
);
globalComponentRegistry.register("Icon", (spec, surface) =>
  renderIcon(spec, surface),
);
globalComponentRegistry.register("Video", (spec, surface, ctx) =>
  renderVideo(spec, surface, { resolveMediaUrl: ctx.resolveMediaUrl }),
);
globalComponentRegistry.register("AudioPlayer", (spec, surface, ctx) =>
  renderAudioPlayer(spec, surface, { resolveMediaUrl: ctx.resolveMediaUrl }),
);
globalComponentRegistry.register("List", (spec, surface, ctx) =>
  renderList(spec, surface, { renderComponent: ctx.renderComponent }),
);
globalComponentRegistry.register("Card", (spec, surface, ctx) =>
  renderCard(spec, surface, { renderComponent: ctx.renderComponent }),
);
globalComponentRegistry.register("Tabs", (spec, surface, ctx) =>
  renderTabs(spec, surface, { renderComponent: ctx.renderComponent }),
);
globalComponentRegistry.register("Modal", (spec, surface, ctx) =>
  renderModal(spec, surface, {
    renderComponent: ctx.renderComponent,
    attachModalOverlay: ctx.attachModalOverlay,
  }),
);
globalComponentRegistry.register("Divider", (spec, surface) =>
  renderDivider(spec, surface),
);
globalComponentRegistry.register("CheckBox", (spec, surface, ctx) =>
  renderCheckBox(spec, surface, {
    dispatchAction: ctx.dispatchAction,
    updateDataModelPointer: ctx.updateDataModelPointer,
  }),
);
globalComponentRegistry.register("ChoicePicker", (spec, surface, ctx) =>
  renderChoicePicker(spec, surface, {
    updateDataModelPointer: ctx.updateDataModelPointer,
  }),
);
globalComponentRegistry.register("Slider", (spec, surface, ctx) =>
  renderSlider(spec, surface, {
    updateDataModelPointer: ctx.updateDataModelPointer,
  }),
);
globalComponentRegistry.register("DateTimeInput", (spec, surface, ctx) =>
  renderDateTimeInput(spec, surface, {
    updateDataModelPointer: ctx.updateDataModelPointer,
  }),
);

// Register basic functions
registerBasicFunctions();
