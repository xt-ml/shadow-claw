import { jest } from "@jest/globals";

// Mock ulid for deterministic IDs
let ulidCounter = 0;
jest.unstable_mockModule("../../utils/ulid.js", () => ({
  ulid: () => `CARD_ULID_${++ulidCounter}`,
}));

const {
  buildAgentCard,
  createGetAgentCardRequest,
  createGetAgentCardResponse,
  parseAgentCardResponse,
  PeerCardStore,
} = await import("./peer-agent-card.js");
const { A2A_PROTOCOL_BINDING, A2A_PROTOCOL_VERSION, A2A_METHOD } =
  await import("./peer-protocol.js");

describe("peer-agent-card", () => {
  beforeEach(() => {
    ulidCounter = 0;
  });

  describe("buildAgentCard", () => {
    it("builds a card with required fields", () => {
      const card = buildAgentCard({
        peerId: "my-peer-id",
        name: "TestAgent",
      });

      expect(card.name).toBe("TestAgent");
      expect(card.version).toBe("1.0.0");
      expect(card.supportedInterfaces).toHaveLength(1);
      expect(card.supportedInterfaces[0].url).toBe("webrtc://my-peer-id");
      expect(card.supportedInterfaces[0].protocolBinding).toBe(
        A2A_PROTOCOL_BINDING,
      );
      expect(card.supportedInterfaces[0].protocolVersion).toBe(
        A2A_PROTOCOL_VERSION,
      );
    });

    it("sets streaming capability to true by default", () => {
      const card = buildAgentCard({
        peerId: "peer-1",
        name: "Agent",
      });

      expect(card.capabilities.streaming).toBe(true);
      expect(card.capabilities.pushNotifications).toBe(false);
    });

    it("uses custom description and version", () => {
      const card = buildAgentCard({
        peerId: "peer-2",
        name: "CustomAgent",
        description: "My custom agent",
        version: "2.5.0",
      });

      expect(card.description).toBe("My custom agent");
      expect(card.version).toBe("2.5.0");
    });

    it("includes skills when provided", () => {
      const card = buildAgentCard({
        peerId: "peer-3",
        name: "SkillfulAgent",
        skills: [
          {
            id: "web_search",
            name: "Web Search",
            description: "Searches the web",
            tags: ["search", "web"],
          },
        ],
      });

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].id).toBe("web_search");
    });

    it("sets default input/output modes", () => {
      const card = buildAgentCard({
        peerId: "peer-4",
        name: "Agent",
      });

      expect(card.defaultInputModes).toContain("text/plain");
      expect(card.defaultInputModes).toContain("application/json");
      expect(card.defaultOutputModes).toContain("text/plain");
    });
  });

  describe("createGetAgentCardRequest", () => {
    it("creates a valid JSON-RPC request", () => {
      const req = createGetAgentCardRequest();

      expect(req.jsonrpc).toBe("2.0");
      expect(req.method).toBe(A2A_METHOD.GET_AGENT_CARD);
      expect(typeof req.id).toBe("string");
      expect(req.id.length).toBeGreaterThan(0);
    });
  });

  describe("createGetAgentCardResponse", () => {
    it("wraps agent card in a JSON-RPC response", () => {
      const card = buildAgentCard({
        peerId: "peer-5",
        name: "Responder",
      });

      const response = createGetAgentCardResponse("req_123", card);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("req_123");
      expect(response.result).toBe(card);
      expect(response.error).toBeUndefined();
    });
  });

  describe("parseAgentCardResponse", () => {
    it("parses a valid agent card response", () => {
      const card = buildAgentCard({
        peerId: "peer-6",
        name: "RemoteAgent",
        version: "3.0.0",
      });

      const response = createGetAgentCardResponse("req_456", card);
      const parsed = parseAgentCardResponse(response);

      expect(parsed).not.toBeNull();
      expect(parsed!.name).toBe("RemoteAgent");
      expect(parsed!.version).toBe("3.0.0");
    });

    it("returns null for error responses", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "req_789",
        error: { code: -32603, message: "Internal error" },
      };

      const parsed = parseAgentCardResponse(response);
      expect(parsed).toBeNull();
    });

    it("returns null for missing result", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "req_000",
        result: undefined,
      };

      const parsed = parseAgentCardResponse(response);
      expect(parsed).toBeNull();
    });

    it("returns null for result missing required fields", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "req_111",
        result: { description: "no name or version" },
      };

      const parsed = parseAgentCardResponse(response);
      expect(parsed).toBeNull();
    });
  });

  describe("PeerCardStore", () => {
    let store: InstanceType<typeof PeerCardStore>;

    beforeEach(() => {
      store = new PeerCardStore();
    });

    it("stores and retrieves cards", () => {
      const card = buildAgentCard({ peerId: "remote-1", name: "Agent1" });
      store.set("remote-1", card);

      expect(store.get("remote-1")).toBe(card);
      expect(store.has("remote-1")).toBe(true);
    });

    it("returns undefined for unknown peers", () => {
      expect(store.get("unknown")).toBeUndefined();
      expect(store.has("unknown")).toBe(false);
    });

    it("deletes cards", () => {
      const card = buildAgentCard({ peerId: "remote-2", name: "Agent2" });
      store.set("remote-2", card);
      store.delete("remote-2");

      expect(store.has("remote-2")).toBe(false);
    });

    it("clears all cards", () => {
      store.set("a", buildAgentCard({ peerId: "a", name: "A" }));
      store.set("b", buildAgentCard({ peerId: "b", name: "B" }));
      store.clear();

      expect(store.has("a")).toBe(false);
      expect(store.has("b")).toBe(false);
    });

    it("supportsStreaming returns capability from card", () => {
      const card = buildAgentCard({
        peerId: "streamer",
        name: "Streamer",
        streaming: true,
      });
      store.set("streamer", card);

      expect(store.supportsStreaming("streamer")).toBe(true);
      expect(store.supportsStreaming("unknown")).toBe(false);
    });

    it("getDisplayName returns card name or peer ID fallback", () => {
      const card = buildAgentCard({
        peerId: "fancy",
        name: "FancyAgent",
      });
      store.set("fancy", card);

      expect(store.getDisplayName("fancy")).toBe("FancyAgent");
      expect(store.getDisplayName("unknown")).toBe("unknown");
    });

    it("iterates entries", () => {
      store.set("x", buildAgentCard({ peerId: "x", name: "X" }));
      store.set("y", buildAgentCard({ peerId: "y", name: "Y" }));

      const entries = Array.from(store.entries());
      expect(entries).toHaveLength(2);
      expect(entries.map(([k]) => k).sort()).toEqual(["x", "y"]);
    });
  });
});
