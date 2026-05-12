import { jest } from "@jest/globals";

import {
  executeRemoteMcpCallTool,
  executeRemoteMcpListTools,
  resolveMcpReauth,
} from "./remote-mcp.js";

class MockMcpReauthRequiredError extends Error {
  connectionId: string;

  constructor(connectionId: string) {
    super("OAuth reconnect required for remote MCP connection");
    this.name = "McpReauthRequiredError";
    this.connectionId = connectionId;
  }
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    listRemoteMcpTools: jest.fn(async () => []),
    callRemoteMcpTool: jest.fn(async () => ({})),
    McpReauthRequiredError: MockMcpReauthRequiredError,
    post: jest.fn(),
    ...overrides,
  } as any;
}

describe("worker/tools/remote-mcp", () => {
  it("returns validation error when list_tools is missing connection_id", async () => {
    const result = await executeRemoteMcpListTools(
      {} as any,
      {},
      "group-1",
      makeDeps(),
    );

    expect(result).toContain("requires connection_id");
  });

  it("formats exposed tools for list_tools", async () => {
    const result = await executeRemoteMcpListTools(
      {} as any,
      { connection_id: "conn-1" },
      "group-1",
      makeDeps({
        listRemoteMcpTools: jest.fn(async () => [
          { name: "alpha", description: "first" },
          { name: "beta" },
        ]),
      }),
    );

    expect(result).toContain("- alpha: first");
    expect(result).toContain("- beta");
  });

  it("retries list_tools after successful reauth", async () => {
    const listRemoteMcpTools = jest.fn(async () => []) as any;
    listRemoteMcpTools
      .mockRejectedValueOnce(new MockMcpReauthRequiredError("conn-retry-list"))
      .mockResolvedValueOnce([{ name: "tool-ok" }]);
    const post = jest.fn();

    setTimeout(() => resolveMcpReauth("conn-retry-list", true), 10);

    const result = await executeRemoteMcpListTools(
      {} as any,
      { connection_id: "conn-retry-list" },
      "group-1",
      makeDeps({
        listRemoteMcpTools,
        post,
      }),
    );

    expect(listRemoteMcpTools).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledWith({
      type: "mcp-reauth-required",
      payload: { connectionId: "conn-retry-list", groupId: "group-1" },
    });
    expect(result).toContain("tool-ok");
  });

  it("deduplicates concurrent reauth prompts for same connection", async () => {
    const error = new MockMcpReauthRequiredError("conn-dedup-module");
    const listRemoteMcpTools = jest.fn(async () => {
      throw error;
    });

    const callRemoteMcpTool = jest.fn(async () => {
      throw error;
    });

    const post = jest.fn();

    setTimeout(() => resolveMcpReauth("conn-dedup-module", false), 20);

    const [listErr, callErr] = await Promise.all([
      executeRemoteMcpListTools(
        {} as any,
        { connection_id: "conn-dedup-module" },
        "group-1",
        makeDeps({
          listRemoteMcpTools,
          callRemoteMcpTool,
          post,
        }),
      ).catch((err) => err),
      executeRemoteMcpCallTool(
        {} as any,
        {
          connection_id: "conn-dedup-module",
          tool_name: "echo",
          arguments: { value: 1 },
        },
        "group-1",
        makeDeps({
          listRemoteMcpTools,
          callRemoteMcpTool,
          post,
        }),
      ).catch((err) => err),
    ]);

    expect(listErr).toBeInstanceOf(MockMcpReauthRequiredError);
    expect(callErr).toBeInstanceOf(MockMcpReauthRequiredError);

    const reauthPosts = post.mock.calls.filter(
      (call: any[]) => call[0]?.type === "mcp-reauth-required",
    );
    expect(reauthPosts).toHaveLength(1);
  });

  it("returns validation error when call_tool is missing tool_name", async () => {
    const result = await executeRemoteMcpCallTool(
      {} as any,
      { connection_id: "conn-2" },
      "group-1",
      makeDeps(),
    );

    expect(result).toContain("requires tool_name");
  });

  it("calls remote tool and stringifies response", async () => {
    const callRemoteMcpTool = jest.fn(async () => ({ ok: true, value: 42 }));

    const result = await executeRemoteMcpCallTool(
      {} as any,
      {
        connection_id: "conn-3",
        tool_name: "ping",
      },
      "group-1",
      makeDeps({
        listRemoteMcpTools: jest.fn(),
        callRemoteMcpTool,
      }),
    );

    expect(callRemoteMcpTool).toHaveBeenCalledWith(
      {} as any,
      "conn-3",
      "ping",
      {},
    );
    expect(result).toContain('"ok": true');
    expect(result).toContain('"value": 42');
  });
});
