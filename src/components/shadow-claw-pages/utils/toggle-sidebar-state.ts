export interface ToggleSidebarStateOptions {
  root: ShadowRoot | HTMLElement | null;
  currentOpen: boolean;
  force?: boolean;
}

/**
 * Updates DOM sidebar collapse classes and dropdown open attributes based on toggle state.
 * Returns the new sidebar open boolean.
 */
export function toggleSidebarState({
  root,
  currentOpen,
  force,
}: ToggleSidebarStateOptions): boolean {
  if (!root) {
    return currentOpen;
  }

  const dropdown = root.querySelector("[data-pages-dropdown]");
  const isDropdownOpen =
    dropdown instanceof HTMLDetailsElement && dropdown.open;

  let nextOpen: boolean;
  if (force !== undefined) {
    nextOpen = force;
  } else {
    nextOpen = !(isDropdownOpen || currentOpen);
  }

  const sidebar = root.querySelector(".pages__sidebar");
  const content = root.querySelector(".pages__content");

  if (sidebar) {
    sidebar.classList.toggle("collapsed", !nextOpen);
  }
  if (content) {
    content.classList.toggle("pages__content--sidebar-collapsed", !nextOpen);
  }

  if (dropdown instanceof HTMLDetailsElement) {
    if (nextOpen) {
      dropdown.setAttribute("open", "");
    } else {
      dropdown.removeAttribute("open");
    }
  }

  return nextOpen;
}
