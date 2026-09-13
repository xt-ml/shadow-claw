import process from "node:process";

/**
 * Suppress Node.js ExperimentalWarnings (e.g. SQLite is an experimental feature)
 * in CLI processes so interactive command-line usage stays clean and quiet.
 */
export function suppressExperimentalWarnings() {
  const originalEmitWarning = process.emitWarning;
  if (!originalEmitWarning || originalEmitWarning.__suppressed) {
    return;
  }

  const patched = function (warning, ...args) {
    if (
      typeof warning === "string" &&
      (args[0] === "ExperimentalWarning" ||
        warning.includes("ExperimentalWarning") ||
        warning.includes("SQLite"))
    ) {
      return;
    }
    if (
      warning &&
      typeof warning === "object" &&
      (warning.name === "ExperimentalWarning" ||
        (typeof warning.message === "string" &&
          warning.message.includes("SQLite")))
    ) {
      return;
    }
    return originalEmitWarning.call(process, warning, ...args);
  };

  patched.__suppressed = true;
  process.emitWarning = patched;
}

// Auto-suppress upon import
suppressExperimentalWarnings();
