import { jest } from "@jest/globals";
import {
  resolveWorkbenchFullscreenState,
  setupWorkbenchFullscreen,
} from "./workbench-fullscreen.js";

describe("workbench-fullscreen", () => {
  it("resolveWorkbenchFullscreenState builds accessible button and host state", () => {
    expect(
      resolveWorkbenchFullscreenState(false, { studioName: "DAW" }),
    ).toEqual({
      isFullscreen: false,
      ariaLabel: "Enter full screen mode",
      ariaPressed: "false",
      title: "Full screen mode (hide app navigation and focus on DAW)",
      btnText: "Full Screen",
      btnIcon: "⛶",
      hostClass: "sc-workbench--fullscreen",
      active: false,
    });

    expect(
      resolveWorkbenchFullscreenState(true, { studioName: "DAW" }),
    ).toEqual({
      isFullscreen: true,
      ariaLabel: "Exit full screen mode",
      ariaPressed: "true",
      title: "Exit full screen mode (restore app navigation)",
      btnText: "Exit Full Screen",
      btnIcon: "✕",
      hostClass: "sc-workbench--fullscreen",
      active: true,
    });
  });

  it("toggles fullscreen via button click, updates ARIA/classes, crosses ShadowRoot to clear/restore ancestor .page transform, and handles Escape & dispose", () => {
    const outerPage = document.createElement("div");
    outerPage.className = "page";
    outerPage.style.setProperty("transform", "translateX(0px)", "important");

    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });

    const pageEl = document.createElement("div");
    const workbenchEl = document.createElement("div");
    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.innerHTML = `<span class="fs-icon"></span><span class="fs-label"></span>`;

    workbenchEl.appendChild(fullscreenBtn);
    pageEl.appendChild(workbenchEl);
    shadow.appendChild(pageEl);
    outerPage.appendChild(host);
    document.body.appendChild(outerPage);

    let docFullscreenEl: Element | null = null;
    (pageEl as any).requestFullscreen = jest.fn(() => {
      docFullscreenEl = pageEl;
      return Promise.resolve();
    });
    const exitFullscreenMock = jest.fn(() => {
      docFullscreenEl = null;
      return Promise.resolve();
    });
    const fakeDoc = {
      get fullscreenElement() {
        return docFullscreenEl;
      },
      exitFullscreen: exitFullscreenMock,
      addEventListener: document.addEventListener.bind(document),
      removeEventListener: document.removeEventListener.bind(document),
    };

    const changes: boolean[] = [];
    const controller = setupWorkbenchFullscreen({
      workbenchEl,
      fullscreenBtn,
      pageEl,
      studioName: "Vector Studio",
      workbenchClass: "scdraw-workbench--fullscreen",
      pageClass: "scdraw-workbench-page--fullscreen",
      activeBtnClass: "scdraw-btn--active",
      labelSelector: ".fs-label",
      iconSelector: ".fs-icon",
      windowObj: window,
      documentObj: fakeDoc as unknown as Document,
      onStateChange: (active) => changes.push(active),
    });

    expect(controller.isFullscreen()).toBe(false);
    expect(fullscreenBtn.getAttribute("aria-pressed")).toBe("false");
    expect(changes).toEqual([false]);

    // Click enters fullscreen
    fullscreenBtn.click();
    expect(controller.isFullscreen()).toBe(true);
    expect(workbenchEl.classList.contains("scdraw-workbench--fullscreen")).toBe(
      true,
    );
    expect(pageEl.classList.contains("scdraw-workbench-page--fullscreen")).toBe(
      true,
    );
    expect(fullscreenBtn.classList.contains("scdraw-btn--active")).toBe(true);
    expect(fullscreenBtn.getAttribute("aria-pressed")).toBe("true");
    expect(fullscreenBtn.querySelector(".fs-label")?.textContent).toBe(
      "Exit Full Screen",
    );
    expect(fullscreenBtn.querySelector(".fs-icon")?.textContent).toBe("✕");
    expect(outerPage.style.getPropertyValue("transform")).toBe("none");
    expect(outerPage.style.getPropertyPriority("transform")).toBe("important");
    expect((pageEl as any).requestFullscreen).toHaveBeenCalledTimes(1);

    // Prevented Escape does nothing
    const preventedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    preventedEscape.preventDefault();
    window.dispatchEvent(preventedEscape);
    expect(controller.isFullscreen()).toBe(true);

    // Non-prevented Escape exits fullscreen & restores outerPage transform
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    expect(controller.isFullscreen()).toBe(false);
    expect(outerPage.style.getPropertyValue("transform")).toBe(
      "translateX(0px)",
    );
    expect(outerPage.style.getPropertyPriority("transform")).toBe("important");
    expect(exitFullscreenMock).toHaveBeenCalledTimes(1);

    // Re-enter via setState, then sync exit via fullscreenchange
    controller.setState(true);
    expect(controller.isFullscreen()).toBe(true);
    docFullscreenEl = null;
    document.dispatchEvent(new Event("fullscreenchange"));
    expect(controller.isFullscreen()).toBe(false);

    // Dispose while active cleans up classes, transform, and listeners
    controller.setState(true);
    controller.dispose();
    expect(controller.isFullscreen()).toBe(false);
    expect(workbenchEl.classList.contains("scdraw-workbench--fullscreen")).toBe(
      false,
    );
    expect(outerPage.style.getPropertyValue("transform")).toBe(
      "translateX(0px)",
    );

    // Click after dispose is a no-op
    fullscreenBtn.click();
    expect(controller.isFullscreen()).toBe(false);

    outerPage.remove();
  });

  it("works in pure Node without window or document objects", () => {
    const controller = setupWorkbenchFullscreen({
      windowObj: null,
      documentObj: null,
    });
    expect(controller.isFullscreen()).toBe(false);
    controller.toggle(true);
    expect(controller.isFullscreen()).toBe(true);
    controller.dispose();
    expect(controller.isFullscreen()).toBe(false);
  });
});
