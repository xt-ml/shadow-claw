import { jest } from "@jest/globals";
import { renderChoicePicker } from "./choice-picker.js";
import type { ChoicePickerSpec } from "../../../ui/a2ui.js";

describe("renderChoicePicker", () => {
  it("renders a single selection (radio) choice picker", () => {
    const spec: ChoicePickerSpec = {
      id: "test-picker",
      component: "ChoicePicker",
      variant: "mutuallyExclusive",
      options: [
        { label: "Option 1", value: "opt1" },
        { label: "Option 2", value: "opt2" },
      ],
      value: { $dataModel: "/choice" },
    };

    const ctx = {
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderChoicePicker(
      spec,
      { surfaceId: "s1", dataModel: { choice: "opt2" } } as any,
      ctx,
    );

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__choicepicker");

    const inputs = el.querySelectorAll("input");
    expect(inputs.length).toBe(2);
    expect(inputs[0].type).toBe("radio");
    expect(inputs[1].type).toBe("radio");

    expect(inputs[0].checked).toBe(false);
    expect(inputs[1].checked).toBe(true);

    inputs[0].checked = true;
    inputs[1].checked = false;
    inputs[0].dispatchEvent(new Event("change"));

    expect(ctx.updateDataModelPointer).toHaveBeenCalledWith("/choice", "opt1");
  });

  it("renders a multiple selection (checkbox) choice picker", () => {
    const spec: ChoicePickerSpec = {
      id: "test-picker",
      component: "ChoicePicker",
      variant: "multipleSelection",
      options: [
        { label: "Option A", value: "A" },
        { label: "Option B", value: "B" },
      ],
      value: { $dataModel: "/choices" },
    };

    const ctx = {
      updateDataModelPointer: jest.fn(),
    } as any;

    const el = renderChoicePicker(
      spec,
      { surfaceId: "s1", dataModel: { choices: ["A"] } } as any,
      ctx,
    );

    const inputs = el.querySelectorAll("input");
    expect(inputs.length).toBe(2);
    expect(inputs[0].type).toBe("checkbox");
    expect(inputs[1].type).toBe("checkbox");

    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);

    inputs[1].checked = true;
    inputs[1].dispatchEvent(new Event("change"));

    expect(ctx.updateDataModelPointer).toHaveBeenCalledWith("/choices", [
      "A",
      "B",
    ]);
  });

  it("handles primitive options arrays", () => {
    const spec: ChoicePickerSpec = {
      id: "test-picker",
      component: "ChoicePicker",
      options: ["Apple", "Banana"] as any,
      value: { $dataModel: "/choice" },
    };

    const el = renderChoicePicker(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      {} as any,
    );
    const inputs = el.querySelectorAll("input");
    expect(inputs.length).toBe(2);
    expect(inputs[0].value).toBe("Apple");
    expect(inputs[1].value).toBe("Banana");
  });
});
