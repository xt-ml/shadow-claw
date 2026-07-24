import { jest } from "@jest/globals";

import { CONFIG_KEYS } from "../../../config/config.js";

describe("persistSidebarWidth", () => {
  let db: any;
  let mockSetConfig: any;
  let persistSidebarWidth: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = {};
    mockSetConfig = jest.fn();

    jest.unstable_mockModule("../../../db/setConfig.js", () => ({
      setConfig: mockSetConfig,
    }));

    const module = await import("./persistSidebarWidth.js");
    persistSidebarWidth = module.persistSidebarWidth;
  });

  afterEach(() => {
    jest.resetModules();
  });

  it("should return early if db is not provided", async () => {
    await persistSidebarWidth(null, 300);
    expect(mockSetConfig).not.toHaveBeenCalled();
  });

  it("should call setConfig with the provided width", async () => {
    mockSetConfig.mockResolvedValue(undefined);
    await persistSidebarWidth(db, 300);
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      CONFIG_KEYS.SIDEBAR_WIDTH,
      300,
    );
  });

  it("should ignore persistence failures and not throw", async () => {
    mockSetConfig.mockRejectedValue(new Error("DB failed"));
    await expect(persistSidebarWidth(db, 300)).resolves.not.toThrow();
    expect(mockSetConfig).toHaveBeenCalledWith(
      db,
      CONFIG_KEYS.SIDEBAR_WIDTH,
      300,
    );
  });
});
