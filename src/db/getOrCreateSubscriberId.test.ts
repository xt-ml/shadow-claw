import { jest } from "@jest/globals";

const mockGetConfig = jest.fn() as any;
const mockSetConfig = jest.fn() as any;

jest.unstable_mockModule("./getConfig.js", () => ({
  getConfig: mockGetConfig,
}));

jest.unstable_mockModule("./setConfig.js", () => ({
  setConfig: mockSetConfig,
}));

const { getOrCreateSubscriberId } =
  await import("./getOrCreateSubscriberId.js");

describe("getOrCreateSubscriberId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns existing subscriber ID from config", async () => {
    mockGetConfig.mockResolvedValue("sub-existing");

    await expect(getOrCreateSubscriberId({} as any)).resolves.toBe(
      "sub-existing",
    );

    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("creates and stores a new subscriber ID when missing", async () => {
    mockGetConfig.mockResolvedValue(undefined);

    const id = await getOrCreateSubscriberId({} as any);

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(mockSetConfig).toHaveBeenCalledWith({} as any, "subscriber_id", id);
  });
});
