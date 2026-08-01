const componentLoaders: Record<string, () => Promise<unknown>> = {
  pages: () => import("../../shadow-claw-pages/shadow-claw-pages.js"),
  chat: () => import("../../shadow-claw-chat/shadow-claw-chat.js"),
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

const loadedComponents = new Set<string>();

export async function ensureComponentLoaded(name: string): Promise<void> {
  if (loadedComponents.has(name)) {
    return;
  }
  const loader = componentLoaders[name];
  if (loader) {
    loadedComponents.add(name);
    await loader();
  }
}
