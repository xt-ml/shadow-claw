/**
 * Headless mode flag.
 *
 * Set to `true` when the agent is running in the headless CLI participant
 * mode (i.e. `npx shadow-claw agent`). Browser-only tools check this flag
 * and return a clear error rather than silently failing.
 */

let _headless = false;

/**
 * Tools that require an interactive browser environment (DOM, canvas, Web Components,
 * PeerJS rooms, Web Share, Web Push notifications, or subagents).
 * In headless mode, these tools are never presented to the LLM or executed.
 */
export const BROWSER_ONLY_TOOLS: ReadonlySet<string> = new Set([
  "ask_user",
  "attach_file_to_chat",
  "clear_chat",
  "create_room",
  "invite_to_room",
  "leave_room",
  "list_components",
  "list_room_members",
  "open_file",
  "render_component",
  "send_file",
  "send_notification",
  "show_toast",
  "spawn_subagent",
]);

/**
 * Returns true if the tool can be safely presented and executed in headless CLI mode.
 */
export function isToolHeadlessSafe(toolName: string): boolean {
  return !BROWSER_ONLY_TOOLS.has(toolName);
}

/**
 * Filters a list of tool definitions or schemas to retain only headless-safe tools.
 */
export function filterHeadlessTools<T extends { name: string }>(
  tools: T[],
): T[] {
  return tools.filter((t) => !BROWSER_ONLY_TOOLS.has(t.name));
}

/**
 * Returns true when the process is running as a headless CLI agent,
 * not in a browser Web Worker.
 */
export function isHeadlessMode(): boolean {
  return _headless;
}

/**
 * Enable or disable headless mode. Call `setHeadlessMode(true)` early in
 * the CLI agent bootstrap, before any tool execution.
 */
export function setHeadlessMode(value: boolean): void {
  _headless = value;
}
