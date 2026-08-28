import { parseIframeMessage } from "./parseIframeMessage.js";

describe("parseIframeMessage", () => {
  it("returns null for non-object or empty message data", () => {
    expect(parseIframeMessage(null)).toBeNull();
    expect(parseIframeMessage("hello")).toBeNull();
    expect(parseIframeMessage(123)).toBeNull();
  });

  it("parses broadcast result payloads", () => {
    const raw = {
      type: "shadow-claw-broadcast-result",
      channel: "ch-1",
      payload: { ok: true },
    };
    expect(parseIframeMessage(raw)).toEqual({
      kind: "broadcast-result",
      channel: "ch-1",
      payload: { ok: true },
    });
  });

  it("parses storage proxy payloads", () => {
    const raw = {
      type: "shadow-claw-storage-proxy",
      requestId: "req-1",
      method: "setItem",
      args: { key: "foo", value: "bar" },
    };
    expect(parseIframeMessage(raw)).toEqual({
      kind: "storage-proxy",
      requestId: "req-1",
      method: "setItem",
      args: { key: "foo", value: "bar" },
    });
  });

  it("parses swipe payloads", () => {
    const raw = {
      type: "shadow-claw-swipe",
      direction: "left",
    };
    expect(parseIframeMessage(raw)).toEqual({
      kind: "swipe",
      direction: "left",
    });
  });

  it("parses iframe resize payloads", () => {
    const raw = {
      type: "shadow-claw-iframe-resize",
      height: 450,
    };
    expect(parseIframeMessage(raw)).toEqual({
      kind: "iframe-resize",
      height: 450,
    });
  });

  it("parses file-viewer link payloads", () => {
    const raw = {
      type: "shadow-claw-file-viewer-link",
      href: "docs/page.md",
    };
    expect(parseIframeMessage(raw)).toEqual({
      kind: "file-viewer-link",
      href: "docs/page.md",
    });
  });

  it("returns null for unrecognized message types", () => {
    expect(parseIframeMessage({ type: "unknown-type" })).toBeNull();
  });
});
