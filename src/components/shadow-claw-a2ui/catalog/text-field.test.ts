import { jest } from "@jest/globals";
import { renderTextField } from "./text-field.js";
import type { TextFieldSpec } from "../../../ui/a2ui.js";

describe("renderTextField", () => {
  it("renders a standard text input by default", () => {
    const spec: TextFieldSpec = {
      id: "test-field",
      component: "TextField",
      label: "Name",
      value: "John",
    };

    const ctx = {
      updateDataModelKey: jest.fn(),
    } as any;

    const el = renderTextField(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      ctx,
    );

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("a2ui__field");

    const label = el.querySelector("label");
    expect(label?.textContent).toBe("Name");

    const input = el.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.type).toBe("text");
    expect(input?.value).toBe("John");
  });

  it("renders a textarea for longText variant", () => {
    const spec: TextFieldSpec = {
      id: "test-field",
      component: "TextField",
      label: "Notes",
      variant: "longText",
    } as any;

    const el = renderTextField(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      {} as any,
    );

    const textarea = el.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.rows).toBe(3);
  });

  it("renders a number input for number variant", () => {
    const spec: TextFieldSpec = {
      id: "test-field",
      component: "TextField",
      label: "Age",
      variant: "number",
    } as any;

    const el = renderTextField(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      {} as any,
    );
    const input = el.querySelector("input");
    expect(input?.type).toBe("number");
  });

  it("renders a password input for obscured variant", () => {
    const spec: TextFieldSpec = {
      id: "test-field",
      component: "TextField",
      label: "Secret",
      variant: "obscured",
    } as any;

    const el = renderTextField(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      {} as any,
    );
    const input = el.querySelector("input");
    expect(input?.type).toBe("password");
  });

  it("updates data model on input", () => {
    const spec: TextFieldSpec = {
      id: "test-field",
      component: "TextField",
      label: "Name",
    };

    const ctx = {
      updateDataModelKey: jest.fn(),
    } as any;

    const el = renderTextField(
      spec,
      { surfaceId: "s1", dataModel: {} } as any,
      ctx,
    );
    const input = el.querySelector("input")!;

    input.value = "Jane";
    input.dispatchEvent(new Event("input"));

    expect(ctx.updateDataModelKey).toHaveBeenCalledWith(spec, "Jane");
  });
});
