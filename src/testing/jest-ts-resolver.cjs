/**
 * Custom Jest resolver that maps `.js` imports to `.ts` source files when the
 * `.js` file doesn't exist on disk but a same-named `.ts` file does.
 *
 * This supports TypeScript's recommended convention of writing:
 *   import { Foo } from "./foo.js"
 * while the actual file is `./foo.ts`.
 */
const fs = require("fs");
const path = require("path");

module.exports = function (request, options) {
  // Try the default resolution first
  try {
    return options.defaultResolver(request, options);
  } catch (_) {
    // If it failed and the request ends with .js, try .ts instead
    if (request.endsWith(".js")) {
      const tsRequest = request.slice(0, -3) + ".ts";
      try {
        return options.defaultResolver(tsRequest, options);
      } catch (_2) {
        // Fall through to re-throw the original error
      }
    }

    throw _;
  }
};
