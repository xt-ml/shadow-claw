import { getPeerChatDisplayStatus } from "./getPeerChatDisplayStatus.js";

describe("getPeerChatDisplayStatus", () => {
  it("returns 'responding' when remote status is idle and remote is typing", () => {
    expect(getPeerChatDisplayStatus("idle", true)).toBe("responding");
  });

  it("returns remoteStatus when not typing", () => {
    expect(getPeerChatDisplayStatus("idle", false)).toBe("idle");
  });

  it("returns remoteStatus when remote status is not idle even if typing", () => {
    expect(getPeerChatDisplayStatus("compacting" as any, true)).toBe(
      "compacting",
    );
    expect(getPeerChatDisplayStatus("executing_tool" as any, true)).toBe(
      "executing_tool",
    );
  });
});
