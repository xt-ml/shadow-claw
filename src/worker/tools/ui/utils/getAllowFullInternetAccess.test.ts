import { jest } from "@jest/globals";

jest.unstable_mockModule("../../../../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

const { getAllowFullInternetAccess } =
  await import("./getAllowFullInternetAccess.js");
const { getConfig } = await import("../../../../db/getConfig.js");

describe("getAllowFullInternetAccess", () => {
  const mockDb: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true when config is 'true'", async () => {
    (getConfig as jest.Mock<any>).mockResolvedValue("true");
    const result = await getAllowFullInternetAccess(mockDb);
    expect(result).toBe(true);
  });

  it("returns false when config is false or missing", async () => {
    (getConfig as jest.Mock<any>).mockResolvedValue("false");
    expect(await getAllowFullInternetAccess(mockDb)).toBe(false);

    (getConfig as jest.Mock<any>).mockResolvedValue(null);
    expect(await getAllowFullInternetAccess(mockDb)).toBe(false);
  });
});
