import { renderIcon } from "./icon.js";
import type { IconSpec } from "../../../ui/a2ui.js";

describe("renderIcon", () => {
  it("renders a string icon using textContent", () => {
    const spec: IconSpec = {
      id: "test-icon",
      component: "Icon",
      name: "home",
    };

    const el = renderIcon(spec, {} as any);

    expect(el.tagName).toBe("SPAN");
    expect(el.className).toBe("a2ui__icon material-symbols-outlined");
    expect(el.dataset.iconName).toBe("home");
    expect(el.textContent).toBe("home");
  });

  it("renders an image icon if name is an object with a path", () => {
    const spec: IconSpec = {
      id: "test-icon",
      component: "Icon",
      name: { path: "https://example.com/icon.png" },
    };

    const el = renderIcon(spec, {} as any);

    expect(el.tagName).toBe("SPAN");
    const img = el.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.src).toBe("https://example.com/icon.png");
  });

  it("applies weight correctly", () => {
    const spec: IconSpec = {
      id: "test-icon",
      component: "Icon",
      name: "settings",
      weight: 3,
    };

    const el = renderIcon(spec, {} as any);
    expect(el.style.flexGrow).toBe("3");
  });
});
