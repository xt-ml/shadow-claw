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

    expect(names.has("attach_file_to_chat")).toBe(true);

    expect(names.has("write_file")).toBe(true);

    expect(names.has("patch_file")).toBe(true);

    expect(names.has("manage_email")).toBe(true);

    expect(names.has("email_read_messages")).toBe(true);

    expect(names.has("email_send_message")).toBe(true);

    const manageIntegration: any = TOOL_DEFINITIONS.find(
      (d) => d.name === "manage_email",
    );

    expect(manageIntegration.input_schema.properties.action.enum).toEqual(
      expect.arrayContaining([
        "read_messages",
        "send_message",
        "mark_as_read",
        "mark_as_unread",
        "delete_messages",
        "download_attachments",
      ]),
    );
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

  it("write_text schema supports tone, format, length, outputLanguage, and sharedContext", () => {
    const tool: any = TOOL_DEFINITIONS.find((d) => d.name === "write_text");
    expect(tool).toBeDefined();
    expect(tool.input_schema.properties.prompt).toBeDefined();
    expect(tool.input_schema.properties.tone).toBeDefined();
    expect(tool.input_schema.properties.format).toBeDefined();
    expect(tool.input_schema.properties.length).toBeDefined();
    expect(tool.input_schema.properties.outputLanguage).toBeDefined();
    expect(tool.input_schema.properties.sharedContext).toBeDefined();
  });

  it("rewrite_text schema supports format, outputLanguage, and sharedContext", () => {
    const tool: any = TOOL_DEFINITIONS.find((d) => d.name === "rewrite_text");
    expect(tool).toBeDefined();
    expect(tool.input_schema.properties.text).toBeDefined();
    expect(tool.input_schema.properties.tone).toBeDefined();
    expect(tool.input_schema.properties.format).toBeDefined();
    expect(tool.input_schema.properties.length).toBeDefined();
    expect(tool.input_schema.properties.outputLanguage).toBeDefined();
    expect(tool.input_schema.properties.sharedContext).toBeDefined();
  });
});
