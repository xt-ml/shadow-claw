import { describe, it, expect } from "@jest/globals";
import { McpServer } from "./mcp-server.js";
import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION_2026_07_28,
  type McpTool,
} from "./types.js";
import { getPackageVersion } from "../utils/packageVersion.js";

describe("McpServer", () => {
  function createServer(tools: McpTool[] = []) {
    const server = new McpServer({
      name: "shadow-claw-test",
      version: "1.25.0",
      tools,
    });
    return server;
  }

  describe("server/discover", () => {
    it("defaults version to package.json version when no version is provided", () => {
      const server = new McpServer();
      expect(server.serverInfo.version).toBe(getPackageVersion());
    });

    it("returns discovery response with 2026-07-28 and capabilities", async () => {
      const server = createServer();
      const res = await server.handleRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "server/discover",
      });

      expect(res).not.toBeNull();
      if (res && "result" in res) {
        expect(res.jsonrpc).toBe("2.0");
        expect(res.id).toBe(1);
        expect(res.result.protocolVersion).toBe(
          MCP_PROTOCOL_VERSION_2026_07_28,
        );
        expect(res.result.supportedProtocolVersions).toContain("2026-07-28");
        expect(res.result.serverInfo.name).toBe("shadow-claw-test");
        expect(res.result.capabilities.tools).toBeDefined();
      }
    });
  });

  describe("tools/list", () => {
    it("returns tools in deterministic alphabetical order with cache hints and resultType: complete", async () => {
      const testTools: McpTool[] = [
        {
          name: "zebra_tool",
          description: "Zebra description",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "alpha_tool",
          description: "Alpha description",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "beta_tool",
          description: "Beta description",
          inputSchema: { type: "object", properties: {} },
        },
      ];

      const server = createServer(testTools);
      const res = await server.handleRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      expect(res).not.toBeNull();
      if (res && "result" in res) {
        expect(res.result.resultType).toBe("complete");
        expect(res.result.ttlMs).toBe(5000);
        expect(res.result.cacheScope).toBe("private");
        const names = res.result.tools.map((t: any) => t.name);
        expect(names).toEqual(["alpha_tool", "beta_tool", "zebra_tool"]);
      }
    });
  });

  describe("tools/call", () => {
    it("executes registered tool handler and returns content items", async () => {
      const server = createServer([
        {
          name: "greet",
          description: "Greet user",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      ]);

      server.registerToolHandler("greet", async (args) => {
        return {
          content: [{ type: "text", text: `Hello, ${args.name || "friend"}!` }],
        };
      });

      const res = await server.handleRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "greet",
          arguments: { name: "Agent" },
        },
      });

      expect(res).not.toBeNull();
      if (res && "result" in res) {
        expect(res.result.resultType).toBe("complete");
        expect(res.result.content[0].text).toBe("Hello, Agent!");
      }
    });

    it("returns error response if tool is unknown", async () => {
      const server = createServer();
      const res = await server.handleRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "nonexistent",
        },
      });

      expect(res).not.toBeNull();
      if (res && "error" in res) {
        expect(res.error.code).toBe(MCP_ERROR_CODES.InvalidParams);
        expect(res.error.message).toContain("nonexistent");
      }
    });

    it("supports MRTR pattern with input_required result", async () => {
      const server = createServer([
        {
          name: "ask_user",
          description: "Ask user for input",
          inputSchema: { type: "object", properties: {} },
        },
      ]);

      server.registerToolHandler(
        "ask_user",
        async (_args, _meta, inputResponses) => {
          if (!inputResponses || !inputResponses["confirm"]) {
            return {
              resultType: "input_required",
              inputRequests: [
                {
                  id: "confirm",
                  type: "prompt",
                  message: "Do you want to proceed? (yes/no)",
                },
              ],
            };
          }
          return {
            resultType: "complete",
            content: [
              { type: "text", text: `Confirmed: ${inputResponses["confirm"]}` },
            ],
          };
        },
      );

      // First round-trip: asks for input
      const res1 = await server.handleRequest({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "ask_user",
        },
      });

      expect(res1).not.toBeNull();
      if (res1 && "result" in res1) {
        expect(res1.result.resultType).toBe("input_required");
        expect(res1.result.inputRequests[0].id).toBe("confirm");
      }

      // Second round-trip: client retries with inputResponses
      const res2 = await server.handleRequest({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "ask_user",
          inputResponses: { confirm: "yes" },
        },
      });

      expect(res2).not.toBeNull();
      if (res2 && "result" in res2) {
        expect(res2.result.resultType).toBe("complete");
        expect(res2.result.content[0].text).toBe("Confirmed: yes");
      }
    });
  });

  describe("header validation & error handling", () => {
    it("returns HeaderMismatch (-32020) if Mcp-Method header does not match body", async () => {
      const server = createServer();
      const res = await server.handleRequest(
        {
          jsonrpc: "2.0",
          id: 7,
          method: "tools/list",
        },
        {
          "mcp-method": "tools/call",
        },
      );

      expect(res).not.toBeNull();
      if (res && "error" in res) {
        expect(res.error.code).toBe(MCP_ERROR_CODES.HeaderMismatch);
      }
    });

    it("returns HeaderMismatch (-32020) if Mcp-Name header does not match body", async () => {
      const server = createServer();
      const res = await server.handleRequest(
        {
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: { name: "toolA" },
        },
        {
          "mcp-method": "tools/call",
          "mcp-name": "toolB",
        },
      );

      expect(res).not.toBeNull();
      if (res && "error" in res) {
        expect(res.error.code).toBe(MCP_ERROR_CODES.HeaderMismatch);
      }
    });

    it("returns UnsupportedProtocolVersion (-32022) on unsupported version header", async () => {
      const server = createServer();
      const res = await server.handleRequest(
        {
          jsonrpc: "2.0",
          id: 9,
          method: "server/discover",
        },
        {
          "mcp-protocol-version": "1999-01-01",
        },
      );

      expect(res).not.toBeNull();
      if (res && "error" in res) {
        expect(res.error.code).toBe(MCP_ERROR_CODES.UnsupportedProtocolVersion);
      }
    });
  });

  describe("legacy handshake compatibility", () => {
    it("gracefully answers legacy initialize request with server capabilities", async () => {
      const server = createServer();
      const res = await server.handleRequest({
        jsonrpc: "2.0",
        id: 10,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: { name: "Claude Desktop", version: "0.1.0" },
        },
      });

      expect(res).not.toBeNull();
      if (res && "result" in res) {
        expect(res.result.serverInfo.name).toBe("shadow-claw-test");
        expect(res.result.capabilities.tools).toBeDefined();
      }
    });

    it("accepts notifications/initialized notification", async () => {
      const server = createServer();
      const res = await server.handleRequest({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });

      // Notification returns null or accepted
      expect(res).toBeNull();
    });
  });
});
