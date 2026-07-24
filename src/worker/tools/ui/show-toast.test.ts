import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { executeShowToast } = await import("./show-toast.js");

describe("executeShowToast", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should post a show-toast message with provided duration and message", () => {
    const input = {
      duration: 5000,
      message: "Test message",
      type: "success",
    };

    const result = executeShowToast(input);

    expect(post).toHaveBeenCalledWith({
      type: "show-toast",
      payload: {
        duration: 5000,
        message: "Test message",
        type: "success",
      },
    });

    expect(result).toBe("Toast notification sent: Test message");
  });

  it("should default type to info if not provided", () => {
    const input = {
      duration: 3000,
      message: "Default type message",
    };

    executeShowToast(input);

    expect(post).toHaveBeenCalledWith({
      type: "show-toast",
      payload: {
        duration: 3000,
        message: "Default type message",
        type: "info",
      },
    });
  });
});
