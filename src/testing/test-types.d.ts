declare global {
  var __taskRan: boolean;

  // Extend global for test-specific properties
  namespace NodeJS {
    interface Global {
      fetch: any;
    }
  }

  // Extend Navigator for WebMCP and other browser APIs mocked in tests
  interface Navigator {
    clipboard: {
      writeText: any;
    };

    modelContext?: {
      registerTool: any;
      unregisterTool: any;
    };
  }

  // Extend Window for store injections and E2E testing bridge
  interface Window {
    __SHADOWCLAW_E2E_ENABLE__?: boolean;
    __SHADOWCLAW_E2E__?: import("./e2e-bridge.js").E2eBridge;
    fileViewerStore?: any;
    orchestratorStore?: any;
  }
}

export {};
