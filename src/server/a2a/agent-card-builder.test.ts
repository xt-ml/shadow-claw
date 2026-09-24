import { describe, it, expect } from "@jest/globals";
import {
  buildHttpAgentCard,
  A2A_HTTP_PROTOCOL_BINDING,
} from "./agent-card-builder.js";
import { A2A_PROTOCOL_VERSION } from "../../subsystems/channels/peer-protocol.js";

describe("A2A HTTP Agent Card Builder", () => {
  it("builds an AgentCard with default values for HTTP JSON-RPC binding", () => {
    const card = buildHttpAgentCard({
      baseUrl: "http://127.0.0.1:4000",
      name: "ShadowClaw Node 1",
    });

    expect(card.name).toBe("ShadowClaw Node 1");
    expect(card.description).toContain("ShadowClaw Node 1");
    expect(card.version).toBe("1.0.0");
    expect(card.supportedInterfaces).toHaveLength(1);
    expect(card.supportedInterfaces[0]).toEqual({
      url: "http://127.0.0.1:4000/a2a",
      protocolBinding: A2A_HTTP_PROTOCOL_BINDING,
      protocolVersion: A2A_PROTOCOL_VERSION,
    });
    expect(card.capabilities).toEqual({
      streaming: true,
      pushNotifications: false,
    });
    expect(card.defaultInputModes).toEqual(["text/plain", "application/json"]);
    expect(card.defaultOutputModes).toEqual(["text/plain", "application/json"]);
    expect(card.skills).toEqual([]);
  });

  it("normalizes baseUrl with trailing slash", () => {
    const card = buildHttpAgentCard({
      baseUrl: "http://127.0.0.1:4000/",
      name: "ShadowClaw Node 2",
    });

    expect(card.supportedInterfaces[0].url).toBe("http://127.0.0.1:4000/a2a");
  });

  it("includes custom description, version, skills, and documentationUrl", () => {
    const customSkills = [
      {
        id: "weather_query",
        name: "Weather Query",
        description: "Fetches weather information",
        tags: ["weather", "forecast"],
      },
    ];

    const card = buildHttpAgentCard({
      baseUrl: "https://agent.example.com",
      name: "Weather Agent",
      description: "Autonomous weather reporter",
      version: "2.5.0",
      skills: customSkills,
      streaming: false,
      pushNotifications: true,
      iconUrl: "https://agent.example.com/icon.png",
      documentationUrl: "https://agent.example.com/docs",
    });

    expect(card.name).toBe("Weather Agent");
    expect(card.description).toBe("Autonomous weather reporter");
    expect(card.version).toBe("2.5.0");
    expect(card.skills).toEqual(customSkills);
    expect(card.capabilities.streaming).toBe(false);
    expect(card.capabilities.pushNotifications).toBe(true);
    expect(card.iconUrl).toBe("https://agent.example.com/icon.png");
    expect(card.documentationUrl).toBe("https://agent.example.com/docs");
    expect(card.supportedInterfaces[0].url).toBe(
      "https://agent.example.com/a2a",
    );
  });
});
