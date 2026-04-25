import { jest } from "@jest/globals";

const mockResolveRemoteMcpConnectionAuth = jest.fn() as any;

jest.unstable_mockModule("./mcp-connection-auth.js", () => ({
  resolveRemoteMcpConnectionAuth: mockResolveRemoteMcpConnectionAuth,
}));

const { listRemoteMcpTools, callRemoteMcpTool, clearAllRemoteMcpSessions } =
  await import("./remote-mcp-client.js");

function makeMockResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => normalized.get(name.toLowerCase()) || null,
    },
    json: async () => body,
    text: async () =>
      typeof body === "string"
        ? body
        : JSON.stringify(body === undefined ? null : body),
  };
}

describe("remote-mcp-client", () => {
  beforeEach(() => {
    mockResolveRemoteMcpConnectionAuth.mockReset();
    (globalThis as any).fetch = jest.fn();
    clearAllRemoteMcpSessions();
  });

  it("initializes streamable HTTP session and lists tools with mcp-session-id", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "oauth",
      headers: { Authorization: "Bearer abc" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any)
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-1",
            result: {
              protocolVersion: "2025-03-26",
            },
          },
          {
            "mcp-session-id": "session-123",
            "mcp-protocol-version": "2025-03-26",
          },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, {
          jsonrpc: "2.0",
          result: {},
        }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: {
            tools: [{ name: "read_file", description: "Read a file" }],
          },
        }),
      );

    const result = await listRemoteMcpTools({} as any, "conn-1");

    expect(result).toEqual([{ name: "read_file", description: "Read a file" }]);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(3);
    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      "https://mcp.example.com/rpc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          Authorization: "Bearer abc",
          "mcp-session-id": "session-123",
        }),
      }),
    );
  });

  it("reuses existing streamable HTTP session for subsequent calls", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "pat",
      headers: { "X-API-Key": "key-123" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any)
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-1",
            result: {
              protocolVersion: "2025-03-26",
            },
          },
          {
            "mcp-session-id": "session-abc",
          },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, {
          jsonrpc: "2.0",
          result: {},
        }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: { tools: [{ name: "read_file" }] },
        }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "call-1",
          result: {
            content: [{ type: "text", text: "ok" }],
            isError: false,
          },
        }),
      );

    await listRemoteMcpTools({} as any, "conn-1");

    const result = await callRemoteMcpTool({} as any, "conn-1", "read_file", {
      path: "README.md",
    });

    expect(result).toEqual({
      content: [{ type: "text", text: "ok" }],
      isError: false,
    });

    // initialize + initialized + tools/list + tools/call
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(4);

    const lastCall = ((globalThis as any).fetch as any).mock.calls[3];
    expect(lastCall[1].headers["mcp-session-id"]).toBe("session-abc");
  });

  it("throws reconnect guidance when oauth reauth is required", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "oauth",
      headers: {},
      reauthRequired: true,
    });

    await expect(listRemoteMcpTools({} as any, "conn-1")).rejects.toThrow(
      "OAuth reconnect required",
    );
  });

  it("throws for unsupported MCP transport", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/sse",
        transport: "sse",
      },
      authType: "none",
      headers: {},
      reauthRequired: false,
    });

    await expect(listRemoteMcpTools({} as any, "conn-1")).rejects.toThrow(
      "Unsupported remote MCP transport",
    );
  });

  it("reinitializes and retries once when server reports invalid session", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "none",
      headers: {},
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any)
      // Initial setup
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-1",
            result: {
              protocolVersion: "2025-03-26",
            },
          },
          {
            "mcp-session-id": "stale-session",
          },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, {
          jsonrpc: "2.0",
          result: {},
        }),
      )
      // First tools/list fails with invalid session
      .mockResolvedValueOnce(
        makeMockResponse(400, {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: "tools-1",
        }),
      )
      // Reinitialize
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-2",
            result: {
              protocolVersion: "2025-03-26",
            },
          },
          {
            "mcp-session-id": "fresh-session",
          },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, {
          jsonrpc: "2.0",
          result: {},
        }),
      )
      // Retry succeeds
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-2",
          result: {
            tools: [{ name: "echo" }],
          },
        }),
      );

    const result = await listRemoteMcpTools({} as any, "conn-1");

    expect(result).toEqual([{ name: "echo" }]);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(6);

    const retryCall = ((globalThis as any).fetch as any).mock.calls[5];
    expect(retryCall[1].headers["mcp-session-id"]).toBe("fresh-session");
  });

  it("succeeds when initialize returns 200 with mcp-session-id but empty/non-JSON body", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-empty-body",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "none",
      headers: {},
      reauthRequired: false,
    });

    const initResponse = {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          const key = name.toLowerCase();
          if (key === "mcp-session-id") {
            return "session-abc";
          }

          return null;
        },
      },
      // json() throws to simulate empty/non-JSON body
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
      text: async () => "",
    };

    ((globalThis as any).fetch as any)
      .mockResolvedValueOnce(initResponse)
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: {
            tools: [{ name: "everything" }],
          },
        }),
      );

    const result = await listRemoteMcpTools({} as any, "conn-empty-body");

    expect(result).toEqual([{ name: "everything" }]);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(3);
  });

  it("parses JSON-RPC payloads from text/event-stream responses", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-sse",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "none",
      headers: {},
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any)
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          [
            "event: message",
            'data: {"jsonrpc":"2.0","id":"init-1","result":{"protocolVersion":"2025-03-26"}}',
            "",
          ].join("\n"),
          {
            "content-type": "text/event-stream",
            "mcp-session-id": "session-sse",
          },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, "", {
          "content-type": "text/event-stream",
        }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          [
            "event: message",
            'data: {"jsonrpc":"2.0","id":"tools-1","result":{"tools":[{"name":"sse_tool"}]}}',
            "",
          ].join("\n"),
          {
            "content-type": "text/event-stream",
          },
        ),
      );

    const tools = await listRemoteMcpTools({} as any, "conn-sse");

    expect(tools).toEqual([{ name: "sse_tool" }]);
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(3);
  });
});
