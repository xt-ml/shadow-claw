/**
 * ShadowClaw — Server-Side WebRTC Initialization & PeerJS Loader
 *
 * Polyfills WebRTC (RTCPeerConnection, RTCSessionDescription, RTCIceCandidate)
 * in Node.js environments using node-datachannel, allowing Node servers and CLI
 * tools to establish direct WebRTC RTCDataChannel connections.
 */

let isAvailable: boolean | null = null;

/**
 * Ensure WebRTC APIs are present in globalThis for Node.js environments.
 * Returns true if WebRTC is available (either natively or via polyfill).
 */
export async function ensureServerWebRtc(): Promise<boolean> {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).RTCPeerConnection !== "undefined"
  ) {
    isAvailable = true;
    return true;
  }

  if (isAvailable !== null) {
    return isAvailable;
  }

  try {
    const wrtc = await import("node-datachannel/polyfill");
    if (wrtc && wrtc.RTCPeerConnection) {
      Object.assign(globalThis, {
        RTCPeerConnection: wrtc.RTCPeerConnection,
        RTCSessionDescription: wrtc.RTCSessionDescription,
        RTCIceCandidate: wrtc.RTCIceCandidate,
      });
      isAvailable = true;
      return true;
    }
  } catch (err) {
    console.warn(
      "[webrtc] Failed to load node-datachannel WebRTC polyfill:",
      err instanceof Error ? err.message : String(err),
    );
  }

  isAvailable = false;
  return false;
}

/**
 * Check whether WebRTC is available in the current environment.
 */
export function isWebRtcAvailable(): boolean {
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).RTCPeerConnection !== "undefined"
  ) {
    return true;
  }
  return isAvailable === true;
}

/**
 * Dynamically loads and returns the PeerJS Peer constructor configured for Node.
 */
export async function getPeerClass(): Promise<any> {
  await ensureServerWebRtc();
  const mod = await import("peerjs");
  return (
    (mod as any).default?.Peer || (mod as any).default || (mod as any).Peer
  );
}
