export interface WorkbenchFullscreenStateOptions {
  studioName?: string;
  hostClass?: string;
}

export interface WorkbenchFullscreenState {
  isFullscreen: boolean;
  active: boolean;
  ariaLabel: string;
  ariaPressed: "true" | "false";
  title: string;
  btnText: string;
  btnIcon: string;
  hostClass: string;
}

/**
 * Resolves fullscreen state and accessible UI attributes for a workbench button and host.
 */
export function resolveWorkbenchFullscreenState(
  isFullscreen: boolean,
  options: WorkbenchFullscreenStateOptions = {},
): WorkbenchFullscreenState {
  const active = Boolean(isFullscreen);
  const studioName = options.studioName || "studio";
  const hostClass = options.hostClass || "sc-workbench--fullscreen";

  return {
    isFullscreen: active,
    active,
    ariaLabel: active ? "Exit full screen mode" : "Enter full screen mode",
    ariaPressed: active ? "true" : "false",
    title: active
      ? "Exit full screen mode (restore app navigation)"
      : `Full screen mode (hide app navigation and focus on ${studioName})`,
    btnText: active ? "Exit Full Screen" : "Full Screen",
    btnIcon: active ? "✕" : "⛶",
    hostClass,
  };
}

export interface SetupWorkbenchFullscreenOptions {
  workbenchEl?: HTMLElement | null;
  fullscreenBtn?: HTMLElement | null;
  pageEl?: HTMLElement | null;
  studioName?: string;
  workbenchClass?: string;
  pageClass?: string;
  activeBtnClass?: string;
  labelSelector?: string;
  iconSelector?: string;
  enterIconSelector?: string;
  windowObj?: Window | null;
  documentObj?: Document | null;
  onStateChange?: (active: boolean) => void;
}

export interface WorkbenchFullscreenController {
  toggle: (force?: boolean) => void;
  setState: (force: boolean) => void;
  isFullscreen: () => boolean;
  dispose: () => void;
}

function getDocumentFullscreenElement(doc: any): Element | null {
  return doc?.fullscreenElement || doc?.webkitFullscreenElement || null;
}

function requestElementFullscreen(target: any): void {
  const req = target?.requestFullscreen || target?.webkitRequestFullscreen;
  if (typeof req === "function") {
    try {
      const p = req.call(target);
      p?.catch?.(() => {});
    } catch {}
  }
}

function exitDocumentFullscreen(doc: any): void {
  const exit = doc?.exitFullscreen || doc?.webkitExitFullscreen;
  if (typeof exit === "function") {
    try {
      const p = exit.call(doc);
      p?.catch?.(() => {});
    } catch {}
  }
}

/**
 * Toggles fullscreen mode for a studio workbench and host page container.
 * Uses the Fullscreen API when supported and synchronizes CSS fixed-overlay
 * fullscreen classes, ARIA attributes, Escape ordering, ancestor `.page` transforms
 * across ShadowRoot boundaries, and fullscreenchange events.
 */
export function setupWorkbenchFullscreen(
  options: SetupWorkbenchFullscreenOptions = {},
): WorkbenchFullscreenController {
  const {
    workbenchEl,
    fullscreenBtn,
    pageEl,
    studioName = "studio",
    workbenchClass = "sc-workbench--fullscreen",
    pageClass = "sc-workbench-page--fullscreen",
    activeBtnClass = "sc-btn--active",
    labelSelector = ".sc-fullscreen-label",
    iconSelector = ".sc-fullscreen-icon",
    enterIconSelector = ".sc-fullscreen-icon--enter",
    windowObj = typeof window !== "undefined" ? window : null,
    documentObj = typeof document !== "undefined" ? document : null,
    onStateChange,
  } = options;

  let isFullscreen = false;
  let hostPageEl: HTMLElement | null = null;
  let savedHostTransform: { value: string; priority: string } | null = null;

  const findHostPageContainer = (
    startEl?: HTMLElement | null,
  ): HTMLElement | null => {
    let cur: any = startEl;
    for (let i = 0; i < 12 && cur; i++) {
      if (
        cur !== workbenchEl &&
        cur !== pageEl &&
        cur.classList?.contains?.("page")
      ) {
        return cur as HTMLElement;
      }
      if (cur.parentElement) {
        cur = cur.parentElement;
      } else {
        const root =
          typeof cur.getRootNode === "function" ? cur.getRootNode() : null;
        if (!root || root === cur) {
          cur = null;
        } else if (typeof ShadowRoot !== "undefined") {
          cur = root instanceof ShadowRoot ? root.host : null;
        } else {
          cur = root.host || null;
        }
      }
    }
    return null;
  };

  const applyHostPageTransform = (active: boolean): void => {
    if (active) {
      hostPageEl = findHostPageContainer(pageEl || workbenchEl);
      if (hostPageEl?.style && savedHostTransform === null) {
        savedHostTransform = {
          value: hostPageEl.style.getPropertyValue?.("transform") || "",
          priority: hostPageEl.style.getPropertyPriority?.("transform") || "",
        };
        hostPageEl.style.setProperty?.("transform", "none", "important");
      }
    } else if (hostPageEl?.style && savedHostTransform !== null) {
      if (savedHostTransform.value) {
        hostPageEl.style.setProperty?.(
          "transform",
          savedHostTransform.value,
          savedHostTransform.priority,
        );
      } else {
        hostPageEl.style.removeProperty?.("transform");
      }
      savedHostTransform = null;
      hostPageEl = null;
    }
  };

  const updateUI = (): void => {
    const state = resolveWorkbenchFullscreenState(isFullscreen, {
      studioName,
      hostClass: workbenchClass,
    });

    workbenchEl?.classList?.toggle(workbenchClass, isFullscreen);
    pageEl?.classList?.toggle(pageClass, isFullscreen);
    applyHostPageTransform(isFullscreen);

    if (fullscreenBtn) {
      fullscreenBtn.setAttribute?.("aria-pressed", state.ariaPressed);
      fullscreenBtn.setAttribute?.("aria-label", state.ariaLabel);
      fullscreenBtn.title = state.title;
      fullscreenBtn.classList?.toggle(activeBtnClass, state.isFullscreen);

      const labelEl = fullscreenBtn.querySelector?.(labelSelector);
      if (labelEl) {
        labelEl.textContent = state.btnText;
      }

      const hasEnterIcon = Boolean(
        fullscreenBtn.querySelector?.(enterIconSelector),
      );
      if (!hasEnterIcon) {
        const iconEl = fullscreenBtn.querySelector?.(iconSelector);
        if (iconEl) {
          iconEl.textContent = state.btnIcon;
        }
      }
    }

    if (typeof onStateChange === "function") {
      onStateChange(isFullscreen);
    }
  };

  const setState = (nextActive: boolean): void => {
    const active = Boolean(nextActive);
    if (isFullscreen === active) {
      return;
    }
    isFullscreen = active;

    if (documentObj) {
      const docFsEl = getDocumentFullscreenElement(documentObj);
      if (isFullscreen && !docFsEl) {
        requestElementFullscreen(pageEl || workbenchEl);
      } else if (!isFullscreen && docFsEl) {
        exitDocumentFullscreen(documentObj);
      }
    }

    updateUI();
  };

  const toggle = (force?: boolean): void => {
    const next = typeof force === "boolean" ? force : !isFullscreen;
    setState(next);
  };

  const onBtnClick = (e: Event): void => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    toggle();
  };

  const onKeyDown = (e: Event): void => {
    const ke = e as KeyboardEvent;
    if (ke?.key === "Escape" && isFullscreen && !ke?.defaultPrevented) {
      ke?.preventDefault?.();
      setState(false);
    }
  };

  const onFullscreenChange = (): void => {
    const docActive = Boolean(getDocumentFullscreenElement(documentObj));
    if (docActive !== isFullscreen) {
      setState(docActive);
    }
  };

  fullscreenBtn?.addEventListener?.("click", onBtnClick);
  windowObj?.addEventListener?.("keydown", onKeyDown);
  documentObj?.addEventListener?.("fullscreenchange", onFullscreenChange);
  documentObj?.addEventListener?.("webkitfullscreenchange", onFullscreenChange);

  updateUI();

  return {
    toggle,
    setState,
    isFullscreen: () => isFullscreen,
    dispose: () => {
      fullscreenBtn?.removeEventListener?.("click", onBtnClick);
      windowObj?.removeEventListener?.("keydown", onKeyDown);
      documentObj?.removeEventListener?.(
        "fullscreenchange",
        onFullscreenChange,
      );
      documentObj?.removeEventListener?.(
        "webkitfullscreenchange",
        onFullscreenChange,
      );

      if (documentObj) {
        const docFsEl = getDocumentFullscreenElement(documentObj);
        if (docFsEl && (docFsEl === pageEl || docFsEl === workbenchEl)) {
          exitDocumentFullscreen(documentObj);
        }
      }

      isFullscreen = false;
      applyHostPageTransform(false);
      workbenchEl?.classList?.remove?.(workbenchClass);
      pageEl?.classList?.remove?.(pageClass);
    },
  };
}
