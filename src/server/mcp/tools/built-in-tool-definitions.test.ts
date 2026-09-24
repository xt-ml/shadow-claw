import {
  BUILTIN_TOOL_DEFINITIONS,
  resolveTargetClientId,
} from "./built-in-tool-definitions.js";

describe("built-in-tool-definitions", () => {
  it("defines all core built-in tools with required properties", () => {
    expect(BUILTIN_TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
    const names = BUILTIN_TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("shadowclaw_server_list_clients");
    expect(names).toContain("shadowclaw_server_send_message");
    expect(names).toContain("shadowclaw_server_read_state");
    expect(names).toContain("shadowclaw_server_list_tasks");
    expect(names).toContain("shadowclaw_server_set_active_client");
    expect(names).toContain("shadowclaw_server_manage_backup");
    expect(names).toContain("shadowclaw_server_status");
    expect(names).toContain("shadowclaw_server_send_notification");

    for (const tool of BUILTIN_TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  describe("resolveTargetClientId", () => {
    const clients = [
      { clientId: "client-abc", deviceLabel: "Chrome Desktop" },
      { id: "client-xyz", deviceLabel: "Electron Mac" },
    ];
    const mockControlPlane = {
      getConnectedClients: () => clients,
    };

    it("resolves exact matches", () => {
      expect(resolveTargetClientId(mockControlPlane, "client-abc")).toBe(
        "client-abc",
      );
      expect(resolveTargetClientId(mockControlPlane, "client-xyz")).toBe(
        "client-xyz",
      );
    });

    it("resolves by numerical index", () => {
      expect(resolveTargetClientId(mockControlPlane, "0")).toBe("client-abc");
      expect(resolveTargetClientId(mockControlPlane, "1")).toBe("client-xyz");
    });

    it("resolves by prefix", () => {
      expect(resolveTargetClientId(mockControlPlane, "abc")).toBe("client-abc");
      expect(resolveTargetClientId(mockControlPlane, "xyz")).toBe("client-xyz");
    });

    it("resolves by device label", () => {
      expect(resolveTargetClientId(mockControlPlane, "Chrome")).toBe(
        "client-abc",
      );
      expect(resolveTargetClientId(mockControlPlane, "electron")).toBe(
        "client-xyz",
      );
    });

    it("falls back to first client if requestedId is empty", () => {
      expect(resolveTargetClientId(mockControlPlane)).toBe("client-abc");
      expect(resolveTargetClientId(mockControlPlane, "")).toBe("client-abc");
    });

    it("returns requestedId as trimmed string if no clients found", () => {
      const emptyControlPlane = { getConnectedClients: () => [] };
      expect(resolveTargetClientId(emptyControlPlane, "  custom-id  ")).toBe(
        "custom-id",
      );
    });
  });
});
