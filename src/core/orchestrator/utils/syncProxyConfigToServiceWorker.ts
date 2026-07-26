import type { OrchestratorState } from "../orchestrator-state.js";

export function syncProxyConfigToServiceWorker(
  state: Pick<OrchestratorState, "useProxy" | "proxyUrl">,
) {
  if ("serviceWorker" in navigator && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "set-proxy-config",
      payload: {
        useProxy: state.useProxy,
        proxyUrl: state.proxyUrl,
      },
    });
  }
}
