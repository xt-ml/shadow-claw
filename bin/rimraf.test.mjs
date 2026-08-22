import { describe, expect, it, jest } from "@jest/globals";

import { rimraf } from "./rimraf.mjs";

describe("rimraf", () => {
  it("removes a path recursively and reports success", async () => {
    const rmImpl = jest.fn().mockResolvedValue(undefined);
    const logImpl = jest.fn();

    await rimraf("dist/example", { rmImpl, logImpl });

    expect(rmImpl).toHaveBeenCalledWith("dist/example", {
      recursive: true,
      force: true,
    });
    expect(logImpl).toHaveBeenCalledWith("Successfully deleted: dist/example");
  });

  it("reports deletion errors without throwing", async () => {
    const error = new Error("permission denied");
    const rmImpl = jest.fn().mockRejectedValue(error);
    const errorImpl = jest.fn();

    await expect(
      rimraf("protected", { rmImpl, errorImpl }),
    ).resolves.toBeUndefined();

    expect(errorImpl).toHaveBeenCalledWith(
      "Error while deleting protected:",
      "permission denied",
    );
  });
});
