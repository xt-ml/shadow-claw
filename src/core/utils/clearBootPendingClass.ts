import {
  BOOT_PENDING_ATTR,
  BOOT_PENDING_CLASS,
  HYDRATION_PENDING_ATTR,
} from "../index.js";

export function clearBootPendingClass(doc: Document): void {
  if (typeof doc === "undefined") {
    return;
  }

  doc.documentElement.classList.remove(BOOT_PENDING_CLASS);
  const host = doc.querySelector("shadow-claw");
  host?.removeAttribute(BOOT_PENDING_ATTR);
  host?.removeAttribute(HYDRATION_PENDING_ATTR);
}
