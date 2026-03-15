import { jest } from "@jest/globals";
import { TextDecoder, TextEncoder } from "util";

jest.unstable_mockModule("../../storage/deleteGroupDirectory.mjs", () => ({
  deleteGroupDirectory: jest.fn(),
}));

jest.unstable_mockModule("../../storage/deleteGroupFile.mjs", () => ({
  deleteGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../storage/listGroupFiles.mjs", () => ({
  listGroupFiles: jest.fn(),
}));

jest.unstable_mockModule("../../storage/writeGroupFile.mjs", () => ({
  writeGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../safeRead.mjs", () => ({ safeRead: jest.fn() }));

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.crypto = {
  subtle: {
    digest: jest.fn().mockImplementation(async (algo) => {
      return new Uint8Array(algo === "SHA-256" ? 32 : 20).buffer;
    }),
  },
};

export async function loadDispatchHarness() {
  jest.resetModules();

  const safeRead = (await import("../safeRead.mjs")).safeRead;
  const listGroupFiles = (await import("../../storage/listGroupFiles.mjs"))
    .listGroupFiles;
  const writeGroupFile = (await import("../../storage/writeGroupFile.mjs"))
    .writeGroupFile;
  const deleteGroupFile = (await import("../../storage/deleteGroupFile.mjs"))
    .deleteGroupFile;

  const deleteGroupDirectory = (
    await import("../../storage/deleteGroupDirectory.mjs")
  ).deleteGroupDirectory;

  const dispatch = (await import("../dispatch.mjs")).dispatch;

  return {
    dispatch,
    safeRead,
    listGroupFiles,
    writeGroupFile,
    deleteGroupFile,
    deleteGroupDirectory,
  };
}

export function createDb() {
  return {};
}

export function createCtx() {
  return {
    groupId: "test-group",
    cwd: ".",
    env: { PWD: "/workspace" },
  };
}
