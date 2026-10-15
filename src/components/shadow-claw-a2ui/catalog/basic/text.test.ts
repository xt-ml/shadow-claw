import { describe, expect, it } from "@jest/globals";
import { renderText } from "./text.js";

describe("renderText", () => {
  it("renders text with default variant", () => {
    const spec = {
      type: "text" as const,
      text: "Hello World",
    };
    const surface = { dataModel: {} } as any;

    const el = renderText(spec as any, surface);
    expect(el.tagName).toBe("SPAN");
    expect(el.className).toBe("a2ui__text a2ui__text--body");
    expect(el.textContent).toBe("Hello World");
  });

  it("renders text with custom variant and weight", () => {
    const spec = {
      type: "text" as const,
      variant: "h1" as const,
      text: "Heading Text",
      weight: 1,
    };
    const surface = { dataModel: {} } as any;

    const el = renderText(spec as any, surface);
    expect(el.tagName).toBe("H1");
    expect(el.className).toBe("a2ui__text a2ui__text--h1");
    expect(el.textContent).toBe("Heading Text");
  });
});
