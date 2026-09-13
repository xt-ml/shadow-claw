/**
 * Lightweight ESM loader hook to resolve `.js` specifiers and extensionless
 * imports to `.ts` source files when running directly with Node in development.
 */

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      specifier.startsWith("./") ||
      specifier.startsWith("../") ||
      specifier.startsWith("file://") ||
      specifier.startsWith("/")
    ) {
      if (specifier.endsWith(".js")) {
        try {
          return await nextResolve(specifier.slice(0, -3) + ".ts", context);
        } catch {}
      } else {
        try {
          return await nextResolve(specifier + ".ts", context);
        } catch {}
        try {
          return await nextResolve(specifier + ".js", context);
        } catch {}
        try {
          return await nextResolve(specifier + "/index.ts", context);
        } catch {}
      }
    }
    throw err;
  }
}
