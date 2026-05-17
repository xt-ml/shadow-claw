import { jest } from "@jest/globals";

const mockExec = jest.fn(async () => ({
  stdout: "ok",
  stderr: "",
  exitCode: 0,
}));
const mockBashCtor = jest.fn((_: unknown) => ({ exec: mockExec }));
const mockCreateFileSystem = jest.fn(async () => ({}));

jest.unstable_mockModule("just-bash", () => ({
  Bash: mockBashCtor,
}));

jest.unstable_mockModule("./fs.js", () => ({
  createFileSystem: mockCreateFileSystem,
}));

const { executeShell } = await import("./shell.js");

describe("executeShell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("enables full internet access when flag is true", async () => {
    await executeShell(
      {} as any,
      "curl https://example.com",
      "group1",
      {},
      30,
      true,
    );

    expect(mockBashCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        network: {
          dangerouslyAllowFullInternetAccess: true,
          denyPrivateRanges: false,
        },
      }),
    );
  });

  it("disables full internet access when flag is false", async () => {
    await executeShell(
      {} as any,
      "curl https://example.com",
      "group1",
      {},
      30,
      false,
    );

    expect(mockBashCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        network: {
          dangerouslyAllowFullInternetAccess: false,
          denyPrivateRanges: true,
        },
      }),
    );
  });
});
