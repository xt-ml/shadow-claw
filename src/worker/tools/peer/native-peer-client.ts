import { CliControlClient } from "../../../cli/utils/control-client.js";
import { setPeerClientFactory, type PeerClientFactory } from "./prompt-peer.js";

/**
 * Native Node.js WebRTC / Control Plane client factory for headless CLI mode.
 */
export const nativePeerClientFactory: PeerClientFactory = () =>
  new CliControlClient({ transport: "webrtc" });

// Automatically register with prompt-peer when loaded in headless CLI mode
setPeerClientFactory(nativePeerClientFactory);
(globalThis as any).__peerClientFactory = nativePeerClientFactory;
