export function trimSlashes(input: string): string {
  return input.replace(/^\/+|\/+$/g, "");
}
