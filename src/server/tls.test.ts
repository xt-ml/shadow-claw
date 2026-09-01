import { jest } from "@jest/globals";
import type { ServerConfig } from "./config.js";

describe("tls credentials", () => {
  let fsMock: any;
  let childProcessMock: any;
  let processMock: any;
  let osMock: any;
  let baseConfig: ServerConfig;

  beforeEach(() => {
    jest.resetModules();

    fsMock = {
      existsSync: jest.fn(),
      readFileSync: jest.fn(),
      mkdirSync: jest.fn(),
    };

    childProcessMock = {
      execFileSync: jest.fn(),
    };

    processMock = {
      exit: jest.fn(),
    };

    osMock = {
      networkInterfaces: jest.fn(() => ({
        eth0: [{ address: "192.168.1.50" }],
      })),
    };

    baseConfig = {
      port: 8888,
      bindHost: "127.0.0.1",
      corsMode: "localhost",
      allowedOrigins: new Set(),
      verbose: false,
      peerjs: false,
      rootPath: "/app/public",
      databaseDir: "/app/database",
      allowPrivateProxy: false,
      https: true,
      sslDir: "/app/.cache/tls",
    };

    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});

    jest.unstable_mockModule("node:fs", () => ({
      default: fsMock,
      ...fsMock,
    }));
    jest.unstable_mockModule("node:os", () => ({
      default: osMock,
      ...osMock,
    }));
    jest.unstable_mockModule("node:child_process", () => ({
      default: childProcessMock,
      ...childProcessMock,
    }));
    jest.unstable_mockModule("node:process", () => ({
      exit: processMock.exit,
      default: processMock,
    }));
  });

  it("reads explicit cert and key files when both are provided and exist", async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockImplementation((file: string) =>
      Buffer.from(`content of ${file}`),
    );

    const { ensureTlsCredentials } = await import("./tls.js");
    const credentials = ensureTlsCredentials({
      ...baseConfig,
      certPath: "/custom/cert.pem",
      keyPath: "/custom/key.pem",
    });

    expect(credentials.cert.toString()).toBe("content of /custom/cert.pem");
    expect(credentials.key.toString()).toBe("content of /custom/key.pem");
    expect(childProcessMock.execFileSync).not.toHaveBeenCalled();
  });

  it("exits when certPath is provided without keyPath", async () => {
    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials({
      ...baseConfig,
      certPath: "/custom/cert.pem",
      keyPath: undefined,
    });

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("provided without --key"),
    );
  });

  it("exits when keyPath is provided without certPath", async () => {
    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials({
      ...baseConfig,
      certPath: undefined,
      keyPath: "/custom/key.pem",
    });

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("provided without --cert"),
    );
  });

  it("exits when provided cert file does not exist", async () => {
    fsMock.existsSync.mockImplementation(
      (file: string) => file !== "/custom/cert.pem",
    );

    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials({
      ...baseConfig,
      certPath: "/custom/cert.pem",
      keyPath: "/custom/key.pem",
    });

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("TLS certificate not found"),
    );
  });

  it("exits when provided key file does not exist", async () => {
    fsMock.existsSync.mockImplementation(
      (file: string) => file !== "/custom/key.pem",
    );

    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials({
      ...baseConfig,
      certPath: "/custom/cert.pem",
      keyPath: "/custom/key.pem",
    });

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("TLS private key not found"),
    );
  });

  it("returns cached cert and key if already present in sslDir", async () => {
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readFileSync.mockImplementation((file: string) =>
      Buffer.from(`cached ${file}`),
    );

    const { ensureTlsCredentials } = await import("./tls.js");
    const credentials = ensureTlsCredentials(baseConfig);

    expect(credentials.cert.toString()).toBe("cached /app/.cache/tls/cert.pem");
    expect(credentials.key.toString()).toBe("cached /app/.cache/tls/key.pem");
    expect(childProcessMock.execFileSync).not.toHaveBeenCalled();
  });

  it("generates self-signed cert and key via openssl when not in sslDir", async () => {
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readFileSync.mockImplementation((file: string) =>
      Buffer.from(`generated ${file}`),
    );

    const { ensureTlsCredentials } = await import("./tls.js");
    const credentials = ensureTlsCredentials(baseConfig);

    expect(fsMock.mkdirSync).toHaveBeenCalledWith("/app/.cache/tls", {
      recursive: true,
    });
    expect(childProcessMock.execFileSync).toHaveBeenCalledWith(
      "openssl",
      expect.arrayContaining([
        "-addext",
        expect.stringMatching(/subjectAltName=.*IP:192\.168\.1\.50/),
      ]),
      { stdio: "pipe" },
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Generated self-signed TLS certificate"),
    );
    expect(credentials.cert.toString()).toBe(
      "generated /app/.cache/tls/cert.pem",
    );
    expect(credentials.key.toString()).toBe(
      "generated /app/.cache/tls/key.pem",
    );
  });

  it("resolves SAN entries including loopback, local interfaces, and bindHost", async () => {
    const { resolveSanList } = await import("./tls.js");
    const sans = resolveSanList("10.9.8.226");

    expect(sans).toContain("DNS:localhost");
    expect(sans).toContain("IP:127.0.0.1");
    expect(sans).toContain("IP:::1");
    expect(sans).toContain("IP:192.168.1.50");
    expect(sans).toContain("IP:10.9.8.226");
  });

  it("resolves DNS hostname for bindHost if bindHost is a domain", async () => {
    const { resolveSanList } = await import("./tls.js");
    const sans = resolveSanList("my-laptop.local");

    expect(sans).toContain("DNS:my-laptop.local");
  });

  it("falls back to standard openssl args when -addext fails", async () => {
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readFileSync.mockImplementation((file: string) =>
      Buffer.from(`generated ${file}`),
    );

    childProcessMock.execFileSync
      .mockImplementationOnce(() => {
        throw new Error("unknown option -addext");
      })
      .mockImplementationOnce(() => Buffer.from(""));

    const { ensureTlsCredentials } = await import("./tls.js");
    const credentials = ensureTlsCredentials(baseConfig);

    expect(childProcessMock.execFileSync).toHaveBeenCalledTimes(2);
    expect(credentials.cert.toString()).toBe(
      "generated /app/.cache/tls/cert.pem",
    );
  });

  it("handles ENOENT when OpenSSL binary is missing", async () => {
    fsMock.existsSync.mockReturnValue(false);
    const enoentError: any = new Error("spawnSync openssl ENOENT");
    enoentError.code = "ENOENT";
    childProcessMock.execFileSync.mockImplementation(() => {
      throw enoentError;
    });

    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials(baseConfig);

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("OpenSSL must be installed"),
    );
  });

  it("handles generic openssl execution error", async () => {
    fsMock.existsSync.mockReturnValue(false);
    childProcessMock.execFileSync.mockImplementation(() => {
      throw new Error("Command failed");
    });

    const { ensureTlsCredentials } = await import("./tls.js");
    ensureTlsCredentials(baseConfig);

    expect(processMock.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Error generating TLS certificate with OpenSSL"),
    );
  });
});
