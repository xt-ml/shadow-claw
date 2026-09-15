import { describe, expect, it, jest } from "@jest/globals";
import path from "node:path";

import { touchNoJekyll } from "./touch-nojekyll.js";

describe("touchNoJekyll", () => {
  it("writes empty .nojekyll file in target directory", async () => {
    const writeFileImpl = jest.fn<any>().mockResolvedValue(undefined);

    await touchNoJekyll("/custom/dist/public", { writeFileImpl });

    expect(writeFileImpl).toHaveBeenCalledWith(
      path.join("/custom/dist/public", ".nojekyll"),
      "",
      "utf-8",
    );
  });
});
