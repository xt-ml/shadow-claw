import { jest } from "@jest/globals";
import { TextDecoder } from "node:util";

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

const mockDecryptValue = jest.fn();
const mockEncryptValue = jest.fn();
const mockWriteFileHandle = jest.fn();

jest.unstable_mockModule("./crypto.js", () => ({
  decryptValue: mockDecryptValue,
  encryptValue: mockEncryptValue,
}));

jest.unstable_mockModule("./storage/writeFileHandle.js", () => ({
  writeFileHandle: mockWriteFileHandle,
}));

const {
  createSettingsBackupBlob,
  reapplyPlaintextPasswords,
  writeSettingsBackupToFileHandle,
} = await import("./settings-backup.js");

describe("settings-backup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("omits plaintext passwords and strips secret fields by default", async () => {
    const blob = await createSettingsBackupBlob(
      [
        { key: "storage_handle", value: { kind: "dir" } },
        { key: "git_password", value: "enc-git-password" },
        { key: "api_key", value: "enc-legacy-api-key" },
        { key: "api_key:openrouter", value: "enc-openrouter-key" },
        { key: "telegram_bot_token", value: "enc-telegram-token" },
        { key: "imessage_api_key", value: "enc-imessage-key" },
        {
          key: "git_accounts",
          value: [{ id: "git-1", username: "alice", password: "enc-a" }],
        },
        {
          key: "integration_connections",
          value: [
            {
              id: "int-1",
              credentialRef: { encryptedSecret: "enc-int", label: "mail" },
            },
          ],
        },
        {
          key: "remote_mcp_connections",
          value: [
            {
              id: "mcp-1",
              credentialRef: { encryptedValue: "enc-mcp", type: "header" },
            },
          ],
        },
        { key: "assistant_name", value: "k9" },
      ],
      false,
    );

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(reader.error || new Error("Failed to read blob"));
      reader.readAsText(blob);
    });
    const payload = JSON.parse(text);

    expect(payload.includePlaintextPasswords).toBe(false);
    expect(payload.plaintextPasswords).toBeUndefined();
    expect(payload.configEntries).toEqual([
      {
        key: "git_accounts",
        value: [{ id: "git-1", username: "alice" }],
      },
      {
        key: "integration_connections",
        value: [
          {
            id: "int-1",
            credentialRef: { label: "mail" },
          },
        ],
      },
      {
        key: "remote_mcp_connections",
        value: [
          {
            id: "mcp-1",
            credentialRef: { type: "header" },
          },
        ],
      },
      { key: "assistant_name", value: "k9" },
    ]);
    expect(mockDecryptValue).not.toHaveBeenCalled();
  });

  it("writes a plaintext backup directly to the selected file handle", async () => {
    mockDecryptValue.mockImplementation(
      async (value: any) => `plain:${String(value)}`,
    );
    const fileHandle = { name: "backup.json" } as any;

    await writeSettingsBackupToFileHandle(
      fileHandle,
      [
        { key: "git_password", value: "enc-git-password" },
        { key: "api_key:openrouter", value: "enc-openrouter-key" },
        { key: "telegram_bot_token", value: "enc-telegram-token" },
        { key: "imessage_api_key", value: "enc-imessage-key" },
        { key: "api_key", value: "enc-legacy-api-key" },
        {
          key: "git_accounts",
          value: [{ id: "git-1", password: "enc-a" }],
        },
      ],
      true,
    );

    expect(mockWriteFileHandle).toHaveBeenCalledTimes(1);
    expect(mockWriteFileHandle).toHaveBeenCalledWith(
      fileHandle,
      expect.any(String),
    );

    const payload = JSON.parse(String(mockWriteFileHandle.mock.calls[0][1]));
    expect(payload.includePlaintextPasswords).toBe(true);
    expect(payload.plaintextPasswords).toEqual([
      { key: "git_password", path: [], value: "plain:enc-git-password" },
      {
        key: "api_key:openrouter",
        path: [],
        value: "plain:enc-openrouter-key",
      },
      {
        key: "telegram_bot_token",
        path: [],
        value: "plain:enc-telegram-token",
      },
      { key: "imessage_api_key", path: [], value: "plain:enc-imessage-key" },
      { key: "api_key", path: [], value: "plain:enc-legacy-api-key" },
      { key: "git_accounts", path: [0, "password"], value: "plain:enc-a" },
    ]);
  });

  it("reapplies plaintext passwords by encrypting them during restore", async () => {
    mockEncryptValue.mockImplementation(
      async (value: any) => `enc:${String(value)}`,
    );

    const restored = await reapplyPlaintextPasswords(
      [
        { key: "assistant_name", value: "k9" },
        { key: "git_accounts", value: [{ id: "git-1" }] },
      ],
      [
        { key: "git_password", path: [], value: "plain-git-password" },
        { key: "api_key:openrouter", path: [], value: "plain-openrouter-key" },
        { key: "telegram_bot_token", path: [], value: "plain-telegram-token" },
        { key: "imessage_api_key", path: [], value: "plain-imessage-key" },
        { key: "api_key", path: [], value: "plain-legacy-api-key" },
        {
          key: "git_accounts",
          path: [0, "password"],
          value: "plain-account-password",
        },
      ],
    );

    expect(restored).toEqual([
      { key: "assistant_name", value: "k9" },
      {
        key: "git_accounts",
        value: [{ id: "git-1", password: "enc:plain-account-password" }],
      },
      { key: "git_password", value: "enc:plain-git-password" },
      { key: "api_key:openrouter", value: "enc:plain-openrouter-key" },
      { key: "telegram_bot_token", value: "enc:plain-telegram-token" },
      { key: "imessage_api_key", value: "enc:plain-imessage-key" },
      { key: "api_key", value: "enc:plain-legacy-api-key" },
    ]);
  });
});
