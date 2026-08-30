import { applyWeight, renderChildrenList, variantToTag } from "./shared.js";

describe("catalog/basic/shared", () => {
  describe("variantToTag", () => {
    it("maps header variants to appropriate tags", () => {
      expect(variantToTag("h1")).toBe("h1");
      expect(variantToTag("h2")).toBe("h2");
      expect(variantToTag("h3")).toBe("h3");
      expect(variantToTag("h4")).toBe("h4");
      expect(variantToTag("h5")).toBe("h5");
      expect(variantToTag("body" as any)).toBe("span");
      expect(variantToTag("caption" as any)).toBe("span");
    });
  });

  describe("applyWeight", () => {
    it("applies flexGrow when weight is defined", () => {
      const el = document.createElement("div");
      applyWeight(el, 2);
      expect(el.style.flexGrow).toBe("2");
    });

    it("does nothing when weight is undefined", () => {
      const el = document.createElement("div");
      applyWeight(el, undefined);
      expect(el.style.flexGrow).toBe("");
    });
  });

  describe("renderChildrenList", () => {
    it("renders array of component IDs", () => {
      const rendered: HTMLElement[] = [];
      const ctx = {
        renderComponent: (id: string) => {
          const div = document.createElement("div");
          div.id = id;
          return div;
        },
      };

      renderChildrenList(
        ["comp-1", "comp-2"],
        { dataModel: {} } as any,
        ctx,
        (el) => rendered.push(el),
      );

      expect(rendered).toHaveLength(2);
      expect(rendered[0].id).toBe("comp-1");
      expect(rendered[1].id).toBe("comp-2");
    });

    it("renders array of objects with id property", () => {
      const rendered: HTMLElement[] = [];
      const ctx = {
        renderComponent: (id: string) => {
          const div = document.createElement("div");
          div.id = id;
          return div;
        },
      };

      renderChildrenList(
        [{ id: "item-a" }, { id: "item-b" }] as any,
        { dataModel: {} } as any,
        ctx,
        (el) => rendered.push(el),
      );

      expect(rendered).toHaveLength(2);
      expect(rendered[0].id).toBe("item-a");
    });

    it("renders template bound to dataModel array", () => {
      const rendered: HTMLElement[] = [];
      const surface = {
        dataModel: {
          tasks: ["Task 1", "Task 2"],
        },
      };
      const ctx = {
        renderComponent: (id: string, scope?: any) => {
          const div = document.createElement("div");
          div.id = `${id}-${scope?.index}`;
          div.textContent = String(scope?.itemValue);
          return div;
        },
      };

      renderChildrenList(
        { path: "/tasks", componentId: "task-item" },
        surface as any,
        ctx,
        (el) => rendered.push(el),
      );

      expect(rendered).toHaveLength(2);
      expect(rendered[0].textContent).toBe("Task 1");
      expect(rendered[1].textContent).toBe("Task 2");
    });

    it("handles non-array template target gracefully", () => {
      const rendered: HTMLElement[] = [];
      const surface = { dataModel: { count: 42 } };
      const ctx = { renderComponent: () => document.createElement("div") };

      renderChildrenList(
        { path: "/count", componentId: "item" },
        surface as any,
        ctx,
        (el) => rendered.push(el),
      );

      expect(rendered).toHaveLength(0);
    });
  });
});
