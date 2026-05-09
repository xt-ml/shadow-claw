export type LogLevel = "DEFAULT" | "VERBOSE";

export interface Logger {
  log(level: LogLevel, ...messages: any[]): void;
  error(level: LogLevel, ...messages: any[]): void;
}

export function createLogger(verbose: boolean): Logger {
  return {
    log: (level: LogLevel, ...messages: any[]) => {
      if (level === "DEFAULT" || verbose) {
        const timestamp = new Date().toISOString();
        const prefix = level === "VERBOSE" ? "[VERBOSE]" : "[LOG]";
        console.log(`[${timestamp}] ${prefix}`, ...messages);
      }
    },
    error: (level: LogLevel, ...messages: any[]) => {
      if (level === "DEFAULT" || verbose) {
        const timestamp = new Date().toISOString();
        const prefix = level === "VERBOSE" ? "[VERBOSE ERROR]" : "[ERROR]";
        console.error(`[${timestamp}] ${prefix}`, ...messages);
      }
    },
  };
}
