export const CHUNK_LOAD_ERROR_EVENT = "shadow-claw-chunk-load-error";

const componentLoaders: Record<string, () => Promise<unknown>> = {
  pages: () => import("../../shadow-claw-pages/shadow-claw-pages.js"),
  chat: () => import("../../shadow-claw-chat/shadow-claw-chat.js"),
  conversations: () =>
    import("../../shadow-claw-conversations/shadow-claw-conversations.js"),
  tasks: () => import("../../shadow-claw-tasks/shadow-claw-tasks.js"),
  files: () => import("../../shadow-claw-files/shadow-claw-files.js"),
  settings: () => import("../../shadow-claw-settings/shadow-claw-settings.js"),
  tools: () => import("../../shadow-claw-tools/shadow-claw-tools.js"),
  channels: () => import("../../shadow-claw-channels/shadow-claw-channels.js"),
  terminal: () => import("../../shadow-claw-terminal/shadow-claw-terminal.js"),
  "file-viewer": () =>
    import("../../shadow-claw-file-viewer/shadow-claw-file-viewer.js"),
  "pdf-viewer": () =>
    import("../../shadow-claw-pdf-viewer/shadow-claw-pdf-viewer.js"),
};

const loadingPromises = new Map<string, Promise<void>>();

function dispatchChunkLoadError(name: string, error: unknown): void {
  if (
    typeof globalThis.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    globalThis.dispatchEvent(
      new CustomEvent(CHUNK_LOAD_ERROR_EVENT, {
        detail: { name, error },
      }),
    );
  }
}

export async function ensureComponentLoaded(
  name: string,
  loaders: Record<string, () => Promise<unknown>> = componentLoaders,
): Promise<void> {
  let promise = loadingPromises.get(name);
  if (!promise) {
    const loader = loaders[name];
    if (loader) {
      promise = loader()
        .then(() => undefined)
        .catch((error) => {
          loadingPromises.delete(name);
          dispatchChunkLoadError(name, error);
          throw error;
        });
      loadingPromises.set(name, promise);
    } else {
      promise = Promise.resolve();
    }
  }
  await promise;
}
