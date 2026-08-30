import { jest } from "@jest/globals";
import { A2UI_BASIC_CATALOG_ID } from "../../../ui/a2ui/types.js";

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: jest.fn(),
}));

const { post } = await import("../../utils/post.js");
const { executeRenderComponent } = await import("./render-component.js");

describe("executeRenderComponent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error when surfaceId is missing or not a string", () => {
    const res1 = executeRenderComponent({ action: "createSurface" }, "g1");
    expect(res1).toBe("Error: render_component requires a surfaceId string.");

    const res2 = executeRenderComponent(
      { action: "createSurface", surfaceId: 123 },
      "g1",
    );
    expect(res2).toBe("Error: render_component requires a surfaceId string.");
  });

  it("returns error on unknown action", () => {
    const res = executeRenderComponent(
      { surfaceId: "s1", action: "invalidAction" },
      "g1",
    );
    expect(res).toContain("Error: Unknown render_component action");
  });

  describe("createSurface", () => {
    it("returns error if components is missing", () => {
      const res = executeRenderComponent(
        { surfaceId: "s1", action: "createSurface" },
        "g1",
      );
      expect(res).toBe(
        "Error: createSurface requires a components array (or legacy map).",
      );
    });

    it("returns error if components is primitive or null", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "createSurface",
          components: 123 as any,
        },
        "g1",
      );
      expect(res).toContain(
        'Error: createSurface requires a component with id "root".',
      );
    });

    it("returns error if no component with id root exists", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "createSurface",
          components: [{ id: "btn", component: "Button" }],
        },
        "g1",
      );
      expect(res).toContain(
        'Error: createSurface requires a component with id "root".',
      );
    });

    it("successfully posts createSurface with array components and flattens properties", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "createSurface",
          components: [
            { id: "root", component: "Column", properties: { spacing: "md" } },
            { id: "btn", component: "Button", text: "Click" },
          ],
          dataModel: { count: 0 },
          sendDataModel: true,
          surfaceProperties: { theme: "dark" },
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: createSurface).');
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "createSurface",
            surfaceId: "s1",
            catalogId: A2UI_BASIC_CATALOG_ID,
            components: [
              { id: "root", component: "Column", spacing: "md" },
              { id: "btn", component: "Button", text: "Click" },
            ],
            dataModel: { count: 0 },
            sendDataModel: true,
            surfaceProperties: { theme: "dark" },
          },
        },
      });
    });

    it("successfully converts legacy map format to components array", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "createSurface",
          components: {
            root: { component: "Column", properties: { padding: 4 } },
            item1: { component: "Text", properties: { text: "Hello" } },
          },
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: createSurface).');
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "createSurface",
            surfaceId: "s1",
            catalogId: A2UI_BASIC_CATALOG_ID,
            components: [
              { id: "root", component: "Column", padding: 4 },
              { id: "item1", component: "Text", text: "Hello" },
            ],
            dataModel: undefined,
            sendDataModel: undefined,
            surfaceProperties: undefined,
          },
        },
      });
    });
  });

  describe("updateComponents", () => {
    it("returns error if components is missing", () => {
      const res = executeRenderComponent(
        { surfaceId: "s1", action: "updateComponents" },
        "g1",
      );
      expect(res).toBe(
        "Error: updateComponents requires a components array (or legacy map).",
      );
    });

    it("successfully posts updateComponents envelope", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "updateComponents",
          components: [
            {
              id: "btn",
              component: "Button",
              properties: { label: "Updated" },
            },
          ],
        },
        "group-123",
      );

      expect(res).toBe(
        'A2UI surface "s1" rendered (action: updateComponents).',
      );
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateComponents",
            surfaceId: "s1",
            components: [{ id: "btn", component: "Button", label: "Updated" }],
          },
        },
      });
    });
  });

  describe("updateDataModel", () => {
    it("handles spec-compliant path and value", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "updateDataModel",
          path: "/user/name",
          value: "Alice",
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: updateDataModel).');
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateDataModel",
            surfaceId: "s1",
            path: "/user/name",
            value: "Alice",
          },
        },
      });
    });

    it("handles deprecated patches map with single key", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "updateDataModel",
          patches: {
            "/user/age": 30,
          },
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: updateDataModel).');
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateDataModel",
            surfaceId: "s1",
            path: "/user/age",
            value: 30,
          },
        },
      });
    });

    it("handles deprecated patches map with multiple keys posting separate envelopes", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "updateDataModel",
          patches: {
            "/user/k1": "v1",
            "/user/k2": "v2",
            "/user/k3": "v3",
          },
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: updateDataModel).');
      // Total 3 post calls (2 in loop, 1 final)
      expect(post).toHaveBeenCalledTimes(3);
      expect(post).toHaveBeenNthCalledWith(1, {
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateDataModel",
            surfaceId: "s1",
            path: "/user/k2",
            value: "v2",
          },
        },
      });
      expect(post).toHaveBeenNthCalledWith(2, {
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateDataModel",
            surfaceId: "s1",
            path: "/user/k3",
            value: "v3",
          },
        },
      });
      expect(post).toHaveBeenNthCalledWith(3, {
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "updateDataModel",
            surfaceId: "s1",
            path: "/user/k1",
            value: "v1",
          },
        },
      });
    });

    it("returns error on empty patches object", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "updateDataModel",
          patches: {},
        },
        "group-123",
      );

      expect(res).toBe("Error: updateDataModel patches object is empty.");
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe("deleteSurface", () => {
    it("successfully posts deleteSurface envelope", () => {
      const res = executeRenderComponent(
        {
          surfaceId: "s1",
          action: "deleteSurface",
        },
        "group-123",
      );

      expect(res).toBe('A2UI surface "s1" rendered (action: deleteSurface).');
      expect(post).toHaveBeenCalledWith({
        type: "render-component",
        payload: {
          groupId: "group-123",
          envelope: {
            version: "v1.0",
            type: "deleteSurface",
            surfaceId: "s1",
          },
        },
      });
    });
  });
});
