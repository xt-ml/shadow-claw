import { jest } from "@jest/globals";
import { renderCheckBox } from "./checkbox.js";
import type { CheckBoxSpec } from "../../../ui/a2ui.js";

describe("renderCheckBox", () => {
  it("renders a checkbox with boolean value", () => {
    const spec: CheckBoxSpec = {
      id: "test-checkbox",
      component: "CheckBox",
      label: "Agree",
      value: true,
    };

    const ctx = {
      dispatchAction: jest.fn(),
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderCheckBox(spec, { dataModel: {} } as any, ctx);

    expect(el.tagName).toBe("LABEL");
    expect(el.className).toBe("a2ui__checkbox");

    const input = el.querySelector("input");
    expect(input?.type).toBe("checkbox");
    expect(input?.checked).toBe(true);

    const span = el.querySelector(".a2ui__checkbox-label");
    expect(span?.textContent).toBe("Agree");
  });

  it("renders a checkbox with dataModel value", () => {
    const spec: CheckBoxSpec = {
      id: "test-checkbox",
      component: "CheckBox",
      label: "Agree",
      value: { $dataModel: "/agreed" },
    };

    const ctx = {
      dispatchAction: jest.fn(),
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderCheckBox(
      spec,
      { dataModel: { agreed: true } } as any,
      ctx,
    );
    const input = el.querySelector("input")!;
    expect(input.checked).toBe(true);

    // Test onChange
    input.checked = false;
    input.dispatchEvent(new Event("change"));

    expect(ctx.updateDataModelPointer).toHaveBeenCalledWith("/agreed", false);
  });

  it("dispatches action on change if defined", () => {
    const spec: CheckBoxSpec = {
      id: "test-checkbox",
      component: "CheckBox",
      label: "Agree",
      value: false,
      action: { id: "test-action" } as any,
    } as CheckBoxSpec;

    const ctx = {
      dispatchAction: jest.fn(),
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderCheckBox(spec, { dataModel: {} } as any, ctx);
    const input = el.querySelector("input")!;

    input.dispatchEvent(new Event("change"));

    expect(ctx.dispatchAction).toHaveBeenCalledWith("test-action");
  });
});
