import { jest } from "@jest/globals";

describe("config", () => {
  let processMock: any;
  let fsMock: any;
  let commanderMock: any;

  beforeEach(async () => {
    jest.resetModules();

    processMock = {
      env: {},
      exit: jest.fn(),
      cwd: jest.fn(() => "/cwd"),
    };

    fsMock = {
      existsSync: jest.fn(() => false),
    };

    const programMock = {
      name: jest.fn().mockReturnThis(),
      description: jest.fn().mockReturnThis(),
      argument: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      parse: jest.fn().mockReturnThis(),
      opts: jest.fn(() => ({
        verbose: false,
        corsMode: "localhost",
        corsAllowOrigin: [],
      })),
      args: [],
    };

    commanderMock = { Command: jest.fn(() => programMock) };

    jest.unstable_mockModule("node:process", () => ({
      env: processMock.env,
      exit: processMock.exit,
      default: processMock,
    }));
    jest.unstable_mockModule("node:fs", () => ({
      default: fsMock,
      ...fsMock,
    }));
    jest.unstable_mockModule("commander", () => commanderMock);
  });

  it("returns default configuration", async () => {
    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.port).toBe(8888);
    expect(config.bindHost).toBe("127.0.0.1");
    expect(config.corsMode).toBe("localhost");
  });

  it("parses port from arguments", async () => {
    commanderMock.Command().args = ["9999"];
    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.port).toBe(9999);
  });

  it("validates port range", async () => {
    commanderMock.Command().args = ["80"];
    const { parseConfig } = await import("./config.js");

    // Silence console.error for tests
    jest.spyOn(console, "error").mockImplementation(() => {});

    parseConfig();
    expect(processMock.exit).toHaveBeenCalledWith(1);
  });

  it("parses options from CLI", async () => {
    commanderMock.Command().opts.mockReturnValue({
      verbose: true,
      host: "0.0.0.0",
      corsMode: "all",
      corsAllowOrigin: ["http://example.com"],
    });

    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.verbose).toBe(true);
    expect(config.bindHost).toBe("0.0.0.0");
    expect(config.corsMode).toBe("all");
    expect(config.allowedOrigins.has("http://example.com")).toBe(true);
  });

  it("uses environment variables for database directory", async () => {
    processMock.env.SHADOWCLAW_DATABASE_DIR = "custom-db";
    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    const expected = (await import("node:path")).default.resolve(
      config.rootPath,
      "..",
      "custom-db",
    );
    expect(config.databaseDir).toBe(expected);
  });

  it("detects dist root path if public folder exists", async () => {
    fsMock.existsSync.mockReturnValue(true);
    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.rootPath).toContain("public");
  });

  it("defaults https to false and provides default sslDir", async () => {
    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.https).toBe(false);
    expect(config.certPath).toBeUndefined();
    expect(config.keyPath).toBeUndefined();
    expect(config.sslDir).toContain(".cache/tls");
  });

  it("parses HTTPS options from CLI flags", async () => {
    commanderMock.Command().opts.mockReturnValue({
      https: true,
      cert: "/custom/cert.pem",
      key: "/custom/key.pem",
      sslDir: "/custom/ssl",
      corsAllowOrigin: [],
    });

    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.https).toBe(true);
    expect(config.certPath).toBe("/custom/cert.pem");
    expect(config.keyPath).toBe("/custom/key.pem");
    expect(config.sslDir).toBe("/custom/ssl");
  });

  it("parses HTTPS options from environment variables", async () => {
    processMock.env.SHADOWCLAW_HTTPS = "1";
    processMock.env.SHADOWCLAW_TLS_CERT = "/env/cert.pem";
    processMock.env.SHADOWCLAW_TLS_KEY = "/env/key.pem";
    processMock.env.SHADOWCLAW_SSL_DIR = "env-ssl";

    const { parseConfig } = await import("./config.js");
    const config = parseConfig();

    expect(config.https).toBe(true);
    expect(config.certPath).toBe("/env/cert.pem");
    expect(config.keyPath).toBe("/env/key.pem");
    expect(config.sslDir).toBe(
      (await import("node:path")).default.resolve(
        config.rootPath,
        "..",
        "env-ssl",
      ),
    );
  });
});
