import {
  availableCatalogs,
  list_components,
  render_component,
} from "../tools/a2ui.js";

import {
  A2UI_BASIC_CATALOG_ID,
  BASIC_CATALOG_REFERENCE,
} from "../../ui/a2ui/types.js";

// ---------------------------------------------------------------------------
// Catalog availability
// ---------------------------------------------------------------------------

describe("availableCatalogs", () => {
  it("exposes only the Basic catalog — Minimal was invented and removed", () => {
    expect(availableCatalogs.basic).toBe(A2UI_BASIC_CATALOG_ID);
    expect((availableCatalogs as any).minimal).toBeUndefined();
  });

  it("all array has exactly one entry", () => {
    expect(availableCatalogs.all).toHaveLength(1);
    expect(availableCatalogs.all[0]).toBe(A2UI_BASIC_CATALOG_ID);
  });
});

// ---------------------------------------------------------------------------
// list_components tool definition
// ---------------------------------------------------------------------------

describe("list_components tool definition", () => {
  it("has correct name", () => {
    expect(list_components.name).toBe("list_components");
  });

  it("has empty required array", () => {
    expect((list_components.input_schema as any).required).toEqual([]);
  });

  it("has a non-empty description mentioning Basic catalog", () => {
    expect(list_components.description.length).toBeGreaterThan(10);
    expect(list_components.description).toContain("Basic");
  });
});

// ---------------------------------------------------------------------------
// render_component tool definition
// ---------------------------------------------------------------------------

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

  it("components is typed as an array (not an object map)", () => {
    const componentsProp = (render_component.input_schema as any).properties
      .components;
    expect(componentsProp.type).toBe("array");
  });

  it("does not include rootComponentId (spec requires id:'root' in array)", () => {
    const props = (render_component.input_schema as any).properties;
    expect(props.rootComponentId).toBeUndefined();
  });

  it("exposes path and value for updateDataModel (not patches)", () => {
    const props = (render_component.input_schema as any).properties;
    expect(props.path).toBeDefined();
    expect(props.value).toBeDefined();
    expect(props.patches).toBeUndefined();
  });

  it("does not mention Minimal catalog in description", () => {
    expect(render_component.description.toLowerCase()).not.toContain("minimal");
  });
});

// ---------------------------------------------------------------------------
// BASIC_CATALOG_REFERENCE content
// ---------------------------------------------------------------------------

describe("BASIC_CATALOG_REFERENCE", () => {
  it("mentions all Basic component types", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain("Text");
    expect(BASIC_CATALOG_REFERENCE).toContain("Row");
    expect(BASIC_CATALOG_REFERENCE).toContain("Column");
    expect(BASIC_CATALOG_REFERENCE).toContain("Button");
    expect(BASIC_CATALOG_REFERENCE).toContain("TextField");
    expect(BASIC_CATALOG_REFERENCE).toContain("Image");
    expect(BASIC_CATALOG_REFERENCE).toContain("CheckBox");
  });

  it("includes the Basic catalog ID", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain(A2UI_BASIC_CATALOG_ID);
  });

  it("uses spec-canonical {path} binding syntax (not $dataModel)", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain('{"path":"/');
  });

  it("shows components as an array example (not a map)", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain('"id":"root"');
  });

  it("shows spec-compliant action syntax with event.name (not id)", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain('"event"');
    expect(BASIC_CATALOG_REFERENCE).toContain('"name"');
  });

  it("documents updateDataModel with path/value and does not use 'patches' terminology", () => {
    expect(BASIC_CATALOG_REFERENCE).toContain("path");
    expect(BASIC_CATALOG_REFERENCE).toContain("value");
    // The 'patches' map was a non-standard extension — must not appear in the reference.
    expect(BASIC_CATALOG_REFERENCE).not.toContain('"patches"');
    // The reference should describe path/value form clearly.
    expect(BASIC_CATALOG_REFERENCE).toContain("updateDataModel");
  });
});
