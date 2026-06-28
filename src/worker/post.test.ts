// @ts-nocheck
import { jest } from "@jest/globals";

import {
  post,
  setPostHandler,
  registerSubagentCollector,
  unregisterSubagentCollector,
} from "./post.js";

describe("post", () => {
  it("posts to self when available", () => {
    const originalSelf = globalThis.self;
    const spy = jest.fn();
    globalThis.self = { postMessage: spy };

    post({ ok: true });

    expect(spy).toHaveBeenCalledWith({ ok: true });
    globalThis.self = originalSelf;
  });

  it("uses custom post handler when set", () => {
    const spy = jest.fn();
    setPostHandler(spy);

    post({ ok: true });

    expect(spy).toHaveBeenCalledWith({ ok: true });
    setPostHandler(null);
  });
});

describe("subagent collector", () => {
  afterEach(() => {
    // Clean up any lingering collectors
    unregisterSubagentCollector("subagent:test");
    unregisterSubagentCollector("subagent:other");
  });

  it("routes message to collector when groupId is registered", () => {
    const collector: any[] = [];
    registerSubagentCollector("subagent:test", collector);

    const spy = jest.fn();
    setPostHandler(spy);

    post({
      type: "response",
      payload: { groupId: "subagent:test", text: "hi" },
    });

    // Should NOT reach the normal post handler
    expect(spy).not.toHaveBeenCalled();
    // Should be captured in collector
    expect(collector).toHaveLength(1);
    expect(collector[0]).toEqual({
      type: "response",
      payload: { groupId: "subagent:test", text: "hi" },
    });

    setPostHandler(null);
  });

  it("does not interfere with normal messages whose groupId is not registered", () => {
    const collector: any[] = [];
    registerSubagentCollector("subagent:test", collector);

    const spy = jest.fn();
    setPostHandler(spy);

    post({
      type: "response",
      payload: { groupId: "main-conv", text: "hello" },
    });

    expect(spy).toHaveBeenCalledWith({
      type: "response",
      payload: { groupId: "main-conv", text: "hello" },
    });
    expect(collector).toHaveLength(0);

    setPostHandler(null);
  });

  it("stops routing to collector after unregister", () => {
    const collector: any[] = [];
    registerSubagentCollector("subagent:test", collector);
    unregisterSubagentCollector("subagent:test");

    const spy = jest.fn();
    const originalSelf = globalThis.self;
    globalThis.self = { postMessage: spy };

    post({
      type: "response",
      payload: { groupId: "subagent:test", text: "hi" },
    });

    expect(collector).toHaveLength(0);
    expect(spy).toHaveBeenCalled();

    globalThis.self = originalSelf;
  });

  it("handles messages with no payload gracefully", () => {
    const collector: any[] = [];
    registerSubagentCollector("subagent:test", collector);

    const spy = jest.fn();
    const originalSelf = globalThis.self;
    globalThis.self = { postMessage: spy };

    // Message with no payload — should not crash
    expect(() => post({ type: "ping" })).not.toThrow();
    // Should route normally (not collected)
    expect(collector).toHaveLength(0);

    globalThis.self = originalSelf;
  });

  it("supports multiple concurrent collectors for different groupIds", () => {
    const collectorA: any[] = [];
    const collectorB: any[] = [];
    registerSubagentCollector("subagent:a", collectorA);
    registerSubagentCollector("subagent:b", collectorB);

    post({ type: "response", payload: { groupId: "subagent:a", text: "A" } });
    post({ type: "response", payload: { groupId: "subagent:b", text: "B" } });

    expect(collectorA).toHaveLength(1);
    expect(collectorA[0].payload.text).toBe("A");
    expect(collectorB).toHaveLength(1);
    expect(collectorB[0].payload.text).toBe("B");

    unregisterSubagentCollector("subagent:a");
    unregisterSubagentCollector("subagent:b");
  });
});
