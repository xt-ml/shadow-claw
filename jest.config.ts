export default {
  extensionsToTreatAsEsm: [".ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  projects: [
    {
      displayName: "src",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/src/testing/jest-setup.ts"],
      roots: ["<rootDir>/src", "<rootDir>/electron"],
      resolver: "<rootDir>/jest-ts-resolver.cjs",
      transform: {
        "^.+\\.ts$": "<rootDir>/jest-ts-transform.cjs",
      },
      extensionsToTreatAsEsm: [".ts"],
      moduleNameMapper: {
        // Signal Polyfill
        "^signal-polyfill$": "<rootDir>/src/__mocks__/signal-polyfill.cjs",
        // Bare specifiers (used by other modules or older patterns)
        "^zip$": "<rootDir>/src/__mocks__/zip.cjs",
        "^jszip$": "<rootDir>/src/__mocks__/jszip.cjs",
        "^dompurify$": "<rootDir>/src/__mocks__/dompurify.cjs",
        "^marked$": "<rootDir>/src/__mocks__/marked.cjs",
        "^highlight\\.js$": "<rootDir>/src/__mocks__/highlightjs.cjs",
        "^pdfjs-dist$": "<rootDir>/src/__mocks__/pdfjs-dist.cjs",
        "^just-bash$": "<rootDir>/src/__mocks__/just-bash.cjs",
        "^node:sqlite$":
          "<rootDir>/src/subsystems/notifications/__mocks__/node-sqlite.cjs",
      },
      testPathIgnorePatterns: [
        "/dist/",
        "/e2e/",
        "/bin/",
        "/server/",
        "/notifications/",
      ],
    },
    {
      displayName: "server",
      testEnvironment: "node",
      roots: ["<rootDir>/src/server"],
      resolver: "<rootDir>/jest-ts-resolver.cjs",
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/jest-ts-transform.cjs",
      },
    },
    {
      displayName: "notifications",
      testEnvironment: "node",
      roots: ["<rootDir>/src"],
      resolver: "<rootDir>/jest-ts-resolver.cjs",
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/jest-ts-transform.cjs",
      },
      testMatch: [
        "<rootDir>/src/subsystems/notifications/push-store.test.ts",
        "<rootDir>/src/subsystems/notifications/push-routes.test.ts",
        "<rootDir>/src/subsystems/notifications/push-client.test.ts",
      ],
      moduleNameMapper: {
        "^node:sqlite$":
          "<rootDir>/src/subsystems/notifications/__mocks__/node-sqlite.cjs",
      },
    },
    {
      displayName: "task-schedule",
      testEnvironment: "node",
      roots: ["<rootDir>/src"],
      resolver: "<rootDir>/jest-ts-resolver.cjs",
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/jest-ts-transform.cjs",
      },
      testMatch: [
        "<rootDir>/src/subsystems/notifications/task-schedule-store.test.ts",
        "<rootDir>/src/subsystems/notifications/task-schedule-routes.test.ts",
        "<rootDir>/src/subsystems/notifications/task-scheduler-server.test.ts",
      ],
      moduleNameMapper: {
        "^node:sqlite$":
          "<rootDir>/src/subsystems/notifications/__mocks__/node-sqlite.cjs",
      },
    },
    {
      displayName: "bin",
      testEnvironment: "node",
      roots: ["<rootDir>/bin"],
      resolver: "<rootDir>/jest-ts-resolver.cjs",
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/jest-ts-transform.cjs",
      },
      testMatch: ["<rootDir>/bin/**/*.test.mjs"],
    },
  ],
};
