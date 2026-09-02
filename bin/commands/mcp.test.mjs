import { describe, it, expect, jest } from "@jest/globals";
import { createCliMcpEngine } from "./mcp.mjs";

describe("CLI MCP Engine (createCliMcpEngine)", () => {
  it("processes server/discover request", async () => {
    const mockClient = {
      listClients: jest
        .fn()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: {},
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
    });

    expect(res).toBeDefined();
    expect(res.id).toBe(1);
    expect(res.result.protocolVersion).toBe("2026-07-28");
    expect(res.result.serverInfo.name).toBe("shadow-claw");
  });

  it("processes tools/list including built-in and client tools", async () => {
    const mockClient = {
      listClients: jest
        .fn()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn().mockImplementation(async (clientId, action) => {
        if (action === "list-tools") {
          return {
            success: true,
            data: {
              tools: [
                {
                  name: "read_file",
                  description: "Read workspace file",
                  inputSchema: { type: "object" },
                },
              ],
            },
          };
        }
        return { success: true, data: {} };
      }),
    };

    const engine = createCliMcpEngine({
      client: mockClient,
      relayClientTools: true,
    });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    const toolNames = res.result.tools.map((t) => t.name);
    expect(toolNames).toContain("shadowclaw_list_clients");
    expect(toolNames).toContain("shadowclaw_send_message");
    expect(toolNames).toContain("read_file");
  });

  it("processes tools/call for shadowclaw_send_message", async () => {
    const mockClient = {
      listClients: jest
        .fn()
        .mockResolvedValue([{ clientId: "c1", deviceLabel: "Browser Test" }]),
      sendCommand: jest.fn().mockResolvedValue({
        success: true,
        data: { queued: true },
      }),
    };

    const engine = createCliMcpEngine({ client: mockClient });
    const res = await engine.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "shadowclaw_send_message",
        arguments: { text: "Test message" },
      },
    });

    expect(res).toBeDefined();
    expect(res.result.resultType).toBe("complete");
    expect(mockClient.sendCommand).toHaveBeenCalledWith("c1", "send-message", {
      text: "Test message",
      groupId: undefined,
    });
  });
});
