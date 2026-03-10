import { TOOL_DEFINITIONS } from "./tools.mjs";

describe("TOOL_DEFINITIONS", () => {
  it("contains named tools with JSON schema", () => {
    expect(Array.isArray(TOOL_DEFINITIONS)).toBe(true);
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(5);
    for (const def of TOOL_DEFINITIONS) {
      expect(typeof def.name).toBe("string");
      expect(typeof def.description).toBe("string");
      expect(def.input_schema).toBeDefined();
    }
  });

  it("includes core tools", () => {
    const names = new Set(TOOL_DEFINITIONS.map((d) => d.name));
    expect(names.has("bash")).toBe(true);
    expect(names.has("read_file")).toBe(true);
    expect(names.has("open_file")).toBe(true);
    expect(names.has("write_file")).toBe(true);
  });
});
