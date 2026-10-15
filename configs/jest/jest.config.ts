import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

const coveragePathIgnorePatterns = [
  "/node_modules/",
  "/dist/",
  "/src/shell/__fixtures__/",
  "/src/__mocks__/",
];

export default {
  rootDir: projectRoot,
  silent: true,
  workerIdleMemoryLimit: "512MB",
  extensionsToTreatAsEsm: [".ts"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  coveragePathIgnorePatterns,
  projects: [
    {
      displayName: "src",
      rootDir: projectRoot,
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/configs/jest/jest-setup.ts"],
      roots: ["<rootDir>/src", "<rootDir>/electron"],
      resolver: "<rootDir>/configs/jest/jest-ts-resolver.cjs",
      coveragePathIgnorePatterns,
      transform: {
        "^.+\\.ts$": "<rootDir>/configs/jest/jest-ts-transform.cjs",
        // Support import attributes for CSS and HTML
        "\\.css$": "<rootDir>/configs/jest/jest-css-mock.cjs",
        "\\.html$": "<rootDir>/configs/jest/jest-html-mock.cjs",
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
      },
      testPathIgnorePatterns: [
        "/dist/",
        "/e2e/",
        "/bin/",
        "/cli/",
        "/server/",
        "/notifications/",
      ],
    },
    {
      displayName: "server",
      rootDir: projectRoot,
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/configs/jest/jest-setup.ts"],
      roots: ["<rootDir>/src/server"],
      resolver: "<rootDir>/configs/jest/jest-ts-resolver.cjs",
      coveragePathIgnorePatterns,
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/configs/jest/jest-ts-transform.cjs",
      },
    },
    {
      displayName: "notifications",
      rootDir: projectRoot,
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/configs/jest/jest-setup.ts"],
      roots: ["<rootDir>/src"],
      resolver: "<rootDir>/configs/jest/jest-ts-resolver.cjs",
      coveragePathIgnorePatterns,
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/configs/jest/jest-ts-transform.cjs",
      },
      testMatch: [
        "<rootDir>/src/subsystems/notifications/push-store.test.ts",
        "<rootDir>/src/subsystems/notifications/push-routes.test.ts",
        "<rootDir>/src/subsystems/notifications/push-client.test.ts",
      ],
    },
    {
      displayName: "task-schedule",
      rootDir: projectRoot,
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/configs/jest/jest-setup.ts"],
      roots: ["<rootDir>/src"],
      resolver: "<rootDir>/configs/jest/jest-ts-resolver.cjs",
      coveragePathIgnorePatterns,
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/configs/jest/jest-ts-transform.cjs",
      },
      testMatch: [
        "<rootDir>/src/subsystems/notifications/task-schedule-store.test.ts",
        "<rootDir>/src/subsystems/notifications/task-schedule-routes.test.ts",
        "<rootDir>/src/subsystems/notifications/task-scheduler-server.test.ts",
      ],
    },
    {
      displayName: "cli",
      rootDir: projectRoot,
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/configs/jest/jest-setup.ts"],
      roots: ["<rootDir>/src/cli", "<rootDir>/bin"],
      resolver: "<rootDir>/configs/jest/jest-ts-resolver.cjs",
      coveragePathIgnorePatterns,
      extensionsToTreatAsEsm: [".ts"],
      transform: {
        "^.+\\.ts$": "<rootDir>/configs/jest/jest-ts-transform.cjs",
      },
      testMatch: ["<rootDir>/src/cli/**/*.test.ts"],
    },
  ],
};
