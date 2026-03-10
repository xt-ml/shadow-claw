import { jest } from "@jest/globals";

jest.unstable_mockModule("./createLogMessage.mjs", () => ({
  createLogMessage: jest.fn(() => ({ type: "thinking-log" })),
}));

jest.unstable_mockModule("./post.mjs", () => ({
  post: jest.fn(),
}));

const { log } = await import("./log.mjs");
const { createLogMessage } = await import("./createLogMessage.mjs");
const { post } = await import("./post.mjs");

describe("log", () => {
  it("posts generated log message", () => {
    log("g", "info", "label", "m");
    expect(createLogMessage).toHaveBeenCalledWith("g", "info", "label", "m");
    expect(post).toHaveBeenCalledWith({ type: "thinking-log" });
  });
});
