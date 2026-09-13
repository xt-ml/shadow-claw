import { describe, it, expect, beforeEach } from "@jest/globals";

describe("headless mode flag", () => {
  beforeEach(async () => {
    // Reset to non-headless before each test
    const { setHeadlessMode } = await import("./headless.js");
    setHeadlessMode(false);
  });

  it("isHeadlessMode returns false by default", async () => {
    const { isHeadlessMode } = await import("./headless.js");
    expect(isHeadlessMode()).toBe(false);
  });

  it("setHeadlessMode(true) causes isHeadlessMode to return true", async () => {
    const { isHeadlessMode, setHeadlessMode } = await import("./headless.js");
    setHeadlessMode(true);
    expect(isHeadlessMode()).toBe(true);
  });

  it("setHeadlessMode(false) resets to false", async () => {
    const { isHeadlessMode, setHeadlessMode } = await import("./headless.js");
    setHeadlessMode(true);
    setHeadlessMode(false);
    expect(isHeadlessMode()).toBe(false);
  });

  it("exports BROWSER_ONLY_TOOLS containing all UI and room tools", async () => {
    const { BROWSER_ONLY_TOOLS } = await import("./headless.js");
    expect(BROWSER_ONLY_TOOLS).toBeInstanceOf(Set);
    const expected = [
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
    ];
    for (const tool of expected) {
      expect(BROWSER_ONLY_TOOLS.has(tool)).toBe(true);
    }
  });

  it("isToolHeadlessSafe correctly identifies browser-only vs headless-safe tools", async () => {
    const { isToolHeadlessSafe } = await import("./headless.js");
    expect(isToolHeadlessSafe("render_component")).toBe(false);
    expect(isToolHeadlessSafe("clear_chat")).toBe(false);
    expect(isToolHeadlessSafe("show_toast")).toBe(false);
    expect(isToolHeadlessSafe("ask_user")).toBe(false);
    expect(isToolHeadlessSafe("create_room")).toBe(false);
    expect(isToolHeadlessSafe("read_file")).toBe(true);
    expect(isToolHeadlessSafe("write_file")).toBe(true);
    expect(isToolHeadlessSafe("bash")).toBe(true);
    expect(isToolHeadlessSafe("git_status")).toBe(true);
    expect(isToolHeadlessSafe("web_search")).toBe(true);
  });

  it("filterHeadlessTools removes all browser-only tools from a tool array", async () => {
    const { filterHeadlessTools } = await import("./headless.js");
    const input = [
      { name: "read_file", description: "read" },
      { name: "render_component", description: "render" },
      { name: "clear_chat", description: "clear" },
      { name: "bash", description: "bash" },
    ];
    const filtered = filterHeadlessTools(input as any);
    expect(filtered.map((t: any) => t.name)).toEqual(["read_file", "bash"]);
  });
});
