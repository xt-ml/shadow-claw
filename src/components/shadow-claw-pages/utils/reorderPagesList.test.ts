import { reorderPagesList } from "./reorderPagesList.js";

describe("reorderPagesList", () => {
  const items = ["A", "B", "C", "D"];

  it("reorders element from fromIndex to toIndex", () => {
    expect(reorderPagesList(items, 0, 2)).toEqual(["B", "C", "A", "D"]);
    expect(reorderPagesList(items, 3, 1)).toEqual(["A", "D", "B", "C"]);
  });

  it("returns original copy when indices are out of bounds or identical", () => {
    expect(reorderPagesList(items, 1, 1)).toEqual(items);
    expect(reorderPagesList(items, -1, 2)).toEqual(items);
    expect(reorderPagesList(items, 0, 5)).toEqual(items);
  });
});
