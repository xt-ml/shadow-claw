import { jest } from "@jest/globals";
import { webcrypto } from "node:crypto";
import { TextEncoder } from "util";

export const safeRead = jest.fn();

global.TextEncoder = TextEncoder;

jest.unstable_mockModule("../safeRead.mjs", () => ({
  safeRead,
}));

const originalCrypto = globalThis.crypto;

export function baseCtx(cwd = ".", pwd = "/workspace") {
  return {
    groupId: "g1",
    cwd,
    env: { PWD: pwd },
  };
}

export function ok(stdout) {
  return { stdout, stderr: "", exitCode: 0 };
}

export function fail(stderr, code = 1) {
  return { stdout: "", stderr, exitCode: code };
}

export function setWebCrypto() {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}

export function setCrypto(value) {
  Object.defineProperty(globalThis, "crypto", {
    value,
    configurable: true,
    writable: true,
  });
}

export function restoreCrypto() {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
}
