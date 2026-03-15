import { createLogMessage } from "./createLogMessage.mjs";

describe("createLogMessage", () => {
  it("returns thinking-log message with timestamp", () => {
    const msg = createLogMessage("g", "info", "L", "M");

    expect(msg.type).toBe("thinking-log");

    expect(msg.payload).toEqual(
      expect.objectContaining({
        groupId: "g",
        level: "info",
        label: "L",
        message: "M",
      }),
    );

    expect(typeof msg.payload.timestamp).toBe("number");
  });
});
