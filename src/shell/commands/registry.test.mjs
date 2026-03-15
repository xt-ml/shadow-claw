import { SUPPORTED_COMMANDS } from "../shell.mjs";
import { COMMAND_HANDLERS } from "./registry.mjs";

describe("shell command registry", () => {
  it("has handlers for every supported command", () => {
    for (const commandName of SUPPORTED_COMMANDS) {
      expect(COMMAND_HANDLERS).toHaveProperty(commandName);
      expect(typeof COMMAND_HANDLERS[commandName]).toBe("function");
    }
  });

  it("keeps alias handlers aligned", () => {
    expect(typeof COMMAND_HANDLERS.env).toBe("function");

    expect(typeof COMMAND_HANDLERS.printenv).toBe("function");

    expect(typeof COMMAND_HANDLERS.test).toBe("function");

    expect(typeof COMMAND_HANDLERS["["]).toBe("function");

    expect(COMMAND_HANDLERS.md5sum).toBeDefined();

    expect(COMMAND_HANDLERS.sha1sum).toBeDefined();

    expect(COMMAND_HANDLERS.sha256sum).toBeDefined();

    expect(COMMAND_HANDLERS.sha384sum).toBeDefined();

    expect(COMMAND_HANDLERS.sha512sum).toBeDefined();

    expect(typeof COMMAND_HANDLERS.which).toBe("function");

    expect(typeof COMMAND_HANDLERS.command).toBe("function");
  });
});
