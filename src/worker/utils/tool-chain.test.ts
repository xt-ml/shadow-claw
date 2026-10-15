import { jest } from "@jest/globals";

const mockExecuteTool = jest.fn();

jest.unstable_mockModule("./execute-tool.js", () => ({
  executeTool: mockExecuteTool,
}));

const { executeToolChain, resolvePipeRefs, resultToValue } =
  await import("./tool-chain.js");

describe("tool-chain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resultToValue", () => {
    it("returns string as-is", () => {
      expect(resultToValue("hello world")).toBe("hello world");
    });

    it("extracts text from content blocks", () => {
      const blocks = [
        { type: "text", text: "Line 1" },
        { type: "text", text: "Line 2" },
      ];
      expect(resultToValue(blocks)).toBe("Line 1\nLine 2");
    });

    it("extracts data from content blocks", () => {
      const blocks = [{ data: "raw-data" }];
      expect(resultToValue(blocks)).toBe("raw-data");
    });

    it("handles objects and nullish values", () => {
      const obj = { foo: "bar" };
      expect(resultToValue(obj)).toEqual({ foo: "bar" });
      expect(resultToValue(null)).toBe("");
      expect(resultToValue(undefined)).toBe("");
    });
  });

  describe("resolvePipeRefs", () => {
    it("returns primitives unchanged", () => {
      expect(resolvePipeRefs(42, [], [])).toBe(42);
      expect(resolvePipeRefs("test", [], [])).toBe("test");
      expect(resolvePipeRefs(true, [], [])).toBe(true);
      expect(resolvePipeRefs(null, [], [])).toBe(null);
    });

    it("resolves $pipe: 'prev'", () => {
      const rawOutputs = ["output-1", "output-2"];
      const tools: any[] = [
        { name: "step1", input: {} },
        { name: "step2", input: {} },
      ];
      const input = { data: { $pipe: "prev" } };
      expect(resolvePipeRefs(input, rawOutputs, tools)).toEqual({
        data: "output-2",
      });
    });

    it("resolves $pipe by numeric index", () => {
      const rawOutputs = ["first", "second", "third"];
      const tools: any[] = [
        { name: "step1", input: {} },
        { name: "step2", input: {} },
        { name: "step3", input: {} },
      ];
      const input = { firstResult: { $pipe: 0 }, secondResult: { $pipe: 1 } };
      expect(resolvePipeRefs(input, rawOutputs, tools)).toEqual({
        firstResult: "first",
        secondResult: "second",
      });
    });

    it("resolves $pipe by tool name looking backwards", () => {
      const rawOutputs = ["fetch-res", "summarize-res"];
      const tools: any[] = [
        { name: "fetch_url", input: {} },
        { name: "summarize", input: {} },
      ];
      const input = { source: { $pipe: "fetch_url" } };
      expect(resolvePipeRefs(input, rawOutputs, tools)).toEqual({
        source: "fetch-res",
      });
    });

    it("resolves nested arrays and objects", () => {
      const rawOutputs = ["val1"];
      const tools: any[] = [{ name: "step1", input: {} }];
      const input = {
        nested: [{ item: { $pipe: "prev" } }],
      };
      expect(resolvePipeRefs(input, rawOutputs, tools)).toEqual({
        nested: [{ item: "val1" }],
      });
    });
  });

  describe("executeToolChain", () => {
    const dummyDb: any = {};
    const groupId = "group-1";

    it("executes tools sequentially and returns outputs", async () => {
      mockExecuteTool
        .mockResolvedValueOnce("result 1")
        .mockResolvedValueOnce("result 2");

      const onStep = jest.fn();
      const tools: any[] = [
        { name: "tool1", input: { a: 1 } },
        { name: "tool2", input: { $pipe: "prev" } },
      ];

      const res = await executeToolChain(dummyDb, groupId, tools, {
        onStep,
        isManual: true,
      });

      expect(onStep).toHaveBeenCalledTimes(2);
      expect(mockExecuteTool).toHaveBeenCalledTimes(2);
      expect(mockExecuteTool).toHaveBeenNthCalledWith(
        1,
        dummyDb,
        "tool1",
        { a: 1 },
        groupId,
        { isScheduledTask: false, isTaskExecution: undefined },
      );
      expect(mockExecuteTool).toHaveBeenNthCalledWith(
        2,
        dummyDb,
        "tool2",
        "result 1",
        groupId,
        { isScheduledTask: false, isTaskExecution: undefined },
      );

      expect(res.rawOutputs).toEqual(["result 1", "result 2"]);
      expect(res.results).toEqual([
        "**Tool `tool1`**: result 1",
        "**Tool `tool2`**: result 2",
      ]);
    });

    it("respects suppressOutput", async () => {
      mockExecuteTool.mockResolvedValueOnce("secret");

      const tools: any[] = [
        { name: "quiet_tool", input: {}, suppressOutput: true },
      ];

      const res = await executeToolChain(dummyDb, groupId, tools);
      expect(res.rawOutputs).toEqual(["secret"]);
      expect(res.results).toEqual([]);
    });

    it("handles tool execution errors gracefully", async () => {
      mockExecuteTool
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce("recovered");

      const tools: any[] = [
        { name: "failing_tool", input: {} },
        { name: "next_tool", input: {} },
      ];

      const res = await executeToolChain(dummyDb, groupId, tools);
      expect(res.rawOutputs).toEqual(["Network timeout", "recovered"]);
      expect(res.results).toEqual([
        "**Tool `failing_tool` failed**: Network timeout",
        "**Tool `next_tool`**: recovered",
      ]);
    });
  });
});
