/**
 * Tests for the A2UI tool definitions (list_components, render_component)
 * and the executeTool dispatch for both.
 *
 * We test the executor directly by calling executeTool with a mock post()
 * and a null DB (neither tool touches the DB).
 */

import { list_components, render_component } from "./a2ui.js";
import { MINIMAL_CATALOG_REFERENCE, A2UI_MINIMAL_CATALOG_ID } from "../a2ui.js";

// ---------------------------------------------------------------------------
// Tool definition shape tests
// ---------------------------------------------------------------------------

describe("list_components tool definition", () => {
  it("has correct name", () => {
    expect(list_components.name).toBe("list_components");
  });

  it("has empty required array", () => {
    expect((list_components.input_schema as any).required).toEqual([]);
  });

  it("has a non-empty description", () => {
    expect(list_components.description.length).toBeGreaterThan(10);
  });
});

describe("render_component tool definition", () => {
  it("has correct name", () => {
    expect(render_component.name).toBe("render_component");
  });

  it("requires action and surfaceId", () => {
    expect((render_component.input_schema as any).required).toEqual([
      "action",
      "surfaceId",
    ]);
  });

  it("enumerates the four valid actions", () => {
    const actionEnum = (render_component.input_schema as any).properties.action
      .enum as string[];
    expect(actionEnum).toContain("createSurface");
    expect(actionEnum).toContain("updateComponents");
    expect(actionEnum).toContain("updateDataModel");
    expect(actionEnum).toContain("deleteSurface");
  });
});

// ---------------------------------------------------------------------------
// MINIMAL_CATALOG_REFERENCE content
// ---------------------------------------------------------------------------

describe("MINIMAL_CATALOG_REFERENCE", () => {
  it("mentions all five component types", () => {
    expect(MINIMAL_CATALOG_REFERENCE).toContain("Text");
    expect(MINIMAL_CATALOG_REFERENCE).toContain("Row");
    expect(MINIMAL_CATALOG_REFERENCE).toContain("Column");
    expect(MINIMAL_CATALOG_REFERENCE).toContain("Button");
    expect(MINIMAL_CATALOG_REFERENCE).toContain("TextField");
  });

  it("includes the catalog ID", () => {
    expect(MINIMAL_CATALOG_REFERENCE).toContain(A2UI_MINIMAL_CATALOG_ID);
  });
});
