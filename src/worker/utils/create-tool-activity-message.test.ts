import { createToolActivityMessage } from "./create-tool-activity-message.js";

describe("createToolActivityMessage", () => {
  it("creates tool activity payload", () => {
    expect(createToolActivityMessage("g", "bash", "running")).toEqual({
      type: "tool-activity",
      payload: { groupId: "g", tool: "bash", status: "running" },
    });
  });
});
