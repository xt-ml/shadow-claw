import { ShadowClawDialog } from "./shadow-claw-dialog.js";

describe("shadow-claw-dialog", () => {
  it("wraps its light DOM children in a native dialog", () => {
    const el = new ShadowClawDialog();
    el.setAttribute("dialog-class", "test-dialog");
    el.setAttribute("aria-label", "Example dialog");
    el.innerHTML = '<div class="content">Hello</div>';

    document.body.appendChild(el);

    const dialog = el.querySelector("dialog.test-dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.getAttribute("aria-label")).toBe("Example dialog");
    expect(dialog?.querySelector(".content")?.textContent).toBe("Hello");

    document.body.removeChild(el);
  });

  it("clones nested template content into the native dialog", () => {
    const el = new ShadowClawDialog();
    el.setAttribute("dialog-class", "template-dialog");
    el.innerHTML =
      '<template><div class="content">From template</div></template>';

    document.body.appendChild(el);

    const dialog = el.querySelector("dialog.template-dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog?.querySelector(".content")?.textContent).toBe(
      "From template",
    );

    document.body.removeChild(el);
  });
});
