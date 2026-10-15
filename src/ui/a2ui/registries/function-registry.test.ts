import {
  FunctionRegistry,
  globalFunctionRegistry,
} from "./function-registry.js";

describe("function-registry", () => {
  it("registers and retrieves functions", () => {
    const registry = new FunctionRegistry();
    const fnDef = {
      name: "testFn",
      callableFrom: "rendererOrAgent" as const,
      evaluate: (args: Record<string, any>) => args.val * 2,
    };

    registry.register(fnDef);
    expect(registry.get("testFn")).toBe(fnDef);
    expect(registry.get("non-existent")).toBeUndefined();
  });

  it("executes registered functions and throws on unregistered functions", () => {
    const registry = new FunctionRegistry();
    registry.register({
      name: "add",
      callableFrom: "rendererOrAgent",
      evaluate: (args) => args.a + args.b,
    });

    const result = registry.execute("add", { a: 2, b: 3 }, { dataModel: {} });
    expect(result).toBe(5);

    expect(() => registry.execute("missing", {}, { dataModel: {} })).toThrow(
      "INVALID_FUNCTION_CALL: Unregistered function missing",
    );
  });

  it("provides globalFunctionRegistry instance", () => {
    expect(globalFunctionRegistry).toBeInstanceOf(FunctionRegistry);
  });
});
