import { jest } from "@jest/globals";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { executeSendNotification } = await import("./send-notification.js");
const { post } = await import("../../utils/post.js");

describe("executeSendNotification", () => {
  it("posts send-notification event and returns confirmation", () => {
    const result = executeSendNotification(
      { body: "Task completed successfully", title: "Build Notification" },
      "group-789",
    );

    expect(result).toBe("Push notification sent: Task completed successfully");
    expect(post).toHaveBeenCalledWith({
      type: "send-notification",
      payload: {
        body: "Task completed successfully",
        groupId: "group-789",
        title: "Build Notification",
      },
    });
  });

  it("uses default title when title is omitted", () => {
    executeSendNotification({ body: "Ping" }, "group-789");

    expect(post).toHaveBeenCalledWith({
      type: "send-notification",
      payload: {
        body: "Ping",
        groupId: "group-789",
        title: "ShadowClaw",
      },
    });
  });
});
