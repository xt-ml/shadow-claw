/**
 * <shadow-claw-a2ui>
 *
 * A2UI v1.0 minimal catalog renderer — renders interactive UI surfaces
 * delivered from an agent via the PeerJS WebRTC channel.
 *
 * Supported components: Text, Row, Column, Button, TextField
 * Supported function:   capitalize
 */

import ShadowClawElement from "../shadow-claw-element.js";

import { applyDataModelPatches } from "../../ui/a2ui.js";
import { getDb } from "../../db/db.js";
import { readGroupFileBytes } from "../../storage/readGroupFileBytes.js";
import { chatUiStore } from "../../stores/chat-ui.js";

import {
  renderAudioPlayer,
  renderButton,
  renderCard,
  renderCheckBox,
  renderChoicePicker,
  renderColumn,
  renderDateTimeInput,
  renderDivider,
  renderIcon,
  renderImage,
  renderList,
  renderModal,
  renderRow,
  renderSlider,
  renderTabs,
  renderText,
  renderTextField,
  renderVideo,
} from "./catalog/index.js";

import type { A2UIEnvelope, A2UIAction, TextFieldSpec } from "../../ui/a2ui.js";
import type { SurfaceState } from "./catalog/types.js";

export class ShadowClawA2UI extends ShadowClawElement {
  static readonly component = "shadow-claw-a2ui";
  static readonly styles = "components/shadow-claw-a2ui/shadow-claw-a2ui.css";
  static readonly template =
    "components/shadow-claw-a2ui/shadow-claw-a2ui.html";

  /** Current surface state — set externally by the chat component */
  #surface: SurfaceState | null = null;

  /** groupId of the conversation this surface belongs to */
  groupId: string = "";

  // ---------------------------------------------------------------------------
  // Public API — called by shadow-claw-chat
  // ---------------------------------------------------------------------------

  /**
   * Apply an A2UI envelope. Handles all four envelope types.
   * Call this whenever the orchestrator emits "a2ui-surface".
   */
  applyEnvelope(envelope: A2UIEnvelope): void {
    switch (envelope.type) {
      case "createSurface": {
        this.#surface = {
          surfaceId: envelope.surfaceId,
          components: { ...envelope.components },
          dataModel: { ...(envelope.dataModel ?? {}) },
          rootComponentId: envelope.rootComponentId,
        };
        this.#renderSurface();

        break;
      }

      case "updateComponents": {
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }

        this.#surface = {
          ...this.#surface,
          components: {
            ...this.#surface.components,
            ...envelope.components,
          },
        };
        this.#renderSurface();

        break;
      }

      case "updateDataModel": {
        if (!this.#surface || this.#surface.surfaceId !== envelope.surfaceId) {
          return;
        }

        this.#surface = {
          ...this.#surface,
          dataModel: applyDataModelPatches(
            this.#surface.dataModel,
            envelope.patches,
          ),
        };
        this.#renderSurface();

        break;
      }

      case "deleteSurface": {
        if (this.#surface?.surfaceId === envelope.surfaceId) {
          this.#surface = null;
          this.#clearRoot();
        }

        break;
      }
    }
  }

  getSurfaceId(): string | null {
    return this.#surface?.surfaceId ?? null;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  override async render(): Promise<void> {
    if (this.#surface) {
      this.#renderSurface();
    }
  }

  #clearRoot(): void {
    const root = this.shadowRoot?.querySelector(".a2ui__root");
    if (root) {
      root.replaceChildren();
    }
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

  #renderComponent(id: string, surface: SurfaceState): HTMLElement | null {
    const rawSpec = surface.components[id];
    if (!rawSpec) {
      console.warn(`[shadow-claw-a2ui] Unknown component id: "${id}"`);

      return null;
    }

    // Stamp the map key as spec.id — agents typically omit this field.
    const spec = rawSpec.id ? rawSpec : { ...rawSpec, id };

    switch (spec.component) {
      case "Text":
        return renderText(spec, surface);
      case "Row":
        return renderRow(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
        });
      case "Column":
        return renderColumn(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
        });
      case "Button":
        return renderButton(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
          dispatchAction: (actionId) => this.#dispatchAction(actionId, surface),
        });
      case "TextField":
        return renderTextField(spec, surface, {
          updateDataModelKey: (spec, newValue) =>
            this.#updateDataModelKey(spec, newValue),
        });
      case "Image":
        return renderImage(spec, surface, {
          resolveMediaUrl: (input) => this.#resolveMediaUrl(input),
        });
      case "Icon":
        return renderIcon(spec, surface);
      case "Video":
        return renderVideo(spec, surface, {
          resolveMediaUrl: (input) => this.#resolveMediaUrl(input),
        });
      case "AudioPlayer":
        return renderAudioPlayer(spec, surface, {
          resolveMediaUrl: (input) => this.#resolveMediaUrl(input),
        });
      case "List":
        return renderList(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
        });
      case "Card":
        return renderCard(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
        });
      case "Tabs":
        return renderTabs(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
        });
      case "Modal":
        return renderModal(spec, surface, {
          renderComponent: (childId) => this.#renderComponent(childId, surface),
          attachModalOverlay: (overlay) => this.#attachModalOverlay(overlay),
        });
      case "Divider":
        return renderDivider(spec, surface);
      case "CheckBox":
        return renderCheckBox(spec, surface, {
          dispatchAction: (actionId) => this.#dispatchAction(actionId, surface),
          updateDataModelPointer: (pointer, value) =>
            this.#updateDataModelPointer(pointer, value),
        });
      case "ChoicePicker":
        return renderChoicePicker(spec, surface, {
          updateDataModelPointer: (pointer, value) =>
            this.#updateDataModelPointer(pointer, value),
        });
      case "Slider":
        return renderSlider(spec, surface, {
          updateDataModelPointer: (pointer, value) =>
            this.#updateDataModelPointer(pointer, value),
        });
      case "DateTimeInput":
        return renderDateTimeInput(spec, surface, {
          updateDataModelPointer: (pointer, value) =>
            this.#updateDataModelPointer(pointer, value),
        });
      default:
        console.warn(
          `[shadow-claw-a2ui] Unknown component type: "${(spec as any).component}"`,
        );

        return null;
    }
  }

  #attachModalOverlay(overlay: HTMLElement): void {
    const surface = this.shadowRoot?.querySelector(".a2ui__surface");
    if (surface) {
      surface.appendChild(overlay);
    }
  }

  // ── Basic components ───────────────────────────────────────────────────

  // ---------------------------------------------------------------------------
  // Generic helper to set a data model pointer on the current surface
  // ---------------------------------------------------------------------------

  #updateDataModelPointer(pointer: string, value: unknown): void {
    if (!this.#surface) {
      return;
    }

    const key = pointer.replace(/^\//, "");
    this.#surface = {
      ...this.#surface,
      dataModel: { ...this.#surface.dataModel, [key]: value },
    };
  }

  // ---------------------------------------------------------------------------
  // Data model mutation (from field input events)
  // ---------------------------------------------------------------------------

  #updateDataModelKey(spec: TextFieldSpec, newValue: string): void {
    if (!this.#surface || !spec.value) {
      return;
    }

    if (typeof spec.value === "object" && "$dataModel" in spec.value) {
      const key = spec.value.$dataModel.replace(/^\//, "");
      this.#surface = {
        ...this.#surface,
        dataModel: {
          ...this.#surface.dataModel,
          [key]: newValue,
        },
      };
      // No full re-render needed — the input owns its own value
    }
  }

  // ---------------------------------------------------------------------------
  // Action dispatch
  // ---------------------------------------------------------------------------

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
      dataModel: { ...currentSurface.dataModel },
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

  // ---------------------------------------------------------------------------
  // Workspace file resolution
  // ---------------------------------------------------------------------------

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

    const db = await getDb();

    // Collect all deferred media elements
    const mediaElements = [
      ...Array.from(root.querySelectorAll("img[data-a2ui-workspace-src]")),
      ...Array.from(root.querySelectorAll("video[data-a2ui-workspace-src]")),
      ...Array.from(root.querySelectorAll("audio[data-a2ui-workspace-src]")),
    ];

    // Parallelize all media blob URL conversions using Promise.all
    await Promise.all(
      mediaElements.map((el) => this.#resolveSingleMediaToBlobUrl(el, db)),
    );

    // Also resolve poster URLs for videos
    const videosWithPoster = Array.from(
      root.querySelectorAll("video[data-a2ui-workspace-poster]"),
    );
    await Promise.all(
      videosWithPoster.map((el) =>
        this.#resolveVideoPosterToBlobUrl(el as HTMLVideoElement, db),
      ),
    );
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
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

if (!customElements.get("shadow-claw-a2ui")) {
  customElements.define("shadow-claw-a2ui", ShadowClawA2UI);
}
