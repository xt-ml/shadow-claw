import { jest } from "@jest/globals";
import { syncProxyConfigToServiceWorker } from "./syncProxyConfigToServiceWorker.js";

describe("syncProxyConfigToServiceWorker", () => {
  let originalServiceWorker: any;

  beforeEach(() => {
    originalServiceWorker = (navigator as any).serviceWorker;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });

  it("posts proxy config to active service worker controller", () => {
    const mockPostMessage = jest.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: {
          postMessage: mockPostMessage,
        },
      },
      configurable: true,
      writable: true,
    });

    syncProxyConfigToServiceWorker({
      useProxy: true,
      proxyUrl: "http://localhost:8888/proxy",
    });

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: "set-proxy-config",
      payload: {
        useProxy: true,
        proxyUrl: "http://localhost:8888/proxy",
      },
    });
  });

  it("does nothing when service worker controller is missing", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: null,
      },
      configurable: true,
      writable: true,
    });

    // Should not throw
    syncProxyConfigToServiceWorker({
      useProxy: false,
      proxyUrl: "",
    });
  });
});
