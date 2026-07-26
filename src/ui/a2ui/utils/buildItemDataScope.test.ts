import { buildItemDataScope } from "./buildItemDataScope.js";

describe("buildItemDataScope", () => {
  it("injects @index and @item into a copy of the data model", () => {
    const base = { name: "Alice" };
    const scope = buildItemDataScope(base, { id: 1, label: "First" }, 0);
    expect(scope["@index"]).toBe(0);
    expect(scope["@item"]).toEqual({ id: 1, label: "First" });
    expect(scope["name"]).toBe("Alice");
  });

  it("does not mutate the original data model", () => {
    const base = { x: 1 };
    buildItemDataScope(base, "item", 2);
    expect((base as any)["@index"]).toBeUndefined();
  });

  it("spreads object item properties into the scope for legacy compatibility", () => {
    const base = { name: "Alice" };
    const scope = buildItemDataScope(base, { id: 1, label: "First" }, 0);
    expect(scope["id"]).toBe(1);
    expect(scope["label"]).toBe("First");
  });
});
