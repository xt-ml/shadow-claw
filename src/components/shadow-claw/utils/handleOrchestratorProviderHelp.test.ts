import { jest } from "@jest/globals";

describe("handleOrchestratorProviderHelp", () => {
  let handleOrchestratorProviderHelp: any;
  let mockRequestDialog: jest.Mock<any>;
  let mockBuildLlamafileHelpDialogOptions: jest.Mock<any>;
  let mockBuildProviderHelpDialogOptions: jest.Mock<any>;
  let mockBuildTransformersJsHelpDialogOptions: jest.Mock<any>;

  let mockDoc: Document;
  let mockShadow: ShadowRoot | null;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("./requestDialog.js", () => ({
      requestDialog: jest.fn(),
    }));
    jest.unstable_mockModule("../../common/help/llamafile.js", () => ({
      buildLlamafileHelpDialogOptions: jest.fn((reason) => ({
        title: "Llamafile Help",
        reason,
      })),
    }));
    jest.unstable_mockModule("../../common/help/providers.js", () => ({
      buildProviderHelpDialogOptions: jest.fn(
        (providerId, helpType, reason) => ({
          title: `${providerId} Help`,
          helpType,
          reason,
        }),
      ),
    }));
    jest.unstable_mockModule("../../common/help/transformers.js", () => ({
      buildTransformersJsHelpDialogOptions: jest.fn((reason) => ({
        title: "Transformers.js Help",
        reason,
      })),
    }));

    mockRequestDialog = (await import("./requestDialog.js"))
      .requestDialog as jest.Mock<any>;
    mockBuildLlamafileHelpDialogOptions = (
      await import("../../common/help/llamafile.js")
    ).buildLlamafileHelpDialogOptions as jest.Mock<any>;
    mockBuildProviderHelpDialogOptions = (
      await import("../../common/help/providers.js")
    ).buildProviderHelpDialogOptions as jest.Mock<any>;
    mockBuildTransformersJsHelpDialogOptions = (
      await import("../../common/help/transformers.js")
    ).buildTransformersJsHelpDialogOptions as jest.Mock<any>;
    handleOrchestratorProviderHelp = (
      await import("./handleOrchestratorProviderHelp.js")
    ).handleOrchestratorProviderHelp;

    mockDoc = {} as any;
    mockShadow = { querySelector: jest.fn() } as any;
  });

  it("should open llamafile help dialog when providerId is llamafile with reason", async () => {
    const payload = {
      providerId: "llamafile",
      reason: "No llamafile binary found",
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockBuildLlamafileHelpDialogOptions).toHaveBeenCalledWith(
      "No llamafile binary found",
    );
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);
    expect(mockRequestDialog).toHaveBeenCalledWith(mockDoc, mockShadow, {
      title: "Llamafile Help",
      reason: "No llamafile binary found",
    });
  });

  it("should open llamafile help dialog without reason", async () => {
    const payload = {
      providerId: "llamafile",
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockBuildLlamafileHelpDialogOptions).toHaveBeenCalledWith(undefined);
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);
  });

  it("should open transformers_js_local help dialog when providerId is transformers_js_local", async () => {
    const payload = {
      providerId: "transformers_js_local",
      reason: "Transformers model not loaded",
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockBuildTransformersJsHelpDialogOptions).toHaveBeenCalledWith(
      "Transformers model not loaded",
    );
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);
    expect(mockRequestDialog).toHaveBeenCalledWith(mockDoc, mockShadow, {
      title: "Transformers.js Help",
      reason: "Transformers model not loaded",
    });
  });

  it("should open provider help dialog when providerId and helpType are provided", async () => {
    const payload = {
      providerId: "openai",
      helpType: "configuration" as const,
      reason: "Missing API key",
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockBuildProviderHelpDialogOptions).toHaveBeenCalledWith(
      "openai",
      "configuration",
      "Missing API key",
    );
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);
    expect(mockRequestDialog).toHaveBeenCalledWith(mockDoc, mockShadow, {
      title: "openai Help",
      helpType: "configuration",
      reason: "Missing API key",
    });
  });

  it("should open provider help dialog with helpType but no reason", async () => {
    const payload = {
      providerId: "anthropic",
      helpType: "connection" as const,
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockBuildProviderHelpDialogOptions).toHaveBeenCalledWith(
      "anthropic",
      "connection",
      undefined,
    );
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);
  });

  it("should do nothing when providerId is missing", async () => {
    const payload = {
      reason: "Some reason",
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockRequestDialog).not.toHaveBeenCalled();
    expect(mockBuildLlamafileHelpDialogOptions).not.toHaveBeenCalled();
    expect(mockBuildTransformersJsHelpDialogOptions).not.toHaveBeenCalled();
    expect(mockBuildProviderHelpDialogOptions).not.toHaveBeenCalled();
  });

  it("should do nothing when only helpType is provided without providerId", async () => {
    const payload = {
      helpType: "configuration" as const,
    };

    await handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any);

    expect(mockRequestDialog).not.toHaveBeenCalled();
  });

  it("should pass shadow as null when appropriate", async () => {
    const payload = {
      providerId: "llamafile",
      reason: "Test null shadow",
    };

    await handleOrchestratorProviderHelp(mockDoc, null, payload as any);

    expect(mockRequestDialog).toHaveBeenCalledWith(
      mockDoc,
      null,
      expect.any(Object),
    );
  });

  it("should handle requestDialog rejection and propagate error", async () => {
    const payload = {
      providerId: "openai",
      helpType: "configuration" as const,
    };
    const error = new Error("Dialog failed");
    mockRequestDialog.mockRejectedValueOnce(error);

    await expect(
      handleOrchestratorProviderHelp(mockDoc, mockShadow, payload as any),
    ).rejects.toThrow(error);
  });

  it("should handle all three provider types correctly with same dialog structure", async () => {
    const helpPayload = {
      providerId: "openai",
      helpType: "api" as const,
    };

    // Test llamafile
    await handleOrchestratorProviderHelp(mockDoc, mockShadow, {
      providerId: "llamafile",
    } as any);
    expect(mockRequestDialog).toHaveBeenCalledTimes(1);

    // Test transformers_js_local
    await handleOrchestratorProviderHelp(mockDoc, mockShadow, {
      providerId: "transformers_js_local",
    } as any);
    expect(mockRequestDialog).toHaveBeenCalledTimes(2);

    // Test generic provider with helpType
    await handleOrchestratorProviderHelp(
      mockDoc,
      mockShadow,
      helpPayload as any,
    );
    expect(mockRequestDialog).toHaveBeenCalledTimes(3);

    // Verify all were called with doc and shadow
    expect(mockRequestDialog).toHaveBeenNthCalledWith(
      1,
      mockDoc,
      mockShadow,
      expect.any(Object),
    );
    expect(mockRequestDialog).toHaveBeenNthCalledWith(
      2,
      mockDoc,
      mockShadow,
      expect.any(Object),
    );
    expect(mockRequestDialog).toHaveBeenNthCalledWith(
      3,
      mockDoc,
      mockShadow,
      expect.any(Object),
    );
  });
});
