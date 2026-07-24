import { jest } from "@jest/globals";
import { renderSlider } from "./slider.js";
import type { SliderSpec } from "../../../ui/a2ui.js";

describe("renderSlider", () => {
  it("renders a basic slider with min, max, and steps", () => {
    const spec: SliderSpec = {
      id: "test-slider",
      component: "Slider",
      min: 10,
      max: 50,
      steps: 5,
      value: 20,
    };

    const ctx = {
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderSlider(spec, { dataModel: {} } as any, ctx);

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__slider");

    const input = el.querySelector("input");
    expect(input?.type).toBe("range");
    expect(input?.min).toBe("10");
    expect(input?.max).toBe("50");
    expect(input?.step).toBe("5");
    expect(input?.value).toBe("20");
  });

  it("updates data model on input change", () => {
    const spec: SliderSpec = {
      id: "test-slider",
      component: "Slider",
      max: 100,
      value: { $dataModel: "/sliderVal" },
    };

    const ctx = {
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderSlider(spec, { dataModel: { sliderVal: 75 } } as any, ctx);
    const input = el.querySelector("input")!;
    expect(input.value).toBe("75");

    input.value = "85";
    input.dispatchEvent(new Event("input"));

    expect(ctx.updateDataModelPointer).toHaveBeenCalledWith("/sliderVal", 85);
  });
});
