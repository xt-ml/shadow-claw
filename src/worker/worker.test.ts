// @ts-nocheck
import { jest } from "@jest/globals";

const mockSandboxedEval = jest.fn();

describe("worker and worker/agent.js", () => {
  let agentModule;
  let workerModule;
  let stripHtml;

  beforeAll(() => {
    self.postMessage = jest.fn();
  });

  beforeAll(async () => {
    // Mock the dependencies that agent.mjs imports
    jest.unstable_mockModule("../config.js", () => ({
      BASH_DEFAULT_TIMEOUT_SEC: 120,
      BASH_MAX_TIMEOUT_SEC: 1800,
      CONFIG_KEYS: {
        PROVIDER: "provider",
        API_KEY: "api_key",
        MODEL: "model",
        MAX_TOKENS: "max_tokens",
        VM_BOOT_MODE: "vm_boot_mode",
        VM_BOOT_HOST: "vm_boot_host",
        VM_NETWORK_RELAY_URL: "vm_network_relay_url",
        VM_BASH_TIMEOUT_SEC: "vm_bash_timeout_sec",
      },
      DEFAULT_GROUP_ID: "br:main",
      DEFAULT_MAX_ITERATIONS: 50,
      FETCH_MAX_RESPONSE: 1000,
      DEFAULT_VM_BOOT_HOST: "http://localhost:8888",
      DEFAULT_DEV_HOST: "localhost",
      DEFAULT_DEV_PORT: 8888,
      GENERAL_ACCOUNT_PROVIDER_CAPABILITIES: {},
      getGeneralAccountProviderCapabilities: jest.fn(() => null),
      getProvider: jest.fn(),
      getProviderTokenAuthScheme: jest.fn(() => ({
        headerName: "Authorization",
        headerPrefix: "Bearer ",
      })),
      OPFS_ROOT: "shadowclaw",
    }));

    jest.unstable_mockModule("../db/setConfig.js", () => ({
      getConfig: jest.fn(),
      setConfig: jest.fn(),
    }));

    jest.unstable_mockModule("../db/openDatabase.js", () => ({
      openDatabase: jest.fn(),
    }));

    jest.unstable_mockModule("../vm.js", () => ({
      attachTerminalWorkspaceAutoSync: jest.fn(),
      bootVM: jest.fn(),
      createTerminalSession: jest.fn(),
      executeInVM: jest.fn(),
      flushVMWorkspaceToHost: jest.fn(),
      getVMBootModePreference: jest.fn(),
      getVMBootHostPreference: jest.fn(),
      getVMNetworkRelayURLPreference: jest.fn(),
      getVMStatus: jest.fn(),
      isVMReady: jest.fn(),
      setVMBootHostPreference: jest.fn(),
      setVMBootModePreference: jest.fn(),
      setVMNetworkRelayURLPreference: jest.fn(),
      shutdownVM: jest.fn(),
      subscribeVMBootOutput: jest.fn(),
      subscribeVMStatus: jest.fn(),
      syncVMWorkspaceFromHost: jest.fn(),
    }));

    jest.unstable_mockModule("../providers.js", () => ({
      buildHeaders: jest.fn(),
      formatRequest: jest.fn(),
      getContextLimit: jest.fn(),
      parseResponse: jest.fn(),
    }));

    jest.unstable_mockModule("../shell/shell.js", () => ({
      executeShell: jest.fn(),
    }));

    jest.unstable_mockModule("../storage/listGroupFiles.js", () => ({
      listGroupFiles: jest.fn(),
    }));

    jest.unstable_mockModule("../storage/readGroupFile.js", () => ({
      readGroupFile: jest.fn(),
    }));

    jest.unstable_mockModule("../storage/storage.js", () => ({
      getStorageRoot: jest.fn(),
      setStorageRoot: jest.fn(),
      getStorageStatus: jest.fn(() => ({ type: "opfs" })),
      invalidateStorageRoot: jest.fn(),
      isStaleHandleError: jest.fn(),
    }));

    jest.unstable_mockModule("../storage/writeGroupFile.js", () => ({
      writeGroupFile: jest.fn(),
    }));

    jest.unstable_mockModule("../tools.js", () => ({
      TOOL_DEFINITIONS: [],
    }));

    jest.unstable_mockModule("../ulid.js", () => ({
      ulid: jest.fn(() => "01AN4Z07BY79KA1307SR9X4MV3"),
    }));

    jest.unstable_mockModule("../types.js", () => ({}) as any);

    jest.unstable_mockModule("../worker/sandboxedEval.js", () => ({
      sandboxedEval: mockSandboxedEval,
    }));

    // Import from agent.mjs for unit testing
    agentModule = await import("./agent.js");

    // Import extracted utilities
    const stripHtmlModule = await import("./stripHtml.js");
    stripHtml = stripHtmlModule.stripHtml;

    // Import from worker.ts to verify no exports
    workerModule = await import("./worker.js");
  });

  describe("agent utilities (src/worker/agent.mjs)", () => {
    describe("stripHtml", () => {
      it("should remove script and style tags", () => {
        const html =
          "<div>Hello<script>alert(1)</script><style>body{}</style> World</div>";
        expect(stripHtml(html)).toBe("Hello World");
      });

      it("should remove HTML tags and keep text", () => {
        const html = "<p>This is <b>bold</b> text.</p>";
        expect(stripHtml(html)).toBe("This is bold text.");
      });

      it("should decode common entities", () => {
        const html = "Fish &amp; Chips &lt; &gt; &quot;quote&quot;";
        expect(stripHtml(html)).toBe('Fish & Chips < > "quote"');
      });
    });

    describe("executeTool", () => {
      beforeEach(() => {
        mockSandboxedEval.mockReset();
      });

      it("should handle unknown tool", async () => {
        const result = await agentModule.executeTool(
          {},
          "unknown_tool",
          {},
          "group",
        );
        expect(result).toBe("Unknown tool: unknown_tool");
      });

      it("should handle javascript tool with eval", async () => {
        (mockSandboxedEval as any).mockResolvedValueOnce({
          ok: true,
          value: 2,
        });

        const result = await agentModule.executeTool(
          {},
          "javascript",
          { code: "1 + 1" },
          "group",
        );
        expect(mockSandboxedEval).toHaveBeenCalledWith("1 + 1");
        expect(result).toBe("2");
      });

      it("should handle javascript error", async () => {
        (mockSandboxedEval as any).mockResolvedValueOnce({
          ok: false,
          error: "fail",
        });

        const result = await agentModule.executeTool(
          {},
          "javascript",
          { code: "throw new Error('fail')" },
          "group",
        );
        expect(mockSandboxedEval).toHaveBeenCalledWith(
          "throw new Error('fail')",
        );
        expect(result).toContain("JavaScript error: fail");
      });
    });
  });

  describe("Web Worker interface", () => {
    it("should respond to messages via handleMessage", async () => {
      // Mock self and postMessage
      const postMessageSpy = jest.fn();
      global.self = {
        postMessage: postMessageSpy,
      };

      try {
        // Mock openDatabase failure or success is fine, let's just mock it to return a dummy db
        const { openDatabase } = await import("../db/openDatabase.js");
        (openDatabase as any).mockResolvedValueOnce({} as any);

        // Call handleMessage directly
        await agentModule.handleMessage({
          data: {
            type: "invoke",
            payload: {
              groupId: "test-group",
              messages: [],
              systemPrompt: "test prompt",
              apiKey: "test-key",
              model: "test-model",
              maxTokens: 100,
              provider: "test-provider",
            },
          },
        });

        expect(postMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            payload: expect.objectContaining({
              groupId: "test-group",
              error: "Unknown provider: test-provider",
            }),
          }),
        );
      } finally {
        delete global.self;
      }
    });
  });

  describe("Toast helper functions (on globalThis)", () => {
    let postMessageSpy;

    beforeEach(() => {
      postMessageSpy = jest.fn();
      global.self = {
        postMessage: postMessageSpy,
      };
    });

    afterEach(() => {
      delete global.self;
    });

    it("should call showToast with default type", () => {
      globalThis.showToast("Test message");
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: { message: "Test message", type: "info", duration: undefined },
      });
    });

    it("should call showToast with custom type and duration", () => {
      globalThis.showToast("Warning message", "warning", 5000);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: {
          message: "Warning message",
          type: "warning",
          duration: 5000,
        },
      });
    });

    it("should call showSuccess", () => {
      globalThis.showSuccess("Success message", 3000);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: {
          message: "Success message",
          type: "success",
          duration: 3000,
        },
      });
    });

    it("should call showError", () => {
      globalThis.showError("Error message");
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: {
          message: "Error message",
          type: "error",
          duration: undefined,
        },
      });
    });

    it("should call showWarning", () => {
      globalThis.showWarning("Warning message");
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: {
          message: "Warning message",
          type: "warning",
          duration: undefined,
        },
      });
    });

    it("should call showInfo", () => {
      globalThis.showInfo("Info message", 2000);
      expect(postMessageSpy).toHaveBeenCalledWith({
        type: "show-toast",
        payload: { message: "Info message", type: "info", duration: 2000 },
      });
    });
  });
});
