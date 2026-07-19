import { jest } from "@jest/globals";

jest.unstable_mockModule("./createLogMessage.js", () => ({
  createLogMessage: jest.fn(() => ({ type: "thinking-log" })),
}));

jest.unstable_mockModule("./post.js", () => ({
  post: jest.fn(),
}));

const { log } = await import("./log.js");
const { createLogMessage } = await import("./createLogMessage.js");
const { post } = await import("./post.js");

describe("log", () => {
  it("posts generated log message", () => {
    log("g", "info", "label", "m");

    expect(createLogMessage).toHaveBeenCalledWith("g", "info", "label", "m");

    expect(post).toHaveBeenCalledWith({ type: "thinking-log" });
  });
});
