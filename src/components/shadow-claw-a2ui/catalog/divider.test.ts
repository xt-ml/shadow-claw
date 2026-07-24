import { renderDivider } from "./divider.js";
import type { DividerSpec } from "../../../ui/a2ui.js";

describe("renderDivider", () => {
  it("renders a horizontal divider by default", () => {
    const spec: DividerSpec = {
      id: "test-div",
      component: "Divider",
      weight: 1,
    };

    const el = renderDivider(spec, {} as any);

    expect(el.tagName).toBe("HR");
    expect(el.className).toBe("a2ui__divider a2ui__divider--horizontal");
    expect(el.style.flexGrow).toBe("1");
  });

  it("renders a vertical divider when specified", () => {
    const spec: DividerSpec = {
      id: "test-div-2",
      component: "Divider",
      axis: "vertical",
    };

    const el = renderDivider(spec, {} as any);

    expect(el.tagName).toBe("HR");
    expect(el.className).toBe("a2ui__divider a2ui__divider--vertical");
    expect(el.style.flexGrow).toBe("");
  });
});
