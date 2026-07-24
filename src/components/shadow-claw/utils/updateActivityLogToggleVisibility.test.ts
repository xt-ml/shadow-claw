import { updateActivityLogToggleVisibility } from "./updateActivityLogToggleVisibility.js";

describe("updateActivityLogToggleVisibility", () => {
  let shadowRoot: ShadowRoot;
  let button: HTMLButtonElement;

  beforeEach(() => {
    shadowRoot = document.createElement("div").attachShadow({ mode: "open" });
    button = document.createElement("button");
    button.className = "activity-log-toggle";
    shadowRoot.appendChild(button);
  });

  it("should return early if shadowRoot is null", () => {
    // Should not throw
    updateActivityLogToggleVisibility(null, "chat", 1);
  });

  it("should return early if button is missing", () => {
    shadowRoot.innerHTML = "";
    // Should not throw
    updateActivityLogToggleVisibility(shadowRoot, "chat", 1);
  });

  it("should return early if element is not a button", () => {
    shadowRoot.innerHTML = "";
    const div = document.createElement("div");
    div.className = "activity-log-toggle";
    shadowRoot.appendChild(div);
    // Should not throw
    updateActivityLogToggleVisibility(shadowRoot, "chat", 1);
  });

  it("should show button if on chat page and log length > 0", () => {
    button.hidden = true;
    updateActivityLogToggleVisibility(shadowRoot, "chat", 1);
    expect(button.hidden).toBe(false);
  });

  it("should hide button if not on chat page", () => {
    button.hidden = false;
    updateActivityLogToggleVisibility(shadowRoot, "files", 1);
    expect(button.hidden).toBe(true);
  });

  it("should hide button if log length is 0", () => {
    button.hidden = false;
    updateActivityLogToggleVisibility(shadowRoot, "chat", 0);
    expect(button.hidden).toBe(true);
  });
});
