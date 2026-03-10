describe("types module", () => {
  it("imports without runtime side effects", async () => {
    await expect(import("./types.mjs")).resolves.toBeDefined();
  });
});
