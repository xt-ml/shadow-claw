import {
  ensureServerWebRtc,
  isWebRtcAvailable,
  getPeerClass,
} from "./webrtc.js";

describe("server webrtc", () => {
  it("polyfs WebRTC APIs on globalThis in Node environment", async () => {
    const available = await ensureServerWebRtc();
    expect(available).toBe(true);
    expect(isWebRtcAvailable()).toBe(true);
    expect((globalThis as any).RTCPeerConnection).toBeDefined();
    expect((globalThis as any).RTCSessionDescription).toBeDefined();
    expect((globalThis as any).RTCIceCandidate).toBeDefined();
  });

  it("loads PeerJS constructor configured for Node", async () => {
    const PeerClass = await getPeerClass();
    expect(typeof PeerClass).toBe("function");
  });
});
