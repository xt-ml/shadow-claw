import process from "node:process";

/**
 * Suppress Node.js ExperimentalWarnings (e.g. SQLite is an experimental feature)
 * in CLI processes so interactive command-line usage stays clean and quiet.
 */
export function suppressExperimentalWarnings(): void {
  const originalEmitWarning = process.emitWarning;
  if (!originalEmitWarning || (originalEmitWarning as any).__suppressed) {
    return;
  }

  const patched = function (
    this: typeof process,
    warning: any,
    ...args: any[]
  ): void {
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
    return (originalEmitWarning as Function).call(process, warning, ...args);
  };

  (patched as any).__suppressed = true;
  process.emitWarning = patched as any;
}

// Auto-suppress upon import
suppressExperimentalWarnings();
