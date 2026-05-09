import { jest } from "@jest/globals";

describe("app", () => {
  let expressMock: any;
  let appMock: any;
  let fsMock: any;
  let config: any;

  beforeEach(async () => {
    jest.resetModules();

    appMock = {
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    };
    expressMock = jest.fn(() => appMock);
    expressMock.json = jest.fn(() => () => {});

    fsMock = {
      existsSync: jest.fn(() => true),
      mkdirSync: jest.fn(),
    };

    config = {
      verbose: false,
      databaseDir: "/db",
      rootPath: "/root",
      allowedOrigins: ["*"],
    };

    jest.unstable_mockModule("express", () => ({ default: expressMock }));
    jest.unstable_mockModule("node:fs", () => ({ default: fsMock }));
    jest.unstable_mockModule("compression", () => ({
      default: jest.fn(() => () => {}),
    }));

    // Mock all the route/middleware registers
    jest.unstable_mockModule("./proxy.js", () => ({
      registerProxyRoutes: jest.fn(),
    }));
    jest.unstable_mockModule("./routes/oauth.js", () => ({
      registerOAuthRoutes: jest.fn(),
    }));
    jest.unstable_mockModule("../notifications/push-store.js", () => ({
      openPushStore: jest.fn(),
    }));
    jest.unstable_mockModule("../notifications/push-routes.js", () => ({
      registerPushRoutes: jest.fn(),
      broadcastPush: jest.fn(),
    }));
    jest.unstable_mockModule("../notifications/task-schedule-store.js", () => ({
      openTaskScheduleStore: jest.fn(),
      getEnabledScheduledTasks: jest.fn(),
      updateScheduledTaskLastRun: jest.fn(),
    }));
    jest.unstable_mockModule(
      "../notifications/task-schedule-routes.js",
      () => ({ registerTaskScheduleRoutes: jest.fn() }),
    );
    jest.unstable_mockModule(
      "../notifications/task-scheduler-server.js",
      () => ({
        ServerTaskScheduler: jest.fn().mockImplementation(() => ({})),
      }),
    );
    jest.unstable_mockModule("./logger.js", () => ({
      createLogger: jest.fn(() => ({ log: jest.fn() })),
    }));
    jest.unstable_mockModule("./middleware/request-logger.js", () => ({
      createRequestLoggerMiddleware: jest.fn(() => () => {}),
    }));
    jest.unstable_mockModule("./middleware/pna.js", () => ({
      createPnaMiddleware: jest.fn(() => () => {}),
    }));
    jest.unstable_mockModule("./middleware/cors.js", () => ({
      createCorsMiddleware: jest.fn(() => () => {}),
    }));
    jest.unstable_mockModule("./middleware/static-files.js", () => ({
      registerStaticFilesMiddleware: jest.fn(),
    }));
  });

  it("creates the app and initializes all components", async () => {
    const { createApp } = await import("./app.js");
    const { registerProxyRoutes } = await import("./proxy.js");
    const { registerOAuthRoutes } = await import("./routes/oauth.js");
    const { openPushStore } = await import("../notifications/push-store.js");
    const { registerStaticFilesMiddleware } =
      await import("./middleware/static-files.js");

    const result = createApp(config);

    expect(result.app).toBe(appMock);
    expect(result.scheduler).toBeDefined();

    expect(registerProxyRoutes).toHaveBeenCalledWith(appMock, {
      verbose: false,
    });
    expect(registerOAuthRoutes).toHaveBeenCalledWith(appMock);
    expect(openPushStore).toHaveBeenCalledWith(
      expect.stringContaining("push-subscriptions.db"),
    );
    expect(registerStaticFilesMiddleware).toHaveBeenCalledWith(
      appMock,
      config.rootPath,
    );
  });

  it("creates the database directory if it doesn't exist", async () => {
    fsMock.existsSync.mockReturnValue(false);
    const { createApp } = await import("./app.js");

    createApp(config);

    expect(fsMock.mkdirSync).toHaveBeenCalledWith(config.databaseDir, {
      recursive: true,
    });
  });
});
