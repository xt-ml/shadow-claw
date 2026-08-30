import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

jest.unstable_mockModule("../../../utils/ulid.js", () => ({
  ulid: jest.fn(() => "mock-ask-id"),
}));

const { executeAskUser } = await import("./ask-user.js");
const { post } = await import("../../utils/post.js");

describe("executeAskUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).pendingAskUserResolvers = {};
  });

  it("returns error when question is missing", async () => {
    const result = await executeAskUser({}, "group-1");
    expect(result).toBe("Error: question is required.");
    expect(post).not.toHaveBeenCalled();
  });

  it("posts ask-user message and resolves when resolver is invoked", async () => {
    const askPromise = executeAskUser(
      { question: "Do you want to proceed?", options: ["Yes", "No"] },
      "group-1",
    );

    expect(post).toHaveBeenCalledWith({
      type: "ask-user",
      payload: {
        id: "mock-ask-id",
        groupId: "group-1",
        question: "Do you want to proceed?",
        options: ["Yes", "No"],
      },
    });

    const resolver = (globalThis as any).pendingAskUserResolvers["mock-ask-id"];
    expect(typeof resolver).toBe("function");

    resolver("User selected: Yes");

    const result = await askPromise;
    expect(result).toBe("User selected: Yes");
  });
});
