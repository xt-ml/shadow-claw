import { spawn_subagent } from "./subagent.js";

describe("spawn_subagent tool definition", () => {
  it("has the correct name", () => {
    expect(spawn_subagent.name).toBe("spawn_subagent");
  });

  it("has a non-empty description", () => {
    expect(typeof spawn_subagent.description).toBe("string");
    expect(spawn_subagent.description.length).toBeGreaterThan(20);
  });

  it("requires a prompt field", () => {
    expect(spawn_subagent.input_schema.required).toContain("prompt");
  });

  it("has prompt as a string property", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.prompt).toBeDefined();
    expect(props.prompt.type).toBe("string");
  });

  it("has optional tools property as array", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.tools).toBeDefined();
    expect(props.tools.type).toBe("array");
  });

  it("has optional model property as string", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.model).toBeDefined();
    expect(props.model.type).toBe("string");
  });

  it("has optional provider property as string", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.provider).toBeDefined();
    expect(props.provider.type).toBe("string");
  });

  it("has optional workspace_group_id property as string", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.workspace_group_id).toBeDefined();
    expect(props.workspace_group_id.type).toBe("string");
  });

  it("has optional system_prompt property as string", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.system_prompt).toBeDefined();
    expect(props.system_prompt.type).toBe("string");
  });

  it("has optional parallel_agents property as array", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    expect(props.parallel_agents).toBeDefined();
    expect(props.parallel_agents.type).toBe("array");
  });

  it("parallel_agents items have prompt and tools", () => {
    const props = spawn_subagent.input_schema.properties as Record<string, any>;
    const items = props.parallel_agents.items;
    expect(items).toBeDefined();
    expect(items.properties.prompt).toBeDefined();
    expect(items.properties.tools).toBeDefined();
    expect(items.properties.provider).toBeDefined();
    expect(items.properties.workspace_group_id).toBeDefined();
  });

  it("does not require parallel_agents", () => {
    const required = spawn_subagent.input_schema.required ?? [];
    expect(required).not.toContain("parallel_agents");
  });
});
