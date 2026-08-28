import { isNavigationSuppressed } from "./isNavigationSuppressed.js";

describe("isNavigationSuppressed", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("returns false when no element or event suppresses navigation", () => {
    const btn = document.createElement("button");
    container.appendChild(btn);
    expect(isNavigationSuppressed(null, btn)).toBe(false);
  });

  it("returns true when target element is an input, textarea, select, option, or iframe", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const option = document.createElement("option");
    const iframe = document.createElement("iframe");

    container.append(input, textarea, select, option, iframe);

    expect(isNavigationSuppressed(null, input)).toBe(true);
    expect(isNavigationSuppressed(null, textarea)).toBe(true);
    expect(isNavigationSuppressed(null, select)).toBe(true);
    expect(isNavigationSuppressed(null, option)).toBe(true);
    expect(isNavigationSuppressed(null, iframe)).toBe(true);
  });

  it("returns true when element is contentEditable or has pages__preview-frame class", () => {
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    const frame = document.createElement("div");
    frame.className = "pages__preview-frame";

    container.append(editable, frame);

    expect(isNavigationSuppressed(null, editable)).toBe(true);
    expect(isNavigationSuppressed(null, frame)).toBe(true);
  });

  it("returns true when element is inside a container with navigation suppression attributes", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-no-swipe", "true");
    const child = document.createElement("span");
    parent.appendChild(child);
    container.appendChild(parent);

    expect(isNavigationSuppressed(null, child)).toBe(true);
  });

  it("returns true when event composedPath contains an isolated node", () => {
    const parent = document.createElement("div");
    parent.setAttribute("data-game-controls", "true");
    const child = document.createElement("button");
    parent.appendChild(child);
    container.appendChild(parent);

    const event = new MouseEvent("click", { bubbles: true });
    child.dispatchEvent(event);

    expect(isNavigationSuppressed(event)).toBe(true);
  });
});
