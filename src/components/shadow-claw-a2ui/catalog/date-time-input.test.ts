import { jest } from "@jest/globals";
import { renderDateTimeInput } from "./date-time-input.js";
import type { DateTimeInputSpec } from "../../../ui/a2ui.js";

describe("renderDateTimeInput", () => {
  it("renders datetime-local when both enableDate and enableTime are true", () => {
    const spec: DateTimeInputSpec = {
      id: "test-dt",
      component: "DateTimeInput",
      enableDate: true,
      enableTime: true,
      value: "",
    };

    const el = renderDateTimeInput(spec, { dataModel: {} } as any, {} as any);
    const input = el.querySelector("input");
    expect(input?.type).toBe("datetime-local");
  });

  it("renders date when enableDate is true and enableTime is false", () => {
    const spec: DateTimeInputSpec = {
      id: "test-dt",
      component: "DateTimeInput",
      enableDate: true,
      enableTime: false,
      value: "",
    };

    const el = renderDateTimeInput(spec, { dataModel: {} } as any, {} as any);
    const input = el.querySelector("input");
    expect(input?.type).toBe("date");
  });

  it("renders time when enableTime is true and enableDate is false", () => {
    const spec: DateTimeInputSpec = {
      id: "test-dt",
      component: "DateTimeInput",
      enableDate: false,
      enableTime: true,
      value: "",
    };

    const el = renderDateTimeInput(spec, { dataModel: {} } as any, {} as any);
    const input = el.querySelector("input");
    expect(input?.type).toBe("time");
  });

  it("initializes with datamodel value and min/max limits", () => {
    const spec: DateTimeInputSpec = {
      id: "test-dt",
      component: "DateTimeInput",
      enableDate: true,
      value: { $dataModel: "/dateStr" },
      min: "2023-01-01",
      max: "2024-12-31",
    };

    const el = renderDateTimeInput(
      spec,
      { dataModel: { dateStr: "2023-05-15" } } as any,
      {} as any,
    );
    const input = el.querySelector("input")!;

    expect(input.value).toBe("2023-05-15");
    expect(input.min).toBe("2023-01-01");
    expect(input.max).toBe("2024-12-31");
  });

  it("updates data model on input", () => {
    const spec: DateTimeInputSpec = {
      id: "test-dt",
      component: "DateTimeInput",
      enableDate: true,
      value: { $dataModel: "/dateStr" },
    };

    const ctx = {
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderDateTimeInput(spec, { dataModel: {} } as any, ctx);
    const input = el.querySelector("input")!;

    input.value = "2024-01-01";
    input.dispatchEvent(new Event("input"));

    expect(ctx.updateDataModelPointer).toHaveBeenCalledWith(
      "/dateStr",
      "2024-01-01",
    );
  });
});
