import { TOOL_DEFINITIONS } from "./tools.js";

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

    expect(names.has("patch_file")).toBe(true);
  });

  it("read_file accepts both path (string) and paths (array)", () => {
    const readFile: any = TOOL_DEFINITIONS.find((d) => d.name === "read_file");

    expect(readFile).toBeDefined();

    expect(readFile!.input_schema.properties.path).toBeDefined();

    expect(readFile!.input_schema.properties.paths).toBeDefined();

    expect(readFile!.input_schema.properties.paths.type).toBe("array");

    expect(readFile!.input_schema.properties.paths.items.type).toBe("string");
  });

  it("patch_file requires path, old_string, and new_string", () => {
    const patchFile: any = TOOL_DEFINITIONS.find(
      (d) => d.name === "patch_file",
    );

    expect(patchFile).toBeDefined();

    expect(patchFile!.input_schema.required).toEqual(
      expect.arrayContaining(["path", "old_string", "new_string"]),
    );

    expect(patchFile!.input_schema.properties.path).toBeDefined();

    expect(patchFile!.input_schema.properties.old_string).toBeDefined();

    expect(patchFile!.input_schema.properties.new_string).toBeDefined();
  });

  it("send_notification requires body", () => {
    const tool: any = TOOL_DEFINITIONS.find(
      (d) => d.name === "send_notification",
    );

    expect(tool).toBeDefined();

    expect(tool!.input_schema.required).toEqual(["body"]);

    expect(tool!.input_schema.properties.body).toBeDefined();

    expect(tool!.input_schema.properties.title).toBeDefined();

    expect(tool!.input_schema.properties.title.type).toBe("string");

    expect(tool!.input_schema.properties.body.type).toBe("string");
  });
});
