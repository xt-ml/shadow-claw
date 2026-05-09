import { jest } from "@jest/globals";

const mockResolveRemoteMcpConnectionAuth = jest.fn() as any;

jest.unstable_mockModule("./mcp-connection-auth.js", () => ({
  resolveRemoteMcpConnectionAuth: mockResolveRemoteMcpConnectionAuth,
}));

const {
  listRemoteMcpTools,
  callRemoteMcpTool,
  testRemoteMcpConnection,
  clearAllRemoteMcpSessions,
  McpReauthRequiredError,
} = await import("./remote-mcp-client.js");

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

  it("retries with force-refreshed OAuth token on HTTP 401", async () => {
    // First call returns stale token; second call (forceRefresh) returns fresh token.
    mockResolveRemoteMcpConnectionAuth
      .mockResolvedValueOnce({
        connection: {
          id: "conn-1",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer stale" },
        reauthRequired: false,
      })
      .mockResolvedValueOnce({
        connection: {
          id: "conn-1",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer refreshed" },
        reauthRequired: false,
      });

    ((globalThis as any).fetch as any)
      // First initialize → 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-1",
          error: { code: -32000, message: "Unauthorized" },
        }),
      )
      // Retry: initialize succeeds with refreshed token
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-2",
            result: { protocolVersion: "2025-03-26" },
          },
          { "mcp-session-id": "session-refreshed" },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      // tools/list succeeds
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: { tools: [{ name: "echo" }] },
        }),
      );

    const result = await listRemoteMcpTools({} as any, "conn-1");

    expect(result).toEqual([{ name: "echo" }]);
    // Second resolve call should have forceRefresh: true
    expect(mockResolveRemoteMcpConnectionAuth).toHaveBeenCalledTimes(2);
    expect(mockResolveRemoteMcpConnectionAuth).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "conn-1",
      { forceRefresh: true },
    );
  });

  it("does not retry 401 for non-OAuth auth types", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-1",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "custom_header",
      headers: { "X-API-Key": "bad-key" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any).mockResolvedValueOnce(
      makeMockResponse(401, {
        jsonrpc: "2.0",
        id: "init-1",
        error: { code: -32000, message: "Unauthorized" },
      }),
    );

    await expect(listRemoteMcpTools({} as any, "conn-1")).rejects.toThrow(
      "401",
    );
    // Should not attempt a second auth resolution
    expect(mockResolveRemoteMcpConnectionAuth).toHaveBeenCalledTimes(1);
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

  it("auto-accepts elicitation/create requests with schema defaults", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-elicit",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "oauth",
      headers: { Authorization: "Bearer abc" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any)
      // initialize
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-1",
            result: { protocolVersion: "2025-03-26" },
          },
          { "mcp-session-id": "session-elicit" },
        ),
      )
      // initialized notification
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      // tools/call returns an elicitation/create server request
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "elicit-abc",
          method: "elicitation/create",
          params: {
            mode: "form",
            message: "Enable auto-discovery?",
            requestedSchema: {
              type: "object",
              properties: {
                auto_tool_discovery: {
                  type: "boolean",
                  title: "Auto Tool Discovery",
                  default: true,
                },
              },
              required: ["auto_tool_discovery"],
            },
          },
        }),
      )
      // elicitation response returns the actual tool result
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tool-result-1",
          result: {
            content: [{ type: "text", text: "Auto-discovery enabled." }],
            isError: false,
          },
        }),
      );

    const result = await callRemoteMcpTool(
      {} as any,
      "conn-elicit",
      "enable-auto-tool-discovery",
      {},
    );

    expect(result).toEqual({
      content: [{ type: "text", text: "Auto-discovery enabled." }],
      isError: false,
    });

    // init + initialized + tools/call + elicitation response = 4
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(4);

    // Verify the elicitation response was sent correctly
    const elicitationCall = ((globalThis as any).fetch as any).mock.calls[3];
    const elicitationBody = JSON.parse(elicitationCall[1].body);
    expect(elicitationBody).toEqual({
      jsonrpc: "2.0",
      id: "elicit-abc",
      result: {
        action: "accept",
        content: { auto_tool_discovery: true },
      },
    });
  });
});

describe("testRemoteMcpConnection", () => {
  beforeEach(() => {
    mockResolveRemoteMcpConnectionAuth.mockReset();
    (globalThis as any).fetch = jest.fn();
    clearAllRemoteMcpSessions();
  });

  it("returns successful diagnostic when connection works", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-ok",
        label: "My MCP",
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
            result: { protocolVersion: "2025-03-26" },
          },
          { "mcp-session-id": "session-ok" },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: {
            tools: [
              { name: "read_file", description: "Read a file" },
              { name: "write_file", description: "Write a file" },
            ],
          },
        }),
      );

    const result = await testRemoteMcpConnection({} as any, "conn-ok");

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.toolCount).toBe(2);
    expect(result.toolNames).toEqual(["read_file", "write_file"]);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0]).toEqual({
      step: "Resolve authentication",
      status: "ok",
      detail: "Auth type: oauth",
    });
    expect(result.steps[1]).toEqual({
      step: "Establish MCP session",
      status: "ok",
      detail: "Session established",
    });
    expect(result.steps[2]).toEqual({
      step: "Discover tools",
      status: "ok",
      detail: "2 tools available",
    });
  });

  it("reports error when connection is not found", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue(null);

    const result = await testRemoteMcpConnection({} as any, "missing-conn");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection not found");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe("error");
  });

  it("reports reauth required for expired OAuth tokens", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-expired",
        label: "Expired MCP",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "oauth",
      headers: {},
      reauthRequired: true,
    });

    const result = await testRemoteMcpConnection({} as any, "conn-expired");

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "OAuth token expired or revoked — re-authenticate in Settings",
    );
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual({
      step: "Resolve authentication",
      status: "error",
      detail: "OAuth token expired or revoked — re-authenticate in Settings",
    });
  });

  it("reports HTTP error with status code on session failure", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-401",
        label: "Unauth MCP",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "custom_header",
      headers: { "X-API-Key": "bad-key" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any).mockResolvedValueOnce(
      makeMockResponse(401, {
        jsonrpc: "2.0",
        id: "init-1",
        error: { code: -32000, message: "Unauthorized" },
      }),
    );

    const result = await testRemoteMcpConnection({} as any, "conn-401");

    expect(result.success).toBe(false);
    expect(result.error).toContain("401");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe("ok");
    expect(result.steps[1].status).toBe("error");
    expect(result.steps[1].detail).toContain("401");
  });

  it("retries session establishment with force-refreshed OAuth on 401", async () => {
    mockResolveRemoteMcpConnectionAuth
      .mockResolvedValueOnce({
        connection: {
          id: "conn-401-retry",
          label: "OAuth MCP",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer stale-token" },
        reauthRequired: false,
      })
      .mockResolvedValueOnce({
        connection: {
          id: "conn-401-retry",
          label: "OAuth MCP",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer fresh-token" },
        reauthRequired: false,
      });

    ((globalThis as any).fetch as any)
      // First initialize → 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-1",
          error: { code: -32000, message: "Unauthorized" },
        }),
      )
      // Retry initialize with refreshed token → success
      .mockResolvedValueOnce(
        makeMockResponse(
          200,
          {
            jsonrpc: "2.0",
            id: "init-2",
            result: { protocolVersion: "2025-03-26" },
          },
          { "mcp-session-id": "session-fresh" },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      // tools/list succeeds
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: {
            tools: [{ name: "read_file" }],
          },
        }),
      );

    const result = await testRemoteMcpConnection({} as any, "conn-401-retry");

    expect(result.success).toBe(true);
    expect(result.toolCount).toBe(1);
    expect(result.steps).toHaveLength(5);
    expect(result.steps[0]).toEqual({
      step: "Resolve authentication",
      status: "ok",
      detail: "Auth type: oauth",
    });
    expect(result.steps[1]).toEqual({
      step: "Establish MCP session",
      status: "error",
      detail: expect.stringContaining("401"),
    });
    expect(result.steps[2]).toEqual({
      step: "Refresh OAuth token",
      status: "ok",
      detail: "Token refreshed, retrying",
    });
    expect(result.steps[3]).toEqual({
      step: "Establish MCP session",
      status: "ok",
      detail: "Session established",
    });
    expect(result.steps[4]).toEqual({
      step: "Discover tools",
      status: "ok",
      detail: "1 tool available",
    });
    // Should have called auth resolver twice — second with forceRefresh
    expect(mockResolveRemoteMcpConnectionAuth).toHaveBeenCalledTimes(2);
    expect(mockResolveRemoteMcpConnectionAuth).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "conn-401-retry",
      { forceRefresh: true },
    );
  });

  it("suggests re-authorize when retry also returns 401", async () => {
    mockResolveRemoteMcpConnectionAuth
      .mockResolvedValueOnce({
        connection: {
          id: "conn-double-401",
          label: "OAuth MCP",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer stale-token" },
        reauthRequired: false,
      })
      .mockResolvedValueOnce({
        connection: {
          id: "conn-double-401",
          label: "OAuth MCP",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer still-bad-token" },
        reauthRequired: false,
      });

    ((globalThis as any).fetch as any)
      // First initialize → 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-1",
          error: { code: -32000, message: "Unauthorized" },
        }),
      )
      // Retry initialize → still 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-2",
          error: { code: -32000, message: "Unauthorized" },
        }),
      );

    const result = await testRemoteMcpConnection({} as any, "conn-double-401");

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(4);
    expect(result.steps[2]).toEqual({
      step: "Refresh OAuth token",
      status: "ok",
      detail: "Token refreshed, retrying",
    });
    expect(result.steps[3]).toEqual({
      step: "Establish MCP session",
      status: "error",
      detail: expect.stringContaining("re-authorize in Settings"),
    });
  });

  it("reports unsupported transport", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-sse",
        label: "SSE MCP",
        serverUrl: "https://mcp.example.com/sse",
        transport: "sse",
      },
      authType: "none",
      headers: {},
      reauthRequired: false,
    });

    const result = await testRemoteMcpConnection({} as any, "conn-sse");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported");
    expect(result.steps[0].status).toBe("ok");
    expect(result.steps[1].status).toBe("error");
  });

  it("reports auth with no credentials (empty headers)", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-no-creds",
        label: "No Creds MCP",
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
          {
            jsonrpc: "2.0",
            id: "init-1",
            result: { protocolVersion: "2025-03-26" },
          },
          { "mcp-session-id": "session-anon" },
        ),
      )
      .mockResolvedValueOnce(
        makeMockResponse(202, { jsonrpc: "2.0", result: {} }),
      )
      .mockResolvedValueOnce(
        makeMockResponse(200, {
          jsonrpc: "2.0",
          id: "tools-1",
          result: { tools: [] },
        }),
      );

    const result = await testRemoteMcpConnection({} as any, "conn-no-creds");

    expect(result.success).toBe(true);
    expect(result.steps[0].detail).toBe("Auth type: none");
    expect(result.toolCount).toBe(0);
  });

  it("reports network failure during session init", async () => {
    mockResolveRemoteMcpConnectionAuth.mockResolvedValue({
      connection: {
        id: "conn-net",
        label: "Offline MCP",
        serverUrl: "https://mcp.example.com/rpc",
        transport: "streamable_http",
      },
      authType: "pat",
      headers: { Authorization: "Bearer token" },
      reauthRequired: false,
    });

    ((globalThis as any).fetch as any).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    const result = await testRemoteMcpConnection({} as any, "conn-net");

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to fetch");
    expect(result.steps[0].status).toBe("ok");
    expect(result.steps[1].status).toBe("error");
  });

  it("throws McpReauthRequiredError when reauthRequired is true", async () => {
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

    const err = await listRemoteMcpTools({} as any, "conn-1").catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(McpReauthRequiredError);
    expect(
      (err as InstanceType<typeof McpReauthRequiredError>).connectionId,
    ).toBe("conn-1");
  });

  it("throws McpReauthRequiredError when force-refresh still needs reauth", async () => {
    mockResolveRemoteMcpConnectionAuth
      .mockResolvedValueOnce({
        connection: {
          id: "conn-2",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer stale" },
        reauthRequired: false,
      })
      .mockResolvedValueOnce({
        connection: {
          id: "conn-2",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: {},
        reauthRequired: true,
      });

    ((globalThis as any).fetch as any).mockResolvedValueOnce(
      makeMockResponse(401, {
        jsonrpc: "2.0",
        id: "init-1",
        error: { code: -32000, message: "Unauthorized" },
      }),
    );

    const err = await listRemoteMcpTools({} as any, "conn-2").catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(McpReauthRequiredError);
    expect(
      (err as InstanceType<typeof McpReauthRequiredError>).connectionId,
    ).toBe("conn-2");
  });

  it("throws McpReauthRequiredError when retry after refresh still returns 401", async () => {
    mockResolveRemoteMcpConnectionAuth
      .mockResolvedValueOnce({
        connection: {
          id: "conn-3",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer stale" },
        reauthRequired: false,
      })
      .mockResolvedValueOnce({
        connection: {
          id: "conn-3",
          serverUrl: "https://mcp.example.com/rpc",
          transport: "streamable_http",
        },
        authType: "oauth",
        headers: { Authorization: "Bearer refreshed-but-still-bad" },
        reauthRequired: false,
      });

    ((globalThis as any).fetch as any)
      // First call — 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-1",
          error: { code: -32000, message: "Unauthorized" },
        }),
      )
      // Retry after refresh — still 401
      .mockResolvedValueOnce(
        makeMockResponse(401, {
          jsonrpc: "2.0",
          id: "init-2",
          error: { code: -32000, message: "Unauthorized" },
        }),
      );

    const err = await listRemoteMcpTools({} as any, "conn-3").catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(McpReauthRequiredError);
    expect(
      (err as InstanceType<typeof McpReauthRequiredError>).connectionId,
    ).toBe("conn-3");
  });
});
