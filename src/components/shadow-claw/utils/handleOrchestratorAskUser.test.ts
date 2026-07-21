import { jest } from "@jest/globals";

describe("handleOrchestratorAskUser", () => {
  let handleOrchestratorAskUser: any;
  let mockRequestUserPrompt: jest.Mock<any>;
  let mockDoc: Document;
  let mockShadow: ShadowRoot | null;
  let mockShadowClaw: any;
  let mockAnswerUserPrompt: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    jest.unstable_mockModule("./requestUserPrompt.js", () => ({
      requestUserPrompt: jest.fn(),
    }));

    mockRequestUserPrompt = (await import("./requestUserPrompt.js"))
      .requestUserPrompt as jest.Mock<any>;
    handleOrchestratorAskUser = (await import("./handleOrchestratorAskUser.js"))
      .handleOrchestratorAskUser;

    mockDoc = {} as any;
    mockShadow = {} as any;
    mockAnswerUserPrompt = jest.fn();
    mockShadowClaw = {
      orchestrator: {
        answerUserPrompt: mockAnswerUserPrompt,
      },
    };
  });

  it("should call requestUserPrompt with correct arguments and answerUserPrompt with response", async () => {
    const payload = {
      id: "prompt-1",
      groupId: "group-1",
      question: "What is your favorite color?",
      options: ["Red", "Green", "Blue"],
    };
    const mockResponse = "Red";
    mockRequestUserPrompt.mockResolvedValueOnce(mockResponse);

    await handleOrchestratorAskUser(
      mockDoc,
      mockShadow,
      mockShadowClaw,
      payload,
    );

    expect(mockRequestUserPrompt).toHaveBeenCalledTimes(1);
    expect(mockRequestUserPrompt).toHaveBeenCalledWith(
      mockDoc,
      mockShadow,
      payload,
    );
    expect(mockAnswerUserPrompt).toHaveBeenCalledWith(payload.id, mockResponse);
  });

  it("should call requestUserPrompt with payload containing only required fields (no options)", async () => {
    const payload = {
      id: "prompt-2",
      groupId: "group-2",
      question: "Enter a name",
    };
    const mockResponse = "John Doe";
    mockRequestUserPrompt.mockResolvedValueOnce(mockResponse);

    await handleOrchestratorAskUser(
      mockDoc,
      mockShadow,
      mockShadowClaw,
      payload,
    );

    expect(mockRequestUserPrompt).toHaveBeenCalledWith(
      mockDoc,
      mockShadow,
      payload,
    );
    expect(mockAnswerUserPrompt).toHaveBeenCalledWith(payload.id, mockResponse);
  });

  it("should handle requestUserPrompt rejection and propagate error", async () => {
    const payload = {
      id: "prompt-3",
      groupId: "group-3",
      question: "Test error",
    };
    const error = new Error("User cancelled");
    mockRequestUserPrompt.mockRejectedValueOnce(error);

    await expect(
      handleOrchestratorAskUser(mockDoc, mockShadow, mockShadowClaw, payload),
    ).rejects.toThrow(error);

    expect(mockRequestUserPrompt).toHaveBeenCalledWith(
      mockDoc,
      mockShadow,
      payload,
    );
    expect(mockAnswerUserPrompt).not.toHaveBeenCalled();
  });

  it("should not call answerUserPrompt if requestUserPrompt returns null", async () => {
    const payload = {
      id: "prompt-4",
      groupId: "group-4",
      question: "What is your name?",
    };
    const mockResponse = null;
    mockRequestUserPrompt.mockResolvedValueOnce(mockResponse);

    await handleOrchestratorAskUser(
      mockDoc,
      mockShadow,
      mockShadowClaw,
      payload,
    );

    expect(mockRequestUserPrompt).toHaveBeenCalledWith(
      mockDoc,
      mockShadow,
      payload,
    );
    expect(mockAnswerUserPrompt).toHaveBeenCalledWith(payload.id, null);
  });

  it("should pass shadow as null when appropriate", async () => {
    const payload = {
      id: "prompt-5",
      groupId: "group-5",
      question: "Test shadow null",
    };
    const mockResponse = "response";
    mockRequestUserPrompt.mockResolvedValueOnce(mockResponse);

    await handleOrchestratorAskUser(mockDoc, null, mockShadowClaw, payload);

    expect(mockRequestUserPrompt).toHaveBeenCalledWith(mockDoc, null, payload);
    expect(mockAnswerUserPrompt).toHaveBeenCalledWith(payload.id, mockResponse);
  });
});
