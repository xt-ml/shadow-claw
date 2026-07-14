export function supportsNavigationApi(): boolean {
  const nav = (window as any).navigation;

  return !!(
    nav &&
    typeof nav.addEventListener === "function" &&
    typeof nav.navigate === "function"
  );
}
