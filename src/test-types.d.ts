import { jest } from "@jest/globals";

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
    modelContext?: {
      registerTool: any;
      unregisterTool: any;
    };
    clipboard: {
      writeText: any;
    };
  }

  // Extend Window for store injections
  interface Window {
    orchestratorStore?: any;
    fileViewerStore?: any;
  }
}

export {};
