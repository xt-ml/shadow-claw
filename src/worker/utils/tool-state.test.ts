import { setToolState, getToolState, clearToolState } from "./tool-state.js";

describe("tool-state", () => {
  beforeEach(() => {
    clearToolState("group-1");
    clearToolState("group-2");
  });

  it("sets, gets, and clears tool state for a group", () => {
    expect(getToolState("group-1")).toBeUndefined();

    const tools: any[] = [
      { name: "test_tool", description: "test", input_schema: {} },
    ];
    setToolState("group-1", tools, "Custom prompt override");

    const state = getToolState("group-1");
    expect(state).toEqual({
      enabledTools: tools,
      systemPromptOverride: "Custom prompt override",
    });

    // Check isolation from other groups
    expect(getToolState("group-2")).toBeUndefined();

    clearToolState("group-1");
    expect(getToolState("group-1")).toBeUndefined();
  });
});
