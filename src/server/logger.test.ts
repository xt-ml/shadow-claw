import { jest } from "@jest/globals";
import { createLogger } from "./logger.js";

describe("createLogger", () => {
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("logs DEFAULT level messages in non-verbose mode", () => {
    const logger = createLogger(false);
    logger.log("DEFAULT", "standard log");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[LOG]"),
      "standard log",
    );

    logger.log("VERBOSE", "hidden log");
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("logs VERBOSE level messages when verbose is true", () => {
    const logger = createLogger(true);
    logger.log("VERBOSE", "verbose log");
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[VERBOSE]"),
      "verbose log",
    );
  });

  it("logs errors in DEFAULT and VERBOSE levels", () => {
    const logger = createLogger(false);
    logger.error("DEFAULT", "standard error");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR]"),
      "standard error",
    );

    logger.error("VERBOSE", "hidden error");
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const verboseLogger = createLogger(true);
    verboseLogger.error("VERBOSE", "verbose error");
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[VERBOSE ERROR]"),
      "verbose error",
    );
  });
});
