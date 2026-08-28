/**
 * Evaluates whether window focus requires re-rendering selected page.
 */
export function handleWindowFocusEvent(
  isHidden: boolean,
  isConnected: boolean,
): boolean {
  return !isHidden && isConnected;
}
