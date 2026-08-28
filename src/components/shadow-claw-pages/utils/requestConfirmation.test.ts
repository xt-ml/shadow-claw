import { describe, it, expect, jest } from "@jest/globals";
import { requestConfirmation } from "./requestConfirmation.js";

describe("requestConfirmation", () => {
  const options = { title: "Confirm Delete", message: "Are you sure?" };

  it("delegates requestDialog to app shell when available", async () => {
    const mockShell = {
      requestDialog: jest
        .fn<(opts: any) => Promise<boolean>>()
        .mockResolvedValue(true),
    };

    const result = await requestConfirmation(options, mockShell);

    expect(mockShell.requestDialog).toHaveBeenCalledWith({
      mode: "confirm",
      ...options,
    });
    expect(result).toBe(true);
  });

  it("calls showWarning fallback when app shell is missing or invalid", async () => {
    const mockShowWarning = jest
      .fn<(message: string, duration?: number) => number>()
      .mockReturnValue(1);

    const result = await requestConfirmation(
      options,
      null,
      mockShowWarning as any,
    );

    expect(mockShowWarning).toHaveBeenCalledWith("Are you sure?", 4500);
    expect(result).toBe(false);
  });
});
