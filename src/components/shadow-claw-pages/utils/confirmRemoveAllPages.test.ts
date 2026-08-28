import { jest } from "@jest/globals";
import { confirmRemoveAllPages } from "./confirmRemoveAllPages.js";
import type { ShadowClawDatabase } from "../../../db/types.js";

describe("confirmRemoveAllPages", () => {
  const mockDb = {} as ShadowClawDatabase;

  it("does nothing if confirmation is rejected", async () => {
    const mockRequestConfirmation = jest
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(false);
    const mockRemoveAll = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    await confirmRemoveAllPages(mockDb, mockRequestConfirmation, mockRemoveAll);

    expect(mockRequestConfirmation).toHaveBeenCalledWith({
      title: "Remove All Pages",
      message: "Remove ALL saved pages from Pages? This cannot be undone!",
      confirmLabel: "Remove All",
      cancelLabel: "Cancel",
    });
    expect(mockRemoveAll).not.toHaveBeenCalled();
  });

  it("executes removeAll callback when confirmed", async () => {
    const mockRequestConfirmation = jest
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true);
    const mockRemoveAll = jest
      .fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    await confirmRemoveAllPages(mockDb, mockRequestConfirmation, mockRemoveAll);

    expect(mockRemoveAll).toHaveBeenCalledWith(mockDb);
  });
});
